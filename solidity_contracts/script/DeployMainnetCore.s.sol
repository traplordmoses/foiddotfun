// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {PrayerTiers} from "../src/PrayerTiers.sol";
import {StreakVotingPower} from "../src/StreakVotingPower.sol";

/// @title DeployMainnetCore
/// @notice Deploys only the contracts needed for mainnet:
///   1. PrayerTiers          — 10-tier prayer streak system
///   2. StreakVotingPower     — voting weight from streak tiers
///   3. Wire up: PrayerTiers → StreakVotingPower
///
///   NOT deployed (legacy):
///   - FoidTrest    — replaced by unified Loreboard
///   - Swipe        — replaced by unified Loreboard
///   - DuelArena    — parked
///   - Engrave      — parked
contract DeployMainnetCore is Script {
    function run() external {
        uint256 expectedChain = vm.envOr("EXPECTED_CHAIN_ID", uint256(25363));
        require(block.chainid == expectedChain, "DeployMainnetCore: wrong chain");

        uint256 deployerPk = vm.envUint("OPERATOR_PK");
        address operator = vm.addr(deployerPk);

        address prayerMirror = vm.envAddress("PRAYER_MIRROR_ADDRESS");

        // Voting power config
        uint256 baseWeight = vm.envOr("VP_BASE_WEIGHT", uint256(100));
        uint256 mifoidBonus = vm.envOr("VP_MIFOID_BONUS", uint256(50));

        vm.startBroadcast(deployerPk);

        // ── 1. PrayerTiers ──
        PrayerTiers prayerTiers = new PrayerTiers(prayerMirror);
        console.log("PrayerTiers:       ", address(prayerTiers));

        // ── 2. StreakVotingPower (MiFOID = address(0) — wired later when deployed) ──
        StreakVotingPower votingPower = new StreakVotingPower(
            prayerMirror,
            address(0),   // MiFOID not deployed yet
            baseWeight,
            mifoidBonus
        );
        console.log("StreakVotingPower:  ", address(votingPower));

        // Wire PrayerTiers into VotingPower
        votingPower.setPrayerTiers(address(prayerTiers));

        vm.stopBroadcast();

        // ── Post-deploy verification ──
        require(votingPower.prayerTiers() == address(prayerTiers), "Deploy: VP tiers not wired");
        require(votingPower.prayerMirror() == prayerMirror, "Deploy: VP mirror mismatch");
        require(votingPower.baseWeight() == baseWeight, "Deploy: baseWeight mismatch");

        console.log("");
        console.log("=== MAINNET CORE DEPLOYMENT COMPLETE ===");
        console.log("PrayerTiers:       ", address(prayerTiers));
        console.log("StreakVotingPower:  ", address(votingPower));
        console.log("Operator:          ", operator);
        console.log("");
        console.log("NEXT:");
        console.log("  Set STREAK_VOTING_POWER_ADDRESS=", address(votingPower));
        console.log("  Set PRAYER_TIERS_ADDRESS=", address(prayerTiers));
        console.log("  Then run DeployLoreboard.s.sol");
    }
}
