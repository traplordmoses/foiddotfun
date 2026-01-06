// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/LoreboardVoting.sol";

contract DeployLoreboardVoting is Script {
    function run() external returns (LoreboardVoting voting) {
        address votingPower = vm.envAddress("VOTING_POWER_SOURCE");
        address admin = vm.envAddress("BOARD_ADMIN");
        uint256 quorum = vm.envUint("VOTING_QUORUM");

        uint256 pk = vm.envUint("DEPLOYER_PK");
        vm.startBroadcast(pk);

        voting = new LoreboardVoting(votingPower, admin, quorum);

        vm.stopBroadcast();
    }
}
