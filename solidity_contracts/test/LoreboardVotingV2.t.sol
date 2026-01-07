// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/LoreboardVotingV2.sol";
import "../src/OnePerPlacementVotingPower.sol";

contract LoreboardVotingV2Test is Test {
    LoreboardVotingV2 internal voting;
    OnePerPlacementVotingPower internal votingPower;

    address internal admin = address(this);
    address internal voter = address(0xBEEF);

    uint64 internal epochZero = 1_730_937_600;
    uint32 internal epochSeconds = 86_400;
    uint32 internal voteWindowSeconds = 259_200;

    function setUp() public {
        votingPower = new OnePerPlacementVotingPower();
        voting = new LoreboardVotingV2(
            address(votingPower),
            admin,
            1,
            epochZero,
            epochSeconds,
            voteWindowSeconds
        );
    }

    function testRegisterCreatesMeta() public {
        bytes32 placementId = keccak256("placement-1");
        uint64 nowTs = epochZero + 100;
        vm.warp(nowTs);

        uint32 epochId = voting.registerPlacement(placementId);
        (uint64 registeredAt, uint64 voteEndsAt, uint32 derivedEpochId, bool exists) =
            voting.getPlacementMeta(placementId);

        assertTrue(exists);
        assertEq(registeredAt, nowTs);
        assertEq(voteEndsAt, nowTs + voteWindowSeconds);
        assertEq(derivedEpochId, epochId);
        assertEq(derivedEpochId, voting.epochAt(voteEndsAt));
    }

    function testVoteTwoArgIncrementsYes() public {
        bytes32 placementId = keccak256("placement-2");
        vm.warp(epochZero + 200);
        voting.registerPlacement(placementId);

        (,, uint32 epochId,) = voting.getPlacementMeta(placementId);

        vm.prank(voter);
        voting.voteOnPlacement(placementId, true);

        (uint256 yesWeight, uint256 noWeight) = voting.getPlacementVotes(epochId, placementId);
        assertEq(yesWeight, 1);
        assertEq(noWeight, 0);
    }

    function testVoteThreeArgWorks() public {
        bytes32 placementId = keccak256("placement-3");
        vm.warp(epochZero + 300);
        voting.registerPlacement(placementId);

        (,, uint32 epochId,) = voting.getPlacementMeta(placementId);

        vm.prank(voter);
        voting.voteOnPlacement(uint256(epochId), placementId, false);

        (uint256 yesWeight, uint256 noWeight) = voting.getPlacementVotes(epochId, placementId);
        assertEq(yesWeight, 0);
        assertEq(noWeight, 1);
    }

    function testVoteThreeArgWrongEpochReverts() public {
        bytes32 placementId = keccak256("placement-4");
        vm.warp(epochZero + 400);
        voting.registerPlacement(placementId);

        (,, uint32 epochId,) = voting.getPlacementMeta(placementId);
        uint256 wrongEpochId = uint256(epochId) + 1;

        vm.prank(voter);
        vm.expectRevert("LoreboardVoting: wrong epochId");
        voting.voteOnPlacement(wrongEpochId, placementId, true);
    }
}
