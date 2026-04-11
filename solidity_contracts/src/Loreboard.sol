// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IVotingPower} from "./IVotingPower.sol";

/// @title Loreboard
/// @notice Unified on-chain cultural canvas with democratic governance.
///
///   THE LOOP:
///     1. propose(cid, x, y, w, h) — pay 0.001 ETH, opens 72h voting window
///     2. castVote(proposalId, approve) — streak-weighted, on-chain, one per wallet
///     3. finalize(proposalId) — permissionless after window; ≥3 unique voters + ≥51% approval
///        → placement recorded permanently on-chain
///     4. setManifestCID(cid, placementCount) — operator updates manifest; NFT auto-syncs
///
///   REMOVAL (v1):
///     - Self-remove: placer removes their own content
///     - Emergency remove: multisig (owner) removes harmful content
///     - Community removal governance planned for v2 via DAO upgrade
///
///   NFT INTEGRATION:
///     Implements ILoreboardManifestStore + ILoreboardTreasury interfaces so the
///     LoreboardLiveNFT (1/1 ERC-721) can read manifest state and auto-update.
///     Full manifest history stored on-chain for provenance.
contract Loreboard {
    // ── Constants ──

    uint32 public constant TILE = 32;       // Grid tile size in pixels
    uint32 public constant MAX_CELLS = 400; // Max grid cells per placement (20×20 tiles)

    // ── Structs ──

    struct Proposal {
        uint256 id;
        address proposer;
        string ipfsCid;
        uint64 createdAt;
        uint64 votingEndsAt;
        bool finalized;
        bool approved;
        uint256 placementId;   // index in placements[]; only meaningful when approved == true
        int32 gridX;
        int32 gridY;
        uint32 gridW;
        uint32 gridH;
    }

    struct Placement {
        uint256 proposalId;
        address placer;
        string ipfsCid;
        int32 x;
        int32 y;
        uint32 w;
        uint32 h;
        uint64 placedAt;
        bool removed;          // true = removed via self-remove or emergency
    }

    // ── Events: Governance ──

    event ProposalCreated(
        uint256 indexed proposalId,
        address indexed proposer,
        string ipfsCid,
        int32 x, int32 y, uint32 w, uint32 h,
        uint64 votingEndsAt
    );
    event VoteCast(uint256 indexed proposalId, address indexed voter, bool approve, uint256 weight);
    event Finalized(uint256 indexed proposalId, bool approved, uint256 weightFor, uint256 weightAgainst);
    event PlacementCreated(
        uint256 indexed placementId,
        uint256 indexed proposalId,
        address indexed placer,
        int32 x, int32 y, uint32 w, uint32 h,
        string ipfsCid
    );
    event ProposalRejected(uint256 indexed proposalId, uint256 weightFor, uint256 weightAgainst);
    event ProposalOverlapRejected(uint256 indexed proposalId);

    // ── Events: Removal ──

    event PlacementSelfRemoved(uint256 indexed placementId, address indexed placer);
    event PlacementEmergencyRemoved(uint256 indexed placementId, address indexed removedBy);

    // ── Events: Manifest ──

    event ManifestUpdated(string newCid, uint256 version, uint256 placementCountAtUpdate);

    // ── Events: Admin ──

    event OperatorChanged(address indexed oldOp, address indexed newOp);
    event OwnerChanged(address indexed oldOwner, address indexed newOwner);
    event FeeRecipientChanged(address indexed oldRecipient, address indexed newRecipient);
    event SubmissionFeeChanged(uint256 oldFee, uint256 newFee);
    event VotingWindowChanged(uint32 oldWindow, uint32 newWindow);
    event ThresholdChanged(uint16 oldThreshold, uint16 newThreshold);
    event MinVoterQuorumChanged(uint256 oldQuorum, uint256 newQuorum);

    // ── Events: Pausable ──

    event Paused(address indexed by);
    event Unpaused(address indexed by);

    // ── Immutables ──

    address public immutable votingPowerSource;

    // ── State: Admin ──

    address public owner;
    address public operator;
    address public feeRecipient;

    // ── State: Config ──

    uint256 public submissionFee;
    uint32 public votingWindowSeconds;
    uint16 public approvalThresholdBps;
    uint256 public minVoterQuorum;         // minimum unique wallets required (default 3)

    // ── State: Core ──

    uint256 public proposalCount;
    uint256 public placementCount;

    mapping(uint256 => Proposal) internal _proposals;
    mapping(uint256 => Placement) internal _placements;

    // ── State: Votes ──

    mapping(uint256 => uint256) public voteWeightFor;
    mapping(uint256 => uint256) public voteWeightAgainst;
    mapping(uint256 => mapping(address => bool)) public hasVoted;
    mapping(uint256 => uint256) public uniqueVoterCount;

    // ── State: Tile Occupation (O(1) overlap check) ──

    /// @dev Maps packed (cellX, cellY) → true if occupied by a non-removed placement.
    mapping(uint256 => bool) internal _cellOccupied;

    // ── State: Manifest (with history) ──

    uint256 public manifestVersion;
    string public currentManifestCID;
    mapping(uint256 => string) public manifestCidAt;     // version → CID
    mapping(uint256 => bytes32) internal _manifestRootAt; // version → keccak256(CID)

    // ── State: Pausable ──

    bool public paused;

    // ── Modifiers ──

    modifier onlyOwner() {
        require(msg.sender == owner, "Loreboard: not owner");
        _;
    }

    modifier onlyOperator() {
        require(msg.sender == operator || msg.sender == owner, "Loreboard: not operator");
        _;
    }

    modifier whenNotPaused() {
        require(!paused, "Loreboard: paused");
        _;
    }

    // ── Constructor ──

    constructor(
        address _votingPowerSource,
        address _operator,
        address _feeRecipient,
        uint256 _submissionFee,
        uint32 _votingWindowSeconds
    ) {
        require(_votingPowerSource != address(0), "Loreboard: zero VP");
        require(_operator != address(0), "Loreboard: zero operator");
        require(_feeRecipient != address(0), "Loreboard: zero recipient");
        require(_votingWindowSeconds > 0, "Loreboard: zero window");

        votingPowerSource = _votingPowerSource;
        owner = msg.sender;
        operator = _operator;
        feeRecipient = _feeRecipient;
        submissionFee = _submissionFee;
        votingWindowSeconds = _votingWindowSeconds;
        approvalThresholdBps = 5100; // 51%
        minVoterQuorum = 3;          // 3 unique wallets
    }

    // ══════════════════════════════════════════════
    //  PROPOSE
    // ══════════════════════════════════════════════

    /// @notice Propose a placement on the Loreboard.
    /// @param ipfsCid IPFS CID of the content to place.
    /// @param x Grid X coordinate (pixels, can be negative — infinite canvas).
    /// @param y Grid Y coordinate (pixels, can be negative).
    /// @param w Width in pixels (must be > 0).
    /// @param h Height in pixels (must be > 0).
    /// @return proposalId The ID of the created proposal.
    function propose(
        string calldata ipfsCid,
        int32 x,
        int32 y,
        uint32 w,
        uint32 h
    ) external payable whenNotPaused returns (uint256 proposalId) {
        require(bytes(ipfsCid).length > 0, "Loreboard: empty CID");
        require(msg.value == submissionFee, "Loreboard: wrong fee");
        require(w > 0 && h > 0, "Loreboard: zero size");

        uint32 cells = _cellsFor(w, h);
        require(cells <= MAX_CELLS, "Loreboard: too many cells");
        require(!_hasOccupiedCells(x, y, w, h), "Loreboard: overlaps existing placement");

        proposalId = proposalCount;
        uint64 endsAt = uint64(block.timestamp) + uint64(votingWindowSeconds);

        _proposals[proposalId] = Proposal({
            id: proposalId,
            proposer: msg.sender,
            ipfsCid: ipfsCid,
            createdAt: uint64(block.timestamp),
            votingEndsAt: endsAt,
            finalized: false,
            approved: false,
            placementId: 0,
            gridX: x,
            gridY: y,
            gridW: w,
            gridH: h
        });

        unchecked { proposalCount++; }
        _forwardFee(msg.value);

        emit ProposalCreated(proposalId, msg.sender, ipfsCid, x, y, w, h, endsAt);
    }

    // ══════════════════════════════════════════════
    //  VOTE
    // ══════════════════════════════════════════════

    /// @notice Cast a YES or NO vote on a proposal directly on-chain.
    /// @param proposalId The proposal to vote on.
    /// @param approve True = YES, false = NO.
    function castVote(uint256 proposalId, bool approve) external whenNotPaused {
        require(proposalId < proposalCount, "Loreboard: invalid proposal");

        Proposal storage p = _proposals[proposalId];
        require(!p.finalized, "Loreboard: already finalized");
        require(block.timestamp <= p.votingEndsAt, "Loreboard: voting ended");
        require(!hasVoted[proposalId][msg.sender], "Loreboard: already voted");

        uint256 weight = _getVotingPower(msg.sender);
        require(weight > 0, "Loreboard: no voting power");

        hasVoted[proposalId][msg.sender] = true;
        unchecked { uniqueVoterCount[proposalId]++; }

        if (approve) {
            voteWeightFor[proposalId] += weight;
        } else {
            voteWeightAgainst[proposalId] += weight;
        }

        emit VoteCast(proposalId, msg.sender, approve, weight);
    }

    // ══════════════════════════════════════════════
    //  FINALIZE (permissionless)
    // ══════════════════════════════════════════════

    /// @notice Finalize a proposal after its voting window closes.
    ///         Anyone can call — the math is deterministic.
    ///         Requires ≥ minVoterQuorum unique voters AND ≥ 51% weighted approval.
    /// @param proposalId The proposal to finalize.
    function finalize(uint256 proposalId) external whenNotPaused {
        require(proposalId < proposalCount, "Loreboard: invalid proposal");

        Proposal storage p = _proposals[proposalId];
        require(!p.finalized, "Loreboard: already finalized");
        require(block.timestamp > p.votingEndsAt, "Loreboard: voting not ended");

        uint256 weightFor = voteWeightFor[proposalId];
        uint256 weightAgainst = voteWeightAgainst[proposalId];
        uint256 totalWeight = weightFor + weightAgainst;

        // Quorum: enough unique wallets participated
        bool hasQuorum = uniqueVoterCount[proposalId] >= minVoterQuorum;

        // Threshold: cross-multiply to avoid division (weightFor/total >= threshold/10000)
        bool meetsThreshold = totalWeight > 0
            && (weightFor * 10000) >= (totalWeight * uint256(approvalThresholdBps));

        bool isApproved = hasQuorum && meetsThreshold;

        // Overlap check: if spot was taken since proposal was created, reject
        bool overlapConflict = false;
        if (isApproved && _hasOccupiedCells(p.gridX, p.gridY, p.gridW, p.gridH)) {
            isApproved = false;
            overlapConflict = true;
        }

        p.finalized = true;
        p.approved = isApproved;

        if (overlapConflict) {
            emit ProposalOverlapRejected(proposalId);
        }

        if (isApproved) {
            uint256 pid = placementCount;

            _placements[pid] = Placement({
                proposalId: proposalId,
                placer: p.proposer,
                ipfsCid: p.ipfsCid,
                x: p.gridX,
                y: p.gridY,
                w: p.gridW,
                h: p.gridH,
                placedAt: uint64(block.timestamp),
                removed: false
            });

            p.placementId = pid;
            unchecked { placementCount++; }

            // Mark tile cells as occupied (O(cells) bounded by MAX_CELLS)
            _markCells(p.gridX, p.gridY, p.gridW, p.gridH);

            emit PlacementCreated(pid, proposalId, p.proposer, p.gridX, p.gridY, p.gridW, p.gridH, p.ipfsCid);
        } else {
            emit ProposalRejected(proposalId, weightFor, weightAgainst);
        }

        emit Finalized(proposalId, isApproved, weightFor, weightAgainst);
    }

    // ══════════════════════════════════════════════
    //  REMOVAL
    // ══════════════════════════════════════════════

    /// @notice Remove your own placement from the board.
    /// @param placementId The placement to remove.
    function removePlacement(uint256 placementId) external {
        require(placementId < placementCount, "Loreboard: invalid placement");

        Placement storage pl = _placements[placementId];
        require(!pl.removed, "Loreboard: already removed");
        require(msg.sender == pl.placer, "Loreboard: not placer");

        pl.removed = true;
        _unmarkCells(pl.x, pl.y, pl.w, pl.h);
        emit PlacementSelfRemoved(placementId, msg.sender);
    }

    /// @notice Emergency removal by the multisig for harmful/illegal content.
    ///         Transparent — emits event with who triggered it.
    /// @param placementId The placement to remove.
    function emergencyRemove(uint256 placementId) external onlyOwner {
        require(placementId < placementCount, "Loreboard: invalid placement");

        Placement storage pl = _placements[placementId];
        require(!pl.removed, "Loreboard: already removed");

        pl.removed = true;
        _unmarkCells(pl.x, pl.y, pl.w, pl.h);
        emit PlacementEmergencyRemoved(placementId, msg.sender);
    }

    // ══════════════════════════════════════════════
    //  MANIFEST (with history + staleness check)
    // ══════════════════════════════════════════════

    /// @notice Update the board manifest CID after placements change.
    ///         Operator uploads a new manifest.json to IPFS, then records it here.
    ///         The claimedPlacementCount must match current state to prevent stale updates.
    /// @param cid The new IPFS CID of the board manifest.
    /// @param claimedPlacementCount Must equal current placementCount (staleness check).
    function setManifestCID(string calldata cid, uint256 claimedPlacementCount) external onlyOperator {
        require(claimedPlacementCount == placementCount, "Loreboard: stale manifest");

        unchecked { manifestVersion++; }

        currentManifestCID = cid;
        manifestCidAt[manifestVersion] = cid;
        _manifestRootAt[manifestVersion] = keccak256(bytes(cid));

        emit ManifestUpdated(cid, manifestVersion, placementCount);
    }

    // ══════════════════════════════════════════════
    //  NFT INTEGRATION (ILoreboardManifestStore + ILoreboardTreasury)
    // ══════════════════════════════════════════════

    /// @notice Returns the latest manifest state. Compatible with ILoreboardManifestStore.
    ///         Used by LoreboardLiveNFT.syncLatest() to update the 1/1 board NFT.
    function latest() external view returns (uint256 version, bytes32 root, string memory cid) {
        version = manifestVersion;
        root = _manifestRootAt[manifestVersion];
        cid = currentManifestCID;
    }

    /// @notice Returns the manifest root for any historical version.
    ///         Compatible with ILoreboardTreasury. Returns bytes32(0) for unset versions.
    function manifestRootOf(uint256 version) external view returns (bytes32) {
        return _manifestRootAt[version];
    }

    // ══════════════════════════════════════════════
    //  VIEWS
    // ══════════════════════════════════════════════

    /// @notice Get a proposal by ID.
    function getProposal(uint256 proposalId) external view returns (Proposal memory) {
        require(proposalId < proposalCount, "Loreboard: invalid proposal");
        return _proposals[proposalId];
    }

    /// @notice Get a placement by ID.
    function getPlacement(uint256 placementId) external view returns (Placement memory) {
        require(placementId < placementCount, "Loreboard: invalid placement");
        return _placements[placementId];
    }

    // ══════════════════════════════════════════════
    //  ADMIN
    // ══════════════════════════════════════════════

    /// @notice Update the operator address. Owner only.
    function setOperator(address newOp) external onlyOwner {
        require(newOp != address(0), "Loreboard: zero address");
        address old = operator;
        operator = newOp;
        emit OperatorChanged(old, newOp);
    }

    /// @notice Update the fee recipient address. Owner only.
    function setFeeRecipient(address newRecipient) external onlyOwner {
        require(newRecipient != address(0), "Loreboard: zero address");
        address old = feeRecipient;
        feeRecipient = newRecipient;
        emit FeeRecipientChanged(old, newRecipient);
    }

    /// @notice Update the submission fee. Owner only.
    function setSubmissionFee(uint256 newFee) external onlyOwner {
        uint256 old = submissionFee;
        submissionFee = newFee;
        emit SubmissionFeeChanged(old, newFee);
    }

    /// @notice Update the voting window duration. Owner only.
    function setVotingWindowSeconds(uint32 newWindow) external onlyOwner {
        require(newWindow > 0, "Loreboard: zero window");
        uint32 old = votingWindowSeconds;
        votingWindowSeconds = newWindow;
        emit VotingWindowChanged(old, newWindow);
    }

    /// @notice Update the approval threshold in basis points (e.g. 5100 = 51%). Owner only.
    function setApprovalThreshold(uint16 newThresholdBps) external onlyOwner {
        require(newThresholdBps > 0 && newThresholdBps <= 10000, "Loreboard: invalid threshold");
        uint16 old = approvalThresholdBps;
        approvalThresholdBps = newThresholdBps;
        emit ThresholdChanged(old, newThresholdBps);
    }

    /// @notice Update the minimum number of unique voters required for quorum. Owner only.
    function setMinVoterQuorum(uint256 newQuorum) external onlyOwner {
        require(newQuorum > 0, "Loreboard: zero quorum");
        uint256 old = minVoterQuorum;
        minVoterQuorum = newQuorum;
        emit MinVoterQuorumChanged(old, newQuorum);
    }

    /// @notice Transfer ownership to a new address. Owner only.
    function setOwner(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Loreboard: zero address");
        address old = owner;
        owner = newOwner;
        emit OwnerChanged(old, newOwner);
    }

    /// @notice Emergency pause — freezes propose, castVote, finalize. Owner (multisig) only.
    function pause() external onlyOwner {
        require(!paused, "Loreboard: already paused");
        paused = true;
        emit Paused(msg.sender);
    }

    /// @notice Unpause the contract. Owner (multisig) only.
    function unpause() external onlyOwner {
        require(paused, "Loreboard: not paused");
        paused = false;
        emit Unpaused(msg.sender);
    }

    // ══════════════════════════════════════════════
    //  INTERNAL
    // ══════════════════════════════════════════════

    /// @dev Pack two int32 cell coordinates into a single uint256 mapping key.
    function _cellKey(int32 cx, int32 cy) internal pure returns (uint256) {
        return (uint256(uint32(cx)) << 32) | uint256(uint32(cy));
    }

    /// @dev Floor division for negative coordinates. Solidity truncates toward zero;
    ///      we need toward negative infinity for correct tile mapping.
    function _floorDiv(int32 a, int32 b) internal pure returns (int32) {
        int32 d = a / b;
        if (a < 0 && a % b != 0) d--;
        return d;
    }

    /// @dev Check if any tile cells in the proposed rect are already occupied.
    ///      O(cells) bounded by MAX_CELLS — constant regardless of board size.
    function _hasOccupiedCells(int32 x, int32 y, uint32 w, uint32 h) internal view returns (bool) {
        int32 t = int32(uint32(TILE));
        int32 cx0 = _floorDiv(x, t);
        int32 cy0 = _floorDiv(y, t);
        int32 cx1 = _floorDiv(x + int32(w) - 1, t);
        int32 cy1 = _floorDiv(y + int32(h) - 1, t);

        for (int32 cx = cx0; cx <= cx1; cx++) {
            for (int32 cy = cy0; cy <= cy1; cy++) {
                if (_cellOccupied[_cellKey(cx, cy)]) return true;
            }
        }
        return false;
    }

    /// @dev Mark all tile cells covered by a placement as occupied.
    function _markCells(int32 x, int32 y, uint32 w, uint32 h) internal {
        int32 t = int32(uint32(TILE));
        int32 cx0 = _floorDiv(x, t);
        int32 cy0 = _floorDiv(y, t);
        int32 cx1 = _floorDiv(x + int32(w) - 1, t);
        int32 cy1 = _floorDiv(y + int32(h) - 1, t);

        for (int32 cx = cx0; cx <= cx1; cx++) {
            for (int32 cy = cy0; cy <= cy1; cy++) {
                _cellOccupied[_cellKey(cx, cy)] = true;
            }
        }
    }

    /// @dev Clear all tile cells covered by a placement (on removal).
    function _unmarkCells(int32 x, int32 y, uint32 w, uint32 h) internal {
        int32 t = int32(uint32(TILE));
        int32 cx0 = _floorDiv(x, t);
        int32 cy0 = _floorDiv(y, t);
        int32 cx1 = _floorDiv(x + int32(w) - 1, t);
        int32 cy1 = _floorDiv(y + int32(h) - 1, t);

        for (int32 cx = cx0; cx <= cx1; cx++) {
            for (int32 cy = cy0; cy <= cy1; cy++) {
                _cellOccupied[_cellKey(cx, cy)] = false;
            }
        }
    }

    function _getVotingPower(address voter) internal view returns (uint256) {
        try IVotingPower(votingPowerSource).votingPowerOf(voter, 0) returns (uint256 w) {
            return w;
        } catch {
            return 0;
        }
    }

    function _cellsFor(uint32 w, uint32 h) internal pure returns (uint32) {
        uint256 cellsWide = (uint256(w) + TILE - 1) / TILE;
        uint256 cellsHigh = (uint256(h) + TILE - 1) / TILE;
        uint256 cells = cellsWide * cellsHigh;
        return uint32(cells);
    }

    function _forwardFee(uint256 amount) internal {
        if (amount > 0) {
            (bool ok, ) = feeRecipient.call{value: amount}("");
            require(ok, "Loreboard: fee transfer failed");
        }
    }
}
