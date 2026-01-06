// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "src/LoreboardVMWrapper.sol";

contract DeployWrapper is Script {
    function run() external returns (LoreboardVMWrapper wrapper) {
        address wasmAddress = vm.envAddress("LOREBOARD_VM_WASM_ADDRESS");

        vm.startBroadcast();
        wrapper = new LoreboardVMWrapper(wasmAddress);
        vm.stopBroadcast();

        console2.log("LoreboardVMWrapper:", address(wrapper));
    }
}
