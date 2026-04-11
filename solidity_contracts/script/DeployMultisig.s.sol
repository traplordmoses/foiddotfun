// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {FoidMultisig} from "../src/FoidMultisig.sol";

/// @title DeployMultisig
/// @notice Deploys the 2-of-3 FoidMultisig and optionally transfers
///         ownership of existing contracts to the multisig.
///
/// Required env vars:
///   OPERATOR_PK          — deployer private key
///   MULTISIG_SIGNER_1    — first signer address
///   MULTISIG_SIGNER_2    — second signer address
///   MULTISIG_SIGNER_3    — third signer address
///
/// Optional env vars (for ownership transfer):
///   SWIPE_ADDRESS                — transfer Swipe ownership
///   STREAK_VOTING_POWER_ADDRESS  — transfer StreakVotingPower ownership
///   MANIFEST_STORE_ADDRESS       — transfer ManifestStore ownership
contract DeployMultisig is Script {
    function run() external {
        uint256 expectedChain = vm.envOr("EXPECTED_CHAIN_ID", uint256(25363));
        require(block.chainid == expectedChain, "DeployMultisig: wrong chain");

        uint256 deployerPk = vm.envUint("OPERATOR_PK");

        address signer1 = vm.envAddress("MULTISIG_SIGNER_1");
        address signer2 = vm.envAddress("MULTISIG_SIGNER_2");
        address signer3 = vm.envAddress("MULTISIG_SIGNER_3");

        vm.startBroadcast(deployerPk);

        // ── Deploy multisig ──
        FoidMultisig multisig = new FoidMultisig([signer1, signer2, signer3]);
        console.log("FoidMultisig:      ", address(multisig));
        console.log("  Signer 1:        ", signer1);
        console.log("  Signer 2:        ", signer2);
        console.log("  Signer 3:        ", signer3);
        console.log("  Required:         2 of 3");

        vm.stopBroadcast();

        // ── Verify ──
        require(multisig.isSigner(signer1), "DeployMultisig: signer1 not set");
        require(multisig.isSigner(signer2), "DeployMultisig: signer2 not set");
        require(multisig.isSigner(signer3), "DeployMultisig: signer3 not set");
        require(multisig.REQUIRED() == 2, "DeployMultisig: threshold not 2");

        console.log("");
        console.log("=== MULTISIG DEPLOYED ===");
        console.log("Address: ", address(multisig));
        console.log("");
        console.log("POST-DEPLOY:");
        console.log("  1. Transfer contract ownership to multisig:");
        console.log("     Swipe.setOwner(multisig)");
        console.log("     ManifestStore.transferOwnership(multisig)");
        console.log("     StreakVotingPower.setOwner(multisig)");
        console.log("  2. Deploy SwipeLoreboard with multisig as owner");
    }
}
