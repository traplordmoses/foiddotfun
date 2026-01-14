// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/LoreboardLiveNFT.sol";

contract MockTreasury is ILoreboardTreasury {
    mapping(uint256 => bytes32) public roots;

    function setRoot(uint256 epoch, bytes32 root) external {
        roots[epoch] = root;
    }

    function manifestRootOf(uint256 epoch) external view returns (bytes32) {
        return roots[epoch];
    }
}

contract MockManifestStore is ILoreboardManifestStore {
    uint256 public e;
    bytes32 public r;
    string public c;

    function setLatest(uint256 epoch, bytes32 root, string memory cid) external {
        e = epoch;
        r = root;
        c = cid;
    }

    function latest() external view returns (uint256 epoch, bytes32 root, string memory cid) {
        return (e, r, c);
    }
}

contract LoreboardLiveNFTTest is Test {
    MockTreasury t;
    MockManifestStore m;
    LoreboardLiveNFT nft;

    address owner = address(0xBEEF);

    function setUp() public {
        t = new MockTreasury();
        m = new MockManifestStore();
        nft = new LoreboardLiveNFT(address(t), address(m), owner);
    }

    function testSyncRevertsIfNotFinalized() public {
        m.setLatest(10, bytes32(uint256(123)), "ipfs://cid");

        vm.expectRevert(abi.encodeWithSelector(LoreboardLiveNFT.EpochNotFinalized.selector, 10));
        nft.syncLatest();
    }

    function testSyncRevertsIfRootMismatch() public {
        m.setLatest(10, bytes32(uint256(123)), "ipfs://cid");
        t.setRoot(10, bytes32(uint256(456)));

        vm.expectRevert(
            abi.encodeWithSelector(
                LoreboardLiveNFT.RootMismatch.selector,
                bytes32(uint256(456)),
                bytes32(uint256(123))
            )
        );
        nft.syncLatest();
    }

    function testSyncUpdatesAndEmits4906() public {
        bytes32 root = keccak256("root");
        m.setLatest(10, root, "ipfs://cid");
        t.setRoot(10, root);

        vm.expectEmit(true, true, true, true);
        emit IERC4906.MetadataUpdate(0);

        nft.syncLatest();

        assertEq(nft.liveEpoch(), 10);
        assertEq(nft.liveManifestRoot(), root);
        assertEq(nft.liveManifestCID(), "ipfs://cid");
    }

    function testTokenURIOnlyForToken0() public {
        vm.expectRevert(abi.encodeWithSelector(LoreboardLiveNFT.BadTokenId.selector, 1));
        nft.tokenURI(1);
    }
}
