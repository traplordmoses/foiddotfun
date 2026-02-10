// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./LoreBoardTreasury.sol";
import "./LoreboardVotingV2.sol";

/// @title LoreboardBoardV2
/// @notice Main board entrypoint that validates tile-aligned proposals, stores CIDs,
/// and relays to Treasury + VotingV2. Also provides admin relay for epoch finalization.
contract LoreboardBoardV2 {
    uint32 public constant TILE = 32;
    uint32 public constant MAX_CELLS = 400;

    LoreBoardTreasury public immutable treasury;
    LoreboardVotingV2 public immutable votingV2;

    uint64 public immutable epochZeroUnix;
    uint32 public immutable epochSeconds;

    /// @notice operator allowed to finalize epochs + manage voting config via this board.
    address public operator;

    mapping(bytes32 => bytes) public cidOf;

    /// @notice Emitted when the operator address is rotated.
    event OperatorUpdated(address indexed oldOp, address indexed newOp);

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

    modifier onlyOperator() {
        require(msg.sender == operator, "Board: not operator");
        _;
    }

    /// @notice Deploy the board with immutable references to Treasury and VotingV2.
    /// @param _treasury Address of the deployed LoreBoardTreasury.
    /// @param _votingV2 Address of the deployed LoreboardVotingV2.
    /// @param _epochZeroUnix Unix timestamp of epoch 0 (must match VotingV2).
    /// @param _epochSeconds Duration of each epoch in seconds (must match VotingV2).
    /// @param _operator Address allowed to finalize epochs and manage config.
    constructor(
        address _treasury,
        address _votingV2,
        uint64 _epochZeroUnix,
        uint32 _epochSeconds,
        address _operator
    ) {
        require(_treasury != address(0), "treasury=0");
        require(_votingV2 != address(0), "votingV2=0");
        require(_operator != address(0), "operator=0");
        require(_epochSeconds > 0, "epochSeconds=0");

        treasury = LoreBoardTreasury(_treasury);
        votingV2 = LoreboardVotingV2(_votingV2);

        require(_epochZeroUnix == votingV2.epochZeroUnix(), "epochZero mismatch");
        require(_epochSeconds == votingV2.epochSeconds(), "epochSeconds mismatch");

        epochZeroUnix = _epochZeroUnix;
        epochSeconds = _epochSeconds;
        operator = _operator;
    }

    // ---------------- admin relay (this is what your worker needs) ----------------

    /// @notice Worker calls this when board is voting admin.
    /// @param epochId The epoch to mark as finalized in VotingV2.
    function finalizeEpochInVoting(uint256 epochId) external onlyOperator {
        votingV2.setEpochFinalized(epochId, true);
    }

    /// @notice Compatibility / manual control.
    /// @param epochId The epoch to update.
    /// @param finalized_ Whether the epoch should be marked finalized.
    function setEpochFinalized(uint256 epochId, bool finalized_) external onlyOperator {
        votingV2.setEpochFinalized(epochId, finalized_);
    }

    /// @notice Escape hatch: rotate voting admin if needed.
    /// @param newAdmin New board admin address for VotingV2.
    function setVotingBoardAdmin(address newAdmin) external onlyOperator {
        votingV2.setBoardAdmin(newAdmin);
    }

    /// @notice Rotate operator (optional).
    /// @param newOp New operator address.
    function setOperator(address newOp) external onlyOperator {
        require(newOp != address(0), "operator=0");
        address old = operator;
        operator = newOp;
        emit OperatorUpdated(old, newOp);
    }

    // ---------------- proposal flow (same as V1) ----------------

    /// @notice Submit a tile-aligned placement proposal with ETH escrow.
    /// @param x Top-left x coordinate of the placement rectangle.
    /// @param y Top-left y coordinate of the placement rectangle.
    /// @param w Width of the placement rectangle in pixels.
    /// @param h Height of the placement rectangle in pixels.
    /// @param bidPerCellWei Bid amount per cell in wei (must be >= base fee).
    /// @param cidBytes Raw CID bytes of the proposed content (1–96 bytes).
    /// @return id Unique proposal identifier (keccak of sender, epoch, cidHash, rect).
    /// @return epoch Derived epoch the proposal lands in based on vote window.
    /// @return cells Number of 32×32 tile cells the rectangle covers.
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
        id = keccak256(abi.encodePacked(msg.sender, uint256(epoch), cidHash, x, y, w, h));

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

        emit PlacementProposed(id, msg.sender, epoch, x, y, w, h, cells, bidPerCellWei, cidHash);
    }

    /// @dev Compute the number of 32×32 tile cells needed for a w×h rectangle.
    /// @param w Width in pixels.
    /// @param h Height in pixels.
    /// @return Number of cells (ceiling division for each dimension, then multiplied).
    function _cellsFor(uint32 w, uint32 h) internal pure returns (uint32) {
        uint256 cellsWide = (uint256(w) + TILE - 1) / TILE;
        uint256 cellsHigh = (uint256(h) + TILE - 1) / TILE;
        uint256 cells = cellsWide * cellsHigh;
        require(cells > 0, "cells=0");
        require(cells <= MAX_CELLS, "too many cells");
        return uint32(cells);
    }
}
