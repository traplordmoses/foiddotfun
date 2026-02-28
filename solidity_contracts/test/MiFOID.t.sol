// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {MiFOID} from "../src/MiFOID.sol";
import {StreakVotingPower} from "../src/StreakVotingPower.sol";
import {PrayerTiers} from "../src/PrayerTiers.sol";

/// @dev Mock PrayerMirror for testing
contract MockPrayerMirror {
    mapping(address => uint256) public streaks;

    function setStreak(address user, uint256 streak) external {
        streaks[user] = streak;
    }

    function get(address user) external view returns (uint256, uint256, uint256) {
        return (streaks[user], streaks[user], streaks[user]); // current, longest, total
    }
}

contract MiFOIDTest is Test {
    MiFOID mifoid;
    MockPrayerMirror mirror;
    StreakVotingPower votingPower;
    PrayerTiers prayerTiers;

    receive() external payable {}

    address owner = address(this);
    address user1 = address(uint160(uint256(keccak256("user1"))));
    address user2 = address(uint160(uint256(keccak256("user2"))));

    function setUp() public {
        mirror = new MockPrayerMirror();
        mifoid = new MiFOID(address(mirror), 0.01 ether, block.timestamp); // opens immediately

        prayerTiers = new PrayerTiers(address(mirror));

        // Deploy StreakVotingPower (new 4-arg constructor)
        votingPower = new StreakVotingPower(
            address(mirror),
            address(mifoid),
            100,   // baseWeight = 100
            50     // mifoidBonus = 50
        );
        votingPower.setPrayerTiers(address(prayerTiers));

        vm.deal(user1, 10 ether);
        vm.deal(user2, 10 ether);
    }

    function testMintSuccess() public {
        mirror.setStreak(user1, 7);

        vm.prank(user1);
        uint256 tokenId = mifoid.mint{value: 0.01 ether}();

        assertEq(tokenId, 0);
        assertTrue(mifoid.hasMiFOID(user1));
        assertEq(mifoid.ownerOf(0), user1);
        assertEq(mifoid.totalMinted(), 1);

        MiFOID.Traits memory t = mifoid.getTraits(0);
        assertEq(t.mintStreak, 7);
        assertEq(t.duelWins, 0);
        assertEq(t.trestPlacements, 0);
    }

    function testCannotMintTwice() public {
        vm.prank(user1);
        mifoid.mint{value: 0.01 ether}();

        vm.prank(user1);
        vm.expectRevert("MiFOID: already minted");
        mifoid.mint{value: 0.01 ether}();
    }

    function testMintTimeLock() public {
        // Deploy a MiFOID that opens in the future
        MiFOID futureMifoid = new MiFOID(address(mirror), 0.01 ether, block.timestamp + 1 days);

        vm.prank(user1);
        vm.expectRevert("MiFOID: minting not open yet");
        futureMifoid.mint{value: 0.01 ether}();

        // Warp past open time
        vm.warp(block.timestamp + 1 days + 1);

        vm.prank(user1);
        futureMifoid.mint{value: 0.01 ether}();
        assertTrue(futureMifoid.hasMiFOID(user1));
    }

    function testTokenURI_NoImage() public {
        mirror.setStreak(user1, 30);

        vm.prank(user1);
        mifoid.mint{value: 0.01 ether}();

        string memory uri = mifoid.tokenURI(0);
        // Should start with data:application/json;base64,
        assertTrue(bytes(uri).length > 40);
    }

    function testSetTokenURI() public {
        vm.prank(user1);
        mifoid.mint{value: 0.01 ether}();

        string memory ipfsUri = "ipfs://QmTestBlenderRender123";
        mifoid.setTokenURI(0, ipfsUri);

        string memory uri = mifoid.tokenURI(0);
        assertTrue(bytes(uri).length > 40);
        // Verify the stored URI
        assertEq(keccak256(bytes(mifoid.tokenIPFSUri(0))), keccak256(bytes(ipfsUri)));
    }

    function testSetTokenURI_OnlyOwner() public {
        vm.prank(user1);
        mifoid.mint{value: 0.01 ether}();

        vm.prank(user1);
        vm.expectRevert("MiFOID: not owner");
        mifoid.setTokenURI(0, "ipfs://QmTest");
    }

    function testVotingPowerWithTiers() public {
        // Streak = 30 = Oracle = 250 bps
        // weight = (100 * 250) / 100 = 250, no MiFOID = 250
        mirror.setStreak(user1, 30);
        uint256 power1 = votingPower.votingPowerOf(user1, 0);
        assertEq(power1, 250);

        // Mint MiFOID: weight = 250 + 50 = 300
        vm.prank(user1);
        mifoid.mint{value: 0.01 ether}();
        uint256 power2 = votingPower.votingPowerOf(user1, 0);
        assertEq(power2, 300);
    }

    function testVotingPowerZeroStreak() public view {
        // No streak, no MiFOID, no PrayerTiers multiplier
        // 0 days = Unranked = 0 bps, so weight = baseWeight = 100
        uint256 power = votingPower.votingPowerOf(user2, 0);
        assertEq(power, 100);
    }

    function testVotingPowerHighStreak() public {
        mirror.setStreak(user1, 90);

        vm.prank(user1);
        mifoid.mint{value: 0.01 ether}();

        // 90 days = Foid Sovereign = 500 bps
        // weight = (100 * 500) / 100 + 50 = 550
        uint256 power = votingPower.votingPowerOf(user1, 0);
        assertEq(power, 550);
    }

    function testTraitUpdates() public {
        vm.prank(user1);
        mifoid.mint{value: 0.01 ether}();

        address updater = address(uint160(uint256(keccak256("updater"))));
        mifoid.authorizeUpdater(updater);

        vm.prank(updater);
        mifoid.incrementDuelWins(user1);

        vm.prank(updater);
        mifoid.incrementTrestPlacements(user1);

        MiFOID.Traits memory t = mifoid.getTraits(0);
        assertEq(t.duelWins, 1);
        assertEq(t.trestPlacements, 1);
    }

    function testUnauthorizedUpdaterReverts() public {
        vm.prank(user1);
        mifoid.mint{value: 0.01 ether}();

        vm.prank(user2);
        vm.expectRevert("MiFOID: not authorized updater");
        mifoid.incrementDuelWins(user1);
    }
}
