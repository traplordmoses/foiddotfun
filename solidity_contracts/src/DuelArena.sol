// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FoidTrest} from "./FoidTrest.sol";

/// @title DuelArena
/// @notice Path 2: Bracket/duel-style meme competition.
///         Users submit memes → memes get matched into 1v1 duels → community votes →
///         winners get free placement on FoidTrest.
// Future: prediction market layer (DuelBetting) — not included in v1
contract DuelArena {
    struct Submission {
        uint256 id;
        address creator;
        string ipfsCid;
        uint64 submittedAt;
        bool matched;
    }

    struct Duel {
        uint256 id;
        uint256 submissionA;
        uint256 submissionB;
        uint64 votingStartsAt;
        uint64 votingEndsAt;
        uint8 winner;            // 0 = undecided, 1 = A, 2 = B
        uint256 totalVotesA;     // weighted votes for side A
        uint256 totalVotesB;     // weighted votes for side B
        uint256 trestEntryId;    // FoidTrest entry ID for the winner (0 until canonized)
        bool finalized;
    }

    event Submitted(uint256 indexed submissionId, address indexed creator, string ipfsCid);
    event DuelCreated(uint256 indexed duelId, uint256 submissionA, uint256 submissionB);
    event DuelVoteCast(uint256 indexed duelId, address indexed voter, uint8 side, uint256 weight);
    event DuelFinalized(uint256 indexed duelId, uint8 winner, uint256 trestEntryId);
    event OperatorChanged(address indexed oldOp, address indexed newOp);
    event OwnerChanged(address indexed oldOwner, address indexed newOwner);
    event VotingWindowChanged(uint32 oldWindow, uint32 newWindow);

    address public owner;
    address public operator;          // can match duels and finalize
    FoidTrest public immutable foidTrest;
    address public mifoidNFT;         // for incrementing duel wins

    uint32 public votingWindowSeconds;
    uint256 public submissionFee;     // optional anti-spam fee

    uint256 public submissionCount;
    uint256 public duelCount;
    uint256 public unmatchedCount;

    mapping(uint256 => Submission) public submissions;
    mapping(uint256 => Duel) public duels;
    mapping(uint256 => mapping(address => bool)) public hasVotedOnDuel;

    // IVotingPower source for weighted votes
    address public votingPowerSource;

    modifier onlyOwner() {
        require(msg.sender == owner, "DuelArena: not owner");
        _;
    }

    modifier onlyOperator() {
        require(msg.sender == operator || msg.sender == owner, "DuelArena: not operator");
        _;
    }

    constructor(
        address _foidTrest,
        address _votingPowerSource,
        address _operator,
        uint32 _votingWindowSeconds,
        uint256 _submissionFee
    ) {
        require(_foidTrest != address(0), "DuelArena: zero trest");
        require(_votingPowerSource != address(0), "DuelArena: zero voting power");
        require(_operator != address(0), "DuelArena: zero operator");
        require(_votingWindowSeconds > 0, "DuelArena: zero window");

        foidTrest = FoidTrest(_foidTrest);
        votingPowerSource = _votingPowerSource;
        owner = msg.sender;
        operator = _operator;
        votingWindowSeconds = _votingWindowSeconds;
        submissionFee = _submissionFee;
    }

    /// @notice Submit a meme to the duel pool.
    function submit(string calldata ipfsCid) external payable returns (uint256 submissionId) {
        require(bytes(ipfsCid).length > 0, "DuelArena: empty CID");
        require(msg.value >= submissionFee, "DuelArena: insufficient fee");

        submissionId = submissionCount;
        submissions[submissionId] = Submission({
            id: submissionId,
            creator: msg.sender,
            ipfsCid: ipfsCid,
            submittedAt: uint64(block.timestamp),
            matched: false
        });

        unchecked {
            submissionCount++;
            unmatchedCount++;
        }

        // Forward submission fee to owner
        if (msg.value > 0) {
            (bool ok, ) = owner.call{value: msg.value}("");
            require(ok, "DuelArena: fee transfer failed");
        }

        emit Submitted(submissionId, msg.sender, ipfsCid);
    }

    /// @notice Match two unmatched submissions into a duel. Operator only.
    function matchDuel(uint256 subA, uint256 subB) external onlyOperator returns (uint256 duelId) {
        require(subA != subB, "DuelArena: same submission");
        require(subA < submissionCount && subB < submissionCount, "DuelArena: invalid submissions");

        Submission storage sA = submissions[subA];
        Submission storage sB = submissions[subB];
        require(!sA.matched, "DuelArena: A already matched");
        require(!sB.matched, "DuelArena: B already matched");

        sA.matched = true;
        sB.matched = true;

        duelId = duelCount;
        duels[duelId] = Duel({
            id: duelId,
            submissionA: subA,
            submissionB: subB,
            votingStartsAt: uint64(block.timestamp),
            votingEndsAt: uint64(block.timestamp) + uint64(votingWindowSeconds),
            winner: 0,
            totalVotesA: 0,
            totalVotesB: 0,
            trestEntryId: 0,
            finalized: false
        });

        unchecked {
            duelCount++;
            unmatchedCount -= 2;
        }

        emit DuelCreated(duelId, subA, subB);
    }

    /// @notice Vote on a duel. 1 wallet = 1 vote per duel, weighted by voting power.
    /// @param duelId The duel to vote on.
    /// @param side 1 for submission A, 2 for submission B.
    function vote(uint256 duelId, uint8 side) external {
        require(duelId < duelCount, "DuelArena: invalid duel");
        require(side == 1 || side == 2, "DuelArena: invalid side");

        Duel storage d = duels[duelId];
        require(!d.finalized, "DuelArena: duel finalized");
        require(block.timestamp >= d.votingStartsAt, "DuelArena: voting not started");
        require(block.timestamp <= d.votingEndsAt, "DuelArena: voting ended");
        require(!hasVotedOnDuel[duelId][msg.sender], "DuelArena: already voted");

        // Get voting weight
        uint256 weight = _getVotingPower(msg.sender);
        require(weight > 0, "DuelArena: no voting power");

        hasVotedOnDuel[duelId][msg.sender] = true;

        if (side == 1) {
            d.totalVotesA += weight;
        } else {
            d.totalVotesB += weight;
        }

        emit DuelVoteCast(duelId, msg.sender, side, weight);
    }

    /// @notice Finalize a duel after voting ends. Winner gets placed on FoidTrest.
    function finalizeDuel(uint256 duelId) external onlyOperator {
        require(duelId < duelCount, "DuelArena: invalid duel");

        Duel storage d = duels[duelId];
        require(!d.finalized, "DuelArena: already finalized");
        require(block.timestamp > d.votingEndsAt, "DuelArena: voting not ended");

        // Determine winner
        uint8 winnerSide;
        if (d.totalVotesA > d.totalVotesB) {
            winnerSide = 1;
        } else if (d.totalVotesB > d.totalVotesA) {
            winnerSide = 2;
        } else {
            // Tie: side A wins (first submitted advantage)
            winnerSide = 1;
        }

        d.winner = winnerSide;
        d.finalized = true;

        // Get winning submission
        uint256 winningSub = winnerSide == 1 ? d.submissionA : d.submissionB;
        Submission memory ws = submissions[winningSub];

        // Place winner on FoidTrest (free — no fee)
        uint256 entryId = foidTrest.addEntry(
            ws.creator,
            ws.ipfsCid,
            "",    // title set later by winner via FoidTrest.setMetadata
            "",    // description set later
            1,     // path = duel
            duelId
        );
        d.trestEntryId = entryId;

        // Increment duel wins on MiFOID if holder
        if (mifoidNFT != address(0)) {
            _tryIncrementDuelWins(ws.creator);
        }

        emit DuelFinalized(duelId, winnerSide, entryId);
    }

    // ── Admin ──

    function setOperator(address newOp) external onlyOwner {
        require(newOp != address(0), "DuelArena: zero address");
        address old = operator;
        operator = newOp;
        emit OperatorChanged(old, newOp);
    }

    function setOwner(address newOwner) external onlyOwner {
        require(newOwner != address(0), "DuelArena: zero address");
        address old = owner;
        owner = newOwner;
        emit OwnerChanged(old, newOwner);
    }

    function setMifoidNFT(address _mifoidNFT) external onlyOwner {
        mifoidNFT = _mifoidNFT;
    }

    function setVotingWindowSeconds(uint32 newWindow) external onlyOwner {
        require(newWindow > 0, "DuelArena: zero window");
        uint32 old = votingWindowSeconds;
        votingWindowSeconds = newWindow;
        emit VotingWindowChanged(old, newWindow);
    }

    function setSubmissionFee(uint256 newFee) external onlyOwner {
        submissionFee = newFee;
    }

    // ── Views ──

    function getDuel(uint256 duelId) external view returns (Duel memory) {
        require(duelId < duelCount, "DuelArena: invalid duel");
        return duels[duelId];
    }

    function getSubmission(uint256 subId) external view returns (Submission memory) {
        require(subId < submissionCount, "DuelArena: invalid submission");
        return submissions[subId];
    }

    function pendingSubmissions() external view returns (uint256) {
        return unmatchedCount;
    }

    // ── Internal ──

    function _getVotingPower(address voter) internal view returns (uint256) {
        (bool ok, bytes memory data) = votingPowerSource.staticcall(
            abi.encodeWithSignature("votingPowerOf(address,uint256)", voter, uint256(0))
        );
        if (!ok || data.length < 32) return 0;
        return abi.decode(data, (uint256));
    }

    function _tryIncrementDuelWins(address creator) internal {
        // Best-effort: don't revert if MiFOID call fails
        (bool ok, ) = mifoidNFT.call(
            abi.encodeWithSignature("incrementDuelWins(address)", creator)
        );
        // Silence unused variable warning
        ok;
    }
}
