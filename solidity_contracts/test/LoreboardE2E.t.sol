// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {Loreboard} from "../src/Loreboard.sol";
import {StreakVotingPower} from "../src/StreakVotingPower.sol";
import {PrayerTiers} from "../src/PrayerTiers.sol";

/// @dev Mock PrayerMirror — lets tests set arbitrary streaks.
contract MockPrayerMirror {
    mapping(address => uint256) public streaks;
    function setStreak(address user, uint256 days_) external { streaks[user] = days_; }
    function get(address user) external view returns (uint256, uint256, uint256) {
        return (streaks[user], streaks[user], streaks[user]);
    }
}

/// @title LoreboardE2ETest
/// @notice Full end-to-end integration: PrayerMirror → PrayerTiers → StreakVotingPower → Loreboard.
///         Proves the complete loop: propose → streak-weighted vote → quorum → finalize → permanent placement.
contract LoreboardE2ETest is Test {
    MockPrayerMirror internal mirror;
    PrayerTiers internal tiers;
    StreakVotingPower internal vp;
    Loreboard internal board;

    address internal operator;

    // User A: 30-day streak (Oracle, 2.5x → weight 250)
    address internal userA;
    // User B: 7-day streak (Devotee, 1.5x → weight 150)
    address internal userB;
    // User C: 0-day streak (Unranked → baseWeight 100)
    address internal userC;

    address internal feeRecipient = address(0xFEE);

    uint256 constant SUB_FEE     = 0.001 ether;
    uint32  constant VOTE_WINDOW = 259200; // 72h

    function setUp() public {
        operator = vm.addr(0xA11CE);
        userA    = vm.addr(0xAAA1);
        userB    = vm.addr(0xBBB1);
        userC    = vm.addr(0xCCC1);

        mirror = new MockPrayerMirror();
        tiers  = new PrayerTiers(address(mirror));
        vp     = new StreakVotingPower(address(mirror), address(0), 100, 50);
        vp.setPrayerTiers(address(tiers));

        board = new Loreboard(
            address(vp),
            operator,
            feeRecipient,
            SUB_FEE,
            VOTE_WINDOW
        );

        // Post-deploy assertions
        assertEq(board.approvalThresholdBps(), 5100);
        assertEq(board.minVoterQuorum(), 3);

        // Simulate prayer streaks
        mirror.setStreak(userA, 30); // Oracle → 2.5x → weight 250
        mirror.setStreak(userB, 7);  // Devotee → 1.5x → weight 150
        mirror.setStreak(userC, 0);  // Unranked → baseWeight 100

        vm.deal(userA,    100 ether);
        vm.deal(userB,    100 ether);
        vm.deal(userC,    100 ether);
        vm.deal(operator, 100 ether);
    }

    // ══════════════════════════════════════════════
    //  1. FULL FLOW: propose → vote → finalize → placement
    // ══════════════════════════════════════════════

    function testFullLoreboardFlow() public {
        assertEq(vp.votingPowerOf(userA, 0), 250, "A: 30d Oracle = 250");
        assertEq(vp.votingPowerOf(userB, 0), 150, "B: 7d Devotee = 150");
        assertEq(vp.votingPowerOf(userC, 0), 100, "C: 0d Unranked = 100");

        // 1. Propose
        vm.prank(userA);
        uint256 pid = board.propose{value: SUB_FEE}("QmFullFlow", 0, 0, 64, 64);

        // 2. Vote (3 unique wallets → meets quorum)
        vm.prank(userA); board.castVote(pid, true);
        vm.prank(userB); board.castVote(pid, true);
        vm.prank(userC); board.castVote(pid, true);

        // 3. Finalize (permissionless)
        vm.warp(block.timestamp + VOTE_WINDOW + 1);
        board.finalize(pid); // called by test contract, not operator

        // 4. Verify
        Loreboard.Proposal memory p = board.getProposal(pid);
        assertTrue(p.finalized);
        assertTrue(p.approved, "100% with 3 voters should pass");

        assertEq(board.placementCount(), 1);
        Loreboard.Placement memory pl = board.getPlacement(0);
        assertEq(pl.placer, userA);
        assertFalse(pl.removed);
    }

    // ══════════════════════════════════════════════
    //  2. REJECTED: below threshold
    // ══════════════════════════════════════════════

    function testRejectedBelowThreshold() public {
        vm.prank(userA);
        uint256 pid = board.propose{value: SUB_FEE}("QmRejected", 100, 100, 32, 32);

        // C votes yes (100), A+B vote no (250+150=400) → 20% < 51%
        vm.prank(userA); board.castVote(pid, false);
        vm.prank(userB); board.castVote(pid, false);
        vm.prank(userC); board.castVote(pid, true);

        vm.warp(block.timestamp + VOTE_WINDOW + 1);
        board.finalize(pid);

        assertFalse(board.getProposal(pid).approved, "20% should not pass");
        assertEq(board.placementCount(), 0);
    }

    // ══════════════════════════════════════════════
    //  3. QUORUM: 2 voters not enough even at 100%
    // ══════════════════════════════════════════════

    function testQuorumBlocksSelfApproval() public {
        vm.prank(userA);
        uint256 pid = board.propose{value: SUB_FEE}("QmSelfApprove", 0, 0, 32, 32);

        // Only A votes (250/250 = 100% but only 1 voter < quorum 3)
        vm.prank(userA); board.castVote(pid, true);

        vm.warp(block.timestamp + VOTE_WINDOW + 1);
        board.finalize(pid);

        assertFalse(board.getProposal(pid).approved, "1 voter < quorum 3 -> rejected");
    }

    // ══════════════════════════════════════════════
    //  4. WEIGHTED: high-streak minority wins
    // ══════════════════════════════════════════════

    function testHighStreakMinorityWins() public {
        vm.prank(userA);
        uint256 pid = board.propose{value: SUB_FEE}("QmMinority", 0, 0, 32, 32);

        // A(250)+B(150) for vs C(100) against → 400/500 = 80% ≥ 51%
        vm.prank(userA); board.castVote(pid, true);
        vm.prank(userB); board.castVote(pid, true);
        vm.prank(userC); board.castVote(pid, false);

        vm.warp(block.timestamp + VOTE_WINDOW + 1);
        board.finalize(pid);

        assertTrue(board.getProposal(pid).approved, "80% with 3 voters should pass");
    }

    // ══════════════════════════════════════════════
    //  5. MULTIPLE PLACEMENTS GROW THE BOARD
    // ══════════════════════════════════════════════

    function testMultiplePlacementsGrowBoard() public {
        uint256 pid0 = _approveProposal(userA, "QmFirst",  0,   0,   64, 64);
        uint256 pid1 = _approveProposal(userB, "QmSecond", 100, 100, 32, 32);
        uint256 pid2 = _approveProposal(userA, "QmThird",  200, 200, 128, 128);

        assertEq(board.placementCount(), 3);

        assertEq(board.getPlacement(0).proposalId, pid0);
        assertEq(board.getPlacement(1).proposalId, pid1);
        assertEq(board.getPlacement(2).proposalId, pid2);
    }

    // ══════════════════════════════════════════════
    //  6. SELF-REMOVE + EMERGENCY REMOVE
    // ══════════════════════════════════════════════

    function testRemovalPaths() public {
        uint256 pid0 = _approveProposal(userA, "QmSelfRemove", 0, 0, 32, 32);
        uint256 pid1 = _approveProposal(userB, "QmEmergency", 100, 100, 32, 32);

        // Self-remove
        uint256 plId0 = board.getProposal(pid0).placementId;
        vm.prank(userA);
        board.removePlacement(plId0);
        assertTrue(board.getPlacement(0).removed);

        // Emergency remove (this test contract is owner)
        uint256 plId1 = board.getProposal(pid1).placementId;
        board.emergencyRemove(plId1);
        assertTrue(board.getPlacement(1).removed);

        // Board still has 2 placements (removed flag, not deleted)
        assertEq(board.placementCount(), 2);
    }

    // ══════════════════════════════════════════════
    //  7. MANIFEST HISTORY + NFT INTEGRATION
    // ══════════════════════════════════════════════

    function testManifestHistoryForNFT() public {
        // Initial manifest (0 placements)
        vm.prank(operator);
        board.setManifestCID("QmGenesis", 0);

        // Add a placement
        _approveProposal(userA, "QmContent", 0, 0, 64, 64);

        // Update manifest (1 placement)
        vm.prank(operator);
        board.setManifestCID("QmWithPlacement", 1);

        // Both versions in history
        assertEq(board.manifestRootOf(1), keccak256(bytes("QmGenesis")));
        assertEq(board.manifestRootOf(2), keccak256(bytes("QmWithPlacement")));

        // latest() returns current for NFT sync
        (uint256 version, bytes32 root, string memory cid) = board.latest();
        assertEq(version, 2);
        assertEq(root, keccak256(bytes("QmWithPlacement")));
        assertEq(keccak256(bytes(cid)), keccak256(bytes("QmWithPlacement")));
    }

    // ══════════════════════════════════════════════
    //  8. STALENESS CHECK PREVENTS BAD MANIFEST
    // ══════════════════════════════════════════════

    function testManifestStalenessCheck() public {
        _approveProposal(userA, "QmContent", 0, 0, 64, 64);

        // Operator tries to set manifest claiming 0 placements, but there's 1
        vm.prank(operator);
        vm.expectRevert("Loreboard: stale manifest");
        board.setManifestCID("QmBadManifest", 0);

        // Correct count works
        vm.prank(operator);
        board.setManifestCID("QmGoodManifest", 1);
    }

    // ══════════════════════════════════════════════
    //  9. OVERLAP PREVENTION WITH REAL VOTING POWER
    // ══════════════════════════════════════════════

    function testOverlapPreventionE2E() public {
        // Place first content
        _approveProposal(userA, "QmFirst", 0, 0, 128, 128);
        assertEq(board.placementCount(), 1);

        // Try to propose overlapping content — reverts on-chain
        vm.prank(userB);
        vm.expectRevert("Loreboard: overlaps existing placement");
        board.propose{value: SUB_FEE}("QmOverlap", 64, 64, 128, 128);

        // Adjacent placement succeeds
        _approveProposal(userB, "QmAdjacent", 128, 0, 64, 64);
        assertEq(board.placementCount(), 2);
    }

    // ══════════════════════════════════════════════
    //  HELPERS
    // ══════════════════════════════════════════════

    function _approveProposal(
        address proposer,
        string memory cid,
        int32 x, int32 y, uint32 w, uint32 h
    ) internal returns (uint256 pid) {
        vm.prank(proposer);
        pid = board.propose{value: SUB_FEE}(cid, x, y, w, h);
        vm.prank(userA); board.castVote(pid, true);
        vm.prank(userB); board.castVote(pid, true);
        vm.prank(userC); board.castVote(pid, true);
        vm.warp(block.timestamp + VOTE_WINDOW + 1);
        board.finalize(pid);
    }
}
