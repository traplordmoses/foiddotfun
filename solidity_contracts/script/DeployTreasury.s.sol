// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/LoreBoardTreasury.sol";

contract DeployTreasury is Script {
    function run() external returns (LoreBoardTreasury treasury) {
        uint256 pk = vm.envUint("DEPLOYER_PK");
        uint96 baseFee = uint96(vm.envUint("BASE_FEE_PER_CELL_WEI"));
        address operator = vm.envAddress("OPERATOR_ADDRESS");

        vm.startBroadcast(pk);
        treasury = new LoreBoardTreasury(baseFee, operator);
        vm.stopBroadcast();
    }
}
