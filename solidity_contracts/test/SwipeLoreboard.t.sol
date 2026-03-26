// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {SwipeLoreboard} from "../src/SwipeLoreboard.sol";

/// @dev Mock voting power that returns configurable weights.
contract MockVotingPower {
    mapping(address => uint256) public power;

    function setPower(address voter, uint256 w) external {
        power[voter] = w;
    }

    function votingPowerOf(address voter, uint256) external view returns (uint256) {
        return power[voter];
    }
}

contract SwipeLoreboardTest is Test {
    SwipeLoreboard internal board;
    MockVotingPower internal vp;

    address internal owner = address(this);
    address internal operatorAddr = address(0xAAAA);
    address internal feeRecipient = address(0xFEE);
    address internal user1 = address(0x1111);
    address internal user2 = address(0x2222);
    address internal user3 = address(0x3333);
    address internal outsider = address(0x9999);

    uint256 constant PLACEMENT_FEE = 0.001 ether;
    uint256 constant FLAG_FEE = 0.001 ether;
    uint8 constant FLAG_THRESHOLD = 3;
    uint32 constant REMOVAL_WINDOW = 259200; // 72h

    function setUp() public {
        vp = new MockVotingPower();

        board = new SwipeLoreboard(
            feeRecipient,
            address(vp),
            PLACEMENT_FEE,
            FLAG_FEE,
            FLAG_THRESHOLD,
            REMOVAL_WINDOW,
            operatorAddr
        );

        // Give users ETH for fees
        vm.deal(user1, 10 ether);
        vm.deal(user2, 10 ether);
        vm.deal(user3, 10 ether);

        // Set voting power for users
        vp.setPower(user1, 100);
        vp.setPower(user2, 100);
        vp.setPower(user3, 100);
    }

    // ══════════════════════════════════════════════
    //  CONSTRUCTOR
    // ══════════════════════════════════════════════

    function testConstructorSetsState() public view {
        assertEq(board.owner(), owner);
        assertEq(board.operator(), operatorAddr);
        assertEq(board.feeRecipient(), feeRecipient);
        assertEq(board.votingPowerSource(), address(vp));
        assertEq(board.placementFeeWei(), PLACEMENT_FEE);
        assertEq(board.flagFeeWei(), FLAG_FEE);
        assertEq(board.flagThreshold(), FLAG_THRESHOLD);
        assertEq(board.removalVoteWindowSeconds(), REMOVAL_WINDOW);
    }

    // ══════════════════════════════════════════════
    //  PLACE (ORIGINAL - PAYABLE)
    // ══════════════════════════════════════════════

    function testRegularPlaceWorks() public {
        vm.prank(user1);
        uint256 id = board.place{value: PLACEMENT_FEE}(
            0, 0, 64, 64, bytes("QmTestCid12345")
        );

        assertEq(id, 0);
        assertEq(board.placementCount(), 1);

        SwipeLoreboard.Placement memory p = board.getPlacement(0);
        assertEq(p.placer, user1);
        assertEq(p.x, 0);
        assertEq(p.y, 0);
        assertEq(p.w, 64);
        assertEq(p.h, 64);
        assertEq(p.cells, 4); // (64/32) * (64/32) = 4
        assertFalse(p.removed);
    }

    function testRegularPlaceRevertsInsufficientFee() public {
        vm.prank(user1);
        vm.expectRevert("Loreboard: insufficient fee");
        board.place{value: 0}(0, 0, 32, 32, bytes("QmTestCid"));
    }

    // ══════════════════════════════════════════════
    //  PLACEFOR (OPERATOR - NO FEE)
    // ══════════════════════════════════════════════

    function testPlaceForRegistersPlacement() public {
        vm.prank(operatorAddr);
        uint256 id = board.placeFor(
            user1, 100, 200, 128, 96, bytes("QmVotedInCid")
        );

        assertEq(id, 0);
        assertEq(board.placementCount(), 1);

        SwipeLoreboard.Placement memory p = board.getPlacement(0);
        assertEq(p.placer, user1);
        assertEq(p.x, 100);
        assertEq(p.y, 200);
        assertEq(p.w, 128);
        assertEq(p.h, 96);
        assertEq(p.cells, 12); // (128/32) * (96/32) = 4*3 = 12
        assertFalse(p.removed);
    }

    function testPlaceForRevertsForNonOperator() public {
        vm.prank(outsider);
        vm.expectRevert("Loreboard: not operator");
        board.placeFor(user1, 0, 0, 32, 32, bytes("QmTest"));
    }

    function testPlaceForRevertsForZeroPlacer() public {
        vm.prank(operatorAddr);
        vm.expectRevert("Loreboard: zero placer");
        board.placeFor(address(0), 0, 0, 32, 32, bytes("QmTest"));
    }

    function testPlaceForNoFeeRequired() public {
        // Operator places with 0 value — should succeed
        vm.prank(operatorAddr);
        uint256 id = board.placeFor(user1, 0, 0, 32, 32, bytes("QmTest"));
        assertEq(id, 0);
    }

    function testOwnerCanCallPlaceFor() public {
        // Owner also passes onlyOperator check
        uint256 id = board.placeFor(user1, 0, 0, 32, 32, bytes("QmOwnerPlace"));
        assertEq(id, 0);
        assertEq(board.getPlacement(0).placer, user1);
    }

    // ══════════════════════════════════════════════
    //  PLACEFOR ENABLES FLAGGING
    // ══════════════════════════════════════════════

    function testPlaceForEnablesFlagging() public {
        // Operator registers a placement
        vm.prank(operatorAddr);
        uint256 placementId = board.placeFor(
            user1, 0, 0, 64, 64, bytes("QmFlaggable")
        );

        // User2 can flag it
        vm.prank(user2);
        board.flagPlacement{value: FLAG_FEE}(placementId);

        assertEq(board.getFlagCount(placementId), 1);
    }

    // ══════════════════════════════════════════════
    //  FLAGGING → REMOVAL VOTE → RESOLVE
    // ══════════════════════════════════════════════

    function testFlaggingTriggersRemovalVote() public {
        // Place something
        vm.prank(user1);
        uint256 pid = board.place{value: PLACEMENT_FEE}(0, 0, 32, 32, bytes("QmFlagMe"));

        // 3 users flag it (threshold = 3)
        vm.prank(user1);
        board.flagPlacement{value: FLAG_FEE}(pid);
        vm.prank(user2);
        board.flagPlacement{value: FLAG_FEE}(pid);
        vm.prank(user3);
        board.flagPlacement{value: FLAG_FEE}(pid);

        // Removal vote should be active
        assertEq(board.voteCount(), 1);
        uint256 voteId = board.activeVoteForPlacement(pid);
        assertEq(voteId, 1);

        SwipeLoreboard.RemovalVote memory v = board.getRemovalVote(1);
        assertEq(v.placementId, pid);
        assertFalse(v.resolved);
    }

    function testRemovalVoteResolves() public {
        // Place
        vm.prank(user1);
        uint256 pid = board.place{value: PLACEMENT_FEE}(0, 0, 32, 32, bytes("QmRemoveMe"));

        // Flag to threshold
        vm.prank(user1);
        board.flagPlacement{value: FLAG_FEE}(pid);
        vm.prank(user2);
        board.flagPlacement{value: FLAG_FEE}(pid);
        vm.prank(user3);
        board.flagPlacement{value: FLAG_FEE}(pid);

        uint256 voteId = board.activeVoteForPlacement(pid);

        // Vote for removal (majority)
        vm.prank(user2);
        board.voteOnRemoval(voteId, true); // remove
        vm.prank(user3);
        board.voteOnRemoval(voteId, true); // remove

        // Warp past vote window
        vm.warp(block.timestamp + REMOVAL_WINDOW + 1);

        // Resolve
        board.resolveRemovalVote(voteId);

        SwipeLoreboard.RemovalVote memory v = board.getRemovalVote(voteId);
        assertTrue(v.resolved);
        assertTrue(v.removalPassed);

        // Placement should be marked removed
        SwipeLoreboard.Placement memory p = board.getPlacement(pid);
        assertTrue(p.removed);
    }

    function testRemovalVoteFailsKeepsPlacement() public {
        // Place
        vm.prank(user1);
        uint256 pid = board.place{value: PLACEMENT_FEE}(0, 0, 32, 32, bytes("QmKeepMe"));

        // Flag to threshold
        vm.prank(user1);
        board.flagPlacement{value: FLAG_FEE}(pid);
        vm.prank(user2);
        board.flagPlacement{value: FLAG_FEE}(pid);
        vm.prank(user3);
        board.flagPlacement{value: FLAG_FEE}(pid);

        uint256 voteId = board.activeVoteForPlacement(pid);

        // Vote against removal (majority)
        vm.prank(user2);
        board.voteOnRemoval(voteId, false); // keep
        vm.prank(user3);
        board.voteOnRemoval(voteId, false); // keep

        // Warp past vote window
        vm.warp(block.timestamp + REMOVAL_WINDOW + 1);

        // Resolve
        board.resolveRemovalVote(voteId);

        SwipeLoreboard.RemovalVote memory v = board.getRemovalVote(voteId);
        assertTrue(v.resolved);
        assertFalse(v.removalPassed);

        // Placement should NOT be removed
        SwipeLoreboard.Placement memory p = board.getPlacement(pid);
        assertFalse(p.removed);

        // Flags should be reset (can be flagged again)
        assertEq(board.getFlagCount(pid), 0);
    }

    // ══════════════════════════════════════════════
    //  ADMIN
    // ══════════════════════════════════════════════

    function testSetOperator() public {
        address newOp = address(0xBBBB);
        board.setOperator(newOp);
        assertEq(board.operator(), newOp);
    }

    function testSetOperatorRevertsForNonOwner() public {
        vm.prank(outsider);
        vm.expectRevert("Loreboard: not owner");
        board.setOperator(outsider);
    }

    function testSetOperatorRevertsForZero() public {
        vm.expectRevert("Loreboard: zero address");
        board.setOperator(address(0));
    }
}
