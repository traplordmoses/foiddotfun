// script/Sweep.s.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import "forge-std/Script.sol";
import "../src/LoreBoardTreasury.sol";

contract Sweep is Script {
    function run() external {
        address owner = vm.envAddress("OWNER");
        address payable to = payable(vm.envAddress("TO"));
        address payable t = payable(vm.envAddress("TREASURY_ADDR"));
        uint256 amount = vm.envUint("AMOUNT"); // or omit and call sweepAllTreasury

        vm.startBroadcast(owner);
        if (amount == 0) {
            LoreBoardTreasury(t).sweepAllTreasury(to);
        } else {
            LoreBoardTreasury(t).sweepTreasury(to, amount);
        }
        vm.stopBroadcast();
    }
}
