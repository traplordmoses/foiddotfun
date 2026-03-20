// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {PrayerTiers} from "../src/PrayerTiers.sol";
import {StreakVotingPower} from "../src/StreakVotingPower.sol";
import {FoidTrest} from "../src/FoidTrest.sol";
import {Swipe} from "../src/Swipe.sol";

/// @title DeployV1
/// @notice Deploys the mainnet v1 stack:
///   1. PrayerTiers          — 10-tier prayer streak system
///   2. StreakVotingPower     — voting weight from streak tiers + MiFOID bonus
///   3. FoidTrest             — permanent on-chain gallery
///   4. Swipe                 — propose → EIP-712 votes → gallery or loreboard voucher
///   5. Wire up: Swipe authorized on FoidTrest, PrayerTiers wired into VotingPower
///
///   NOT deployed:
///   - FoidTrestDirect (no pay-to-bypass for mainnet — all public placements go through Swipe)
///   - SwipeLoreboard  (removal governance is a separate deploy if needed post-launch)
///   - DuelArena       (parked for post-launch)
contract DeployV1 is Script {
    function run() external {
        // ── Environment variables ──
        uint256 deployerPk = vm.envUint("OPERATOR_PK");
        address operator = vm.addr(deployerPk);

        address prayerMirror = vm.envAddress("PRAYER_MIRROR_ADDRESS");
        address feeRecipient = vm.envOr("FEE_RECIPIENT", operator);

        // Voting power config
        uint256 baseWeight = vm.envOr("VP_BASE_WEIGHT", uint256(100));
        uint256 mifoidBonus = vm.envOr("VP_MIFOID_BONUS", uint256(50));

        // Swipe config
        uint256 submissionFee = vm.envOr("SWIPE_SUBMISSION_FEE", uint256(0.001 ether));
        uint32 votingWindowSeconds = uint32(vm.envOr("SWIPE_VOTING_WINDOW", uint256(259200))); // 72h default

        vm.startBroadcast(deployerPk);

        // ── 1. PrayerTiers ──
        PrayerTiers prayerTiers = new PrayerTiers(prayerMirror);
        console.log("PrayerTiers:       ", address(prayerTiers));

        // ── 2. StreakVotingPower (MiFOID = address(0) — set post-deploy via setMifoidNFT) ──
        StreakVotingPower votingPower = new StreakVotingPower(
            prayerMirror,
            address(0),   // MiFOID deployed separately, wired later
            baseWeight,
            mifoidBonus
        );
        console.log("StreakVotingPower:  ", address(votingPower));

        // Wire PrayerTiers into VotingPower
        votingPower.setPrayerTiers(address(prayerTiers));

        // ── 3. FoidTrest (Gallery) ──
        FoidTrest gallery = new FoidTrest();
        console.log("FoidTrest:         ", address(gallery));

        // ── 4. Swipe (gallery + loreboard proposals, voucher system, 60% threshold) ──
        Swipe swipe = new Swipe(
            address(gallery),
            address(votingPower),
            operator,
            feeRecipient,
            submissionFee,
            votingWindowSeconds
        );
        console.log("Swipe:             ", address(swipe));

        // ── Wire up authorizations ──

        // Gallery: authorize Swipe as the sole public entry point
        gallery.authorizeEntryPoint(address(swipe));

        vm.stopBroadcast();

        // ── Post-deploy verification ──

        // Swipe defaults
        require(swipe.approvalThresholdBps() == 6000, "DeployV1: threshold not 6000");
        require(swipe.placementFee() == 0.001 ether, "DeployV1: placementFee not 0.001");
        require(swipe.voucherDurationSeconds() == 604800, "DeployV1: voucherDuration not 7d");
        require(swipe.votingWindowSeconds() == votingWindowSeconds, "DeployV1: votingWindow mismatch");
        require(swipe.submissionFee() == submissionFee, "DeployV1: submissionFee mismatch");

        // Wiring
        require(gallery.authorizedEntryPoints(address(swipe)), "DeployV1: Swipe not authorized on gallery");
        require(address(swipe.gallery()) == address(gallery), "DeployV1: Swipe gallery mismatch");
        require(swipe.votingPowerSource() == address(votingPower), "DeployV1: Swipe VP mismatch");
        require(votingPower.prayerTiers() == address(prayerTiers), "DeployV1: VP tiers not wired");

        // Operator
        require(swipe.operator() == operator, "DeployV1: operator mismatch");
        require(swipe.feeRecipient() == feeRecipient, "DeployV1: feeRecipient mismatch");

        console.log("");
        console.log("=== V1 DEPLOYMENT COMPLETE ===");
        console.log("PrayerTiers:       ", address(prayerTiers));
        console.log("StreakVotingPower:  ", address(votingPower));
        console.log("FoidTrest:         ", address(gallery));
        console.log("Swipe:             ", address(swipe));
        console.log("Operator:          ", operator);
        console.log("Fee Recipient:     ", feeRecipient);
        console.log("");
        console.log("Swipe defaults:");
        console.log("  approvalThreshold: 60%");
        console.log("  placementFee:      0.001 ETH");
        console.log("  voucherDuration:   7 days");
        console.log("  votingWindow:      ", votingWindowSeconds, "s");
        console.log("");
        console.log("POST-DEPLOY TODO:");
        console.log("  1. Deploy MiFOID, then call votingPower.setMifoidNFT(address)");
        console.log("  2. Deploy Engrave if needed: DeployEngrave.s.sol");
        console.log("  3. Tune thresholds via swipe.setApprovalThreshold() if needed");
    }
}
