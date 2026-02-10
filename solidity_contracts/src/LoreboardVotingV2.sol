// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./IVotingPower.sol";

/// @title LoreboardVoting v2 (rolling window per placement, time-derived epochs)
/// @notice - Anyone can register a placement once (stores registeredAt)
///         - Each placement has its own voteEndsAt = createdAt + voteWindow
///         - EpochId is derived from voteEndsAt (bucket by day) so epoch finalization is safe
///         - Vote API stays compatible: voteOnPlacement(epochId, placementId, support)
contract LoreboardVotingV2 {
    struct EpochState {
        bool finalized; // if true, no votes counted for this epoch anymore
    }

    struct PlacementMeta {
        uint64 registeredAt;     // registration timestamp
        uint64 voteEndsAt;       // registeredAt + voteWindowSeconds
        uint32 placementEpochId; // epochAt(voteEndsAt)
        bool exists;
    }

    // ----- Config -----

    /// @notice Source of voting power (pluggable for future streak/MiFOID logic).
    IVotingPower public votingPowerSource;

    /// @notice Address allowed to finalize epochs + update config.
    /// @dev For option (1), set this to your worker EOA.
    address public boardAdmin;

    /// @notice Minimum total voting weight required for a placement to be valid.
    uint256 public minTotalWeightQuorum;

    /// @notice Epoch schedule params (time-derived, no manual configureEpoch).
    uint64 public immutable epochZeroUnix;
    uint32 public immutable epochSeconds;
    uint32 public immutable voteWindowSeconds;

    // ----- State -----

    mapping(uint256 => EpochState) public epochs; // epochId -> state (finalized)
    mapping(bytes32 => PlacementMeta) public placements; // placementId -> meta

    /// @notice Whether a placement is pending (votable) in its derived epoch.
    /// @dev Stored for easy indexing, but "votable now" also depends on time + epoch finalization.
    mapping(uint256 => mapping(bytes32 => bool)) public isPendingPlacement;

    mapping(uint256 => mapping(bytes32 => uint256)) public placementYesVotes;
    mapping(uint256 => mapping(bytes32 => uint256)) public placementNoVotes;
    mapping(uint256 => mapping(bytes32 => mapping(address => bool))) public hasVoted;

    // ----- Events -----

    /// @notice Emitted when a placement is registered for voting in an epoch.
    event PendingPlacementRegistered(
        uint256 indexed epochId,
        bytes32 indexed placementId,
        uint64 registeredAt,
        uint64 voteEndsAt
    );

    /// @notice Emitted when a vote is cast on a placement.
    event VoteCast(
        uint256 indexed epochId,
        bytes32 indexed placementId,
        address indexed voter,
        bool support,
        uint256 weight
    );

    /// @notice Emitted when an epoch is marked as finalized.
    event EpochFinalized(uint256 indexed epochId);
    /// @notice Emitted when the board admin address is updated.
    event BoardAdminUpdated(address indexed oldAdmin, address indexed newAdmin);
    /// @notice Emitted when the voting power source contract is changed.
    event VotingPowerSourceUpdated(address indexed oldSource, address indexed newSource);
    /// @notice Emitted when the minimum quorum threshold is updated.
    event QuorumUpdated(uint256 oldQuorum, uint256 newQuorum);

    /// @notice Deploy the voting contract with immutable epoch schedule parameters.
    /// @param _votingPowerSource Address of the IVotingPower implementation.
    /// @param _boardAdmin Address allowed to finalize epochs and update config.
    /// @param _minTotalWeightQuorum Minimum total vote weight for a placement to meet quorum.
    /// @param _epochZeroUnix Unix timestamp marking the start of epoch 0.
    /// @param _epochSeconds Duration of each epoch in seconds.
    /// @param _voteWindowSeconds Rolling vote window duration per placement.
    constructor(
        address _votingPowerSource,
        address _boardAdmin,
        uint256 _minTotalWeightQuorum,
        uint64 _epochZeroUnix,
        uint32 _epochSeconds,
        uint32 _voteWindowSeconds
    ) {
        require(_votingPowerSource != address(0), "invalid votingPowerSource");
        require(_boardAdmin != address(0), "invalid boardAdmin");
        require(_epochSeconds > 0, "epochSeconds=0");
        require(_voteWindowSeconds > 0, "voteWindow=0");

        votingPowerSource = IVotingPower(_votingPowerSource);
        boardAdmin = _boardAdmin;
        minTotalWeightQuorum = _minTotalWeightQuorum;

        epochZeroUnix = _epochZeroUnix;
        epochSeconds = _epochSeconds;
        voteWindowSeconds = _voteWindowSeconds;

        emit QuorumUpdated(0, _minTotalWeightQuorum);
        emit BoardAdminUpdated(address(0), _boardAdmin);
        emit VotingPowerSourceUpdated(address(0), _votingPowerSource);
    }

    modifier onlyBoardAdmin() {
        require(msg.sender == boardAdmin, "LoreboardVoting: not admin");
        _;
    }

    // ----------------- Epoch math (time-derived) -----------------

    /// @notice Epoch id at unix time `t`, where epoch 0 starts at epochZeroUnix.
    /// @param t Unix timestamp to convert.
    /// @return Epoch id containing timestamp `t`.
    function epochAt(uint64 t) public view returns (uint32) {
        require(t >= epochZeroUnix, "before epochZero");
        unchecked {
            return uint32((uint256(t - epochZeroUnix)) / uint256(epochSeconds));
        }
    }

    /// @notice Returns the unix timestamp at which an epoch begins.
    /// @param epochId The epoch to query.
    /// @return Unix timestamp of the epoch's start.
    function epochStart(uint32 epochId) public view returns (uint64) {
        unchecked {
            return uint64(uint256(epochZeroUnix) + uint256(epochId) * uint256(epochSeconds));
        }
    }

    /// @notice Returns the unix timestamp at which an epoch ends (inclusive).
    /// @param epochId The epoch to query.
    /// @return Unix timestamp of the epoch's last second.
    function epochEnd(uint32 epochId) public view returns (uint64) {
        unchecked {
            return uint64(uint256(epochStart(epochId)) + uint256(epochSeconds) - 1);
        }
    }

    // ----------------- Admin -----------------

    /// @notice Register a placement for voting. Derives voteEndsAt + epochId from block.timestamp.
    /// @param placementId Unique identifier for the placement.
    /// @return epochId The derived epoch the placement belongs to.
    function registerPlacement(bytes32 placementId) external returns (uint32 epochId) {
        require(placementId != bytes32(0), "bad id");
        PlacementMeta storage pm = placements[placementId];
        require(!pm.exists, "already registered");

        uint64 registeredAt = uint64(block.timestamp);
        uint64 voteEndsAt_ = registeredAt + uint64(voteWindowSeconds);

        uint32 epochId_ = epochAt(voteEndsAt_);

        pm.registeredAt = registeredAt;
        pm.voteEndsAt = voteEndsAt_;
        pm.placementEpochId = epochId_;
        pm.exists = true;

        isPendingPlacement[epochId_][placementId] = true;

        emit PendingPlacementRegistered(epochId_, placementId, registeredAt, voteEndsAt_);
        return epochId_;
    }

    /// @notice Lock an epoch (prevents further voting reads/writes for that epoch).
    /// @dev Worker will call this after epochEnd(epochId) when settling.
    /// @param epochId The epoch to finalize or un-finalize.
    /// @param finalized_ True to lock, false to unlock.
    function setEpochFinalized(uint256 epochId, bool finalized_) external onlyBoardAdmin {
        // idempotent: don't emit twice if already true
        if (epochs[epochId].finalized == finalized_) return;

        epochs[epochId].finalized = finalized_;
        if (finalized_) emit EpochFinalized(epochId);
    }

    /// @notice Transfer board admin role to a new address.
    /// @param newAdmin New admin address (must not be zero).
    function setBoardAdmin(address newAdmin) external onlyBoardAdmin {
        require(newAdmin != address(0), "LoreboardVoting: zero address");
        address old = boardAdmin;
        boardAdmin = newAdmin;
        emit BoardAdminUpdated(old, newAdmin);
    }

    /// @notice Swap the voting power source contract.
    /// @param newSource Address of the new IVotingPower implementation.
    function setVotingPowerSource(address newSource) external onlyBoardAdmin {
        require(newSource != address(0), "LoreboardVoting: zero source");
        address old = address(votingPowerSource);
        votingPowerSource = IVotingPower(newSource);
        emit VotingPowerSourceUpdated(old, newSource);
    }

    /// @notice Update the minimum total weight required for quorum.
    /// @param newQuorum New quorum threshold.
    function setMinTotalWeightQuorum(uint256 newQuorum) external onlyBoardAdmin {
        uint256 old = minTotalWeightQuorum;
        minTotalWeightQuorum = newQuorum;
        emit QuorumUpdated(old, newQuorum);
    }

    // ----------------- Voting -----------------

    /// @notice Cast a YES/NO vote for a placement.
    /// @dev Requires the caller to provide the correct epochId (derived from voteEndsAt).
    /// @param epochId Epoch the placement belongs to.
    /// @param placementId Placement to vote on.
    /// @param support True for YES, false for NO.
    function voteOnPlacement(
        uint256 epochId,
        bytes32 placementId,
        bool support
    ) external {
        _vote(epochId, placementId, support);
    }

    /// @notice Cast a YES/NO vote without supplying the epochId.
    /// @dev Uses the placement's derived epochId for consistency.
    /// @param placementId Placement to vote on.
    /// @param support True for YES, false for NO.
    function voteOnPlacement(bytes32 placementId, bool support) external {
        PlacementMeta memory pm = placements[placementId];
        require(pm.exists, "LoreboardVoting: unregistered placement");
        _vote(uint256(pm.placementEpochId), placementId, support);
    }

    function _vote(uint256 epochId, bytes32 placementId, bool support) internal {
        PlacementMeta memory pm = placements[placementId];
        require(pm.exists, "LoreboardVoting: unregistered placement");
        require(uint256(pm.placementEpochId) == epochId, "LoreboardVoting: wrong epochId");
        require(isPendingPlacement[epochId][placementId], "LoreboardVoting: not pending");

        require(!epochs[epochId].finalized, "LoreboardVoting: epoch finalized");
        require(block.timestamp >= pm.registeredAt, "LoreboardVoting: voting not started");
        require(block.timestamp <= pm.voteEndsAt, "LoreboardVoting: voting ended");
        require(!hasVoted[epochId][placementId][msg.sender], "LoreboardVoting: already voted");

        uint256 weight = votingPowerSource.votingPowerOf(
            msg.sender,
            uint256(pm.placementEpochId)
        );
        require(weight > 0, "LoreboardVoting: no voting power");

        hasVoted[epochId][placementId][msg.sender] = true;

        if (support) {
            placementYesVotes[epochId][placementId] += weight;
        } else {
            placementNoVotes[epochId][placementId] += weight;
        }

        emit VoteCast(epochId, placementId, msg.sender, support, weight);
    }

    // ----------------- Views -----------------

    /// @notice Get the current YES and NO vote weights for a placement.
    /// @param epochId Epoch the placement belongs to.
    /// @param placementId Placement to query.
    /// @return yesWeight Total YES vote weight.
    /// @return noWeight Total NO vote weight.
    function getPlacementVotes(uint256 epochId, bytes32 placementId)
        external
        view
        returns (uint256 yesWeight, uint256 noWeight)
    {
        return (placementYesVotes[epochId][placementId], placementNoVotes[epochId][placementId]);
    }

    /// @notice Placement is votable iff: registered, in correct epoch, not finalized, and before voteEndsAt.
    /// @param epochId Epoch to check.
    /// @param placementId Placement to check.
    /// @return True if the placement can currently be voted on.
    function isPlacementVotable(uint256 epochId, bytes32 placementId)
        external
        view
        returns (bool)
    {
        PlacementMeta memory pm = placements[placementId];
        if (!pm.exists) return false;
        if (uint256(pm.placementEpochId) != epochId) return false;
        if (!isPendingPlacement[epochId][placementId]) return false;
        if (epochs[epochId].finalized) return false;
        if (block.timestamp < pm.registeredAt) return false;
        if (block.timestamp > pm.voteEndsAt) return false;
        return true;
    }

    /// @notice Retrieve registration metadata for a placement.
    /// @param placementId Placement to query.
    /// @return registeredAt Unix timestamp when the placement was registered.
    /// @return voteEndsAt Unix timestamp when voting closes for this placement.
    /// @return epochId Derived epoch the placement belongs to.
    /// @return exists Whether the placement has been registered.
    function getPlacementMeta(bytes32 placementId)
        external
        view
        returns (uint64 registeredAt, uint64 voteEndsAt, uint32 epochId, bool exists)
    {
        PlacementMeta memory pm = placements[placementId];
        return (pm.registeredAt, pm.voteEndsAt, pm.placementEpochId, pm.exists);
    }

    /// @notice Check whether a placement meets the minimum total weight quorum.
    /// @param epochId Epoch the placement belongs to.
    /// @param placementId Placement to check.
    /// @return True if (yesWeight + noWeight) >= minTotalWeightQuorum.
    function meetsQuorum(uint256 epochId, bytes32 placementId) public view returns (bool) {
        uint256 yesW = placementYesVotes[epochId][placementId];
        uint256 noW  = placementNoVotes[epochId][placementId];
        return (yesW + noW) >= minTotalWeightQuorum;
    }

    /// @notice Returns true if YES is >= 51% of total (YES+NO) and quorum is met.
    /// @param epochId Epoch the placement belongs to.
    /// @param placementId Placement to check.
    /// @return True if the placement passes a simple 51% majority with quorum.
    function passesMajority51(uint256 epochId, bytes32 placementId) public view returns (bool) {
        uint256 yesW = placementYesVotes[epochId][placementId];
        uint256 noW  = placementNoVotes[epochId][placementId];
        uint256 total = yesW + noW;

        if (total < minTotalWeightQuorum) return false;
        return yesW * 100 >= total * 51;
    }
}
