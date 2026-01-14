// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/LoreboardLiveNFT.sol";

contract DeployLoreboardLiveNFT is Script {
    function run() external {
        address treasury = 0x4A777d8650b3FA2419377F4ffeF0EF8007151536;
        address manifestStore = 0xeE469D8F9BB2Ace861AA689dE53c016871ad3D10;

        uint256 pk = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address owner = vm.addr(pk);

        vm.startBroadcast(pk);
        LoreboardLiveNFT nft = new LoreboardLiveNFT(treasury, manifestStore, owner);
        vm.stopBroadcast();

        console2.log("LoreboardLiveNFT deployed at:", address(nft));
        console2.log("Owner:", owner);
    }
}
