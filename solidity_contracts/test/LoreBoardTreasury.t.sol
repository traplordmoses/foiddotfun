// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/LoreBoardTreasury.sol";

contract Sink {
    receive() external payable {}
    function balance() external view returns (uint256) { return address(this).balance; }
}

contract LoreBoardTreasuryTest is Test {
    LoreBoardTreasury T;

    address owner    = address(uint160(uint256(keccak256("owner"))));
    address operator = address(this); // this contract will call finalizeEpoch
    address bidder   = address(uint160(uint256(keccak256("bidder"))));

    function setUp() public {
        vm.prank(owner);
        T = new LoreBoardTreasury(10_000_000_000_000, operator); // base = 1e13
        vm.deal(bidder, 100 ether);
    }

    function _pid(
        address _bidder,
        uint32 epoch,
        bytes32 cid,
        LoreBoardTreasury.Rect memory r
    ) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(_bidder, epoch, cid, r.x, r.y, r.w, r.h));
    }

    // FIX: actually allocate a dynamic array with one element
    function _one(bytes32 a) internal pure returns (bytes32[] memory arr) {
        arr = new bytes32[](1);
        arr[0] = a;
    }

    function testProposeEscrowsExact() public {
        LoreBoardTreasury.Rect memory r = LoreBoardTreasury.Rect(0,0,64,64);
        uint32 cells = 16;
        uint96 bidPerCell = 10_000_000_000_000; // == base
        uint32 epoch = 1;
        bytes32 cidHash = keccak256("cid");
        bytes32 id = _pid(bidder, epoch, cidHash, r);

        LoreBoardTreasury.Proposed memory p = LoreBoardTreasury.Proposed({
            id: id,
            bidder: bidder,
            rect: r,
            cells: cells,
            bidPerCellWei: bidPerCell,
            cidHash: cidHash,
            epoch: epoch
        });

        uint256 need = uint256(bidPerCell) * cells;
        vm.prank(bidder);
        T.proposePlacement{value: need}(p);

        assertTrue(T.seenProposal(id));
        assertEq(T.escrow(id), need);
    }

    function testProposeRejectsLowBid() public {
        LoreBoardTreasury.Rect memory r = LoreBoardTreasury.Rect(0,0,64,64);
        uint32 cells = 16;
        uint96 bidPerCell = 9_000_000_000_000; // < base
        uint32 epoch = 1;
        bytes32 cidHash = keccak256("cid");
        bytes32 id = _pid(bidder, epoch, cidHash, r);

        LoreBoardTreasury.Proposed memory p = LoreBoardTreasury.Proposed({
            id: id,
            bidder: bidder,
            rect: r,
            cells: cells,
            bidPerCellWei: bidPerCell,
            cidHash: cidHash,
            epoch: epoch
        });

        uint256 need = uint256(bidPerCell) * cells;
        vm.prank(bidder);
        vm.expectRevert("bid < base");
        T.proposePlacement{value: need}(p);
    }

    function testFinalizeMarksAcceptedAndAccruesTreasuryAndSweep() public {
        LoreBoardTreasury.Rect memory r = LoreBoardTreasury.Rect(0,0,64,64);
        uint32 cells = 16; uint96 bpc = 10_000_000_000_000; uint32 epoch = 1;
        bytes32 cidHash = keccak256("cid");
        bytes32 id = _pid(bidder, epoch, cidHash, r);

        LoreBoardTreasury.Proposed memory p = LoreBoardTreasury.Proposed({
            id: id, bidder: bidder, rect: r, cells: cells, bidPerCellWei: bpc, cidHash: cidHash, epoch: epoch
        });

        uint256 need = uint256(bpc) * cells;
        vm.prank(bidder);
        T.proposePlacement{value: need}(p);

        T.finalizeEpoch(
            epoch,
            bytes32(uint256(0x1234)),
            "ipfs://manifest",
            _one(id),
            new bytes32[](0)
        );

        assertTrue(T.accepted(id));
        assertEq(T.escrow(id), 0);
        assertEq(T.treasuryBalance(), need);

        Sink sink = new Sink();
        vm.prank(owner);
        // If your contract exposes sweepTreasury(addr, amount) instead, swap the next line.
        T.sweepAllTreasury(payable(address(sink)));

        assertEq(T.treasuryBalance(), 0);
        assertEq(sink.balance(), need);
    }

    function testFinalizeAutoRefundLoser() public {
        address loser = address(uint160(uint256(keccak256("loser"))));
        vm.deal(loser, 10 ether);

        LoreBoardTreasury.Rect memory r1 = LoreBoardTreasury.Rect(0,0,64,64);
        LoreBoardTreasury.Rect memory r2 = LoreBoardTreasury.Rect(64,0,64,64);

        uint32 cells = 16; uint96 bpc = 10_000_000_000_000; uint32 epoch = 1;
        bytes32 cidHash = keccak256("cid");

        bytes32 id1 = _pid(bidder, epoch, cidHash, r1);
        LoreBoardTreasury.Proposed memory p1 = LoreBoardTreasury.Proposed({
            id: id1, bidder: bidder, rect: r1, cells: cells, bidPerCellWei: bpc, cidHash: cidHash, epoch: epoch
        });
        uint256 need = uint256(bpc) * cells;
        vm.prank(bidder); T.proposePlacement{value: need}(p1);

        bytes32 id2 = _pid(loser, epoch, cidHash, r2);
        LoreBoardTreasury.Proposed memory p2 = LoreBoardTreasury.Proposed({
            id: id2, bidder: loser, rect: r2, cells: cells, bidPerCellWei: bpc, cidHash: cidHash, epoch: epoch
        });
        vm.prank(loser); T.proposePlacement{value: need}(p2);

        uint256 preLoser = loser.balance;

        T.finalizeEpoch(
            epoch,
            bytes32(uint256(0x1234)),
            "ipfs://manifest",
            _one(id1),
            _one(id2)
        );

        assertTrue(T.accepted(id1));
        assertTrue(T.rejected(id2));
        assertEq(T.treasuryBalance(), need);
        assertEq(loser.balance, preLoser + need);
    }

    function testCreditRefundAndWithdraw() public {
        vm.deal(address(T), 1 ether);
        T.creditRefund(bidder, 1 ether);
        assertEq(T.claimable(bidder), 1 ether);

        uint256 pre = bidder.balance;
        vm.prank(bidder);
        T.withdraw();
        assertEq(bidder.balance, pre + 1 ether);
        assertEq(T.claimable(bidder), 0);
    }
}
