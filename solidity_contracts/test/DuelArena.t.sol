// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {FoidTrest} from "../src/FoidTrest.sol";
import {DuelArena} from "../src/DuelArena.sol";
import {OnePerPlacementVotingPower} from "../src/OnePerPlacementVotingPower.sol";

contract DuelArenaTest is Test {
    FoidTrest trest;
    DuelArena arena;
    OnePerPlacementVotingPower votingPower;

    receive() external payable {}

    address owner = address(this);
    address operator = address(uint160(uint256(keccak256("operator"))));
    address user1 = address(uint160(uint256(keccak256("user1"))));
    address user2 = address(uint160(uint256(keccak256("user2"))));
    address voter1 = address(uint160(uint256(keccak256("voter1"))));
    address voter2 = address(uint160(uint256(keccak256("voter2"))));
    address voter3 = address(uint160(uint256(keccak256("voter3"))));

    uint32 constant VOTE_WINDOW = 86400; // 24h

    function setUp() public {
        votingPower = new OnePerPlacementVotingPower();
        trest = new FoidTrest();
        arena = new DuelArena(
            address(trest),
            address(votingPower),
            operator,
            VOTE_WINDOW,
            0 // no submission fee
        );
        trest.authorizeEntryPoint(address(arena));

        vm.deal(user1, 10 ether);
        vm.deal(user2, 10 ether);
        vm.deal(voter1, 10 ether);
        vm.deal(voter2, 10 ether);
        vm.deal(voter3, 10 ether);
    }

    function testSubmitMeme() public {
        vm.prank(user1);
        uint256 id = arena.submit("QmMemeA");
        assertEq(id, 0);
        assertEq(arena.submissionCount(), 1);
        assertEq(arena.unmatchedCount(), 1);

        DuelArena.Submission memory s = arena.getSubmission(0);
        assertEq(s.creator, user1);
        assertFalse(s.matched);
    }

    function testMatchDuel() public {
        vm.prank(user1);
        arena.submit("QmMemeA");
        vm.prank(user2);
        arena.submit("QmMemeB");

        vm.prank(operator);
        uint256 duelId = arena.matchDuel(0, 1);

        assertEq(duelId, 0);
        assertEq(arena.duelCount(), 1);
        assertEq(arena.unmatchedCount(), 0);

        DuelArena.Duel memory d = arena.getDuel(0);
        assertEq(d.submissionA, 0);
        assertEq(d.submissionB, 1);
        assertEq(d.winner, 0); // undecided
        assertFalse(d.finalized);
    }

    function testVoteOnDuel() public {
        _createDuel();

        vm.prank(voter1);
        arena.vote(0, 1); // vote for A

        vm.prank(voter2);
        arena.vote(0, 2); // vote for B

        vm.prank(voter3);
        arena.vote(0, 1); // vote for A

        DuelArena.Duel memory d = arena.getDuel(0);
        assertEq(d.totalVotesA, 2); // voter1 + voter3
        assertEq(d.totalVotesB, 1); // voter2
    }

    function testCannotVoteTwice() public {
        _createDuel();

        vm.prank(voter1);
        arena.vote(0, 1);

        vm.prank(voter1);
        vm.expectRevert("DuelArena: already voted");
        arena.vote(0, 2);
    }

    function testCannotVoteAfterWindow() public {
        _createDuel();

        // Fast forward past voting window
        vm.warp(block.timestamp + VOTE_WINDOW + 1);

        vm.prank(voter1);
        vm.expectRevert("DuelArena: voting ended");
        arena.vote(0, 1);
    }

    function testFinalizeDuel() public {
        _createDuel();

        vm.prank(voter1);
        arena.vote(0, 1); // A wins

        // Fast forward past voting window
        vm.warp(block.timestamp + VOTE_WINDOW + 1);

        vm.prank(operator);
        arena.finalizeDuel(0);

        DuelArena.Duel memory d = arena.getDuel(0);
        assertTrue(d.finalized);
        assertEq(d.winner, 1); // A won
        assertEq(trest.entryCount(), 1);

        FoidTrest.TrestEntry memory entry = trest.getEntry(0);
        assertEq(entry.creator, user1);
        assertEq(entry.path, 1); // duel path
    }

    function testCannotFinalizeBeforeWindowEnds() public {
        _createDuel();

        vm.prank(operator);
        vm.expectRevert("DuelArena: voting not ended");
        arena.finalizeDuel(0);
    }

    function testSubmissionFee() public {
        // Set a fee
        arena.setSubmissionFee(0.01 ether);

        vm.prank(user1);
        vm.expectRevert("DuelArena: insufficient fee");
        arena.submit("QmMemeA");

        vm.prank(user1);
        arena.submit{value: 0.01 ether}("QmMemeA");
        assertEq(arena.submissionCount(), 1);
    }

    function testTieGoesToSideA() public {
        _createDuel();

        vm.prank(voter1);
        arena.vote(0, 1); // 1 vote for A

        vm.prank(voter2);
        arena.vote(0, 2); // 1 vote for B

        vm.warp(block.timestamp + VOTE_WINDOW + 1);

        vm.prank(operator);
        arena.finalizeDuel(0);

        DuelArena.Duel memory d = arena.getDuel(0);
        assertEq(d.winner, 1); // tie => A wins
    }

    // ── Helpers ──

    function _createDuel() internal {
        vm.prank(user1);
        arena.submit("QmMemeA");
        vm.prank(user2);
        arena.submit("QmMemeB");

        vm.prank(operator);
        arena.matchDuel(0, 1);
    }
}
