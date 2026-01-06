// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/LoreBoardTreasury.sol";

contract Finalize is Script {
    function run() external {
        address payable TREASURY    = payable(vm.envAddress("TREASURY"));
        uint32  EPOCH               = uint32(vm.envUint("EPOCH"));
        bytes32 MANIFEST_ROOT       = vm.envBytes32("MANIFEST_ROOT");
        string memory MANIFEST_CID  = vm.envString("MANIFEST_CID"); // use vm.envBytes if your ABI wants bytes

        uint256 OPERATOR_PK = vm.envUint("OPERATOR_PK");
        vm.startBroadcast(OPERATOR_PK);

        LoreBoardTreasury(TREASURY).finalizeEpoch(
            EPOCH,
            MANIFEST_ROOT,
            MANIFEST_CID,
            new bytes32[](0),   // acceptedIds
            new bytes32[](0)    // rejectedIds
        );

        vm.stopBroadcast();
    }
}
