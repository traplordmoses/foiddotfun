// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import {Test} from "forge-std/Test.sol";
import {Counter} from "../src/Counter.sol";

contract CounterTest is Test {
    Counter public c;
    address public admin = 0xcE716032dFe9d5BB840568171F541A6A046bBf90;
    address public user = address(0xBEEF);
    address payable public receiver = payable(address(0xCAFE));

    function setUp() public {
        c = new Counter();
        vm.deal(user, 10 ether);
        vm.deal(receiver, 0);
    }

    function test_DepositViaFunction() public {
        vm.startPrank(user);
        c.deposit{value: 1 ether}();
        vm.stopPrank();
        assertEq(address(c).balance, 1 ether);
    }

    function test_DepositViaReceive() public {
        vm.prank(user);
        (bool ok, ) = address(c).call{value: 0.2 ether}("");
        assertTrue(ok);
        assertEq(address(c).balance, 0.2 ether);
    }

    function test_OnlyAdminCanClaim() public {
        vm.deal(address(c), 2 ether);
        vm.prank(user);
        vm.expectRevert(bytes("not admin"));
        c.claim(1 ether, receiver);
    }

    function test_AdminClaimTransfersAndReducesBalance() public {
        vm.deal(address(c), 2 ether);
        uint256 beforeBal = receiver.balance;
        vm.prank(admin);
        c.claim(1.5 ether, receiver);
        assertEq(receiver.balance, beforeBal + 1.5 ether);
        assertEq(address(c).balance, 0.5 ether);
    }
}
