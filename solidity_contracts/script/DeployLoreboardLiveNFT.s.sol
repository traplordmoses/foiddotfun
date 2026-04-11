// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/LoreboardLiveNFT.sol";

contract DeployLoreboardLiveNFT is Script {
    function run() external {
        address treasury = vm.envAddress("FEE_RECIPIENT");
        address manifestStore = vm.envAddress("MANIFEST_STORE_ADDRESS");

        uint256 pk = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address owner = vm.addr(pk);

        vm.startBroadcast(pk);
        LoreboardLiveNFT nft = new LoreboardLiveNFT(treasury, manifestStore, owner);
        vm.stopBroadcast();

        console2.log("LoreboardLiveNFT deployed at:", address(nft));
        console2.log("Owner:", owner);
    }
}
