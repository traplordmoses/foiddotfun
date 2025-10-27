// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import {AttestorRegistry} from "../src/AttestorRegistry.sol";
import {WrappedFoid} from "../src/WrappedFoid.sol";
import {BridgeRouter} from "../src/BridgeRouter.sol";

contract DeployBridge is Script {
    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");        // deployer/admin
        address attestor = vm.envAddress("ATTESTOR");   // initial TEE signer

        address deployer = vm.addr(pk);
        vm.startBroadcast(pk);

        // 1) registry (owner = deployer)
        AttestorRegistry reg = new AttestorRegistry(deployer);
        reg.addAttestor(attestor);

        // 2) wrapped token (admin = deployer)
        WrappedFoid w = new WrappedFoid(deployer);

        // 3) router
        BridgeRouter router = new BridgeRouter(w, reg);

        // 4) grant roles on token
        bytes32 MINTER_ROLE = w.MINTER_ROLE();
        bytes32 PAUSER_ROLE = w.PAUSER_ROLE();

        w.grantRole(MINTER_ROLE, address(router));   // router can mint/burn
        w.grantRole(PAUSER_ROLE, deployer);          // deployer can pause
        // optional: manual mint while testing
        // w.grantRole(MINTER_ROLE, deployer);

        console2.log("AttestorRegistry:", address(reg));
        console2.log("WrappedFoid    :", address(w));
        console2.log("BridgeRouter   :", address(router));

        vm.stopBroadcast();
    }
}
