// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import {Script, console} from "forge-std/Script.sol";
import {Groyper} from "../src/Groyper.sol";

contract GroyperScript is Script {
    Groyper public groyper;

    function setUp() public {}

    function run() public {
        vm.startBroadcast();

        groyper = new Groyper();
        console.log("Groyper deployed at:", address(groyper));

        vm.stopBroadcast();
    }
}
