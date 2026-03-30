// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {Swipe} from "../src/Swipe.sol";
import {FoidTrest} from "../src/FoidTrest.sol";
import {StreakVotingPower} from "../src/StreakVotingPower.sol";

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

contract SwipeTest is Test {
    Swipe internal swipe;
    FoidTrest internal gallery;
    MockVotingPower internal vp;

    address internal operator  = vm.addr(0xA11CE);
    address internal voter1    = vm.addr(0xB0B1);
    address internal voter2    = vm.addr(0xB0B2);
    address internal voter3    = vm.addr(0xB0B3);
    address internal submitter = vm.addr(0xCAFE);

    address internal feeRecipient = address(0xFEE);

    uint256 constant SUB_FEE    = 0.001 ether;
    uint32  constant VOTE_WINDOW = 259200; // 72 hours

    function setUp() public {
        vp      = new MockVotingPower();
        gallery = new FoidTrest();

        swipe = new Swipe(
            address(gallery),
            address(vp),
            operator,
            feeRecipient,
            address(0),  // loreboardVoting — not wired in tests
            SUB_FEE,
            VOTE_WINDOW
        );

        gallery.authorizeEntryPoint(address(swipe));

        vm.deal(submitter,  100 ether);
        vm.deal(voter1,     100 ether);
        vm.deal(voter2,     100 ether);
        vm.deal(voter3,     100 ether);
        vm.deal(operator,   100 ether);

        // Default voting power: 1 each
        vp.setPower(voter1, 1);
        vp.setPower(voter2, 1);
        vp.setPower(voter3, 1);
    }

    // ══════════════════════════════════════════════
    //  1. Gallery proposal — existing path preserved
    // ══════════════════════════════════════════════

    function testGalleryProposalStillWorks() public {
        uint256 pid = _proposeGallery("QmGalleryTest");

        vm.prank(voter1); swipe.castVote(pid, true);
        vm.prank(voter2); swipe.castVote(pid, true);
        vm.prank(voter3); swipe.castVote(pid, true);

        vm.warp(block.timestamp + VOTE_WINDOW + 1);
        vm.prank(operator);
        swipe.finalize(pid);

        Swipe.Proposal memory p = swipe.getProposal(pid);
        assertTrue(p.finalized);
        assertTrue(p.canonized);
        assertEq(p.proposalType, 0); // Gallery
        assertEq(p.trestEntryId, 0); // First gallery entry
        assertEq(gallery.entryCount(), 1);

        FoidTrest.TrestEntry memory entry = gallery.getEntry(0);
        assertEq(entry.creator, submitter);
        assertEq(entry.path, 1); // swipe path
    }

    // ══════════════════════════════════════════════
    //  2. Loreboard proposal approved → voucher issued
    // ══════════════════════════════════════════════

    function testLoreboardProposalApproved() public {
        uint256 pid = _proposeLoreboard("QmLoreTest", 64, 128, 256, 256);

        vm.prank(voter1); swipe.castVote(pid, true);
        vm.prank(voter2); swipe.castVote(pid, true);
        vm.prank(voter3); swipe.castVote(pid, true);

        vm.warp(block.timestamp + VOTE_WINDOW + 1);
        vm.prank(operator);
        swipe.finalize(pid);

        Swipe.Proposal memory p = swipe.getProposal(pid);
        assertTrue(p.finalized);
        assertTrue(p.canonized);
        assertEq(p.proposalType, 1); // Loreboard
        assertEq(p.gridX, 64);
        assertEq(p.gridY, 128);
        assertEq(p.gridW, 256);
        assertEq(p.gridH, 256);
        assertEq(p.trestEntryId, 0); // Not a gallery entry
        assertEq(gallery.entryCount(), 0); // Nothing in gallery

        Swipe.PlacementVoucher memory v = swipe.getVoucher(pid);
        assertTrue(v.issuedAt > 0);
        assertEq(v.expiresAt, v.issuedAt + 604800);
        assertFalse(v.claimed);
    }

    // ══════════════════════════════════════════════
    //  3. Threshold exact 60% passes
    // ══════════════════════════════════════════════

    function testThresholdExact60Percent() public {
        // 3 for (weight 1 each), 2 against (weight 1 each) = 60% → passes
        address voter4 = vm.addr(0xB0B4);
        address voter5 = vm.addr(0xB0B5);
        vp.setPower(voter4, 1);
        vp.setPower(voter5, 1);
        vm.deal(voter4, 1 ether);
        vm.deal(voter5, 1 ether);

        uint256 pid = _proposeGallery("QmThreshold60");

        vm.prank(voter1); swipe.castVote(pid, true);
        vm.prank(voter2); swipe.castVote(pid, true);
        vm.prank(voter3); swipe.castVote(pid, true);
        vm.prank(voter4); swipe.castVote(pid, false);
        vm.prank(voter5); swipe.castVote(pid, false);

        vm.warp(block.timestamp + VOTE_WINDOW + 1);
        vm.prank(operator);
        swipe.finalize(pid);

        Swipe.Proposal memory p = swipe.getProposal(pid);
        assertTrue(p.canonized, "exactly 60% should pass");
    }

    // ══════════════════════════════════════════════
    //  4. Threshold just below 60% fails
    // ══════════════════════════════════════════════

    function testThresholdJustBelow60() public {
        vp.setPower(voter1, 59); // for
        vp.setPower(voter2, 41); // against

        uint256 pid = _proposeGallery("QmBelow60");

        vm.prank(voter1); swipe.castVote(pid, true);  // 59 weight
        vm.prank(voter2); swipe.castVote(pid, false); // 41 weight

        vm.warp(block.timestamp + VOTE_WINDOW + 1);
        vm.prank(operator);
        swipe.finalize(pid);

        Swipe.Proposal memory p = swipe.getProposal(pid);
        assertTrue(p.finalized);
        assertFalse(p.canonized, "59% should not pass 60% threshold");
        assertEq(gallery.entryCount(), 0);
    }

    // ══════════════════════════════════════════════
    //  5. Voucher claim succeeds
    // ══════════════════════════════════════════════

    function testVoucherClaim() public {
        uint256 pid = _approveLoreboardProposal("QmClaim", 32, 32, 64, 64);

        uint256 recipientBefore = feeRecipient.balance;

        vm.prank(submitter);
        swipe.claimVoucher{value: 0.001 ether}(pid);

        Swipe.PlacementVoucher memory v = swipe.getVoucher(pid);
        assertTrue(v.claimed);

        assertEq(feeRecipient.balance - recipientBefore, 0.001 ether);
    }

    // ══════════════════════════════════════════════
    //  6. Voucher expiry
    // ══════════════════════════════════════════════

    function testVoucherExpiry() public {
        uint256 pid = _approveLoreboardProposal("QmExpiry", 0, 0, 128, 128);

        // Warp past voucher expiry (7 days)
        vm.warp(block.timestamp + 604800 + 1);

        vm.prank(submitter);
        vm.expectRevert("Swipe: voucher expired");
        swipe.claimVoucher{value: 0.001 ether}(pid);
    }

    // ══════════════════════════════════════════════
    //  7. Voucher claim by wrong address
    // ══════════════════════════════════════════════

    function testVoucherWrongSender() public {
        uint256 pid = _approveLoreboardProposal("QmWrongSender", 0, 0, 32, 32);

        vm.prank(voter1);
        vm.expectRevert("Swipe: not submitter");
        swipe.claimVoucher{value: 0.001 ether}(pid);
    }

    // ══════════════════════════════════════════════
    //  8. Voucher double claim
    // ══════════════════════════════════════════════

    function testVoucherDoubleClaim() public {
        uint256 pid = _approveLoreboardProposal("QmDouble", 0, 0, 32, 32);

        vm.prank(submitter);
        swipe.claimVoucher{value: 0.001 ether}(pid);

        vm.prank(submitter);
        vm.expectRevert("Swipe: already claimed");
        swipe.claimVoucher{value: 0.001 ether}(pid);
    }

    // ══════════════════════════════════════════════
    //  9. Voucher insufficient fee
    // ══════════════════════════════════════════════

    function testVoucherInsufficientFee() public {
        uint256 pid = _approveLoreboardProposal("QmLowFee", 0, 0, 32, 32);

        vm.prank(submitter);
        vm.expectRevert("Swipe: wrong placement fee");
        swipe.claimVoucher{value: 0.0009 ether}(pid);
    }

    // ══════════════════════════════════════════════
    //  10. Grid validation on propose
    // ══════════════════════════════════════════════

    function testGridValidation() public {
        // Zero size
        vm.prank(submitter);
        vm.expectRevert("Swipe: zero size");
        swipe.proposeLoreboard{value: SUB_FEE}("QmBadGrid", 0, 0, 0, 100);

        vm.prank(submitter);
        vm.expectRevert("Swipe: zero size");
        swipe.proposeLoreboard{value: SUB_FEE}("QmBadGrid", 0, 0, 100, 0);

        // Too many cells: 641 x 641 pixels → ceil(641/32) * ceil(641/32) = 21*21 = 441 > 400
        vm.prank(submitter);
        vm.expectRevert("Swipe: too many cells");
        swipe.proposeLoreboard{value: SUB_FEE}("QmBadGrid", 0, 0, 641, 641);

        // Valid: 640 x 640 → 20*20 = 400 cells exactly at limit
        vm.prank(submitter);
        uint256 pid = swipe.proposeLoreboard{value: SUB_FEE}("QmGoodGrid", 0, 0, 640, 640);
        Swipe.Proposal memory p = swipe.getProposal(pid);
        assertEq(p.gridW, 640);
        assertEq(p.gridH, 640);
    }

    // ══════════════════════════════════════════════
    //  11. Rejection finality
    // ══════════════════════════════════════════════

    function testRejectionFinality() public {
        uint256 pid = _proposeLoreboard("QmRejected", 0, 0, 32, 32);

        vm.prank(voter1); swipe.castVote(pid, false);
        vm.prank(voter2); swipe.castVote(pid, false);
        vm.prank(voter3); swipe.castVote(pid, false);

        vm.warp(block.timestamp + VOTE_WINDOW + 1);
        vm.prank(operator);
        swipe.finalize(pid);

        Swipe.Proposal memory p = swipe.getProposal(pid);
        assertTrue(p.finalized);
        assertFalse(p.canonized);

        // No voucher issued
        Swipe.PlacementVoucher memory v = swipe.getVoucher(pid);
        assertEq(v.issuedAt, 0);

        // Cannot claim
        vm.prank(submitter);
        vm.expectRevert("Swipe: not approved");
        swipe.claimVoucher{value: 0.001 ether}(pid);
    }

    // ══════════════════════════════════════════════
    //  HELPERS
    // ══════════════════════════════════════════════

    function _proposeGallery(string memory cid) internal returns (uint256) {
        vm.prank(submitter);
        return swipe.propose{value: SUB_FEE}(cid);
    }

    function _proposeLoreboard(string memory cid, int32 x, int32 y, uint32 w, uint32 h) internal returns (uint256) {
        vm.prank(submitter);
        return swipe.proposeLoreboard{value: SUB_FEE}(cid, x, y, w, h);
    }

    /// @dev Propose loreboard → 3 voters approve → warp → finalize
    function _approveLoreboardProposal(
        string memory cid,
        int32 x, int32 y, uint32 w, uint32 h
    ) internal returns (uint256 pid) {
        pid = _proposeLoreboard(cid, x, y, w, h);
        vm.prank(voter1); swipe.castVote(pid, true);
        vm.prank(voter2); swipe.castVote(pid, true);
        vm.prank(voter3); swipe.castVote(pid, true);
        vm.warp(block.timestamp + VOTE_WINDOW + 1);
        vm.prank(operator);
        swipe.finalize(pid);
    }
}
