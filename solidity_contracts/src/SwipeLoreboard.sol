// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title SwipeLoreboard
/// @notice Pay-to-place spatial board with flag/removal governance.
///         First come first serve — no epochs, no escrow, no voting for placement.
///         Governance: flag → threshold → streak-weighted removal vote → removed.
contract SwipeLoreboard {
    uint32 public constant TILE = 32;
    uint32 public constant MAX_CELLS = 400;

    struct Placement {
        uint256 id;
        address placer;
        int32 x;
        int32 y;
        uint32 w;
        uint32 h;
        uint32 cells;
        bytes cidBytes;
        uint64 placedAt;
        bool removed;
    }

    struct RemovalVote {
        uint256 placementId;
        uint64 startsAt;
        uint64 endsAt;
        uint256 votesFor;       // weighted votes for removal
        uint256 votesAgainst;   // weighted votes against removal
        bool resolved;
        bool removalPassed;
    }

    // ── Events ──

    event PlacementCreated(
        uint256 indexed placementId,
        address indexed placer,
        int32 x, int32 y, uint32 w, uint32 h,
        uint32 cells
    );
    event PlacementRemoved(uint256 indexed placementId);
    event PlacementFlagged(uint256 indexed placementId, address indexed flagger, uint256 flagCount);
    event RemovalVoteStarted(uint256 indexed placementId, uint256 indexed voteId);
    event RemovalVoteCast(uint256 indexed voteId, address indexed voter, bool support, uint256 weight);
    event RemovalVoteResolved(uint256 indexed voteId, uint256 indexed placementId, bool removed);
    event OwnerChanged(address indexed oldOwner, address indexed newOwner);
    event FeeRecipientChanged(address indexed oldRecipient, address indexed newRecipient);

    // ── State ──

    address public owner;
    address public feeRecipient;
    address public votingPowerSource;

    uint256 public placementFeeWei;
    uint256 public flagFeeWei;
    uint8 public flagThreshold;
    uint32 public removalVoteWindowSeconds;

    uint256 public placementCount;
    uint256 public voteCount;

    mapping(uint256 => Placement) public placements;

    // Flag tracking
    mapping(uint256 => address[]) internal _flaggers;
    mapping(uint256 => mapping(address => bool)) public hasFlagged;
    mapping(uint256 => uint256) public activeVoteForPlacement; // 0 = no active vote; IDs start at 1

    // Removal votes
    mapping(uint256 => RemovalVote) public removalVotes;
    mapping(uint256 => mapping(address => bool)) public hasVotedOnRemoval;

    modifier onlyOwner() {
        require(msg.sender == owner, "Loreboard: not owner");
        _;
    }

    constructor(
        address _feeRecipient,
        address _votingPowerSource,
        uint256 _placementFeeWei,
        uint256 _flagFeeWei,
        uint8 _flagThreshold,
        uint32 _removalVoteWindowSeconds
    ) {
        require(_feeRecipient != address(0), "Loreboard: zero recipient");
        require(_votingPowerSource != address(0), "Loreboard: zero VP");
        require(_flagThreshold > 0, "Loreboard: zero threshold");
        require(_removalVoteWindowSeconds > 0, "Loreboard: zero window");

        owner = msg.sender;
        feeRecipient = _feeRecipient;
        votingPowerSource = _votingPowerSource;
        placementFeeWei = _placementFeeWei;
        flagFeeWei = _flagFeeWei;
        flagThreshold = _flagThreshold;
        removalVoteWindowSeconds = _removalVoteWindowSeconds;
    }

    // ══════════════════════════════════════════════
    //  PLACEMENT
    // ══════════════════════════════════════════════

    /// @notice Place content on the board. First come first serve.
    /// @param x Top-left x coordinate
    /// @param y Top-left y coordinate
    /// @param w Width in pixels
    /// @param h Height in pixels
    /// @param cidBytes Raw CID bytes (1–96 bytes)
    function place(
        int32 x,
        int32 y,
        uint32 w,
        uint32 h,
        bytes calldata cidBytes
    ) external payable returns (uint256 placementId) {
        require(w > 0 && h > 0, "Loreboard: zero size");
        require(w <= uint32(type(int32).max), "Loreboard: w too large");
        require(h <= uint32(type(int32).max), "Loreboard: h too large");
        require(cidBytes.length > 0 && cidBytes.length <= 96, "Loreboard: bad cid");
        require(msg.value >= placementFeeWei, "Loreboard: insufficient fee");

        uint32 cells = _cellsFor(w, h);

        placementId = placementCount;
        placements[placementId] = Placement({
            id: placementId,
            placer: msg.sender,
            x: x,
            y: y,
            w: w,
            h: h,
            cells: cells,
            cidBytes: cidBytes,
            placedAt: uint64(block.timestamp),
            removed: false
        });

        unchecked { placementCount++; }

        // Forward fee immediately
        if (msg.value > 0) {
            (bool ok, ) = feeRecipient.call{value: msg.value}("");
            require(ok, "Loreboard: fee transfer failed");
        }

        emit PlacementCreated(placementId, msg.sender, x, y, w, h, cells);
    }

    // ══════════════════════════════════════════════
    //  FLAG / REMOVAL GOVERNANCE
    // ══════════════════════════════════════════════

    /// @notice Flag a placement for removal. Costs flagFeeWei. 1 flag per wallet per placement.
    function flagPlacement(uint256 placementId) external payable {
        require(placementId < placementCount, "Loreboard: invalid placement");
        require(!placements[placementId].removed, "Loreboard: already removed");
        require(msg.value >= flagFeeWei, "Loreboard: insufficient flag fee");
        require(!hasFlagged[placementId][msg.sender], "Loreboard: already flagged");
        require(activeVoteForPlacement[placementId] == 0, "Loreboard: vote already active");

        hasFlagged[placementId][msg.sender] = true;
        _flaggers[placementId].push(msg.sender);

        // Forward flag fee
        if (msg.value > 0) {
            (bool ok, ) = feeRecipient.call{value: msg.value}("");
            require(ok, "Loreboard: flag fee transfer failed");
        }

        uint256 count = _flaggers[placementId].length;
        emit PlacementFlagged(placementId, msg.sender, count);

        // Auto-trigger removal vote at threshold
        if (count >= flagThreshold) {
            _startRemovalVote(placementId);
        }
    }

    /// @notice Vote on a removal. support=true means "remove", false means "keep".
    function voteOnRemoval(uint256 voteId, bool support) external {
        require(voteId > 0 && voteId <= voteCount, "Loreboard: invalid vote");

        RemovalVote storage v = removalVotes[voteId];
        require(!v.resolved, "Loreboard: vote resolved");
        require(block.timestamp >= v.startsAt, "Loreboard: not started");
        require(block.timestamp <= v.endsAt, "Loreboard: voting ended");
        require(!hasVotedOnRemoval[voteId][msg.sender], "Loreboard: already voted");

        uint256 weight = _getVotingPower(msg.sender);
        require(weight > 0, "Loreboard: no voting power");

        hasVotedOnRemoval[voteId][msg.sender] = true;

        if (support) {
            v.votesFor += weight;
        } else {
            v.votesAgainst += weight;
        }

        emit RemovalVoteCast(voteId, msg.sender, support, weight);
    }

    /// @notice Resolve a removal vote after window ends. Simple majority → removed.
    function resolveRemovalVote(uint256 voteId) external {
        require(voteId > 0 && voteId <= voteCount, "Loreboard: invalid vote");

        RemovalVote storage v = removalVotes[voteId];
        require(!v.resolved, "Loreboard: already resolved");
        require(block.timestamp > v.endsAt, "Loreboard: voting not ended");

        v.resolved = true;
        bool passed = v.votesFor > v.votesAgainst;
        v.removalPassed = passed;

        // Clear active vote
        activeVoteForPlacement[v.placementId] = 0;

        if (passed) {
            placements[v.placementId].removed = true;
            emit PlacementRemoved(v.placementId);
        } else {
            // Reset flags so placement can be flagged again
            _resetFlags(v.placementId);
        }

        emit RemovalVoteResolved(voteId, v.placementId, passed);
    }

    // ── Views ──

    function getPlacement(uint256 placementId) external view returns (Placement memory) {
        require(placementId < placementCount, "Loreboard: invalid placement");
        return placements[placementId];
    }

    function getRemovalVote(uint256 voteId) external view returns (RemovalVote memory) {
        require(voteId > 0 && voteId <= voteCount, "Loreboard: invalid vote");
        return removalVotes[voteId];
    }

    function getFlagCount(uint256 placementId) external view returns (uint256) {
        return _flaggers[placementId].length;
    }

    // ── Admin ──

    function setPlacementFee(uint256 newFee) external onlyOwner {
        placementFeeWei = newFee;
    }

    function setFlagFee(uint256 newFee) external onlyOwner {
        flagFeeWei = newFee;
    }

    function setFlagThreshold(uint8 newThreshold) external onlyOwner {
        require(newThreshold > 0, "Loreboard: zero threshold");
        flagThreshold = newThreshold;
    }

    function setRemovalVoteWindow(uint32 newWindow) external onlyOwner {
        require(newWindow > 0, "Loreboard: zero window");
        removalVoteWindowSeconds = newWindow;
    }

    function setFeeRecipient(address newRecipient) external onlyOwner {
        require(newRecipient != address(0), "Loreboard: zero address");
        address old = feeRecipient;
        feeRecipient = newRecipient;
        emit FeeRecipientChanged(old, newRecipient);
    }

    function setVotingPowerSource(address newSource) external onlyOwner {
        require(newSource != address(0), "Loreboard: zero address");
        votingPowerSource = newSource;
    }

    function setOwner(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Loreboard: zero address");
        address old = owner;
        owner = newOwner;
        emit OwnerChanged(old, newOwner);
    }

    // ── Internal ──

    function _cellsFor(uint32 w, uint32 h) internal pure returns (uint32) {
        uint256 cellsWide = (uint256(w) + TILE - 1) / TILE;
        uint256 cellsHigh = (uint256(h) + TILE - 1) / TILE;
        uint256 cells = cellsWide * cellsHigh;
        require(cells > 0, "Loreboard: cells=0");
        require(cells <= MAX_CELLS, "Loreboard: too many cells");
        return uint32(cells);
    }

    function _startRemovalVote(uint256 placementId) internal {
        voteCount++;
        uint256 voteId = voteCount;

        removalVotes[voteId] = RemovalVote({
            placementId: placementId,
            startsAt: uint64(block.timestamp),
            endsAt: uint64(block.timestamp) + uint64(removalVoteWindowSeconds),
            votesFor: 0,
            votesAgainst: 0,
            resolved: false,
            removalPassed: false
        });

        activeVoteForPlacement[placementId] = voteId;

        emit RemovalVoteStarted(placementId, voteId);
    }

    function _resetFlags(uint256 placementId) internal {
        address[] storage f = _flaggers[placementId];
        for (uint256 i = 0; i < f.length; i++) {
            hasFlagged[placementId][f[i]] = false;
        }
        delete _flaggers[placementId];
    }

    function _getVotingPower(address voter) internal view returns (uint256) {
        (bool ok, bytes memory data) = votingPowerSource.staticcall(
            abi.encodeWithSignature("votingPowerOf(address,uint256)", voter, uint256(0))
        );
        if (!ok || data.length < 32) return 0;
        return abi.decode(data, (uint256));
    }
}
