// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FoidTrest} from "./FoidTrest.sol";

interface ILoreboardVoting {
    function registerPlacement(bytes32 placementId) external returns (uint32 epochId);
}

/// @title Swipe v2
/// @notice Propose content → community votes on-chain via castVote() → threshold approval.
///         Two proposal types:
///           Gallery  — approved proposals are canonized to FoidTrest immediately.
///           Loreboard — approved proposals receive a PlacementVoucher that the submitter
///                       must claim (with a placement fee) within a configurable window.
///         Loreboard proposals are automatically registered in LoreboardVotingV2 at propose time.
contract Swipe {
    // ── Constants ──

    uint32 public constant TILE = 32;       // Grid tile size in pixels
    uint32 public constant MAX_CELLS = 400; // Max grid cells per placement (20x20 tiles)

    uint8 public constant TYPE_GALLERY = 0;
    uint8 public constant TYPE_LOREBOARD = 1;

    // ── Structs ──

    struct Proposal {
        uint256 id;
        address proposer;
        string ipfsCid;
        uint64 createdAt;
        uint64 votingEndsAt;
        bool finalized;
        bool canonized;
        uint256 trestEntryId;
        uint8 proposalType;
        int32 gridX;
        int32 gridY;
        uint32 gridW;
        uint32 gridH;
    }

    struct PlacementVoucher {
        uint64 issuedAt;
        uint64 expiresAt;
        bool claimed;
    }

    // ── Events ──

    event Proposed(uint256 indexed proposalId, address indexed proposer, string ipfsCid, uint64 votingEndsAt);
    event LoreboardProposed(
        uint256 indexed proposalId,
        address indexed proposer,
        string ipfsCid,
        int32 x, int32 y, uint32 w, uint32 h,
        uint64 votingEndsAt
    );
    event VoteCast(uint256 indexed proposalId, address indexed voter, bool approve, uint256 weight);
    event Finalized(uint256 indexed proposalId, bool canonized, uint256 weightFor, uint256 weightAgainst);
    event Canonized(uint256 indexed proposalId, uint256 indexed trestEntryId);
    event VoucherIssued(uint256 indexed proposalId, address indexed submitter, uint64 expiresAt);
    event PlacementClaimed(
        uint256 indexed proposalId,
        address indexed submitter,
        int32 x, int32 y, uint32 w, uint32 h,
        string ipfsCid
    );
    event ProposalRejected(uint256 indexed proposalId, uint256 weightFor, uint256 weightAgainst);
    event OperatorChanged(address indexed oldOp, address indexed newOp);
    event OwnerChanged(address indexed oldOwner, address indexed newOwner);
    event FeeRecipientChanged(address indexed oldRecipient, address indexed newRecipient);
    event LoreboardVotingChanged(address indexed oldAddr, address indexed newAddr);

    // ── Immutables ──

    FoidTrest public immutable gallery;
    address public immutable votingPowerSource;

    // ── State ──

    address public owner;
    address public operator;
    address public feeRecipient;
    address public loreboardVoting; // LoreboardVotingV2 — set in constructor, updatable by owner

    uint256 public submissionFee;
    uint32 public votingWindowSeconds;
    uint16 public approvalThresholdBps;
    uint256 public placementFee;
    uint32 public voucherDurationSeconds;

    uint256 public proposalCount;
    mapping(uint256 => Proposal) public proposals;
    mapping(uint256 => PlacementVoucher) public vouchers;

    // ── On-chain vote storage (replaces off-chain SQLite + EIP-712 collection) ──

    mapping(uint256 => uint256) public voteWeightFor;
    mapping(uint256 => uint256) public voteWeightAgainst;
    mapping(uint256 => mapping(address => bool)) public hasVoted;

    // ── Modifiers ──

    modifier onlyOwner() {
        require(msg.sender == owner, "Swipe: not owner");
        _;
    }

    modifier onlyOperator() {
        require(msg.sender == operator || msg.sender == owner, "Swipe: not operator");
        _;
    }

    // ── Constructor ──

    /// @param _gallery FoidTrest gallery contract
    /// @param _votingPowerSource StreakVotingPower contract
    /// @param _operator Address allowed to call finalize()
    /// @param _feeRecipient Where submission fees go
    /// @param _loreboardVoting LoreboardVotingV2 contract (for auto-registration on proposeLoreboard)
    /// @param _submissionFee Fee in wei to propose
    /// @param _votingWindowSeconds Duration of the voting window
    constructor(
        address _gallery,
        address _votingPowerSource,
        address _operator,
        address _feeRecipient,
        address _loreboardVoting,
        uint256 _submissionFee,
        uint32 _votingWindowSeconds
    ) {
        require(_gallery != address(0), "Swipe: zero gallery");
        require(_votingPowerSource != address(0), "Swipe: zero VP");
        require(_operator != address(0), "Swipe: zero operator");
        require(_feeRecipient != address(0), "Swipe: zero recipient");
        require(_votingWindowSeconds > 0, "Swipe: zero window");

        gallery = FoidTrest(_gallery);
        votingPowerSource = _votingPowerSource;
        owner = msg.sender;
        operator = _operator;
        feeRecipient = _feeRecipient;
        loreboardVoting = _loreboardVoting;
        submissionFee = _submissionFee;
        votingWindowSeconds = _votingWindowSeconds;

        approvalThresholdBps = 6000;       // 60%
        placementFee = 0.001 ether;
        voucherDurationSeconds = 604800;   // 7 days
    }

    // ══════════════════════════════════════════════
    //  PROPOSE
    // ══════════════════════════════════════════════

    /// @notice Propose a meme for the gallery.
    function propose(string calldata ipfsCid) external payable returns (uint256 proposalId) {
        require(bytes(ipfsCid).length > 0, "Swipe: empty CID");
        require(msg.value == submissionFee, "Swipe: wrong fee");

        proposalId = proposalCount;
        uint64 endsAt = uint64(block.timestamp) + uint64(votingWindowSeconds);

        proposals[proposalId] = Proposal({
            id: proposalId,
            proposer: msg.sender,
            ipfsCid: ipfsCid,
            createdAt: uint64(block.timestamp),
            votingEndsAt: endsAt,
            finalized: false,
            canonized: false,
            trestEntryId: 0,
            proposalType: TYPE_GALLERY,
            gridX: 0,
            gridY: 0,
            gridW: 0,
            gridH: 0
        });

        unchecked { proposalCount++; }
        _forwardFee(msg.value);
        emit Proposed(proposalId, msg.sender, ipfsCid, endsAt);
    }

    /// @notice Propose content for loreboard placement.
    ///         Automatically registers the placement in LoreboardVotingV2 (if wired).
    function proposeLoreboard(
        string calldata ipfsCid,
        int32 x,
        int32 y,
        uint32 w,
        uint32 h
    ) external payable returns (uint256 proposalId) {
        require(bytes(ipfsCid).length > 0, "Swipe: empty CID");
        require(msg.value == submissionFee, "Swipe: wrong fee");
        require(w > 0 && h > 0, "Swipe: zero size");
        require(w <= uint32(type(int32).max), "Swipe: w too large");
        require(h <= uint32(type(int32).max), "Swipe: h too large");

        uint32 cells = _cellsFor(w, h);
        require(cells <= MAX_CELLS, "Swipe: too many cells");

        proposalId = proposalCount;
        uint64 endsAt = uint64(block.timestamp) + uint64(votingWindowSeconds);

        proposals[proposalId] = Proposal({
            id: proposalId,
            proposer: msg.sender,
            ipfsCid: ipfsCid,
            createdAt: uint64(block.timestamp),
            votingEndsAt: endsAt,
            finalized: false,
            canonized: false,
            trestEntryId: 0,
            proposalType: TYPE_LOREBOARD,
            gridX: x,
            gridY: y,
            gridW: w,
            gridH: h
        });

        unchecked { proposalCount++; }
        _forwardFee(msg.value);

        // Auto-register in LoreboardVotingV2 so users can vote immediately.
        // Wrapped in try/catch so a failure here doesn't brick the proposal.
        if (loreboardVoting != address(0)) {
            bytes32 pid = placementIdForProposal(proposalId);
            try ILoreboardVoting(loreboardVoting).registerPlacement(pid) {} catch {}
        }

        emit LoreboardProposed(proposalId, msg.sender, ipfsCid, x, y, w, h, endsAt);
    }

    // ══════════════════════════════════════════════
    //  VOTE
    // ══════════════════════════════════════════════

    /// @notice Cast a YES or NO vote on a proposal directly on-chain.
    /// @dev Voting power is read live from StreakVotingPower.
    ///      One vote per wallet per proposal, enforced here.
    /// @param proposalId The proposal to vote on.
    /// @param approve True = YES, false = NO.
    function castVote(uint256 proposalId, bool approve) external {
        require(proposalId < proposalCount, "Swipe: invalid proposal");

        Proposal storage p = proposals[proposalId];
        require(!p.finalized, "Swipe: already finalized");
        require(block.timestamp <= p.votingEndsAt, "Swipe: voting ended");
        require(!hasVoted[proposalId][msg.sender], "Swipe: already voted");

        uint256 weight = _getVotingPower(msg.sender);
        require(weight > 0, "Swipe: no voting power");

        hasVoted[proposalId][msg.sender] = true;

        if (approve) {
            voteWeightFor[proposalId] += weight;
        } else {
            voteWeightAgainst[proposalId] += weight;
        }

        emit VoteCast(proposalId, msg.sender, approve, weight);
    }

    // ══════════════════════════════════════════════
    //  FINALIZE
    // ══════════════════════════════════════════════

    /// @notice Finalize a proposal after its voting window closes.
    ///         Reads on-chain vote tallies, applies threshold, and settles outcome.
    /// @param proposalId The proposal to finalize.
    function finalize(uint256 proposalId) external onlyOperator {
        require(proposalId < proposalCount, "Swipe: invalid proposal");

        Proposal storage p = proposals[proposalId];
        require(!p.finalized, "Swipe: already finalized");
        require(block.timestamp > p.votingEndsAt, "Swipe: voting not ended");

        uint256 weightFor = voteWeightFor[proposalId];
        uint256 weightAgainst = voteWeightAgainst[proposalId];
        uint256 totalWeight = weightFor + weightAgainst;

        // Cross-multiply to avoid division: weightFor/total >= threshold/10000
        bool approved = totalWeight > 0
            && (weightFor * 10000) >= (totalWeight * uint256(approvalThresholdBps));

        p.finalized = true;
        p.canonized = approved;

        if (approved) {
            if (p.proposalType == TYPE_GALLERY) {
                uint256 entryId = gallery.addEntry(
                    p.proposer,
                    p.ipfsCid,
                    "",
                    "",
                    1,
                    proposalId
                );
                p.trestEntryId = entryId;
                emit Canonized(proposalId, entryId);
            } else {
                uint64 expiresAt = uint64(block.timestamp) + uint64(voucherDurationSeconds);
                vouchers[proposalId] = PlacementVoucher({
                    issuedAt: uint64(block.timestamp),
                    expiresAt: expiresAt,
                    claimed: false
                });
                emit VoucherIssued(proposalId, p.proposer, expiresAt);
            }
        } else {
            emit ProposalRejected(proposalId, weightFor, weightAgainst);
        }

        emit Finalized(proposalId, approved, weightFor, weightAgainst);
    }

    // ══════════════════════════════════════════════
    //  VOUCHER CLAIM
    // ══════════════════════════════════════════════

    function claimVoucher(uint256 proposalId) external payable {
        require(proposalId < proposalCount, "Swipe: invalid proposal");

        Proposal storage p = proposals[proposalId];
        require(p.finalized && p.canonized, "Swipe: not approved");
        require(p.proposalType == TYPE_LOREBOARD, "Swipe: not loreboard");
        require(msg.sender == p.proposer, "Swipe: not submitter");
        require(msg.value == placementFee, "Swipe: wrong placement fee");

        PlacementVoucher storage v = vouchers[proposalId];
        require(v.issuedAt > 0, "Swipe: no voucher");
        require(!v.claimed, "Swipe: already claimed");
        require(block.timestamp <= v.expiresAt, "Swipe: voucher expired");

        v.claimed = true;
        _forwardFee(msg.value);

        emit PlacementClaimed(
            proposalId,
            p.proposer,
            p.gridX,
            p.gridY,
            p.gridW,
            p.gridH,
            p.ipfsCid
        );
    }

    // ══════════════════════════════════════════════
    //  ADMIN
    // ══════════════════════════════════════════════

    function setOperator(address newOp) external onlyOwner {
        require(newOp != address(0), "Swipe: zero address");
        address old = operator;
        operator = newOp;
        emit OperatorChanged(old, newOp);
    }

    function setFeeRecipient(address newRecipient) external onlyOwner {
        require(newRecipient != address(0), "Swipe: zero address");
        address old = feeRecipient;
        feeRecipient = newRecipient;
        emit FeeRecipientChanged(old, newRecipient);
    }

    function setLoreboardVoting(address newAddr) external onlyOwner {
        address old = loreboardVoting;
        loreboardVoting = newAddr;
        emit LoreboardVotingChanged(old, newAddr);
    }

    function setSubmissionFee(uint256 newFee) external onlyOwner {
        submissionFee = newFee;
    }

    function setVotingWindowSeconds(uint32 newWindow) external onlyOwner {
        require(newWindow > 0, "Swipe: zero window");
        votingWindowSeconds = newWindow;
    }

    function setApprovalThreshold(uint16 newThresholdBps) external onlyOwner {
        require(newThresholdBps > 0 && newThresholdBps <= 10000, "Swipe: invalid threshold");
        approvalThresholdBps = newThresholdBps;
    }

    function setPlacementFee(uint256 newFee) external onlyOwner {
        placementFee = newFee;
    }

    function setVoucherDuration(uint32 newDuration) external onlyOwner {
        require(newDuration > 0, "Swipe: zero duration");
        voucherDurationSeconds = newDuration;
    }

    function setOwner(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Swipe: zero address");
        address old = owner;
        owner = newOwner;
        emit OwnerChanged(old, newOwner);
    }

    // ══════════════════════════════════════════════
    //  VIEWS
    // ══════════════════════════════════════════════

    function getProposal(uint256 proposalId) external view returns (Proposal memory) {
        require(proposalId < proposalCount, "Swipe: invalid proposal");
        return proposals[proposalId];
    }

    function getVoucher(uint256 proposalId) external view returns (PlacementVoucher memory) {
        return vouchers[proposalId];
    }

    /// @notice Derives the bytes32 placementId used in LoreboardVotingV2 for a given proposal.
    ///         Deterministic: keccak256(address(this), proposalId).
    function placementIdForProposal(uint256 proposalId) public view returns (bytes32) {
        return keccak256(abi.encode(address(this), proposalId));
    }

    // ══════════════════════════════════════════════
    //  INTERNAL
    // ══════════════════════════════════════════════

    function _getVotingPower(address voter) internal view returns (uint256) {
        (bool ok, bytes memory data) = votingPowerSource.staticcall(
            abi.encodeWithSignature("votingPowerOf(address,uint256)", voter, uint256(0))
        );
        if (!ok || data.length < 32) return 0;
        return abi.decode(data, (uint256));
    }

    function _cellsFor(uint32 w, uint32 h) internal pure returns (uint32) {
        uint256 cellsWide = (uint256(w) + TILE - 1) / TILE;
        uint256 cellsHigh = (uint256(h) + TILE - 1) / TILE;
        uint256 cells = cellsWide * cellsHigh;
        require(cells > 0, "Swipe: cells=0");
        return uint32(cells);
    }

    function _forwardFee(uint256 amount) internal {
        if (amount > 0) {
            (bool ok, ) = feeRecipient.call{value: amount}("");
            require(ok, "Swipe: fee transfer failed");
        }
    }
}
