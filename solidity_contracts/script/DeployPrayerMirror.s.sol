// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {PrayerMirror} from "../src/PrayerMirror.sol";

/// @title DeployPrayerMirror
/// @notice Deploys PrayerMirror — the on-chain oracle that rWASM syncs prayer streaks into.
///         Must be deployed FIRST — PrayerTiers, StreakVotingPower, and MiFOID all depend on it.
///
///   Required env:
///     OPERATOR_PK              — deployer private key
///     PRAYER_REGISTRY_ADDRESS  — rWASM registry contract that calls sync()
///
///   Optional env:
///     WASM_REGISTRY_ADDRESS    — secondary rWASM account (if different from registry)
contract DeployPrayerMirror is Script {
    function run() external {
        uint256 deployerPk = vm.envUint("OPERATOR_PK");
        address operator = vm.addr(deployerPk);

        address registryAddress = vm.envAddress("PRAYER_REGISTRY_ADDRESS");

        vm.startBroadcast(deployerPk);

        PrayerMirror mirror = new PrayerMirror(registryAddress);
        console.log("PrayerMirror:      ", address(mirror));

        // Wire up wasmRegistry if provided
        address wasmRegistry = vm.envOr("WASM_REGISTRY_ADDRESS", address(0));
        if (wasmRegistry != address(0)) {
            mirror.setWasmRegistry(wasmRegistry);
            console.log("WasmRegistry:      ", wasmRegistry);
        }

        vm.stopBroadcast();

        // Post-deploy verification
        require(mirror.owner() == operator, "Deploy: owner mismatch");
        require(mirror.registry() == registryAddress, "Deploy: registry mismatch");

        console.log("");
        console.log("=== PRAYER MIRROR DEPLOYMENT COMPLETE ===");
        console.log("PrayerMirror:      ", address(mirror));
        console.log("Owner:             ", operator);
        console.log("Registry:          ", registryAddress);
        console.log("");
        console.log("NEXT STEPS:");
        console.log("  Set PRAYER_MIRROR_ADDRESS=", address(mirror));
        console.log("  Then run DeployV1.s.sol");
    }
}
