// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/LoreBoardTreasury.sol";

contract FinalizeEpoch is Script {
    function run() external {
        address payable t         = payable(vm.envAddress("TREASURY"));
        uint32  epoch             = uint32(vm.envUint("EPOCH"));
        bytes32 manifestRoot      = vm.envBytes32("MANIFEST_ROOT");
        string memory manifestCID = vm.envString("MANIFEST_CID");

        uint256 pk = vm.envUint("OPERATOR_PK");
        vm.startBroadcast(pk);

        LoreBoardTreasury(t).finalizeEpoch(
            epoch,
            manifestRoot,
            manifestCID,
            new bytes32[](0),
            new bytes32[](0)
        );

        vm.stopBroadcast();
    }
}
