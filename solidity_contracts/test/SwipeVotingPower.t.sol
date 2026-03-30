// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {Swipe} from "../src/Swipe.sol";
import {FoidTrest} from "../src/FoidTrest.sol";
import {StreakVotingPower} from "../src/StreakVotingPower.sol";
import {PrayerTiers} from "../src/PrayerTiers.sol";

/// @dev Mock PrayerMirror that lets tests set arbitrary streaks per address.
contract MockPrayerMirror {
    mapping(address => uint256) public streaks;

    function setStreak(address user, uint256 days_) external {
        streaks[user] = days_;
    }

    /// @dev Matches the signature PrayerTiers/StreakVotingPower expect:
    ///      get(address) → (currentStreak, longestStreak, totalPrayers)
    function get(address user) external view returns (uint256, uint256, uint256) {
        return (streaks[user], streaks[user], streaks[user]);
    }
}

/// @dev Mock MiFOID that lets tests set who holds a token.
contract MockMiFOID {
    mapping(address => bool) public holders;

    function setHolder(address user, bool holds) external {
        holders[user] = holds;
    }

    function holdsToken(address user) external view returns (bool) {
        return holders[user];
    }
}

/// @title SwipeVotingPowerTest
/// @notice Integration test: PrayerMirror → PrayerTiers → StreakVotingPower → Swipe
///         Proves that prayer streak tiers correctly weight votes in finalization.
contract SwipeVotingPowerTest is Test {
    MockPrayerMirror internal mirror;
    MockMiFOID internal mifoid;
    PrayerTiers internal tiers;
    StreakVotingPower internal vp;
    Swipe internal swipe;
    FoidTrest internal gallery;

    uint256 internal operatorPk = 0xA11CE;
    address internal operator = vm.addr(operatorPk);

    // Three voters with different streaks
    address internal lowVoter  = vm.addr(0xD001); // 3-day streak  → Ember (1.25x)  → weight 125
    address internal midVoter  = vm.addr(0xD002); // 15-day streak → Flame Keeper (1.75x) → weight 175
    address internal highVoter = vm.addr(0xD003); // 45-day streak → Ascendant (3x) → weight 300

    address internal submitter    = vm.addr(0xCAFE);
    address internal feeRecipient = address(0xFEE);

    uint256 constant SUB_FEE    = 0.001 ether;
    uint32  constant VOTE_WINDOW = 259200;

    function setUp() public {
        // 1. Deploy mock PrayerMirror
        mirror = new MockPrayerMirror();

        // 2. Deploy PrayerTiers (connected to mirror)
        tiers = new PrayerTiers(address(mirror));

        // 3. Deploy mock MiFOID
        mifoid = new MockMiFOID();

        // 4. Deploy StreakVotingPower (baseWeight=100, mifoidBonus=50)
        vp = new StreakVotingPower(address(mirror), address(mifoid), 100, 50);
        vp.setPrayerTiers(address(tiers));

        // 5. Deploy Gallery + Swipe (loreboardVoting = address(0) — not needed in tests)
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

        // 6. Set up streaks
        mirror.setStreak(lowVoter,  3);   // Ember → 1.25x → weight 125
        mirror.setStreak(midVoter,  15);  // Flame Keeper → 1.75x → weight 175
        mirror.setStreak(highVoter, 45);  // Ascendant → 3x → weight 300

        // 7. Fund accounts
        vm.deal(submitter,   100 ether);
        vm.deal(lowVoter,    100 ether);
        vm.deal(midVoter,    100 ether);
        vm.deal(highVoter,   100 ether);
    }

    // ══════════════════════════════════════════════
    //  1. Verify tier multipliers are correctly read
    // ══════════════════════════════════════════════

    function testTierMultipliersCorrect() public view {
        (uint8 t1,, uint256 m1) = tiers.getTier(3);
        assertEq(t1, 2);
        assertEq(m1, 125);

        (uint8 t2,, uint256 m2) = tiers.getTier(15);
        assertEq(t2, 4);
        assertEq(m2, 175);

        (uint8 t3,, uint256 m3) = tiers.getTier(45);
        assertEq(t3, 7);
        assertEq(m3, 300);

        (uint8 t0,, uint256 m0) = tiers.getTier(0);
        assertEq(t0, 0);
        assertEq(m0, 0);

        (uint8 t10,, uint256 m10) = tiers.getTier(90);
        assertEq(t10, 10);
        assertEq(m10, 500);
    }

    // ══════════════════════════════════════════════
    //  2. Verify StreakVotingPower weights
    // ══════════════════════════════════════════════

    function testVotingPowerWeights() public view {
        assertEq(vp.votingPowerOf(lowVoter,  0), 125);
        assertEq(vp.votingPowerOf(midVoter,  0), 175);
        assertEq(vp.votingPowerOf(highVoter, 0), 300);
    }

    // ══════════════════════════════════════════════
    //  3. Verify 0-day streak gets baseWeight (not 0)
    // ══════════════════════════════════════════════

    function testZeroStreakGetsBaseWeight() public view {
        uint256 w = vp.votingPowerOf(address(0x999), 0);
        assertEq(w, 100, "0-day streak should get baseWeight=100");
    }

    // ══════════════════════════════════════════════
    //  4. Verify MiFOID bonus adds flat on top
    // ══════════════════════════════════════════════

    function testMifoidBonus() public {
        mifoid.setHolder(midVoter, true);
        // midVoter: 15 days → 175 + 50 (MiFOID) = 225
        assertEq(vp.votingPowerOf(midVoter, 0), 225, "MiFOID bonus should add flat 50");
    }

    // ══════════════════════════════════════════════
    //  5. Integration: high-streak voter cannot override 60% threshold alone
    //     low:125 + mid:175 = 300 against; high:300 for → 300/600 = 50% < 60%
    // ══════════════════════════════════════════════

    function testHighStreakCannotOverrideThresholdAlone() public {
        uint256 pid = _proposeLoreboard("QmTest1");

        vm.prank(lowVoter);  swipe.castVote(pid, false); // 125 against
        vm.prank(midVoter);  swipe.castVote(pid, false); // 175 against
        vm.prank(highVoter); swipe.castVote(pid, true);  // 300 for

        vm.warp(block.timestamp + VOTE_WINDOW + 1);
        vm.prank(operator);
        swipe.finalize(pid);

        Swipe.Proposal memory p = swipe.getProposal(pid);
        assertTrue(p.finalized);
        assertFalse(p.canonized, "300 for vs 300 against = 50%, should fail 60% threshold");
    }

    // ══════════════════════════════════════════════
    //  6. Integration: high-streak minority outvotes low-streak majority
    //     high:300 + mid:175 = 475 for; low:125 + low2:125 = 250 against → 65.5% ≥ 60%
    // ══════════════════════════════════════════════

    function testHighStreakMinorityOutvotesLowStreakMajority() public {
        address low2Voter = vm.addr(0xAB01);
        mirror.setStreak(low2Voter, 3); // Ember → 125
        vm.deal(low2Voter, 1 ether);

        uint256 pid = _proposeLoreboard("QmTest2");

        vm.prank(highVoter);  swipe.castVote(pid, true);  // 300 for
        vm.prank(midVoter);   swipe.castVote(pid, true);  // 175 for
        vm.prank(lowVoter);   swipe.castVote(pid, false); // 125 against
        vm.prank(low2Voter);  swipe.castVote(pid, false); // 125 against

        vm.warp(block.timestamp + VOTE_WINDOW + 1);
        vm.prank(operator);
        swipe.finalize(pid);

        Swipe.Proposal memory p = swipe.getProposal(pid);
        assertTrue(p.finalized);
        assertTrue(p.canonized, "475 for vs 250 against = 65.5%, should pass 60% threshold");

        // Voucher should be issued (loreboard type)
        Swipe.PlacementVoucher memory v = swipe.getVoucher(pid);
        assertTrue(v.issuedAt > 0, "voucher should be issued");
    }

    // ══════════════════════════════════════════════
    //  7. Integration: MiFOID bonus tips the scales
    //     high+MiFOID:350, mid+MiFOID:225 for = 575; low:125 + low2:125 = 250 against
    //     575/825 = 69.7% ≥ 60% → pass
    // ══════════════════════════════════════════════

    function testMifoidBonusTipsScales() public {
        mifoid.setHolder(highVoter, true); // 300 + 50 = 350
        mifoid.setHolder(midVoter,  true); // 175 + 50 = 225

        address low2Voter = vm.addr(0xAB02);
        mirror.setStreak(low2Voter, 3); // 125
        vm.deal(low2Voter, 1 ether);

        uint256 pid = _proposeLoreboard("QmMifoidTest");

        vm.prank(highVoter);  swipe.castVote(pid, true);  // 350 for
        vm.prank(midVoter);   swipe.castVote(pid, true);  // 225 for
        vm.prank(lowVoter);   swipe.castVote(pid, false); // 125 against
        vm.prank(low2Voter);  swipe.castVote(pid, false); // 125 against

        vm.warp(block.timestamp + VOTE_WINDOW + 1);
        vm.prank(operator);
        swipe.finalize(pid);

        Swipe.Proposal memory p = swipe.getProposal(pid);
        assertTrue(p.canonized, "575 for vs 250 against = 69.7% with MiFOID bonus");
    }

    // ══════════════════════════════════════════════
    //  8. Gallery path still works with weighted votes
    // ══════════════════════════════════════════════

    function testGalleryPathWithWeightedVotes() public {
        vm.prank(submitter);
        uint256 pid = swipe.propose{value: SUB_FEE}("QmGalleryWeighted");

        // highVoter alone: 300/300 = 100% → passes
        vm.prank(highVoter);
        swipe.castVote(pid, true);

        vm.warp(block.timestamp + VOTE_WINDOW + 1);
        vm.prank(operator);
        swipe.finalize(pid);

        Swipe.Proposal memory p = swipe.getProposal(pid);
        assertTrue(p.canonized);
        assertEq(p.proposalType, 0); // Gallery
        assertEq(gallery.entryCount(), 1);
    }

    // ══════════════════════════════════════════════
    //  HELPERS
    // ══════════════════════════════════════════════

    function _proposeLoreboard(string memory cid) internal returns (uint256) {
        vm.prank(submitter);
        return swipe.proposeLoreboard{value: SUB_FEE}(cid, 0, 0, 64, 64);
    }
}
