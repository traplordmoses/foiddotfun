// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {Swipe} from "../src/Swipe.sol";
import {FoidTrest} from "../src/FoidTrest.sol";
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

/// @title E2EMainnetTest
/// @notice Full end-to-end integration test for the mainnet Loreboard flow:
///   Deploy -> pray -> propose -> vote -> finalize -> voucher -> claim -> verify
///   Then: rejected proposal, gallery path, and edge cases.
contract E2EMainnetTest is Test {
    MockPrayerMirror internal mirror;
    PrayerTiers internal tiers;
    StreakVotingPower internal vp;
    FoidTrest internal gallery;
    Swipe internal swipe;

    uint256 internal operatorPk = 0xA11CE;
    address internal operator;

    // User A: 30-day streak (Oracle, 2.5x -> weight 250)
    uint256 internal userAPk = 0xAAA1;
    address internal userA;

    // User B: 7-day streak (Devotee, 1.5x -> weight 150)
    uint256 internal userBPk = 0xBBB1;
    address internal userB;

    // User C: 0-day streak (Unranked -> baseWeight 100)
    uint256 internal userCPk = 0xCCC1;
    address internal userC;

    address internal feeRecipient = address(0xFEE);

    uint256 constant SUB_FEE = 0.001 ether;
    uint256 constant PLACEMENT_FEE = 0.001 ether;
    uint32 constant VOTE_WINDOW = 259200; // 72h

    bytes32 constant VOTE_TYPEHASH =
        keccak256("SwipeVote(uint256 proposalId,bool approve,uint256 deadline)");
    bytes32 internal DOMAIN_SEPARATOR;

    function setUp() public {
        operator = vm.addr(operatorPk);
        userA = vm.addr(userAPk);
        userB = vm.addr(userBPk);
        userC = vm.addr(userCPk);

        // ═══════════════════════════════════════════
        //  DEPLOY (mirrors DeployV1.s.sol pattern)
        // ═══════════════════════════════════════════

        // 1. PrayerMirror (mock)
        mirror = new MockPrayerMirror();

        // 2. PrayerTiers
        tiers = new PrayerTiers(address(mirror));

        // 3. StreakVotingPower (baseWeight=100, mifoidBonus=50, no MiFOID yet)
        vp = new StreakVotingPower(address(mirror), address(0), 100, 50);
        vp.setPrayerTiers(address(tiers));

        // 4. FoidTrest
        gallery = new FoidTrest();

        // 5. Swipe (72h voting window, 0.001 ETH submission fee)
        swipe = new Swipe(
            address(gallery),
            address(vp),
            operator,
            feeRecipient,
            SUB_FEE,
            VOTE_WINDOW
        );

        // 6. Wire: Swipe authorized on gallery
        gallery.authorizeEntryPoint(address(swipe));

        // ─── Post-deploy assertions (same as DeployV1) ───
        assertEq(swipe.approvalThresholdBps(), 6000);
        assertEq(swipe.placementFee(), 0.001 ether);
        assertEq(swipe.voucherDurationSeconds(), 604800);
        assertTrue(gallery.authorizedEntryPoints(address(swipe)));

        // ═══════════════════════════════════════════
        //  SIMULATE PRAYER STREAKS
        // ═══════════════════════════════════════════
        mirror.setStreak(userA, 30);  // Oracle -> 2.5x -> weight 250
        mirror.setStreak(userB, 7);   // Devotee -> 1.5x -> weight 150
        mirror.setStreak(userC, 0);   // Unranked -> baseWeight 100

        // Fund everyone
        vm.deal(userA, 100 ether);
        vm.deal(userB, 100 ether);
        vm.deal(userC, 100 ether);
        vm.deal(operator, 100 ether);

        // Compute EIP-712 domain separator
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

    // ══════════════════════════════════════════════════════════
    //  FULL E2E: Loreboard propose -> vote -> finalize -> claim
    // ══════════════════════════════════════════════════════════

    function testFullLoreboardFlow() public {
        // ─── Step 1: Verify voting power weights ───
        assertEq(vp.votingPowerOf(userA, 0), 250, "A: 30d Oracle = 250");
        assertEq(vp.votingPowerOf(userB, 0), 150, "B: 7d Devotee = 150");
        assertEq(vp.votingPowerOf(userC, 0), 100, "C: 0d Unranked = 100");

        // ─── Step 2: User A submits loreboard proposal ───
        uint256 recipientBefore = feeRecipient.balance;

        vm.prank(userA);
        uint256 pid = swipe.proposeLoreboard{value: SUB_FEE}(
            "QmMainnetTest",
            0,   // x
            0,   // y
            64,  // w
            64   // h
        );

        assertEq(pid, 0);
        assertEq(feeRecipient.balance - recipientBefore, SUB_FEE, "submission fee forwarded");

        Swipe.Proposal memory p = swipe.getProposal(pid);
        assertEq(p.proposer, userA);
        assertEq(p.proposalType, 1); // Loreboard
        assertEq(p.gridX, 0);
        assertEq(p.gridY, 0);
        assertEq(p.gridW, 64);
        assertEq(p.gridH, 64);
        assertFalse(p.finalized);

        // ─── Step 3: All three users vote YES ───
        vm.warp(block.timestamp + VOTE_WINDOW + 1);

        uint256[] memory pks = new uint256[](3);
        pks[0] = userAPk; pks[1] = userBPk; pks[2] = userCPk;

        bool[] memory approvals = new bool[](3);
        approvals[0] = true; approvals[1] = true; approvals[2] = true;

        (
            address[] memory voters,
            bool[] memory appCopy,
            uint256[] memory deadlines,
            bytes[] memory sigs
        ) = _buildVotes(pid, pks, approvals);

        // ─── Step 4: Operator finalizes ───
        // Total weight: 250 + 150 + 100 = 500 for, 0 against
        // 500/500 = 100% ≥ 60% -> passes
        vm.prank(operator);
        swipe.finalize(pid, voters, appCopy, deadlines, sigs);

        p = swipe.getProposal(pid);
        assertTrue(p.finalized);
        assertTrue(p.canonized, "100% approval should pass");

        // Gallery should be empty (loreboard path, not gallery)
        assertEq(gallery.entryCount(), 0, "loreboard path should not touch gallery");

        // ─── Step 5: Voucher issued ───
        Swipe.PlacementVoucher memory v = swipe.getVoucher(pid);
        assertTrue(v.issuedAt > 0, "voucher should exist");
        assertEq(v.expiresAt, v.issuedAt + 604800, "7-day expiry");
        assertFalse(v.claimed);

        // ─── Step 6: User A claims voucher ───
        recipientBefore = feeRecipient.balance;

        vm.prank(userA);
        swipe.claimVoucher{value: PLACEMENT_FEE}(pid);

        v = swipe.getVoucher(pid);
        assertTrue(v.claimed, "voucher should be claimed");
        assertEq(feeRecipient.balance - recipientBefore, PLACEMENT_FEE, "placement fee forwarded");

        // ─── Step 7: Cannot claim again ───
        vm.prank(userA);
        vm.expectRevert("Swipe: already claimed");
        swipe.claimVoucher{value: PLACEMENT_FEE}(pid);
    }

    // ══════════════════════════════════════════════════════════
    //  REJECTED PROPOSAL: minority approval -> no voucher
    // ══════════════════════════════════════════════════════════

    function testRejectedProposalNoVoucher() public {
        vm.prank(userA);
        uint256 pid = swipe.proposeLoreboard{value: SUB_FEE}("QmRejected", 100, 100, 32, 32);

        vm.warp(block.timestamp + VOTE_WINDOW + 1);

        // User C votes yes (100), Users A+B vote no (250+150=400)
        // 100/500 = 20% < 60% -> rejected
        uint256[] memory pks = new uint256[](3);
        pks[0] = userAPk; pks[1] = userBPk; pks[2] = userCPk;

        bool[] memory approvals = new bool[](3);
        approvals[0] = false; approvals[1] = false; approvals[2] = true;

        (
            address[] memory voters,
            bool[] memory appCopy,
            uint256[] memory deadlines,
            bytes[] memory sigs
        ) = _buildVotes(pid, pks, approvals);

        vm.prank(operator);
        swipe.finalize(pid, voters, appCopy, deadlines, sigs);

        Swipe.Proposal memory p = swipe.getProposal(pid);
        assertTrue(p.finalized);
        assertFalse(p.canonized, "20% should not pass 60% threshold");

        // No voucher
        Swipe.PlacementVoucher memory v = swipe.getVoucher(pid);
        assertEq(v.issuedAt, 0, "no voucher for rejected proposal");

        // Cannot claim
        vm.prank(userA);
        vm.expectRevert("Swipe: not approved");
        swipe.claimVoucher{value: PLACEMENT_FEE}(pid);
    }

    // ══════════════════════════════════════════════════════════
    //  GALLERY PATH: propose -> vote -> canonized to FoidTrest
    // ══════════════════════════════════════════════════════════

    function testGalleryPathCanonizesToTrest() public {
        vm.prank(userA);
        uint256 pid = swipe.propose{value: SUB_FEE}("QmGalleryE2E");

        vm.warp(block.timestamp + VOTE_WINDOW + 1);

        // All vote yes
        uint256[] memory pks = new uint256[](3);
        pks[0] = userAPk; pks[1] = userBPk; pks[2] = userCPk;
        bool[] memory approvals = new bool[](3);
        approvals[0] = true; approvals[1] = true; approvals[2] = true;

        (
            address[] memory voters,
            bool[] memory appCopy,
            uint256[] memory deadlines,
            bytes[] memory sigs
        ) = _buildVotes(pid, pks, approvals);

        vm.prank(operator);
        swipe.finalize(pid, voters, appCopy, deadlines, sigs);

        Swipe.Proposal memory p = swipe.getProposal(pid);
        assertTrue(p.canonized);
        assertEq(p.proposalType, 0); // Gallery type
        assertEq(p.trestEntryId, 0); // First entry

        // Gallery received the entry
        assertEq(gallery.entryCount(), 1);
        FoidTrest.TrestEntry memory entry = gallery.getEntry(0);
        assertEq(entry.creator, userA);
        assertEq(entry.path, 1); // swipe path
        assertEq(keccak256(bytes(entry.ipfsCid)), keccak256(bytes("QmGalleryE2E")));
    }

    // ══════════════════════════════════════════════════════════
    //  VOUCHER EXPIRY: approved but claim too late
    // ══════════════════════════════════════════════════════════

    function testVoucherExpiresAfter7Days() public {
        vm.prank(userA);
        uint256 pid = swipe.proposeLoreboard{value: SUB_FEE}("QmExpiry", 0, 0, 32, 32);

        vm.warp(block.timestamp + VOTE_WINDOW + 1);

        uint256[] memory pks = new uint256[](1);
        pks[0] = userAPk;
        bool[] memory approvals = new bool[](1);
        approvals[0] = true;

        (
            address[] memory voters,
            bool[] memory appCopy,
            uint256[] memory deadlines,
            bytes[] memory sigs
        ) = _buildVotes(pid, pks, approvals);

        vm.prank(operator);
        swipe.finalize(pid, voters, appCopy, deadlines, sigs);

        // Warp 8 days from finalization
        vm.warp(block.timestamp + 8 days);

        vm.prank(userA);
        vm.expectRevert("Swipe: voucher expired");
        swipe.claimVoucher{value: PLACEMENT_FEE}(pid);
    }

    // ══════════════════════════════════════════════════════════
    //  WEIGHTED THRESHOLD: high-streak minority beats low-streak majority
    // ══════════════════════════════════════════════════════════

    function testHighStreakMinorityWins() public {
        // User A (250) votes YES, Users B (150) + C (100) vote NO
        // 250 / 500 = 50% < 60% -> rejected
        vm.prank(userA);
        uint256 pid1 = swipe.proposeLoreboard{value: SUB_FEE}("QmTest1", 0, 0, 32, 32);
        vm.warp(block.timestamp + VOTE_WINDOW + 1);

        {
            uint256[] memory pks = new uint256[](3);
            pks[0] = userAPk; pks[1] = userBPk; pks[2] = userCPk;
            bool[] memory app = new bool[](3);
            app[0] = true; app[1] = false; app[2] = false;
            (address[] memory v, bool[] memory a, uint256[] memory d, bytes[] memory s) = _buildVotes(pid1, pks, app);
            vm.prank(operator);
            swipe.finalize(pid1, v, a, d, s);
        }
        assertFalse(swipe.getProposal(pid1).canonized, "250 vs 250 = 50% -> fail");

        // Now: A (250) + B (150) vote YES = 400, C (100) votes NO = 100
        // 400 / 500 = 80% ≥ 60% -> passes
        vm.prank(userA);
        uint256 pid2 = swipe.proposeLoreboard{value: SUB_FEE}("QmTest2", 0, 0, 32, 32);
        vm.warp(block.timestamp + VOTE_WINDOW + 1);

        {
            uint256[] memory pks = new uint256[](3);
            pks[0] = userAPk; pks[1] = userBPk; pks[2] = userCPk;
            bool[] memory app = new bool[](3);
            app[0] = true; app[1] = true; app[2] = false;
            (address[] memory v, bool[] memory a, uint256[] memory d, bytes[] memory s) = _buildVotes(pid2, pks, app);
            vm.prank(operator);
            swipe.finalize(pid2, v, a, d, s);
        }
        assertTrue(swipe.getProposal(pid2).canonized, "400 vs 100 = 80% -> pass");
    }

    // ══════════════════════════════════════════════════════════
    //  WRONG SUBMITTER CANNOT CLAIM
    // ══════════════════════════════════════════════════════════

    function testWrongSubmitterCannotClaim() public {
        uint256 pid = _approveLoreboardProposal(userA, "QmWrongClaimer", 0, 0, 32, 32);

        vm.prank(userB);
        vm.expectRevert("Swipe: not submitter");
        swipe.claimVoucher{value: PLACEMENT_FEE}(pid);
    }

    // ══════════════════════════════════════════════════════════
    //  MULTIPLE PROPOSALS: sequential workflow
    // ══════════════════════════════════════════════════════════

    function testMultipleProposalsSequential() public {
        // Proposal 0: loreboard by A -> approved
        uint256 pid0 = _approveLoreboardProposal(userA, "QmFirst", 0, 0, 64, 64);
        // Proposal 1: gallery by B -> approved
        uint256 pid1 = _approveGalleryProposal(userB, "QmSecond");
        // Proposal 2: loreboard by A -> approved
        uint256 pid2 = _approveLoreboardProposal(userA, "QmThird", 100, 100, 32, 32);

        // Verify independent state
        Swipe.Proposal memory p0 = swipe.getProposal(pid0);
        Swipe.Proposal memory p1 = swipe.getProposal(pid1);
        Swipe.Proposal memory p2 = swipe.getProposal(pid2);

        assertEq(p0.proposalType, 1); // loreboard
        assertEq(p1.proposalType, 0); // gallery
        assertEq(p2.proposalType, 1); // loreboard

        assertTrue(p0.canonized);
        assertTrue(p1.canonized);
        assertTrue(p2.canonized);

        // Gallery has exactly 1 entry (from pid1)
        assertEq(gallery.entryCount(), 1);

        // Loreboard vouchers exist for pid0 and pid2
        assertTrue(swipe.getVoucher(pid0).issuedAt > 0);
        assertTrue(swipe.getVoucher(pid2).issuedAt > 0);
        assertEq(swipe.getVoucher(pid1).issuedAt, 0); // gallery path, no voucher

        // Claim both loreboard vouchers
        vm.prank(userA);
        swipe.claimVoucher{value: PLACEMENT_FEE}(pid0);
        vm.prank(userA);
        swipe.claimVoucher{value: PLACEMENT_FEE}(pid2);

        assertTrue(swipe.getVoucher(pid0).claimed);
        assertTrue(swipe.getVoucher(pid2).claimed);
    }

    // ══════════════════════════════════════════════════════════
    //  HELPERS
    // ══════════════════════════════════════════════════════════

    function _approveLoreboardProposal(
        address proposer,
        string memory cid,
        int32 x, int32 y, uint32 w, uint32 h
    ) internal returns (uint256 pid) {
        vm.prank(proposer);
        pid = swipe.proposeLoreboard{value: SUB_FEE}(cid, x, y, w, h);
        vm.warp(block.timestamp + VOTE_WINDOW + 1);
        _finalizeAllYes(pid);
    }

    function _approveGalleryProposal(address proposer, string memory cid) internal returns (uint256 pid) {
        vm.prank(proposer);
        pid = swipe.propose{value: SUB_FEE}(cid);
        vm.warp(block.timestamp + VOTE_WINDOW + 1);
        _finalizeAllYes(pid);
    }

    function _finalizeAllYes(uint256 pid) internal {
        uint256[] memory pks = new uint256[](3);
        pks[0] = userAPk; pks[1] = userBPk; pks[2] = userCPk;
        bool[] memory approvals = new bool[](3);
        approvals[0] = true; approvals[1] = true; approvals[2] = true;

        (
            address[] memory voters,
            bool[] memory appCopy,
            uint256[] memory deadlines,
            bytes[] memory sigs
        ) = _buildVotes(pid, pks, approvals);

        vm.prank(operator);
        swipe.finalize(pid, voters, appCopy, deadlines, sigs);
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
