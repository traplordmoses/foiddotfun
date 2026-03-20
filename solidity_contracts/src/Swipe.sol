// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {FoidTrest} from "./FoidTrest.sol";

/// @title Swipe
/// @notice Propose content → community votes via EIP-712 signed ballots → threshold approval.
///         Two parallel paths:
///           Gallery  — approved proposals are canonized to FoidTrest immediately.
///           Loreboard — approved proposals receive a PlacementVoucher that the submitter
///                       must claim (with a placement fee) within a configurable window.
contract Swipe is EIP712 {
    // ── Constants ──

    uint32 public constant TILE = 32;       // Grid tile size in pixels (matches SwipeLoreboard)
    uint32 public constant MAX_CELLS = 400; // Max grid cells per placement (20x20 tiles)

    uint8 public constant TYPE_GALLERY = 0;   // Gallery proposal — canonized to FoidTrest on approval
    uint8 public constant TYPE_LOREBOARD = 1; // Loreboard proposal — voucher issued on approval

    // ── Structs ──

    /// @dev Proposal stores both gallery and loreboard data in one struct.
    ///      Gallery proposals: gridX/Y/W/H are 0 (unused).
    ///      Loreboard proposals: trestEntryId is 0 (not a gallery entry).
    struct Proposal {
        uint256 id;               // Sequential proposal ID
        address proposer;          // Wallet that submitted the proposal
        string ipfsCid;            // IPFS content identifier for the content
        uint64 createdAt;          // Block timestamp when proposed
        uint64 votingEndsAt;       // Timestamp after which finalization is allowed
        bool finalized;            // True once finalize() has been called
        bool canonized;            // True if approved (passed threshold)
        uint256 trestEntryId;      // Gallery entry ID (Gallery type only, 0 otherwise)
        uint8 proposalType;        // 0 = Gallery, 1 = Loreboard
        int32 gridX;               // Loreboard grid X position (pixels)
        int32 gridY;               // Loreboard grid Y position (pixels)
        uint32 gridW;              // Loreboard grid width (pixels)
        uint32 gridH;              // Loreboard grid height (pixels)
    }

    /// @dev Voucher issued to approved loreboard proposals. Submitter must claim
    ///      within expiresAt to mint the placement. Unclaimed vouchers are forfeit.
    struct PlacementVoucher {
        uint64 issuedAt;           // When the voucher was created
        uint64 expiresAt;          // Deadline to claim (issuedAt + voucherDurationSeconds)
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

    // ── Immutables ──

    bytes32 public constant VOTE_TYPEHASH =
        keccak256("SwipeVote(uint256 proposalId,bool approve,uint256 deadline)");

    FoidTrest public immutable gallery;
    address public immutable votingPowerSource;

    // ── State ──

    address public owner;
    address public operator;
    address public feeRecipient;

    uint256 public submissionFee;
    uint32 public votingWindowSeconds;
    uint16 public approvalThresholdBps;     // default 6000 = 60%
    uint256 public placementFee;             // claim fee, default 0.001 ether
    uint32 public voucherDurationSeconds;    // default 604800 = 7 days

    uint256 public proposalCount;
    mapping(uint256 => Proposal) public proposals;
    mapping(uint256 => PlacementVoucher) public vouchers;

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
    /// @param _operator Address that submits finalize() batches
    /// @param _feeRecipient Where submission fees go
    /// @param _submissionFee Fee in wei to propose (e.g. 0.001 ether)
    /// @param _votingWindowSeconds Duration of voting window (e.g. 86400 = 24h)
    constructor(
        address _gallery,
        address _votingPowerSource,
        address _operator,
        address _feeRecipient,
        uint256 _submissionFee,
        uint32 _votingWindowSeconds
    ) EIP712("FoidSwipe", "1") {
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
        submissionFee = _submissionFee;
        votingWindowSeconds = _votingWindowSeconds;

        approvalThresholdBps = 6000;        // 60%
        placementFee = 0.001 ether;
        voucherDurationSeconds = 604800;    // 7 days
    }

    // ══════════════════════════════════════════════
    //  PROPOSE
    // ══════════════════════════════════════════════

    /// @notice Propose a meme for the gallery. Pays submission fee.
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

    /// @notice Propose content for loreboard placement. Pays submission fee.
    /// @param ipfsCid IPFS CID of the content
    /// @param x Top-left x coordinate (pixels)
    /// @param y Top-left y coordinate (pixels)
    /// @param w Width in pixels
    /// @param h Height in pixels
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

        emit LoreboardProposed(proposalId, msg.sender, ipfsCid, x, y, w, h, endsAt);
    }

    // ══════════════════════════════════════════════
    //  FINALIZE
    // ══════════════════════════════════════════════

    /// @notice Finalize a proposal by submitting batch of EIP-712 signed votes.
    ///         Operator collects signed ballots off-chain and submits them here.
    /// @param proposalId The proposal to finalize
    /// @param voters Array of voter addresses (for voting power lookup)
    /// @param approvals Array of booleans (true = approve, false = reject)
    /// @param deadlines Array of signature deadlines
    /// @param signatures Array of EIP-712 signatures
    function finalize(
        uint256 proposalId,
        address[] calldata voters,
        bool[] calldata approvals,
        uint256[] calldata deadlines,
        bytes[] calldata signatures
    ) external onlyOperator {
        require(proposalId < proposalCount, "Swipe: invalid proposal");

        Proposal storage p = proposals[proposalId];
        require(!p.finalized, "Swipe: already finalized");
        require(block.timestamp > p.votingEndsAt, "Swipe: voting not ended");

        uint256 len = voters.length;
        require(len == approvals.length, "Swipe: length mismatch");
        require(len == deadlines.length, "Swipe: length mismatch");
        require(len == signatures.length, "Swipe: length mismatch");

        uint256 weightFor;
        uint256 weightAgainst;

        // Aggregate weighted votes from off-chain EIP-712 signed ballots.
        // Each voter signs { proposalId, approve, deadline } off-chain.
        // The operator collects signatures and submits them in batch.
        // Voting power is queried LIVE (not snapshotted) — rewards active streaks.
        // NOTE: Duplicate voter prevention is the operator's responsibility for v1.
        for (uint256 i = 0; i < len; i++) {
            // Deadline must extend past voting window to prevent stale signature replay
            require(deadlines[i] >= p.votingEndsAt, "Swipe: vote deadline too early");

            // Reconstruct EIP-712 typed data hash and recover signer
            bytes32 structHash = keccak256(
                abi.encode(VOTE_TYPEHASH, proposalId, approvals[i], deadlines[i])
            );
            bytes32 digest = _hashTypedDataV4(structHash);
            address signer = ECDSA.recover(digest, signatures[i]);
            require(signer == voters[i], "Swipe: invalid signature");

            // Query live voting power from StreakVotingPower (streak tier * base + MiFOID bonus)
            uint256 weight = _getVotingPower(signer);

            if (approvals[i]) {
                weightFor += weight;
            } else {
                weightAgainst += weight;
            }
        }

        p.finalized = true;

        // Threshold check: weightFor / totalWeight >= approvalThresholdBps / 10000
        // Cross-multiplied to avoid division: weightFor * 10000 >= totalWeight * threshold
        // Default threshold: 6000 = 60% weighted approval required
        uint256 totalWeight = weightFor + weightAgainst;
        bool approved = totalWeight > 0
            && (weightFor * 10000) >= (totalWeight * uint256(approvalThresholdBps));
        p.canonized = approved;

        if (approved) {
            if (p.proposalType == TYPE_GALLERY) {
                // Gallery path — canonize to FoidTrest
                uint256 entryId = gallery.addEntry(
                    p.proposer,
                    p.ipfsCid,
                    "",    // title set later via FoidTrest.setMetadata
                    "",    // description set later
                    1,     // path = swipe
                    proposalId
                );
                p.trestEntryId = entryId;
                emit Canonized(proposalId, entryId);
            } else {
                // Loreboard path — issue placement voucher
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

    /// @notice Claim an approved loreboard placement voucher.
    ///         Submitter pays placementFee, voucher must not be expired or already claimed.
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

    /// @dev Calculate grid cell count from pixel dimensions using ceiling division.
    ///      Formula: ceil(w/TILE) * ceil(h/TILE). A 64x64px image = 2x2 = 4 cells.
    function _cellsFor(uint32 w, uint32 h) internal pure returns (uint32) {
        uint256 cellsWide = (uint256(w) + TILE - 1) / TILE; // ceil(w / 32)
        uint256 cellsHigh = (uint256(h) + TILE - 1) / TILE; // ceil(h / 32)
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
