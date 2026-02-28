// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IVotingPower} from "./IVotingPower.sol";

/// @title StreakVotingPower
/// @notice IVotingPower implementation that weights votes using PrayerTiers multiplier + MiFOID bonus.
///         weight = (baseWeight * tierMultiplierBps / 100) + (mifoidBonus if holder)
///         Delegates to PrayerTiers for multiplier lookup.
contract StreakVotingPower is IVotingPower {
    event ConfigUpdated(uint256 baseWeight, uint256 mifoidBonus);
    event OwnerChanged(address indexed oldOwner, address indexed newOwner);

    address public owner;
    address public prayerMirror;
    address public mifoidNFT;
    address public prayerTiers; // PrayerTiers contract for multiplier lookups

    uint256 public baseWeight;
    uint256 public mifoidBonus; // flat bonus for MiFOID holders

    modifier onlyOwner() {
        require(msg.sender == owner, "StreakVotingPower: not owner");
        _;
    }

    /// @param _prayerMirror Contract that exposes get(address) → (currentStreak, longestStreak, totalPrayers)
    /// @param _mifoidNFT MiFOID NFT contract that exposes holdsToken(address) → bool (can be address(0) initially)
    /// @param _baseWeight Base voting weight (e.g., 100)
    /// @param _mifoidBonus Flat bonus added for MiFOID holders (e.g., 50)
    constructor(
        address _prayerMirror,
        address _mifoidNFT,
        uint256 _baseWeight,
        uint256 _mifoidBonus
    ) {
        require(_prayerMirror != address(0), "StreakVotingPower: zero mirror");
        owner = msg.sender;
        prayerMirror = _prayerMirror;
        mifoidNFT = _mifoidNFT;
        baseWeight = _baseWeight;
        mifoidBonus = _mifoidBonus;
    }

    /// @notice Calculate voting power for a voter. epochId is ignored (power is live, not snapshotted).
    function votingPowerOf(address voter, uint256 /* epochId */)
        external
        view
        override
        returns (uint256)
    {
        uint256 weight = baseWeight;

        // Apply tier multiplier from PrayerTiers if set
        if (prayerTiers != address(0)) {
            uint256 streak = _readStreak(voter);
            uint256 multiplierBps = _getTierMultiplier(streak);
            if (multiplierBps > 0) {
                weight = (baseWeight * multiplierBps) / 100;
            }
        }

        // Add MiFOID holder bonus
        if (mifoidNFT != address(0) && _holdsMiFOID(voter)) {
            weight += mifoidBonus;
        }

        return weight;
    }

    /// @notice Update the MiFOID NFT address (deployed after this contract).
    function setMifoidNFT(address _mifoidNFT) external onlyOwner {
        mifoidNFT = _mifoidNFT;
    }

    /// @notice Set the PrayerTiers contract address.
    function setPrayerTiers(address _prayerTiers) external onlyOwner {
        prayerTiers = _prayerTiers;
    }

    /// @notice Update weighting parameters.
    function setConfig(uint256 _baseWeight, uint256 _mifoidBonus) external onlyOwner {
        baseWeight = _baseWeight;
        mifoidBonus = _mifoidBonus;
        emit ConfigUpdated(_baseWeight, _mifoidBonus);
    }

    /// @notice Transfer ownership.
    function setOwner(address newOwner) external onlyOwner {
        require(newOwner != address(0), "StreakVotingPower: zero address");
        address old = owner;
        owner = newOwner;
        emit OwnerChanged(old, newOwner);
    }

    // ── Internal reads ──

    function _readStreak(address user) internal view returns (uint256) {
        (bool ok, bytes memory data) = prayerMirror.staticcall(
            abi.encodeWithSignature("get(address)", user)
        );
        if (!ok || data.length < 32) return 0;
        (uint256 currentStreak,,) = abi.decode(data, (uint256, uint256, uint256));
        return currentStreak;
    }

    function _holdsMiFOID(address user) internal view returns (bool) {
        (bool ok, bytes memory data) = mifoidNFT.staticcall(
            abi.encodeWithSignature("holdsToken(address)", user)
        );
        if (!ok || data.length < 32) return false;
        return abi.decode(data, (bool));
    }

    function _getTierMultiplier(uint256 streakDays) internal view returns (uint256) {
        (bool ok, bytes memory data) = prayerTiers.staticcall(
            abi.encodeWithSignature("getMultiplierBps(uint256)", streakDays)
        );
        if (!ok || data.length < 32) return 0;
        return abi.decode(data, (uint256));
    }
}
