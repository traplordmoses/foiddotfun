// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import "forge-std/Script.sol";
import "../contracts/LoreBoardTreasury.sol";

contract Deploy is Script {
    function run() external {
        uint96 base = 10_000_000_000_000; // 1e13
        address operator = vm.envAddress("OPERATOR");

        vm.startBroadcast();
        new LoreBoardTreasury(base, operator);
        vm.stopBroadcast();
    }
}
