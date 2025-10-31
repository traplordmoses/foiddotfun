// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import {Test} from "forge-std/Test.sol";
import {Groyper} from "../src/Groyper.sol";

contract GroyperTest is Test {
    Groyper public g;
    address public admin = 0xcE716032dFe9d5BB840568171F541A6A046bBf90;
    address public user = address(0xBEEF);
    address payable public receiver = payable(address(0xCAFE));

    function setUp() public {
        g = new Groyper();
        vm.deal(user, 10 ether);
        vm.deal(receiver, 0);
    }

    function test_DepositEmitsEvent() public {
        vm.expectEmit(true, false, false, false);
        emit Groyper.Deposit(user, 1 ether, block.timestamp);
        
        vm.prank(user);
        g.deposit{value: 1 ether}();
        
        assertEq(address(g).balance, 1 ether);
    }

    function test_OnlyAdminCanClaim() public {
        vm.deal(address(g), 2 ether);
        vm.prank(user);
        vm.expectRevert(bytes("not admin"));
        g.claim(1 ether, receiver);
    }

    function test_AdminClaimTransfersAndReducesBalance() public {
        vm.deal(address(g), 2 ether);
        uint256 beforeBal = receiver.balance;
        vm.prank(admin);
        g.claim(1.5 ether, receiver);
        assertEq(receiver.balance, beforeBal + 1.5 ether);
        assertEq(address(g).balance, 0.5 ether);
    }
}
