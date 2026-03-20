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

    // Use proper Foundry‑generated wallets so we can sign EIP-712 messages.
    uint256 internal operatorPk = 0xA11CE;
    address internal operator = vm.addr(operatorPk);

    uint256 internal voter1Pk = 0xB0B1;
    address internal voter1 = vm.addr(voter1Pk);

    uint256 internal voter2Pk = 0xB0B2;
    address internal voter2 = vm.addr(voter2Pk);

    uint256 internal voter3Pk = 0xB0B3;
    address internal voter3 = vm.addr(voter3Pk);

    uint256 internal submitterPk = 0xCAFE;
    address internal submitter = vm.addr(submitterPk);

    address internal feeRecipient = address(0xFEE);

    uint256 constant SUB_FEE = 0.001 ether;
    uint32 constant VOTE_WINDOW = 259200; // 72 hours

    // ── EIP-712 helpers ──

    bytes32 constant VOTE_TYPEHASH =
        keccak256("SwipeVote(uint256 proposalId,bool approve,uint256 deadline)");

    // Must match Swipe constructor: EIP712("FoidSwipe", "1")
    bytes32 internal DOMAIN_SEPARATOR;

    function setUp() public {
        vp = new MockVotingPower();
        gallery = new FoidTrest();

        swipe = new Swipe(
            address(gallery),
            address(vp),
            operator,
            feeRecipient,
            SUB_FEE,
            VOTE_WINDOW
        );

        // Authorize Swipe as an entry point on the gallery
        gallery.authorizeEntryPoint(address(swipe));

        // Give everyone ETH
        vm.deal(submitter, 100 ether);
        vm.deal(voter1, 100 ether);
        vm.deal(voter2, 100 ether);
        vm.deal(voter3, 100 ether);
        vm.deal(operator, 100 ether);

        // Default voting power: 1 each
        vp.setPower(voter1, 1);
        vp.setPower(voter2, 1);
        vp.setPower(voter3, 1);

        // Compute domain separator (matches OpenZeppelin EIP712)
        DOMAIN_SEPARATOR = keccak256(
            abi.encode(
                keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
                keccak256("FoidSwipe"),
                keccak256("1"),
                block.chainid,
                address(swipe)
            )
        );
    }

    // ══════════════════════════════════════════════
    //  1. Gallery proposal — existing path preserved
    // ══════════════════════════════════════════════

    function testGalleryProposalStillWorks() public {
        // Give voters enough weight to hit 60%: 3 approve (weight 1 each), 0 against → 100%
        uint256 pid = _proposeGallery("QmGalleryTest");

        // Fast-forward past voting window
        vm.warp(block.timestamp + VOTE_WINDOW + 1);

        // Build 3 approving votes
        (
            address[] memory voters,
            bool[] memory approvals,
            uint256[] memory deadlines,
            bytes[] memory sigs
        ) = _buildVotes(pid, _threeVoters(), _bools(true, true, true));

        vm.prank(operator);
        swipe.finalize(pid, voters, approvals, deadlines, sigs);

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

        vm.warp(block.timestamp + VOTE_WINDOW + 1);

        (
            address[] memory voters,
            bool[] memory approvals,
            uint256[] memory deadlines,
            bytes[] memory sigs
        ) = _buildVotes(pid, _threeVoters(), _bools(true, true, true));

        vm.prank(operator);
        swipe.finalize(pid, voters, approvals, deadlines, sigs);

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
        uint256 voter4Pk = 0xB0B4;
        address voter4 = vm.addr(voter4Pk);
        uint256 voter5Pk = 0xB0B5;
        address voter5 = vm.addr(voter5Pk);
        vp.setPower(voter4, 1);
        vp.setPower(voter5, 1);

        uint256 pid = _proposeGallery("QmThreshold60");
        vm.warp(block.timestamp + VOTE_WINDOW + 1);

        address[] memory voters = new address[](5);
        voters[0] = voter1; voters[1] = voter2; voters[2] = voter3;
        voters[3] = voter4; voters[4] = voter5;

        bool[] memory approvals = new bool[](5);
        approvals[0] = true; approvals[1] = true; approvals[2] = true;
        approvals[3] = false; approvals[4] = false;

        uint256[] memory deadlines = new uint256[](5);
        bytes[] memory sigs = new bytes[](5);
        uint256 deadline = block.timestamp + 1000;
        uint256[] memory pks = new uint256[](5);
        pks[0] = voter1Pk; pks[1] = voter2Pk; pks[2] = voter3Pk;
        pks[3] = voter4Pk; pks[4] = voter5Pk;

        for (uint256 i = 0; i < 5; i++) {
            deadlines[i] = deadline;
            sigs[i] = _signVote(pks[i], pid, approvals[i], deadline);
        }

        vm.prank(operator);
        swipe.finalize(pid, voters, approvals, deadlines, sigs);

        Swipe.Proposal memory p = swipe.getProposal(pid);
        assertTrue(p.canonized, "exactly 60% should pass");
    }

    // ══════════════════════════════════════════════
    //  4. Threshold just below 60% fails
    // ══════════════════════════════════════════════

    function testThresholdJustBelow60() public {
        // Use weighted votes: voter1=59, voter2=41 against → 59/100 < 60%
        vp.setPower(voter1, 59);
        vp.setPower(voter2, 41);

        uint256 pid = _proposeGallery("QmBelow60");
        vm.warp(block.timestamp + VOTE_WINDOW + 1);

        address[] memory voters = new address[](2);
        voters[0] = voter1; voters[1] = voter2;

        bool[] memory approvals = new bool[](2);
        approvals[0] = true; approvals[1] = false;

        uint256 deadline = block.timestamp + 1000;
        uint256[] memory deadlines = new uint256[](2);
        deadlines[0] = deadline; deadlines[1] = deadline;

        bytes[] memory sigs = new bytes[](2);
        sigs[0] = _signVote(voter1Pk, pid, true, deadline);
        sigs[1] = _signVote(voter2Pk, pid, false, deadline);

        vm.prank(operator);
        swipe.finalize(pid, voters, approvals, deadlines, sigs);

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

        vm.warp(block.timestamp + VOTE_WINDOW + 1);

        // All 3 voters reject
        (
            address[] memory voters,
            bool[] memory approvals,
            uint256[] memory deadlines,
            bytes[] memory sigs
        ) = _buildVotes(pid, _threeVoters(), _bools(false, false, false));

        vm.prank(operator);
        swipe.finalize(pid, voters, approvals, deadlines, sigs);

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

    /// @dev Helper: propose loreboard → finalize with all-approve → return proposalId
    function _approveLoreboardProposal(
        string memory cid,
        int32 x, int32 y, uint32 w, uint32 h
    ) internal returns (uint256 pid) {
        pid = _proposeLoreboard(cid, x, y, w, h);
        vm.warp(block.timestamp + VOTE_WINDOW + 1);

        (
            address[] memory voters,
            bool[] memory approvals,
            uint256[] memory deadlines,
            bytes[] memory sigs
        ) = _buildVotes(pid, _threeVoters(), _bools(true, true, true));

        vm.prank(operator);
        swipe.finalize(pid, voters, approvals, deadlines, sigs);
    }

    function _threeVoters() internal view returns (uint256[] memory pks) {
        pks = new uint256[](3);
        pks[0] = voter1Pk;
        pks[1] = voter2Pk;
        pks[2] = voter3Pk;
    }

    function _bools(bool a, bool b, bool c) internal pure returns (bool[] memory arr) {
        arr = new bool[](3);
        arr[0] = a; arr[1] = b; arr[2] = c;
    }

    function _buildVotes(
        uint256 proposalId,
        uint256[] memory voterPks,
        bool[] memory approvals
    )
        internal
        view
        returns (
            address[] memory voters,
            bool[] memory approvalsCopy,
            uint256[] memory deadlines,
            bytes[] memory sigs
        )
    {
        uint256 len = voterPks.length;
        voters = new address[](len);
        approvalsCopy = new bool[](len);
        deadlines = new uint256[](len);
        sigs = new bytes[](len);

        uint256 deadline = block.timestamp + 1000;

        for (uint256 i = 0; i < len; i++) {
            voters[i] = vm.addr(voterPks[i]);
            approvalsCopy[i] = approvals[i];
            deadlines[i] = deadline;
            sigs[i] = _signVote(voterPks[i], proposalId, approvals[i], deadline);
        }
    }

    function _signVote(
        uint256 pk,
        uint256 proposalId,
        bool approve,
        uint256 deadline
    ) internal view returns (bytes memory) {
        bytes32 structHash = keccak256(
            abi.encode(VOTE_TYPEHASH, proposalId, approve, deadline)
        );
        bytes32 digest = keccak256(
            abi.encodePacked("\x19\x01", DOMAIN_SEPARATOR, structHash)
        );
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(pk, digest);
        return abi.encodePacked(r, s, v);
    }
}
