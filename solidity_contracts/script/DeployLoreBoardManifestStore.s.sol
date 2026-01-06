// script/DeployLoreBoardManifestStore.s.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/LoreBoardManifestStore.sol"; // adjust path if your contract is elsewhere

contract DeployLoreBoardManifestStore is Script {
    function run() external {
        uint256 pk = vm.envUint("DEPLOYER_PRIVATE_KEY");
        vm.startBroadcast(pk);

        address owner = vm.addr(pk);
        LoreBoardManifestStore store = new LoreBoardManifestStore(owner);

        vm.stopBroadcast();

        console2.log("LoreBoardManifestStore deployed at:", address(store));
        console2.log("Owner:", owner);
    }
}
