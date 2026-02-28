// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {FoidTrest} from "../src/FoidTrest.sol";
import {FoidTrestDirect} from "../src/FoidTrestDirect.sol";
import {FoidTrestGovernance} from "../src/FoidTrestGovernance.sol";
import {OnePerPlacementVotingPower} from "../src/OnePerPlacementVotingPower.sol";

contract FoidTrestGovernanceTest is Test {
    receive() external payable {}

    FoidTrest trest;
    FoidTrestDirect direct;
    FoidTrestGovernance governance;
    OnePerPlacementVotingPower votingPower;

    address owner = address(this);
    address feeRecipient = address(uint160(uint256(keccak256("feeRecipient"))));
    address placer = address(uint160(uint256(keccak256("placer"))));

    uint256 constant PLACEMENT_FEE = 0.001 ether;
    uint256 constant FLAG_FEE = 0.0002 ether;
    uint8 constant FLAG_THRESHOLD = 3; // lowered for tests
    uint32 constant VOTE_WINDOW = 86400;

    function setUp() public {
        votingPower = new OnePerPlacementVotingPower();
        trest = new FoidTrest();
        direct = new FoidTrestDirect(address(trest), feeRecipient, PLACEMENT_FEE);
        governance = new FoidTrestGovernance(
            address(trest),
            address(votingPower),
            feeRecipient,
            FLAG_FEE,
            FLAG_THRESHOLD,
            VOTE_WINDOW
        );

        trest.authorizeEntryPoint(address(direct));
        // Governance needs setVisibility permission — transfer ownership to governance
        // Actually, governance calls setVisibility which is onlyOwner on FoidTrest
        // So FoidTrest owner must be governance (or we transfer)
        trest.setOwner(address(governance));

        vm.deal(placer, 10 ether);
        // Place a post
        vm.prank(placer);
        direct.placeDirect{value: PLACEMENT_FEE}("QmTest", "Test Post", "A test");
    }

    function testFlagPost() public {
        address flagger = _makeAddr("flagger1");
        vm.deal(flagger, 1 ether);

        vm.prank(flagger);
        governance.flagPost{value: FLAG_FEE}(0);

        assertEq(governance.getFlagCount(0), 1);
        assertTrue(governance.hasFlagged(0, flagger));
    }

    function testCannotDoubleFlagSameWallet() public {
        address flagger = _makeAddr("flagger1");
        vm.deal(flagger, 1 ether);

        vm.prank(flagger);
        governance.flagPost{value: FLAG_FEE}(0);

        vm.prank(flagger);
        vm.expectRevert("Governance: already flagged");
        governance.flagPost{value: FLAG_FEE}(0);
    }

    function testFlagInsufficientFee() public {
        address flagger = _makeAddr("flagger1");
        vm.deal(flagger, 1 ether);

        vm.prank(flagger);
        vm.expectRevert("Governance: insufficient fee");
        governance.flagPost{value: FLAG_FEE - 1}(0);
    }

    function testFlagThresholdTriggersVote() public {
        _flagToThreshold(0);

        // Vote should be active
        uint256 voteId = governance.activeVoteForEntry(0);
        assertEq(voteId, 1);
        assertEq(governance.voteCount(), 1);

        FoidTrestGovernance.RemovalVote memory v = governance.getVote(1);
        assertEq(v.entryId, 0);
        assertFalse(v.resolved);
    }

    function testCannotFlagWhileVoteActive() public {
        _flagToThreshold(0);

        address extraFlagger = _makeAddr("extra");
        vm.deal(extraFlagger, 1 ether);

        vm.prank(extraFlagger);
        vm.expectRevert("Governance: vote already active");
        governance.flagPost{value: FLAG_FEE}(0);
    }

    function testVoteOnRemoval() public {
        _flagToThreshold(0);

        address voter1 = _makeAddr("voter1");
        address voter2 = _makeAddr("voter2");

        vm.prank(voter1);
        governance.voteOnRemoval(1, true); // for removal

        vm.prank(voter2);
        governance.voteOnRemoval(1, false); // against removal

        FoidTrestGovernance.RemovalVote memory v = governance.getVote(1);
        assertEq(v.votesFor, 1);
        assertEq(v.votesAgainst, 1);
    }

    function testCannotVoteTwice() public {
        _flagToThreshold(0);

        address voter = _makeAddr("voter1");

        vm.prank(voter);
        governance.voteOnRemoval(1, true);

        vm.prank(voter);
        vm.expectRevert("Governance: already voted");
        governance.voteOnRemoval(1, false);
    }

    function testRemovalPasses() public {
        _flagToThreshold(0);

        // Vote for removal (3 votes for, 1 against)
        for (uint i = 0; i < 3; i++) {
            address voter = _makeAddr(string(abi.encodePacked("removeVoter", i)));
            vm.prank(voter);
            governance.voteOnRemoval(1, true);
        }
        address keepVoter = _makeAddr("keepVoter");
        vm.prank(keepVoter);
        governance.voteOnRemoval(1, false);

        // Fast forward past window
        vm.warp(block.timestamp + VOTE_WINDOW + 1);

        governance.resolveRemovalVote(1);

        FoidTrestGovernance.RemovalVote memory v = governance.getVote(1);
        assertTrue(v.resolved);
        assertTrue(v.removalPassed);

        // Entry should be hidden
        FoidTrest.TrestEntry memory entry = trest.getEntry(0);
        assertFalse(entry.visible);
    }

    function testRemovalFails_FlagsReset() public {
        _flagToThreshold(0);

        // Vote against removal (2 against, 1 for)
        for (uint i = 0; i < 2; i++) {
            address voter = _makeAddr(string(abi.encodePacked("keepVoter", i)));
            vm.prank(voter);
            governance.voteOnRemoval(1, false);
        }
        address removeVoter = _makeAddr("removeVoter");
        vm.prank(removeVoter);
        governance.voteOnRemoval(1, true);

        vm.warp(block.timestamp + VOTE_WINDOW + 1);

        governance.resolveRemovalVote(1);

        FoidTrestGovernance.RemovalVote memory v = governance.getVote(1);
        assertTrue(v.resolved);
        assertFalse(v.removalPassed);

        // Entry should still be visible
        FoidTrest.TrestEntry memory entry = trest.getEntry(0);
        assertTrue(entry.visible);

        // Flags should be reset — can flag again
        assertEq(governance.getFlagCount(0), 0);
        assertEq(governance.activeVoteForEntry(0), 0);
    }

    function testCannotResolveBeforeWindowEnds() public {
        _flagToThreshold(0);

        vm.expectRevert("Governance: voting not ended");
        governance.resolveRemovalVote(1);
    }

    function testFlagFeesGoToRecipient() public {
        uint256 preBal = feeRecipient.balance;

        address flagger = _makeAddr("flagger1");
        vm.deal(flagger, 1 ether);

        vm.prank(flagger);
        governance.flagPost{value: FLAG_FEE}(0);

        assertEq(feeRecipient.balance, preBal + FLAG_FEE);
    }

    // ── Helpers ──

    function _flagToThreshold(uint256 entryId) internal {
        for (uint8 i = 0; i < FLAG_THRESHOLD; i++) {
            address flagger = _makeAddr(string(abi.encodePacked("flagger", i)));
            vm.deal(flagger, 1 ether);
            vm.prank(flagger);
            governance.flagPost{value: FLAG_FEE}(entryId);
        }
    }

    function _makeAddr(string memory name) internal pure returns (address) {
        return address(uint160(uint256(keccak256(abi.encodePacked(name)))));
    }
}
