// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/LoreBoardTreasury.sol";

/// @title Deploy
/// @notice Deploys LoreBoardTreasury with a base fee and operator read from environment.
contract Deploy is Script {
    /// @notice Entry point — reads OPERATOR from env, broadcasts a LoreBoardTreasury deployment.
    function run() external {
        uint96 base = 10_000_000_000_000; // 1e13
        address operator = vm.envAddress("OPERATOR");
        vm.startBroadcast();
        new LoreBoardTreasury(base, operator);
        vm.stopBroadcast();
    }
}
