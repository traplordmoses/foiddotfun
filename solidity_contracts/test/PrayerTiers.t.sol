// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {PrayerTiers} from "../src/PrayerTiers.sol";
import {StreakVotingPower} from "../src/StreakVotingPower.sol";

/// @dev Mock PrayerMirror for testing
contract MockPrayerMirrorTiers {
    mapping(address => uint256) public streaks;

    function setStreak(address user, uint256 streak) external {
        streaks[user] = streak;
    }

    function get(address user) external view returns (uint256, uint256, uint256) {
        return (streaks[user], streaks[user], streaks[user]);
    }
}

contract PrayerTiersTest is Test {
    PrayerTiers tiers;
    MockPrayerMirrorTiers mirror;

    address user1 = address(uint160(uint256(keccak256("user1"))));

    function setUp() public {
        mirror = new MockPrayerMirrorTiers();
        tiers = new PrayerTiers(address(mirror));
    }

    function testTierZeroStreak() public view {
        (uint8 level, string memory name, uint256 bps) = tiers.getTier(0);
        assertEq(level, 0);
        assertEq(keccak256(bytes(name)), keccak256(bytes("Unranked")));
        assertEq(bps, 0);
    }

    function testTier1_Whisper() public view {
        (uint8 level, string memory name, uint256 bps) = tiers.getTier(1);
        assertEq(level, 1);
        assertEq(keccak256(bytes(name)), keccak256(bytes("Whisper")));
        assertEq(bps, 100);
    }

    function testTier3_Devotee() public view {
        (uint8 level, string memory name, uint256 bps) = tiers.getTier(7);
        assertEq(level, 3);
        assertEq(keccak256(bytes(name)), keccak256(bytes("Devotee")));
        assertEq(bps, 150);
    }

    function testTier6_Oracle() public view {
        (uint8 level, string memory name, uint256 bps) = tiers.getTier(30);
        assertEq(level, 6);
        assertEq(keccak256(bytes(name)), keccak256(bytes("Oracle")));
        assertEq(bps, 250);
    }

    function testTier10_FoidSovereign() public view {
        (uint8 level, string memory name, uint256 bps) = tiers.getTier(90);
        assertEq(level, 10);
        assertEq(keccak256(bytes(name)), keccak256(bytes("Foid Sovereign")));
        assertEq(bps, 500);
    }

    function testTier10_HighStreak() public view {
        // 365 days still maps to tier 10
        (uint8 level,, uint256 bps) = tiers.getTier(365);
        assertEq(level, 10);
        assertEq(bps, 500);
    }

    function testGetTierForAddress() public {
        mirror.setStreak(user1, 14);

        (uint8 level, string memory name, uint256 bps) = tiers.getTierForAddress(user1);
        assertEq(level, 4); // Flame Keeper
        assertEq(keccak256(bytes(name)), keccak256(bytes("Flame Keeper")));
        assertEq(bps, 175);
    }

    function testHighestTierTracking() public {
        mirror.setStreak(user1, 30);
        tiers.getTierForAddress(user1); // Oracle, level 6
        assertEq(tiers.highestTier(user1), 6);

        // Streak drops but highest remains
        mirror.setStreak(user1, 1);
        tiers.getTierForAddress(user1); // Whisper, level 1
        assertEq(tiers.highestTier(user1), 6); // still 6

        // Streak increases past previous high
        mirror.setStreak(user1, 90);
        tiers.getTierForAddress(user1); // Foid Sovereign, level 10
        assertEq(tiers.highestTier(user1), 10);
    }

    function testGetMultiplierBps() public view {
        assertEq(tiers.getMultiplierBps(0), 0);
        assertEq(tiers.getMultiplierBps(1), 100);
        assertEq(tiers.getMultiplierBps(3), 125);
        assertEq(tiers.getMultiplierBps(7), 150);
        assertEq(tiers.getMultiplierBps(14), 175);
        assertEq(tiers.getMultiplierBps(21), 200);
        assertEq(tiers.getMultiplierBps(30), 250);
        assertEq(tiers.getMultiplierBps(45), 300);
        assertEq(tiers.getMultiplierBps(60), 350);
        assertEq(tiers.getMultiplierBps(75), 400);
        assertEq(tiers.getMultiplierBps(90), 500);
    }

    function testGetAllTiers() public view {
        PrayerTiers.TierDef[10] memory allTiers = tiers.getAllTiers();
        assertEq(allTiers[0].level, 1);
        assertEq(keccak256(bytes(allTiers[0].name)), keccak256(bytes("Whisper")));
        assertEq(allTiers[9].level, 10);
        assertEq(keccak256(bytes(allTiers[9].name)), keccak256(bytes("Foid Sovereign")));
    }

    function testVotingPowerWithTiers() public {
        // Deploy StreakVotingPower that uses PrayerTiers
        StreakVotingPower vp = new StreakVotingPower(
            address(mirror),
            address(0), // no MiFOID
            100,        // baseWeight
            50          // mifoidBonus
        );
        vp.setPrayerTiers(address(tiers));

        // Streak = 30 days = Oracle = 250 bps
        // weight = (100 * 250) / 100 = 250
        mirror.setStreak(user1, 30);
        assertEq(vp.votingPowerOf(user1, 0), 250);

        // Streak = 90 days = Foid Sovereign = 500 bps
        // weight = (100 * 500) / 100 = 500
        mirror.setStreak(user1, 90);
        assertEq(vp.votingPowerOf(user1, 0), 500);

        // Streak = 0 = Unranked = 0 bps
        // weight = baseWeight (no multiplier applied when bps = 0)
        mirror.setStreak(user1, 0);
        assertEq(vp.votingPowerOf(user1, 0), 100);
    }
}
