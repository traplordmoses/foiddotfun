// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {Loreboard} from "../src/Loreboard.sol";

/// @dev Minimal mock that returns a configurable voting power per address.
contract MockVotingPower {
    mapping(address => uint256) public power;

    function setPower(address voter, uint256 w) external {
        power[voter] = w;
    }

    function votingPowerOf(address voter, uint256 /* epochId */) external view returns (uint256) {
        return power[voter];
    }
}

contract LoreboardTest is Test {
    Loreboard internal board;
    MockVotingPower internal vp;

    address internal operator  = vm.addr(0xA11CE);
    address internal voter1    = vm.addr(0xB0B1);
    address internal voter2    = vm.addr(0xB0B2);
    address internal voter3    = vm.addr(0xB0B3);
    address internal voter4    = vm.addr(0xB0B4);
    address internal submitter = vm.addr(0xCAFE);

    address internal feeRecipient = address(0xFEE);

    uint256 constant SUB_FEE     = 0.001 ether;
    uint32  constant VOTE_WINDOW = 259200; // 72 hours

    function setUp() public {
        vp = new MockVotingPower();

        board = new Loreboard(
            address(vp),
            operator,
            feeRecipient,
            SUB_FEE,
            VOTE_WINDOW
        );

        vm.deal(submitter,  100 ether);
        vm.deal(voter1,     100 ether);
        vm.deal(voter2,     100 ether);
        vm.deal(voter3,     100 ether);
        vm.deal(voter4,     100 ether);
        vm.deal(operator,   100 ether);

        vp.setPower(voter1, 1);
        vp.setPower(voter2, 1);
        vp.setPower(voter3, 1);
        vp.setPower(voter4, 1);
    }

    // ══════════════════════════════════════════════
    //  CONSTRUCTOR
    // ══════════════════════════════════════════════

    function testConstructorSetsState() public view {
        assertEq(board.votingPowerSource(), address(vp));
        assertEq(board.operator(), operator);
        assertEq(board.feeRecipient(), feeRecipient);
        assertEq(board.submissionFee(), SUB_FEE);
        assertEq(board.votingWindowSeconds(), VOTE_WINDOW);
        assertEq(board.approvalThresholdBps(), 5100);
        assertEq(board.minVoterQuorum(), 3);
        assertEq(board.proposalCount(), 0);
        assertEq(board.placementCount(), 0);
    }

    // ══════════════════════════════════════════════
    //  PROPOSE
    // ══════════════════════════════════════════════

    function testProposeBasic() public {
        uint256 recipientBefore = feeRecipient.balance;

        vm.prank(submitter);
        uint256 pid = board.propose{value: SUB_FEE}("QmTest", 10, -20, 64, 64);

        assertEq(pid, 0);
        assertEq(board.proposalCount(), 1);
        assertEq(feeRecipient.balance - recipientBefore, SUB_FEE);

        Loreboard.Proposal memory p = board.getProposal(pid);
        assertEq(p.proposer, submitter);
        assertEq(keccak256(bytes(p.ipfsCid)), keccak256(bytes("QmTest")));
        assertEq(p.gridX, 10);
        assertEq(p.gridY, -20);
        assertEq(p.gridW, 64);
        assertEq(p.gridH, 64);
        assertFalse(p.finalized);
        assertFalse(p.approved);
    }

    function testProposeEmptyCidReverts() public {
        vm.prank(submitter);
        vm.expectRevert("Loreboard: empty CID");
        board.propose{value: SUB_FEE}("", 0, 0, 64, 64);
    }

    function testProposeWrongFeeReverts() public {
        vm.prank(submitter);
        vm.expectRevert("Loreboard: wrong fee");
        board.propose{value: 0.002 ether}("QmTest", 0, 0, 64, 64);
    }

    function testProposeZeroSizeReverts() public {
        vm.prank(submitter);
        vm.expectRevert("Loreboard: zero size");
        board.propose{value: SUB_FEE}("QmTest", 0, 0, 0, 64);

        vm.prank(submitter);
        vm.expectRevert("Loreboard: zero size");
        board.propose{value: SUB_FEE}("QmTest", 0, 0, 64, 0);
    }

    function testProposeTooManyCellsReverts() public {
        vm.prank(submitter);
        vm.expectRevert("Loreboard: too many cells");
        board.propose{value: SUB_FEE}("QmTest", 0, 0, 641, 641);
    }

    function testProposeMaxCellsSucceeds() public {
        vm.prank(submitter);
        uint256 pid = board.propose{value: SUB_FEE}("QmGood", 0, 0, 640, 640);
        Loreboard.Proposal memory p = board.getProposal(pid);
        assertEq(p.gridW, 640);
        assertEq(p.gridH, 640);
    }

    function testProposeNegativeCoordinates() public {
        vm.prank(submitter);
        uint256 pid = board.propose{value: SUB_FEE}("QmNeg", -500, -300, 32, 32);
        Loreboard.Proposal memory p = board.getProposal(pid);
        assertEq(p.gridX, -500);
        assertEq(p.gridY, -300);
    }

    // ══════════════════════════════════════════════
    //  CAST VOTE
    // ══════════════════════════════════════════════

    function testCastVoteBasic() public {
        uint256 pid = _propose("QmVote");

        vm.prank(voter1);
        board.castVote(pid, true);

        assertEq(board.voteWeightFor(pid), 1);
        assertEq(board.voteWeightAgainst(pid), 0);
        assertTrue(board.hasVoted(pid, voter1));
        assertEq(board.uniqueVoterCount(pid), 1);
    }

    function testCastVoteAgainst() public {
        uint256 pid = _propose("QmNo");

        vm.prank(voter1);
        board.castVote(pid, false);

        assertEq(board.voteWeightFor(pid), 0);
        assertEq(board.voteWeightAgainst(pid), 1);
        assertEq(board.uniqueVoterCount(pid), 1);
    }

    function testCastVoteAlreadyVotedReverts() public {
        uint256 pid = _propose("QmDouble");

        vm.prank(voter1);
        board.castVote(pid, true);

        vm.prank(voter1);
        vm.expectRevert("Loreboard: already voted");
        board.castVote(pid, true);
    }

    function testCastVoteNoVotingPowerReverts() public {
        uint256 pid = _propose("QmNoPower");

        address nobody = vm.addr(0xDEAD);
        vm.prank(nobody);
        vm.expectRevert("Loreboard: no voting power");
        board.castVote(pid, true);
    }

    function testCastVoteAfterWindowReverts() public {
        uint256 pid = _propose("QmLate");
        vm.warp(block.timestamp + VOTE_WINDOW + 1);

        vm.prank(voter1);
        vm.expectRevert("Loreboard: voting ended");
        board.castVote(pid, true);
    }

    function testCastVoteOnFinalizedReverts() public {
        uint256 pid = _propose("QmFinalized");
        vm.prank(voter1); board.castVote(pid, true);
        vm.prank(voter2); board.castVote(pid, true);
        vm.prank(voter3); board.castVote(pid, true);
        vm.warp(block.timestamp + VOTE_WINDOW + 1);
        board.finalize(pid);

        vm.prank(voter4);
        vm.expectRevert("Loreboard: already finalized");
        board.castVote(pid, true);
    }

    function testCastVoteInvalidProposalReverts() public {
        vm.prank(voter1);
        vm.expectRevert("Loreboard: invalid proposal");
        board.castVote(999, true);
    }

    // ══════════════════════════════════════════════
    //  FINALIZE — QUORUM + THRESHOLD
    // ══════════════════════════════════════════════

    function testFinalizeApprovedWithQuorum() public {
        uint256 pid = _propose("QmApproved");

        vm.prank(voter1); board.castVote(pid, true);
        vm.prank(voter2); board.castVote(pid, true);
        vm.prank(voter3); board.castVote(pid, true);

        vm.warp(block.timestamp + VOTE_WINDOW + 1);
        board.finalize(pid);

        Loreboard.Proposal memory p = board.getProposal(pid);
        assertTrue(p.finalized);
        assertTrue(p.approved);
        assertEq(p.placementId, 0);
        assertEq(board.placementCount(), 1);

        Loreboard.Placement memory pl = board.getPlacement(0);
        assertEq(pl.proposalId, pid);
        assertEq(pl.placer, submitter);
        assertFalse(pl.removed);
    }

    function testFinalizeRejectedBelowQuorum() public {
        // 2 voters < quorum of 3, even at 100% approval -> rejected
        uint256 pid = _propose("QmNoQuorum");

        vm.prank(voter1); board.castVote(pid, true);
        vm.prank(voter2); board.castVote(pid, true);

        vm.warp(block.timestamp + VOTE_WINDOW + 1);
        board.finalize(pid);

        Loreboard.Proposal memory p = board.getProposal(pid);
        assertTrue(p.finalized);
        assertFalse(p.approved, "2 voters < quorum 3 should fail even at 100%");
        assertEq(board.placementCount(), 0);
    }

    function testFinalizeRejectedBelowThreshold() public {
        uint256 pid = _propose("QmRejected");

        vm.prank(voter1); board.castVote(pid, false);
        vm.prank(voter2); board.castVote(pid, false);
        vm.prank(voter3); board.castVote(pid, false);

        vm.warp(block.timestamp + VOTE_WINDOW + 1);
        board.finalize(pid);

        assertFalse(board.getProposal(pid).approved);
        assertEq(board.placementCount(), 0);
    }

    function testFinalizePermissionless() public {
        uint256 pid = _propose("QmPermissionless");

        vm.prank(voter1); board.castVote(pid, true);
        vm.prank(voter2); board.castVote(pid, true);
        vm.prank(voter3); board.castVote(pid, true);

        vm.warp(block.timestamp + VOTE_WINDOW + 1);

        // Random address (not operator) can finalize
        address random = vm.addr(0xBEEF);
        vm.prank(random);
        board.finalize(pid);

        assertTrue(board.getProposal(pid).approved);
    }

    function testFinalizeBeforeWindowReverts() public {
        uint256 pid = _propose("QmEarly");
        vm.expectRevert("Loreboard: voting not ended");
        board.finalize(pid);
    }

    function testFinalizeAlreadyFinalizedReverts() public {
        uint256 pid = _propose("QmTwice");
        vm.prank(voter1); board.castVote(pid, true);
        vm.prank(voter2); board.castVote(pid, true);
        vm.prank(voter3); board.castVote(pid, true);
        vm.warp(block.timestamp + VOTE_WINDOW + 1);
        board.finalize(pid);

        vm.expectRevert("Loreboard: already finalized");
        board.finalize(pid);
    }

    function testFinalizeNoVotesRejected() public {
        uint256 pid = _propose("QmNoVotes");
        vm.warp(block.timestamp + VOTE_WINDOW + 1);
        board.finalize(pid);
        assertFalse(board.getProposal(pid).approved, "0 votes should reject");
    }

    // ══════════════════════════════════════════════
    //  THRESHOLD EDGE CASES
    // ══════════════════════════════════════════════

    function testThresholdExact51Percent() public {
        vp.setPower(voter1, 51);
        vp.setPower(voter2, 25);
        vp.setPower(voter3, 24);  // total against = 49

        uint256 pid = _propose("Qm51");
        vm.prank(voter1); board.castVote(pid, true);   // 51 for
        vm.prank(voter2); board.castVote(pid, false);   // 25 against
        vm.prank(voter3); board.castVote(pid, false);   // 24 against -> total 49

        vm.warp(block.timestamp + VOTE_WINDOW + 1);
        board.finalize(pid);
        assertTrue(board.getProposal(pid).approved, "51% with quorum should pass");
    }

    function testThresholdJustBelow51Percent() public {
        vp.setPower(voter1, 5099);
        vp.setPower(voter2, 2500);
        vp.setPower(voter3, 2401);

        uint256 pid = _propose("QmBelow51");
        vm.prank(voter1); board.castVote(pid, true);   // 5099 for
        vm.prank(voter2); board.castVote(pid, false);   // 2500 against
        vm.prank(voter3); board.castVote(pid, false);   // 2401 against -> total 4901

        vm.warp(block.timestamp + VOTE_WINDOW + 1);
        board.finalize(pid);
        assertFalse(board.getProposal(pid).approved, "50.99% should fail");
    }

    function testThresholdSingleVoteFailsQuorum() public {
        uint256 pid = _propose("QmSingleYes");
        vm.prank(voter1); board.castVote(pid, true);

        vm.warp(block.timestamp + VOTE_WINDOW + 1);
        board.finalize(pid);
        assertFalse(board.getProposal(pid).approved, "1 voter < quorum 3 -> rejected");
    }

    // ══════════════════════════════════════════════
    //  REMOVAL — SELF-REMOVE
    // ══════════════════════════════════════════════

    function testSelfRemove() public {
        uint256 pid = _approveProposal("QmRemoveMe", 0, 0, 64, 64);
        uint256 plId = board.getProposal(pid).placementId;

        vm.prank(submitter);
        board.removePlacement(plId);

        Loreboard.Placement memory pl = board.getPlacement(plId);
        assertTrue(pl.removed);
    }

    function testSelfRemoveNotPlacerReverts() public {
        uint256 pid = _approveProposal("QmNotMine", 0, 0, 64, 64);
        uint256 plId = board.getProposal(pid).placementId;

        vm.prank(voter1);
        vm.expectRevert("Loreboard: not placer");
        board.removePlacement(plId);
    }

    function testSelfRemoveAlreadyRemovedReverts() public {
        uint256 pid = _approveProposal("QmDoubleRemove", 0, 0, 64, 64);
        uint256 plId = board.getProposal(pid).placementId;

        vm.prank(submitter);
        board.removePlacement(plId);

        vm.prank(submitter);
        vm.expectRevert("Loreboard: already removed");
        board.removePlacement(plId);
    }

    // ══════════════════════════════════════════════
    //  REMOVAL — EMERGENCY (MULTISIG)
    // ══════════════════════════════════════════════

    function testEmergencyRemove() public {
        uint256 pid = _approveProposal("QmBadContent", 0, 0, 64, 64);
        uint256 plId = board.getProposal(pid).placementId;

        // Owner (this test contract) = multisig
        board.emergencyRemove(plId);

        Loreboard.Placement memory pl = board.getPlacement(plId);
        assertTrue(pl.removed);
    }

    function testEmergencyRemoveNotOwnerReverts() public {
        uint256 pid = _approveProposal("QmProtected", 0, 0, 64, 64);
        uint256 plId = board.getProposal(pid).placementId;

        vm.prank(operator);
        vm.expectRevert("Loreboard: not owner");
        board.emergencyRemove(plId);
    }

    function testEmergencyRemoveAlreadyRemovedReverts() public {
        uint256 pid = _approveProposal("QmAlready", 0, 0, 64, 64);
        uint256 plId = board.getProposal(pid).placementId;

        board.emergencyRemove(plId);

        vm.expectRevert("Loreboard: already removed");
        board.emergencyRemove(plId);
    }

    // ══════════════════════════════════════════════
    //  MANIFEST — HISTORY + STALENESS
    // ══════════════════════════════════════════════

    function testSetManifestCIDWithStalenessCheck() public {
        // Need at least one placement for placementCount > 0
        _approveProposal("QmForManifest", 0, 0, 64, 64);

        vm.prank(operator);
        board.setManifestCID("QmManifest1", 1);

        assertEq(board.manifestVersion(), 1);
        assertEq(keccak256(bytes(board.currentManifestCID())), keccak256(bytes("QmManifest1")));
    }

    function testSetManifestCIDStaleReverts() public {
        _approveProposal("QmForManifest", 0, 0, 64, 64);

        vm.prank(operator);
        vm.expectRevert("Loreboard: stale manifest");
        board.setManifestCID("QmStale", 0); // claims 0 placements, but there's 1
    }

    function testManifestHistory() public {
        // Set initial manifest (0 placements)
        vm.prank(operator);
        board.setManifestCID("QmVersion1", 0);

        _approveProposal("QmPlacement1", 0, 0, 64, 64);

        vm.prank(operator);
        board.setManifestCID("QmVersion2", 1);

        // Both versions are readable
        assertEq(keccak256(bytes(board.manifestCidAt(1))), keccak256(bytes("QmVersion1")));
        assertEq(keccak256(bytes(board.manifestCidAt(2))), keccak256(bytes("QmVersion2")));

        // manifestRootOf works for ALL historical versions
        assertEq(board.manifestRootOf(1), keccak256(bytes("QmVersion1")));
        assertEq(board.manifestRootOf(2), keccak256(bytes("QmVersion2")));

        // Version 0 and unset versions return bytes32(0)
        assertEq(board.manifestRootOf(0), bytes32(0));
        assertEq(board.manifestRootOf(99), bytes32(0));
    }

    function testLatestForNFT() public {
        vm.prank(operator);
        board.setManifestCID("QmNFT", 0);

        (uint256 version, bytes32 root, string memory cid) = board.latest();
        assertEq(version, 1);
        assertEq(root, keccak256(bytes("QmNFT")));
        assertEq(keccak256(bytes(cid)), keccak256(bytes("QmNFT")));
    }

    function testSetManifestCIDNonOperatorReverts() public {
        vm.prank(submitter);
        vm.expectRevert("Loreboard: not operator");
        board.setManifestCID("QmUnauth", 0);
    }

    // ══════════════════════════════════════════════
    //  ADMIN
    // ══════════════════════════════════════════════

    function testAdminSetOperator() public {
        address newOp = vm.addr(0xBEEF);
        board.setOperator(newOp);
        assertEq(board.operator(), newOp);
    }

    function testAdminSetMinVoterQuorum() public {
        board.setMinVoterQuorum(5);
        assertEq(board.minVoterQuorum(), 5);
    }

    function testAdminSetMinVoterQuorumZeroReverts() public {
        vm.expectRevert("Loreboard: zero quorum");
        board.setMinVoterQuorum(0);
    }

    function testAdminSetThreshold() public {
        board.setApprovalThreshold(6000);
        assertEq(board.approvalThresholdBps(), 6000);
    }

    function testAdminSetThresholdInvalidReverts() public {
        vm.expectRevert("Loreboard: invalid threshold");
        board.setApprovalThreshold(0);
        vm.expectRevert("Loreboard: invalid threshold");
        board.setApprovalThreshold(10001);
    }

    function testAdminNonOwnerReverts() public {
        vm.startPrank(submitter);
        vm.expectRevert("Loreboard: not owner");
        board.setOperator(submitter);
        vm.expectRevert("Loreboard: not owner");
        board.setFeeRecipient(submitter);
        vm.expectRevert("Loreboard: not owner");
        board.setMinVoterQuorum(1);
        vm.expectRevert("Loreboard: not owner");
        board.setOwner(submitter);
        vm.stopPrank();
    }

    // ══════════════════════════════════════════════
    //  VIEWS
    // ══════════════════════════════════════════════

    function testGetProposalInvalidReverts() public {
        vm.expectRevert("Loreboard: invalid proposal");
        board.getProposal(0);
    }

    function testGetPlacementInvalidReverts() public {
        vm.expectRevert("Loreboard: invalid placement");
        board.getPlacement(0);
    }

    // ══════════════════════════════════════════════
    //  MULTIPLE PROPOSALS
    // ══════════════════════════════════════════════

    function testMultipleProposalsAndPlacements() public {
        uint256 pid0 = _approveProposal("QmFirst",  0,   0,   64, 64);
        uint256 pid1 = _approveProposal("QmSecond", 100, 100, 32, 32);
        uint256 pid2 = _rejectProposal("QmThird",   200, 200, 32, 32);

        assertEq(board.proposalCount(), 3);
        assertEq(board.placementCount(), 2);

        assertTrue(board.getProposal(pid0).approved);
        assertTrue(board.getProposal(pid1).approved);
        assertFalse(board.getProposal(pid2).approved);
    }

    // ══════════════════════════════════════════════
    //  OVERLAP PREVENTION
    // ══════════════════════════════════════════════

    function testProposeOverlapsExistingReverts() public {
        _approveProposal("QmFirst", 0, 0, 64, 64);

        // Exact same position
        vm.prank(submitter);
        vm.expectRevert("Loreboard: overlaps existing placement");
        board.propose{value: SUB_FEE}("QmOverlap", 0, 0, 64, 64);

        // Partial overlap
        vm.prank(submitter);
        vm.expectRevert("Loreboard: overlaps existing placement");
        board.propose{value: SUB_FEE}("QmPartial", 32, 32, 64, 64);
    }

    function testProposeAdjacentNotOverlap() public {
        _approveProposal("QmFirst", 0, 0, 64, 64);

        // Adjacent right (touching edge = NOT overlap)
        vm.prank(submitter);
        uint256 pid = board.propose{value: SUB_FEE}("QmRight", 64, 0, 64, 64);
        assertEq(pid, 1); // succeeds

        // Adjacent below
        vm.prank(submitter);
        uint256 pid2 = board.propose{value: SUB_FEE}("QmBelow", 0, 64, 64, 64);
        assertEq(pid2, 2); // succeeds
    }

    function testFinalizeOverlapRaceCondition() public {
        // Two proposals for the same empty spot, both enter voting
        vm.prank(submitter);
        uint256 pid0 = board.propose{value: SUB_FEE}("QmRace1", 0, 0, 64, 64);
        vm.prank(submitter);
        uint256 pid1 = board.propose{value: SUB_FEE}("QmRace2", 0, 0, 64, 64);

        // Both get enough votes
        vm.prank(voter1); board.castVote(pid0, true);
        vm.prank(voter2); board.castVote(pid0, true);
        vm.prank(voter3); board.castVote(pid0, true);

        vm.prank(voter1); board.castVote(pid1, true);
        vm.prank(voter2); board.castVote(pid1, true);
        vm.prank(voter3); board.castVote(pid1, true);

        vm.warp(block.timestamp + VOTE_WINDOW + 1);

        // First to finalize wins
        board.finalize(pid0);
        assertTrue(board.getProposal(pid0).approved);
        assertEq(board.placementCount(), 1);

        // Second finalized as rejected (overlap)
        board.finalize(pid1);
        assertFalse(board.getProposal(pid1).approved, "second proposal should be rejected due to overlap");
        assertEq(board.placementCount(), 1, "still only 1 placement");
    }

    function testProposeAfterRemovalSucceeds() public {
        uint256 pid = _approveProposal("QmRemoved", 0, 0, 64, 64);
        uint256 plId = board.getProposal(pid).placementId;

        // Remove the placement
        vm.prank(submitter);
        board.removePlacement(plId);

        // Now the same spot is available
        vm.prank(submitter);
        uint256 pid2 = board.propose{value: SUB_FEE}("QmReplacement", 0, 0, 64, 64);
        assertEq(pid2, 1); // succeeds
    }

    function testProposeNoOverlapDifferentPosition() public {
        _approveProposal("QmFirst", 0, 0, 64, 64);

        // Completely separate position
        vm.prank(submitter);
        uint256 pid = board.propose{value: SUB_FEE}("QmFarAway", 1000, 1000, 32, 32);
        assertEq(pid, 1); // succeeds
    }

    function testProposeOverlapNegativeCoordinates() public {
        _approveProposal("QmNeg", -100, -100, 64, 64);

        // Overlaps in negative space
        vm.prank(submitter);
        vm.expectRevert("Loreboard: overlaps existing placement");
        board.propose{value: SUB_FEE}("QmNegOverlap", -80, -80, 32, 32);
    }

    // ══════════════════════════════════════════════
    //  FEE FORWARDING
    // ══════════════════════════════════════════════

    function testFeeForwarding() public {
        uint256 before_ = feeRecipient.balance;
        vm.prank(submitter);
        board.propose{value: SUB_FEE}("QmFee", 0, 0, 32, 32);
        assertEq(feeRecipient.balance - before_, SUB_FEE);
    }

    // ══════════════════════════════════════════════
    //  PAUSABLE
    // ══════════════════════════════════════════════

    function testPauseBlocksPropose() public {
        board.pause();
        vm.prank(submitter);
        vm.expectRevert("Loreboard: paused");
        board.propose{value: SUB_FEE}("QmPaused", 0, 0, 32, 32);
    }

    function testPauseBlocksCastVote() public {
        vm.prank(submitter);
        uint256 pid = board.propose{value: SUB_FEE}("QmVote", 0, 0, 32, 32);

        board.pause();
        vm.prank(voter1);
        vm.expectRevert("Loreboard: paused");
        board.castVote(pid, true);
    }

    function testPauseBlocksFinalize() public {
        vm.prank(submitter);
        uint256 pid = board.propose{value: SUB_FEE}("QmFinal", 0, 0, 32, 32);
        vm.prank(voter1); board.castVote(pid, true);
        vm.prank(voter2); board.castVote(pid, true);
        vm.prank(voter3); board.castVote(pid, true);
        vm.warp(block.timestamp + VOTE_WINDOW + 1);

        board.pause();
        vm.expectRevert("Loreboard: paused");
        board.finalize(pid);
    }

    function testUnpauseResumesOperations() public {
        board.pause();
        board.unpause();

        // Should work after unpause
        vm.prank(submitter);
        uint256 pid = board.propose{value: SUB_FEE}("QmUnpaused", 0, 0, 32, 32);
        assertEq(pid, 0);
    }

    function testPauseOnlyOwner() public {
        vm.prank(voter1);
        vm.expectRevert("Loreboard: not owner");
        board.pause();
    }

    function testPauseDoesNotBlockRemoval() public {
        uint256 pid = _approveProposal("QmRemove", 0, 0, 64, 64);
        uint256 plId = board.getProposal(pid).placementId;

        board.pause();

        // Self-remove still works while paused (users should be able to remove their own content)
        vm.prank(submitter);
        board.removePlacement(plId);
        assertTrue(board.getPlacement(plId).removed);
    }

    // ══════════════════════════════════════════════
    //  HELPERS
    // ══════════════════════════════════════════════

    function _propose(string memory cid) internal returns (uint256) {
        vm.prank(submitter);
        return board.propose{value: SUB_FEE}(cid, 0, 0, 64, 64);
    }

    function _approveProposal(string memory cid, int32 x, int32 y, uint32 w, uint32 h) internal returns (uint256 pid) {
        vm.prank(submitter);
        pid = board.propose{value: SUB_FEE}(cid, x, y, w, h);
        vm.prank(voter1); board.castVote(pid, true);
        vm.prank(voter2); board.castVote(pid, true);
        vm.prank(voter3); board.castVote(pid, true);
        vm.warp(block.timestamp + VOTE_WINDOW + 1);
        board.finalize(pid);
    }

    function _rejectProposal(string memory cid, int32 x, int32 y, uint32 w, uint32 h) internal returns (uint256 pid) {
        vm.prank(submitter);
        pid = board.propose{value: SUB_FEE}(cid, x, y, w, h);
        vm.prank(voter1); board.castVote(pid, false);
        vm.prank(voter2); board.castVote(pid, false);
        vm.prank(voter3); board.castVote(pid, false);
        vm.warp(block.timestamp + VOTE_WINDOW + 1);
        board.finalize(pid);
    }
}
