// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {Engrave} from "../src/Engrave.sol";

/// @title DeployEngrave
/// @notice Deploys the Engrave contract with FoidTrest as the gallery reference.
contract DeployEngrave is Script {
    function run() external {
        uint256 deployerPk = vm.envUint("OPERATOR_PK");

        // FoidTrest (Gallery) address on Fluent testnet
        address foidTrest = 0xdEe866015122c9f3672E18646a172Bd8a1eb2ff1;

        vm.startBroadcast(deployerPk);

        Engrave engrave = new Engrave(foidTrest);
        console.log("Engrave deployed at:", address(engrave));
        console.log("Gallery (FoidTrest):", foidTrest);

        vm.stopBroadcast();
    }
}
