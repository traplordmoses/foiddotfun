// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {FoidTrest} from "../src/FoidTrest.sol";
import {FoidTrestDirect} from "../src/FoidTrestDirect.sol";

contract FoidTrestTest is Test {
    FoidTrest trest;
    FoidTrestDirect direct;

    address owner = address(this);
    address feeRecipient = address(uint160(uint256(keccak256("feeRecipient"))));
    address user1 = address(uint160(uint256(keccak256("user1"))));
    address user2 = address(uint160(uint256(keccak256("user2"))));

    uint256 constant FEE = 0.001 ether;

    function setUp() public {
        trest = new FoidTrest();
        direct = new FoidTrestDirect(address(trest), feeRecipient, FEE);
        trest.authorizeEntryPoint(address(direct));

        vm.deal(user1, 10 ether);
        vm.deal(user2, 10 ether);
    }

    function testDirectPlacementSuccess() public {
        uint256 preFee = feeRecipient.balance;

        vm.prank(user1);
        uint256 entryId = direct.placeDirect{value: FEE}(
            "QmTestCID123", "My Meme", "A great meme"
        );

        assertEq(entryId, 0);
        assertEq(trest.entryCount(), 1);

        FoidTrest.TrestEntry memory entry = trest.getEntry(0);
        assertEq(entry.creator, user1);
        assertEq(entry.path, 0);
        assertTrue(entry.visible);
        assertEq(keccak256(bytes(entry.ipfsCid)), keccak256(bytes("QmTestCID123")));

        assertEq(feeRecipient.balance, preFee + FEE);
    }

    function testDirectPlacementInsufficientFee() public {
        vm.prank(user1);
        vm.expectRevert("FoidTrestDirect: insufficient fee");
        direct.placeDirect{value: FEE - 1}("QmTestCID", "Title", "Desc");
    }

    function testUnauthorizedEntryPointReverts() public {
        vm.prank(user1);
        vm.expectRevert("FoidTrest: unauthorized entry point");
        trest.addEntry(user1, "QmTest", "T", "D", 0, 0);
    }

    function testMetadataUpdateByCreator() public {
        vm.prank(user1);
        direct.placeDirect{value: FEE}("QmTest", "", "");

        vm.prank(user1);
        trest.setMetadata(0, "Updated Title", "Updated Description");

        FoidTrest.TrestEntry memory entry = trest.getEntry(0);
        assertEq(keccak256(bytes(entry.title)), keccak256(bytes("Updated Title")));
    }

    function testMetadataUpdateByNonCreatorReverts() public {
        vm.prank(user1);
        direct.placeDirect{value: FEE}("QmTest", "", "");

        vm.prank(user2);
        vm.expectRevert("FoidTrest: not creator");
        trest.setMetadata(0, "Hack", "Hacked");
    }

    function testVisibilityToggle() public {
        vm.prank(user1);
        direct.placeDirect{value: FEE}("QmTest", "T", "D");

        trest.setVisibility(0, false);
        assertFalse(trest.getEntry(0).visible);

        trest.setVisibility(0, true);
        assertTrue(trest.getEntry(0).visible);
    }

    function testMultipleEntries() public {
        vm.prank(user1);
        direct.placeDirect{value: FEE}("QmA", "A", "");

        vm.prank(user2);
        direct.placeDirect{value: FEE}("QmB", "B", "");

        assertEq(trest.entryCount(), 2);
        assertEq(trest.getEntry(0).creator, user1);
        assertEq(trest.getEntry(1).creator, user2);
    }

    function testRevokeEntryPoint() public {
        trest.revokeEntryPoint(address(direct));

        // Direct calls from the revoked entry point should revert
        vm.prank(address(direct));
        vm.expectRevert("FoidTrest: unauthorized entry point");
        trest.addEntry(user1, "QmTest", "T", "D", 0, 0);
    }

    function testOwnerTransfer() public {
        trest.setOwner(user1);
        assertEq(trest.owner(), user1);

        // Original owner can no longer act
        vm.expectRevert("FoidTrest: not owner");
        trest.setVisibility(0, false);
    }
}
