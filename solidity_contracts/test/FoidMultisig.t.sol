// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {FoidMultisig} from "../src/FoidMultisig.sol";

/// @dev Simple target contract to test multisig execution against.
contract MockTarget {
    uint256 public value;
    address public lastCaller;

    function setValue(uint256 v) external {
        value = v;
        lastCaller = msg.sender;
    }

    function revertingCall() external pure {
        revert("MockTarget: boom");
    }

    receive() external payable {}
}

contract FoidMultisigTest is Test {
    FoidMultisig internal multisig;
    MockTarget internal target;

    address internal signer1 = address(0x1111);
    address internal signer2 = address(0x2222);
    address internal signer3 = address(0x3333);
    address internal outsider = address(0x9999);

    function setUp() public {
        address[3] memory signers = [signer1, signer2, signer3];
        multisig = new FoidMultisig(signers);
        target = new MockTarget();
        vm.deal(address(multisig), 10 ether);
    }

    // ── Constructor ──

    function testSignersSet() public view {
        assertEq(multisig.signers(0), signer1);
        assertEq(multisig.signers(1), signer2);
        assertEq(multisig.signers(2), signer3);
        assertTrue(multisig.isSigner(signer1));
        assertTrue(multisig.isSigner(signer2));
        assertTrue(multisig.isSigner(signer3));
        assertFalse(multisig.isSigner(outsider));
    }

    function testConstructorRevertsDuplicateSigner() public {
        address[3] memory signers = [signer1, signer1, signer3];
        vm.expectRevert("Multisig: duplicate signer");
        new FoidMultisig(signers);
    }

    function testConstructorRevertsZeroSigner() public {
        address[3] memory signers = [signer1, address(0), signer3];
        vm.expectRevert("Multisig: zero signer");
        new FoidMultisig(signers);
    }

    // ── Submit ──

    function testSubmitTransaction() public {
        bytes memory data = abi.encodeWithSignature("setValue(uint256)", 42);
        vm.prank(signer1);
        uint256 txId = multisig.submitTransaction(address(target), 0, data);

        assertEq(txId, 0);
        assertEq(multisig.txCount(), 1);
        assertEq(multisig.getConfirmationCount(0), 1); // submitter auto-confirms
        assertTrue(multisig.hasConfirmed(0, signer1));
    }

    function testSubmitRevertsForNonSigner() public {
        bytes memory data = abi.encodeWithSignature("setValue(uint256)", 42);
        vm.prank(outsider);
        vm.expectRevert("Multisig: not signer");
        multisig.submitTransaction(address(target), 0, data);
    }

    // ── Confirm ──

    function testConfirmTransaction() public {
        bytes memory data = abi.encodeWithSignature("setValue(uint256)", 42);
        vm.prank(signer1);
        uint256 txId = multisig.submitTransaction(address(target), 0, data);

        vm.prank(signer2);
        multisig.confirmTransaction(txId);

        assertEq(multisig.getConfirmationCount(txId), 2);
        assertTrue(multisig.hasConfirmed(txId, signer2));
        assertTrue(multisig.isConfirmed(txId));
    }

    function testDoubleConfirmReverts() public {
        bytes memory data = abi.encodeWithSignature("setValue(uint256)", 42);
        vm.prank(signer1);
        uint256 txId = multisig.submitTransaction(address(target), 0, data);

        vm.prank(signer1);
        vm.expectRevert("Multisig: already confirmed");
        multisig.confirmTransaction(txId);
    }

    // ── Execute ──

    function testSubmitAndConfirmAndExecute() public {
        bytes memory data = abi.encodeWithSignature("setValue(uint256)", 42);

        vm.prank(signer1);
        uint256 txId = multisig.submitTransaction(address(target), 0, data);

        vm.prank(signer2);
        multisig.confirmTransaction(txId);

        // Anyone can trigger execution once confirmed
        multisig.executeTransaction(txId);

        assertEq(target.value(), 42);
        assertEq(target.lastCaller(), address(multisig));
    }

    function testSingleSignerCannotExecute() public {
        bytes memory data = abi.encodeWithSignature("setValue(uint256)", 42);

        vm.prank(signer1);
        uint256 txId = multisig.submitTransaction(address(target), 0, data);

        // Only 1 confirmation, need 2
        vm.expectRevert("Multisig: not enough confirmations");
        multisig.executeTransaction(txId);
    }

    function testExecuteRevertsOnRevertingTarget() public {
        bytes memory data = abi.encodeWithSignature("revertingCall()");

        vm.prank(signer1);
        uint256 txId = multisig.submitTransaction(address(target), 0, data);

        vm.prank(signer2);
        multisig.confirmTransaction(txId);

        vm.expectRevert("MockTarget: boom");
        multisig.executeTransaction(txId);
    }

    function testCannotExecuteTwice() public {
        bytes memory data = abi.encodeWithSignature("setValue(uint256)", 42);

        vm.prank(signer1);
        uint256 txId = multisig.submitTransaction(address(target), 0, data);

        vm.prank(signer2);
        multisig.confirmTransaction(txId);

        multisig.executeTransaction(txId);

        vm.expectRevert("Multisig: already executed");
        multisig.executeTransaction(txId);
    }

    // ── Revoke ──

    function testRevokeConfirmation() public {
        bytes memory data = abi.encodeWithSignature("setValue(uint256)", 42);

        vm.prank(signer1);
        uint256 txId = multisig.submitTransaction(address(target), 0, data);

        // Signer2 confirms then revokes
        vm.prank(signer2);
        multisig.confirmTransaction(txId);
        assertEq(multisig.getConfirmationCount(txId), 2);

        vm.prank(signer2);
        multisig.revokeConfirmation(txId);
        assertEq(multisig.getConfirmationCount(txId), 1);
        assertFalse(multisig.hasConfirmed(txId, signer2));
    }

    function testRevokeRevertsIfNotConfirmed() public {
        bytes memory data = abi.encodeWithSignature("setValue(uint256)", 42);

        vm.prank(signer1);
        uint256 txId = multisig.submitTransaction(address(target), 0, data);

        vm.prank(signer2);
        vm.expectRevert("Multisig: not confirmed");
        multisig.revokeConfirmation(txId);
    }

    // ── ETH handling ──

    function testReceiveETH() public {
        vm.deal(outsider, 1 ether);
        vm.prank(outsider);
        (bool ok,) = address(multisig).call{value: 1 ether}("");
        assertTrue(ok);
        assertEq(address(multisig).balance, 11 ether); // 10 from setUp + 1
    }

    function testExecuteWithETH() public {
        bytes memory data = "";
        vm.prank(signer1);
        uint256 txId = multisig.submitTransaction(address(target), 1 ether, data);

        vm.prank(signer2);
        multisig.confirmTransaction(txId);

        multisig.executeTransaction(txId);
        assertEq(address(target).balance, 1 ether);
    }

    // ── Integration: multisig calls setApprovalThreshold on a target ──

    function testExecuteCallsExternalFunction() public {
        // Simulate calling Swipe.setApprovalThreshold(5100) via multisig
        bytes memory data = abi.encodeWithSignature("setValue(uint256)", 5100);

        vm.prank(signer1);
        uint256 txId = multisig.submitTransaction(address(target), 0, data);

        vm.prank(signer3);
        multisig.confirmTransaction(txId);

        multisig.executeTransaction(txId);
        assertEq(target.value(), 5100);
    }

    // ── Views ──

    function testGetTransaction() public {
        bytes memory data = abi.encodeWithSignature("setValue(uint256)", 99);

        vm.prank(signer1);
        multisig.submitTransaction(address(target), 0.5 ether, data);

        (address to, uint256 value, bytes memory txData, bool executed, uint8 confirmCount) =
            multisig.getTransaction(0);

        assertEq(to, address(target));
        assertEq(value, 0.5 ether);
        assertEq(txData, data);
        assertFalse(executed);
        assertEq(confirmCount, 1);
    }
}
