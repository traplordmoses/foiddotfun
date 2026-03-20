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
    uint256 internal lowPk = 0xD001;     // 3-day streak → Ember (1.25x)
    address internal lowVoter = vm.addr(lowPk);

    uint256 internal midPk = 0xD002;     // 15-day streak → Flame Keeper (1.75x)
    address internal midVoter = vm.addr(midPk);

    uint256 internal highPk = 0xD003;    // 45-day streak → Ascendant (3x)
    address internal highVoter = vm.addr(highPk);

    uint256 internal submitterPk = 0xCAFE;
    address internal submitter = vm.addr(submitterPk);

    address internal feeRecipient = address(0xFEE);

    uint256 constant SUB_FEE = 0.001 ether;
    uint32 constant VOTE_WINDOW = 259200;

    bytes32 constant VOTE_TYPEHASH =
        keccak256("SwipeVote(uint256 proposalId,bool approve,uint256 deadline)");
    bytes32 internal DOMAIN_SEPARATOR;

    function setUp() public {
        // 1. Deploy mock PrayerMirror
        mirror = new MockPrayerMirror();

        // 2. Deploy PrayerTiers (connected to mirror)
        tiers = new PrayerTiers(address(mirror));

        // 3. Deploy mock MiFOID
        mifoid = new MockMiFOID();

        // 4. Deploy StreakVotingPower (baseWeight=100, mifoidBonus=50)
        vp = new StreakVotingPower(
            address(mirror),
            address(mifoid),
            100,
            50
        );
        // Wire PrayerTiers into StreakVotingPower
        vp.setPrayerTiers(address(tiers));

        // 5. Deploy Gallery + Swipe
        gallery = new FoidTrest();
        swipe = new Swipe(
            address(gallery),
            address(vp),
            operator,
            feeRecipient,
            SUB_FEE,
            VOTE_WINDOW
        );
        gallery.authorizeEntryPoint(address(swipe));

        // 6. Set up streaks
        mirror.setStreak(lowVoter, 3);     // Ember → 1.25x → weight 125
        mirror.setStreak(midVoter, 15);    // Flame Keeper → 1.75x → weight 175
        mirror.setStreak(highVoter, 45);   // Ascendant → 3x → weight 300

        // 7. Fund accounts
        vm.deal(submitter, 100 ether);
        vm.deal(lowVoter, 100 ether);
        vm.deal(midVoter, 100 ether);
        vm.deal(highVoter, 100 ether);

        // 8. Compute domain separator
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
    //  1. Verify tier multipliers are correctly read
    // ══════════════════════════════════════════════

    function testTierMultipliersCorrect() public view {
        // 3-day streak → Ember (tier 2, 125 bps = 1.25x)
        (uint8 t1,, uint256 m1) = tiers.getTier(3);
        assertEq(t1, 2);
        assertEq(m1, 125);

        // 15-day streak → Flame Keeper (tier 4, 175 bps = 1.75x)
        (uint8 t2,, uint256 m2) = tiers.getTier(15);
        assertEq(t2, 4);
        assertEq(m2, 175);

        // 45-day streak → Ascendant (tier 7, 300 bps = 3x)
        (uint8 t3,, uint256 m3) = tiers.getTier(45);
        assertEq(t3, 7);
        assertEq(m3, 300);

        // 0-day streak → Unranked (tier 0, 0 bps)
        (uint8 t0,, uint256 m0) = tiers.getTier(0);
        assertEq(t0, 0);
        assertEq(m0, 0);

        // 90-day streak → Foid Sovereign (tier 10, 500 bps = 5x)
        (uint8 t10,, uint256 m10) = tiers.getTier(90);
        assertEq(t10, 10);
        assertEq(m10, 500);
    }

    // ══════════════════════════════════════════════
    //  2. Verify StreakVotingPower weights
    // ══════════════════════════════════════════════

    function testVotingPowerWeights() public view {
        // lowVoter: 3 days → (100 * 125) / 100 = 125
        uint256 wLow = vp.votingPowerOf(lowVoter, 0);
        assertEq(wLow, 125);

        // midVoter: 15 days → (100 * 175) / 100 = 175
        uint256 wMid = vp.votingPowerOf(midVoter, 0);
        assertEq(wMid, 175);

        // highVoter: 45 days → (100 * 300) / 100 = 300
        uint256 wHigh = vp.votingPowerOf(highVoter, 0);
        assertEq(wHigh, 300);
    }

    // ══════════════════════════════════════════════
    //  3. Verify 0-day streak gets baseWeight (not 0)
    // ══════════════════════════════════════════════

    function testZeroStreakGetsBaseWeight() public view {
        // Unranked: multiplierBps = 0, so the if-guard keeps baseWeight
        uint256 w = vp.votingPowerOf(address(0x999), 0);
        assertEq(w, 100, "0-day streak should get baseWeight=100");
    }

    // ══════════════════════════════════════════════
    //  4. Verify MiFOID bonus adds flat on top
    // ══════════════════════════════════════════════

    function testMifoidBonus() public {
        mifoid.setHolder(midVoter, true);
        // midVoter: 15 days → 175 + 50 (MiFOID) = 225
        uint256 w = vp.votingPowerOf(midVoter, 0);
        assertEq(w, 225, "MiFOID bonus should add flat 50");
    }

    // ══════════════════════════════════════════════
    //  5. Integration: weighted votes in Loreboard finalize
    //     2 low-streak voters reject, 1 high-streak voter approves
    //     low: 125 + 125 = 250 against
    //     high: 300 for
    //     300 / 550 = 54.5% → fails 60% threshold
    // ══════════════════════════════════════════════

    function testHighStreakCannotOverrideThresholdAlone() public {
        uint256 pid = _proposeLoreboard("QmTest1");
        vm.warp(block.timestamp + VOTE_WINDOW + 1);

        // 2 low-streak reject, 1 high-streak approve
        uint256[] memory pks = new uint256[](3);
        pks[0] = lowPk; pks[1] = midPk; pks[2] = highPk;
        bool[] memory approvals = new bool[](3);
        approvals[0] = false; // low: 125 against
        approvals[1] = false; // mid: 175 against
        approvals[2] = true;  // high: 300 for

        // total for: 300, total against: 300 → 300/600 = 50% < 60%
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
        assertFalse(p.canonized, "300 for vs 300 against = 50%, should fail 60% threshold");
    }

    // ══════════════════════════════════════════════
    //  6. Integration: high-streak minority outvotes low-streak majority
    //     1 high-streak (300) + 1 mid-streak (175) approve = 475 for
    //     2 low-streak (125 each) reject = 250 against
    //     475 / 725 = 65.5% ≥ 60% → passes
    // ══════════════════════════════════════════════

    function testHighStreakMinorityOutvotesLowStreakMajority() public {
        // Add a second low voter
        uint256 low2Pk = 0xAB01;
        address low2Voter = vm.addr(low2Pk);
        mirror.setStreak(low2Voter, 3); // Ember → 125

        uint256 pid = _proposeLoreboard("QmTest2");
        vm.warp(block.timestamp + VOTE_WINDOW + 1);

        uint256[] memory pks = new uint256[](4);
        pks[0] = highPk;  // 300 for
        pks[1] = midPk;   // 175 for
        pks[2] = lowPk;   // 125 against
        pks[3] = low2Pk;  // 125 against

        bool[] memory approvals = new bool[](4);
        approvals[0] = true;
        approvals[1] = true;
        approvals[2] = false;
        approvals[3] = false;

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
        assertTrue(p.canonized, "475 for vs 250 against = 65.5%, should pass 60% threshold");

        // Voucher should be issued (loreboard type)
        Swipe.PlacementVoucher memory v = swipe.getVoucher(pid);
        assertTrue(v.issuedAt > 0, "voucher should be issued");
    }

    // ══════════════════════════════════════════════
    //  7. Integration: MiFOID bonus tips the scales
    //     Without MiFOID: mid=175 for, low+low=250 against → 175/425 = 41% → fail
    //     With MiFOID:    mid=225 for, low+low=250 against → 225/475 = 47% → still fail
    //     With MiFOID on two: mid=225 for + high=350 for = 575,
    //       vs low=125+low=125=250 → 575/825 = 69.7% → pass
    // ══════════════════════════════════════════════

    function testMifoidBonusTipsScales() public {
        mifoid.setHolder(highVoter, true);  // high: 300 + 50 = 350
        mifoid.setHolder(midVoter, true);   // mid: 175 + 50 = 225

        uint256 low2Pk = 0xAB02;
        address low2Voter = vm.addr(low2Pk);
        mirror.setStreak(low2Voter, 3); // 125

        uint256 pid = _proposeLoreboard("QmMifoidTest");
        vm.warp(block.timestamp + VOTE_WINDOW + 1);

        uint256[] memory pks = new uint256[](4);
        pks[0] = highPk;  // 350 for (with MiFOID)
        pks[1] = midPk;   // 225 for (with MiFOID)
        pks[2] = lowPk;   // 125 against
        pks[3] = low2Pk;  // 125 against

        bool[] memory approvals = new bool[](4);
        approvals[0] = true;
        approvals[1] = true;
        approvals[2] = false;
        approvals[3] = false;

        (
            address[] memory voters,
            bool[] memory appCopy,
            uint256[] memory deadlines,
            bytes[] memory sigs
        ) = _buildVotes(pid, pks, approvals);

        vm.prank(operator);
        swipe.finalize(pid, voters, appCopy, deadlines, sigs);

        Swipe.Proposal memory p = swipe.getProposal(pid);
        assertTrue(p.canonized, "575 for vs 250 against = 69.7% with MiFOID bonus");
    }

    // ══════════════════════════════════════════════
    //  8. Verify gallery path still works with weighted votes
    // ══════════════════════════════════════════════

    function testGalleryPathWithWeightedVotes() public {
        vm.prank(submitter);
        uint256 pid = swipe.propose{value: SUB_FEE}("QmGalleryWeighted");
        vm.warp(block.timestamp + VOTE_WINDOW + 1);

        // high voter alone: 300/300 = 100% → passes
        uint256[] memory pks = new uint256[](1);
        pks[0] = highPk;
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
