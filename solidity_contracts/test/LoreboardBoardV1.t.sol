// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/LoreboardBoardV1.sol";
import "../src/LoreBoardTreasury.sol";
import "../src/LoreboardVotingV2.sol";
import "../src/OnePerPlacementVotingPower.sol";

contract LoreboardBoardV1Test is Test {
    LoreboardBoardV1 internal board;
    LoreBoardTreasury internal treasury;
    LoreboardVotingV2 internal voting;
    OnePerPlacementVotingPower internal votingPower;

    uint64 internal epochZero = 1_730_937_600;
    uint32 internal epochSeconds = 86_400;
    uint32 internal voteWindowSeconds = 259_200;

    address internal bidder = address(0xBEEF);

    function setUp() public {
        votingPower = new OnePerPlacementVotingPower();
        voting = new LoreboardVotingV2(
            address(votingPower),
            address(this),
            1,
            epochZero,
            epochSeconds,
            voteWindowSeconds
        );
        treasury = new LoreBoardTreasury(0, address(this));
        board = new LoreboardBoardV1(
            address(treasury),
            address(voting),
            epochZero,
            epochSeconds
        );
    }

    function testProposeUsesVotingEpoch() public {
        vm.warp(epochZero + 123);

        int32 x = 1;
        int32 y = 2;
        uint32 w = 64;
        uint32 h = 32;
        uint96 bidPerCellWei = 1;
        bytes memory cidBytes = bytes("bafybeigdyrzt");

        uint64 voteEndsAt = uint64(block.timestamp) + uint64(voting.voteWindowSeconds());
        uint32 expectedEpoch = voting.epochAt(voteEndsAt);

        uint32 cells = 2; // ceil(64/32) * ceil(32/32)
        uint256 value = uint256(bidPerCellWei) * uint256(cells);

        vm.deal(bidder, value);
        vm.prank(bidder);
        (bytes32 id, uint32 epoch, uint32 gotCells) = board.proposePlacement{value: value}(
            x,
            y,
            w,
            h,
            bidPerCellWei,
            cidBytes
        );

        bytes32 cidHash = keccak256(cidBytes);
        bytes32 expectedId = keccak256(
            abi.encodePacked(bidder, uint256(expectedEpoch), cidHash, x, y, w, h)
        );

        assertEq(epoch, expectedEpoch);
        assertEq(gotCells, cells);
        assertEq(id, expectedId);
        assertTrue(treasury.seenProposal(id));

        (,, uint32 placementEpochId, bool exists) = voting.getPlacementMeta(id);
        assertTrue(exists);
        assertEq(placementEpochId, expectedEpoch);
    }
}
