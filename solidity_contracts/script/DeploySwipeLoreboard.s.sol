// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {SwipeLoreboard} from "../src/SwipeLoreboard.sol";

/// @title DeploySwipeLoreboard
/// @notice Deploys the SwipeLoreboard contract with flag/removal governance.
///         After deploy, transfers ownership to the multisig.
///
/// Required env vars:
///   OPERATOR_PK                    — deployer private key (also used as operator)
///   STREAK_VOTING_POWER_ADDRESS    — StreakVotingPower contract address
///
/// Optional env vars:
///   FEE_RECIPIENT                  — fee recipient (default: operator address)
///   PLACEMENT_FEE                  — placement fee in wei (default: 0.001 ether)
///   FLAG_FEE                       — flag fee in wei (default: 0.001 ether)
///   FLAG_THRESHOLD                 — flags needed to trigger removal vote (default: 3)
///   REMOVAL_VOTE_WINDOW            — removal vote window in seconds (default: 259200 = 72h)
///   MULTISIG_ADDRESS               — if set, transfers ownership to multisig after deploy
contract DeploySwipeLoreboard is Script {
    function run() external {
        uint256 deployerPk = vm.envUint("OPERATOR_PK");
        address operatorAddr = vm.addr(deployerPk);

        address votingPowerSource = vm.envAddress("STREAK_VOTING_POWER_ADDRESS");
        address feeRecipient = vm.envOr("FEE_RECIPIENT", operatorAddr);

        uint256 placementFee = vm.envOr("PLACEMENT_FEE", uint256(0.001 ether));
        uint256 flagFee = vm.envOr("FLAG_FEE", uint256(0.001 ether));
        uint8 flagThreshold = uint8(vm.envOr("FLAG_THRESHOLD", uint256(3)));
        uint32 removalVoteWindow = uint32(vm.envOr("REMOVAL_VOTE_WINDOW", uint256(259200)));

        vm.startBroadcast(deployerPk);

        // ── Deploy ──
        SwipeLoreboard loreboard = new SwipeLoreboard(
            feeRecipient,
            votingPowerSource,
            placementFee,
            flagFee,
            flagThreshold,
            removalVoteWindow,
            operatorAddr
        );

        console.log("SwipeLoreboard:    ", address(loreboard));

        // ── Transfer ownership to multisig if set ──
        address multisig = vm.envOr("MULTISIG_ADDRESS", address(0));
        if (multisig != address(0)) {
            loreboard.setOwner(multisig);
            console.log("  Ownership transferred to multisig: ", multisig);
        }

        vm.stopBroadcast();

        // ── Verify ──
        require(loreboard.operator() == operatorAddr, "Deploy: operator mismatch");
        require(loreboard.feeRecipient() == feeRecipient, "Deploy: feeRecipient mismatch");
        require(loreboard.votingPowerSource() == votingPowerSource, "Deploy: VP mismatch");
        require(loreboard.placementFeeWei() == placementFee, "Deploy: placementFee mismatch");
        require(loreboard.flagFeeWei() == flagFee, "Deploy: flagFee mismatch");
        require(loreboard.flagThreshold() == flagThreshold, "Deploy: flagThreshold mismatch");
        require(loreboard.removalVoteWindowSeconds() == removalVoteWindow, "Deploy: window mismatch");

        if (multisig != address(0)) {
            require(loreboard.owner() == multisig, "Deploy: owner not multisig");
        }

        console.log("");
        console.log("=== SWIPE LOREBOARD DEPLOYED ===");
        console.log("Address:           ", address(loreboard));
        console.log("Operator:          ", operatorAddr);
        console.log("Fee Recipient:     ", feeRecipient);
        console.log("Voting Power:      ", votingPowerSource);
        console.log("Placement Fee:     ", placementFee);
        console.log("Flag Fee:          ", flagFee);
        console.log("Flag Threshold:    ", uint256(flagThreshold));
        console.log("Removal Window:    ", uint256(removalVoteWindow), "s");
        if (multisig != address(0)) {
            console.log("Owner (multisig):  ", multisig);
        } else {
            console.log("Owner (deployer):  ", operatorAddr);
            console.log("");
            console.log("POST-DEPLOY: Transfer ownership to multisig:");
            console.log("  loreboard.setOwner(<MULTISIG_ADDRESS>)");
        }
        console.log("");
        console.log("UPDATE CONFIG:");
        console.log("  1. Set NEXT_PUBLIC_SWIPE_LOREBOARD=", address(loreboard));
        console.log("  2. Update src/config/canonical.ts swipeLoreboard address");
    }
}
