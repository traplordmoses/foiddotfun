// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./LoreBoardTreasury.sol";
import "./LoreboardVotingV2.sol";

/// @notice On-chain Board entrypoint for permissionless proposals.
contract LoreboardBoardV1 {
    uint32 public constant TILE = 32;
    uint32 public constant MAX_CELLS = 400;

    LoreBoardTreasury public immutable treasury;
    LoreboardVotingV2 public immutable votingV2;

    uint64 public immutable epochZeroUnix;
    uint32 public immutable epochSeconds;

    mapping(bytes32 => bytes) public cidOf;

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
    }

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

    function _cellsFor(uint32 w, uint32 h) internal pure returns (uint32) {
        uint256 cellsWide = (uint256(w) + TILE - 1) / TILE;
        uint256 cellsHigh = (uint256(h) + TILE - 1) / TILE;
        uint256 cells = cellsWide * cellsHigh;
        require(cells > 0, "cells=0");
        require(cells <= MAX_CELLS, "too many cells");
        return uint32(cells);
    }
}
