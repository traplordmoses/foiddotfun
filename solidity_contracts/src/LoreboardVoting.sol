// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./IVotingPower.sol";

/// @title LoreboardVoting v1 (YES/NO)
/// @notice On-chain tallies for FOID loreboard placements.
///         - One vote per address per placement per epoch (weighted)
///         - Only pending placements are votable
///         - Epochs have voting windows + finalized flag
///         - Records YES and NO weights
///         - Provides helpers for quorum + 51% YES threshold
contract LoreboardVoting {
    struct EpochConfig {
        uint64 votingStartsAt; // unix timestamp
        uint64 votingEndsAt;   // unix timestamp
        bool finalized;        // true once epoch is locked (no more voting)
    }

    /// @notice Source of voting power (pluggable for future streak/MiFOID logic).
    IVotingPower public votingPowerSource;

    /// @notice Address allowed to configure epochs and register pending placements.
    /// @dev Set this to your board contract or an admin EOA/multisig.
    address public boardAdmin;

    /// @notice Minimum total voting weight required for a placement to be considered valid.
    /// @dev Quorum is checked against yes+no for a placement in an epoch.
    uint256 public minTotalWeightQuorum;

    /// @notice Epoch configs by id.
    mapping(uint256 => EpochConfig) public epochs;

    /// @notice Whether a placement is pending (votable) in a given epoch.
    mapping(uint256 => mapping(bytes32 => bool)) public isPendingPlacement;

    /// @notice YES votes (total weight) for a placement in an epoch.
    mapping(uint256 => mapping(bytes32 => uint256)) public placementYesVotes;

    /// @notice NO votes (total weight) for a placement in an epoch.
    mapping(uint256 => mapping(bytes32 => uint256)) public placementNoVotes;

    /// @notice Tracks if a voter has already voted on a placement in an epoch.
    mapping(uint256 => mapping(bytes32 => mapping(address => bool))) public hasVoted;

    /// @notice Emitted when an epoch's voting window is configured or updated.
    event EpochConfigured(uint256 indexed epochId, uint64 startsAt, uint64 endsAt);
    /// @notice Emitted when a placement is registered as pending in an epoch.
    event PendingPlacementRegistered(uint256 indexed epochId, bytes32 indexed placementId);

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

    /// @notice Deploy the v1 voting contract.
    /// @param _votingPowerSource Address of the IVotingPower implementation.
    /// @param _boardAdmin Address allowed to configure epochs and manage placements.
    /// @param _minTotalWeightQuorum Minimum total vote weight for quorum.
    constructor(address _votingPowerSource, address _boardAdmin, uint256 _minTotalWeightQuorum) {
        require(_votingPowerSource != address(0), "invalid votingPowerSource");
        require(_boardAdmin != address(0), "invalid boardAdmin");
        votingPowerSource = IVotingPower(_votingPowerSource);
        boardAdmin = _boardAdmin;
        minTotalWeightQuorum = _minTotalWeightQuorum;
        emit QuorumUpdated(0, _minTotalWeightQuorum);
    }

    modifier onlyBoardAdmin() {
        require(msg.sender == boardAdmin, "LoreboardVoting: not admin");
        _;
    }

    modifier onlyWhileVoting(uint256 epochId) {
        EpochConfig memory e = epochs[epochId];
        require(
            e.votingStartsAt != 0 || e.votingEndsAt != 0,
            "LoreboardVoting: epoch not configured"
        );
        require(block.timestamp >= e.votingStartsAt, "LoreboardVoting: voting not started");
        require(block.timestamp <= e.votingEndsAt, "LoreboardVoting: voting ended");
        require(!e.finalized, "LoreboardVoting: epoch finalized");
        _;
    }

    // ----------------- Admin -----------------

    /// @notice Configure or update an epoch's voting window.
    /// @dev `votingStartsAt < votingEndsAt` is enforced.
    /// @param epochId Epoch to configure.
    /// @param votingStartsAt Unix timestamp when voting opens.
    /// @param votingEndsAt Unix timestamp when voting closes.
    function configureEpoch(
        uint256 epochId,
        uint64 votingStartsAt,
        uint64 votingEndsAt
    ) external onlyBoardAdmin {
        require(votingStartsAt < votingEndsAt, "LoreboardVoting: bad times");

        epochs[epochId].votingStartsAt = votingStartsAt;
        epochs[epochId].votingEndsAt = votingEndsAt;

        emit EpochConfigured(epochId, votingStartsAt, votingEndsAt);
    }

    /// @notice Register a placement as pending (votable) in a given epoch.
    /// @param epochId Epoch the placement belongs to.
    /// @param placementId Unique placement identifier.
    function registerPendingPlacement(uint256 epochId, bytes32 placementId)
        external
        onlyBoardAdmin
    {
        isPendingPlacement[epochId][placementId] = true;
        emit PendingPlacementRegistered(epochId, placementId);
    }

    /// @notice Mark an epoch as finalized or un-finalized.
    /// @param epochId Epoch to update.
    /// @param finalized_ True to lock, false to unlock.
    function setEpochFinalized(uint256 epochId, bool finalized_) external onlyBoardAdmin {
        epochs[epochId].finalized = finalized_;
        if (finalized_) {
            emit EpochFinalized(epochId);
        }
    }

    /// @notice Update the board admin address.
    /// @param newAdmin New admin address (must not be zero).
    function setBoardAdmin(address newAdmin) external onlyBoardAdmin {
        require(newAdmin != address(0), "LoreboardVoting: zero address");
        address old = boardAdmin;
        boardAdmin = newAdmin;
        emit BoardAdminUpdated(old, newAdmin);
    }

    /// @notice Update the voting power source contract (for future streak/MiFOID logic).
    /// @param newSource Address of the new IVotingPower implementation.
    function setVotingPowerSource(address newSource) external onlyBoardAdmin {
        require(newSource != address(0), "LoreboardVoting: zero source");
        address old = address(votingPowerSource);
        votingPowerSource = IVotingPower(newSource);
        emit VotingPowerSourceUpdated(old, newSource);
    }

    /// @notice Update the minimum total voting weight quorum.
    /// @param newQuorum New quorum threshold.
    function setMinTotalWeightQuorum(uint256 newQuorum) external onlyBoardAdmin {
        uint256 old = minTotalWeightQuorum;
        minTotalWeightQuorum = newQuorum;
        emit QuorumUpdated(old, newQuorum);
    }

    // ----------------- Voting -----------------

    /// @notice Cast a YES/NO vote for a placement in an epoch.
    /// @dev Semantics:
    ///      - each address can vote at most once per (epochId, placementId)
    ///      - weight is provided by IVotingPower
    ///      - support=true => YES, support=false => NO
    /// @param epochId Epoch the placement belongs to.
    /// @param placementId Placement to vote on.
    /// @param support True for YES, false for NO.
    function voteOnPlacement(
        uint256 epochId,
        bytes32 placementId,
        bool support
    ) external onlyWhileVoting(epochId) {
        require(isPendingPlacement[epochId][placementId], "LoreboardVoting: not pending");
        require(!hasVoted[epochId][placementId][msg.sender], "LoreboardVoting: already voted");

        uint256 weight = votingPowerSource.votingPowerOf(msg.sender, epochId);
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

    /// @notice Returns (yesWeight, noWeight) for a placement in an epoch.
    /// @param epochId Epoch to query.
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

    /// @notice Check if a placement is currently votable for an epoch.
    /// @param epochId Epoch to check.
    /// @param placementId Placement to check.
    /// @return True if the placement can currently be voted on.
    function isPlacementVotable(uint256 epochId, bytes32 placementId)
        external
        view
        returns (bool)
    {
        EpochConfig memory e = epochs[epochId];
        if (e.finalized) return false;
        if (block.timestamp < e.votingStartsAt) return false;
        if (block.timestamp > e.votingEndsAt) return false;
        return isPendingPlacement[epochId][placementId];
    }

    /// @notice Returns true if (yes+no) meets the quorum for the placement in this epoch.
    /// @param epochId Epoch to check.
    /// @param placementId Placement to check.
    /// @return True if total vote weight meets or exceeds minTotalWeightQuorum.
    function meetsQuorum(uint256 epochId, bytes32 placementId) public view returns (bool) {
        uint256 yesW = placementYesVotes[epochId][placementId];
        uint256 noW = placementNoVotes[epochId][placementId];
        return (yesW + noW) >= minTotalWeightQuorum;
    }

    /// @notice Returns true if YES is >= 51% of total (YES+NO). Also requires quorum.
    /// @dev Uses integer math: yes * 100 >= 51 * total.
    /// @param epochId Epoch to check.
    /// @param placementId Placement to check.
    /// @return True if the placement passes a simple 51% majority with quorum.
    function passesMajority51(uint256 epochId, bytes32 placementId) public view returns (bool) {
        uint256 yesW = placementYesVotes[epochId][placementId];
        uint256 noW = placementNoVotes[epochId][placementId];
        uint256 total = yesW + noW;

        if (total < minTotalWeightQuorum) return false;

        // 51% threshold
        return yesW * 100 >= total * 51;
    }

    /// @notice Get the current config for an epoch.
    /// @param epochId Epoch to query.
    /// @return startsAt Unix timestamp when voting opens.
    /// @return endsAt Unix timestamp when voting closes.
    /// @return finalized Whether the epoch has been finalized.
    function getEpochConfig(uint256 epochId)
        external
        view
        returns (uint64 startsAt, uint64 endsAt, bool finalized)
    {
        EpochConfig memory e = epochs[epochId];
        return (e.votingStartsAt, e.votingEndsAt, e.finalized);
    }
}