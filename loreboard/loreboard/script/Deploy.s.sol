// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import {Script} from "forge-std/Script.sol";
import {BlendedCounter} from "../src/BlendedCounter.sol";

/// @title Deploy
/// @notice Deploys the Rust PowerCalculator WASM contract and the Solidity BlendedCounter
/// that references it, demonstrating Fluent blended execution.
contract Deploy is Script {
    /// @notice Entry point — deploys the WASM contract via inline assembly, then deploys BlendedCounter.
    function run() external {
        vm.startBroadcast();

        // Deploy Rust (WASM) contract
        bytes memory wasmBytecode = vm.getCode("out/power-calculator.wasm/foundry.json");
        address powerCalculator;

        // Solidity does not natively support WASM deployment,
        // so we use inline assembly to deploy the compiled Rust contract
        assembly {
            powerCalculator := create(0, add(wasmBytecode, 0x20), mload(wasmBytecode))
        }
        require(powerCalculator != address(0), "PowerCalculator deployment failed");

        // Deploy Solidity contract and link to the Rust one
        new BlendedCounter(powerCalculator);

        vm.stopBroadcast();
    }
}
