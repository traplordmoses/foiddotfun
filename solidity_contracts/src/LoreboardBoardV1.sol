// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./LoreBoardTreasury.sol";
import "./LoreboardVotingV2.sol";

/// @title LoreboardBoardV1
/// @notice Legacy board entrypoint for permissionless proposals using workerAdmin instead of operator.
/// @dev Optional: includes a relay for VotingV2 epoch finalization if you set VotingV2.boardAdmin = this board.
contract LoreboardBoardV1 {
    uint32 public constant TILE = 32;
    uint32 public constant MAX_CELLS = 400;

    LoreBoardTreasury public immutable treasury;
    LoreboardVotingV2 public immutable votingV2;

    uint64 public immutable epochZeroUnix;
    uint32 public immutable epochSeconds;

    /// @notice Who is allowed to relay admin actions (epoch finalization) through this board.
    /// @dev Defaults to deployer. Changeable.
    address public workerAdmin;

    mapping(bytes32 => bytes) public cidOf;

    /// @notice Emitted when a placement proposal is submitted through this board.
    event PlacementProposed(
        bytes32 indexed id,
        address indexed bidder,
        uint32 epoch,
        int32 x,
        int32 y,
        uint32 w,
        uint32 h,
        uint32 cells,
        uint96 bidPerCellWei,
        bytes32 cidHash
    );

    /// @notice Emitted when the worker admin address is changed.
    event WorkerAdminUpdated(address indexed oldAdmin, address indexed newAdmin);

    modifier onlyWorkerAdmin() {
        require(msg.sender == workerAdmin, "Board: not worker admin");
        _;
    }

    /// @notice Deploy the V1 board with immutable references to Treasury and VotingV2.
    /// @param _treasury Address of the deployed LoreBoardTreasury.
    /// @param _votingV2 Address of the deployed LoreboardVotingV2.
    /// @param _epochZeroUnix Unix timestamp of epoch 0 (must match VotingV2).
    /// @param _epochSeconds Duration of each epoch in seconds (must match VotingV2).
    constructor(
        address _treasury,
        address _votingV2,
        uint64 _epochZeroUnix,
        uint32 _epochSeconds
    ) {
        require(_treasury != address(0), "treasury=0");
        require(_votingV2 != address(0), "votingV2=0");
        require(_epochSeconds > 0, "epochSeconds=0");

        treasury = LoreBoardTreasury(_treasury);
        votingV2 = LoreboardVotingV2(_votingV2);

        require(_epochZeroUnix == votingV2.epochZeroUnix(), "epochZero mismatch");
        require(_epochSeconds == votingV2.epochSeconds(), "epochSeconds mismatch");

        epochZeroUnix = _epochZeroUnix;
        epochSeconds = _epochSeconds;

        workerAdmin = msg.sender;
        emit WorkerAdminUpdated(address(0), msg.sender);
    }

    // ----------------- Proposals -----------------

    /// @notice Submit a tile-aligned placement proposal with ETH escrow.
    /// @param x Top-left x coordinate of the placement rectangle.
    /// @param y Top-left y coordinate of the placement rectangle.
    /// @param w Width of the placement rectangle in pixels.
    /// @param h Height of the placement rectangle in pixels.
    /// @param bidPerCellWei Bid amount per cell in wei (must be >= base fee).
    /// @param cidBytes Raw CID bytes of the proposed content (1–96 bytes).
    /// @return id Unique proposal identifier.
    /// @return epoch Derived epoch the proposal lands in.
    /// @return cells Number of 32x32 tile cells the rectangle covers.
    function proposePlacement(
        int32 x,
        int32 y,
        uint32 w,
        uint32 h,
        uint96 bidPerCellWei,
        bytes calldata cidBytes
    ) external payable returns (bytes32 id, uint32 epoch, uint32 cells) {
        require(w > 0 && h > 0, "zero size");
        require(w <= uint32(type(int32).max), "w too large");
        require(h <= uint32(type(int32).max), "h too large");
        require(cidBytes.length > 0 && cidBytes.length <= 96, "bad cid");

        cells = _cellsFor(w, h);

        uint64 voteEndsAt = uint64(block.timestamp) + uint64(votingV2.voteWindowSeconds());
        epoch = votingV2.epochAt(voteEndsAt);

        bytes32 cidHash = keccak256(cidBytes);
        id = keccak256(
            abi.encodePacked(
                msg.sender,
                uint256(epoch),
                cidHash,
                x,
                y,
                w,
                h
            )
        );

        uint256 required = uint256(bidPerCellWei) * uint256(cells);
        require(msg.value == required, "bad msg.value");

        LoreBoardTreasury.Rect memory rect = LoreBoardTreasury.Rect({
            x: x,
            y: y,
            w: int32(uint32(w)),
            h: int32(uint32(h))
        });

        LoreBoardTreasury.Proposed memory p = LoreBoardTreasury.Proposed({
            id: id,
            bidder: msg.sender,
            rect: rect,
            cells: cells,
            bidPerCellWei: bidPerCellWei,
            cidHash: cidHash,
            epoch: epoch
        });

        treasury.proposePlacement{value: msg.value}(p);

        uint32 got = votingV2.registerPlacement(id);
        require(got == epoch, "epoch mismatch");

        cidOf[id] = cidBytes;

        emit PlacementProposed(
            id,
            msg.sender,
            epoch,
            x,
            y,
            w,
            h,
            cells,
            bidPerCellWei,
            cidHash
        );
    }

    // ----------------- Worker admin / relay -----------------

    /// @notice Transfer the worker admin role to a new address.
    /// @param newAdmin New worker admin address (must not be zero).
    function setWorkerAdmin(address newAdmin) external onlyWorkerAdmin {
        require(newAdmin != address(0), "Board: zero admin");
        address old = workerAdmin;
        workerAdmin = newAdmin;
        emit WorkerAdminUpdated(old, newAdmin);
    }

    /// @notice Relay method your worker already expects (name matches your logs).
    /// @dev Only works if VotingV2.boardAdmin == address(this).
    /// @param epochId The epoch to finalize in VotingV2.
    function finalizeEpochInVoting(uint256 epochId) external onlyWorkerAdmin {
        _requireEpochEnded(epochId);
        votingV2.setEpochFinalized(epochId, true);
    }

    /// @notice More general relay (finalize or unfinalize).
    /// @dev Only works if VotingV2.boardAdmin == address(this).
    /// @param epochId The epoch to update.
    /// @param finalized_ Whether the epoch should be marked finalized.
    function setEpochFinalizedInVoting(uint256 epochId, bool finalized_) external onlyWorkerAdmin {
        if (finalized_) _requireEpochEnded(epochId);
        votingV2.setEpochFinalized(epochId, finalized_);
    }

    function _requireEpochEnded(uint256 epochId) internal view {
        require(epochId <= type(uint32).max, "Board: epochId too large");
        uint64 end = _epochEnd(uint32(epochId));
        require(block.timestamp > end, "Board: epoch not ended");
    }

    function _epochStart(uint32 epochId) internal view returns (uint64) {
        unchecked {
            return uint64(uint256(epochZeroUnix) + uint256(epochId) * uint256(epochSeconds));
        }
    }

    function _epochEnd(uint32 epochId) internal view returns (uint64) {
        unchecked {
            return uint64(uint256(_epochStart(epochId)) + uint256(epochSeconds) - 1);
        }
    }

    // ----------------- Helpers -----------------

    function _cellsFor(uint32 w, uint32 h) internal pure returns (uint32) {
        uint256 cellsWide = (uint256(w) + TILE - 1) / TILE;
        uint256 cellsHigh = (uint256(h) + TILE - 1) / TILE;
        uint256 cells = cellsWide * cellsHigh;
        require(cells > 0, "cells=0");
        require(cells <= MAX_CELLS, "too many cells");
        return uint32(cells);
    }
}
