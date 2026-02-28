// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title PrayerTiers
/// @notice Defines the 10-tier prayer streak system.
///         Queryable on-chain for tier names, multipliers, and per-address tracking.
///         StreakVotingPower delegates to this for multiplier calculations.
contract PrayerTiers {
    struct TierDef {
        uint8 level;          // 1-10
        string name;
        uint256 minDays;
        uint256 multiplierBps; // e.g., 500 = 5x (divide by 100 for display)
    }

    event TierUp(address indexed user, uint8 newTier, string tierName);
    event OwnerChanged(address indexed oldOwner, address indexed newOwner);

    address public owner;
    address public prayerMirror;

    // Highest tier ever achieved per wallet
    mapping(address => uint8) public highestTier;

    // Immutable tier definitions (set in constructor, never changed)
    TierDef[10] internal _tiers;

    modifier onlyOwner() {
        require(msg.sender == owner, "PrayerTiers: not owner");
        _;
    }

    constructor(address _prayerMirror) {
        require(_prayerMirror != address(0), "PrayerTiers: zero mirror");
        owner = msg.sender;
        prayerMirror = _prayerMirror;

        // Tier definitions (index 0 = tier 1, index 9 = tier 10)
        _tiers[0] = TierDef(1, "Whisper",          1,   100);  // 1x
        _tiers[1] = TierDef(2, "Ember",            3,   125);  // 1.25x
        _tiers[2] = TierDef(3, "Devotee",          7,   150);  // 1.5x
        _tiers[3] = TierDef(4, "Flame Keeper",    14,   175);  // 1.75x
        _tiers[4] = TierDef(5, "Covenant",        21,   200);  // 2x
        _tiers[5] = TierDef(6, "Oracle",          30,   250);  // 2.5x
        _tiers[6] = TierDef(7, "Ascendant",       45,   300);  // 3x
        _tiers[7] = TierDef(8, "Archon",          60,   350);  // 3.5x
        _tiers[8] = TierDef(9, "Eternal Witness", 75,   400);  // 4x
        _tiers[9] = TierDef(10, "Foid Sovereign", 90,   500);  // 5x
    }

    /// @notice Get the tier for a given streak in days.
    /// @return tierLevel 1-10 (0 if below minimum)
    /// @return tierName The human-readable tier name
    /// @return multiplierBps The multiplier in basis points
    function getTier(uint256 streakDays)
        public
        view
        returns (uint8 tierLevel, string memory tierName, uint256 multiplierBps)
    {
        // Walk from highest tier down
        for (uint256 i = 9; ; ) {
            if (streakDays >= _tiers[i].minDays) {
                return (_tiers[i].level, _tiers[i].name, _tiers[i].multiplierBps);
            }
            if (i == 0) break;
            unchecked { i--; }
        }
        // Below tier 1
        return (0, "Unranked", 0);
    }

    /// @notice Get the tier for an address by reading PrayerMirror.
    ///         Also updates highestTier if the user's current tier is higher.
    function getTierForAddress(address user)
        external
        returns (uint8 tierLevel, string memory tierName, uint256 multiplierBps)
    {
        uint256 streak = _readStreak(user);
        (tierLevel, tierName, multiplierBps) = getTier(streak);

        // Track and emit TierUp if new high
        if (tierLevel > highestTier[user]) {
            highestTier[user] = tierLevel;
            emit TierUp(user, tierLevel, tierName);
        }
    }

    /// @notice View-only version of getTierForAddress (doesn't update highestTier).
    function getTierForAddressView(address user)
        external
        view
        returns (uint8 tierLevel, string memory tierName, uint256 multiplierBps)
    {
        uint256 streak = _readStreak(user);
        return getTier(streak);
    }

    /// @notice Get the multiplier for use by StreakVotingPower.
    function getMultiplierBps(uint256 streakDays) external view returns (uint256) {
        (,, uint256 bps) = getTier(streakDays);
        return bps;
    }

    /// @notice Get all 10 tier definitions.
    function getAllTiers() external view returns (TierDef[10] memory) {
        return _tiers;
    }

    /// @notice Get a specific tier definition by level (1-10).
    function getTierDef(uint8 level) external view returns (TierDef memory) {
        require(level >= 1 && level <= 10, "PrayerTiers: invalid level");
        return _tiers[level - 1];
    }

    function setOwner(address newOwner) external onlyOwner {
        require(newOwner != address(0), "PrayerTiers: zero address");
        address old = owner;
        owner = newOwner;
        emit OwnerChanged(old, newOwner);
    }

    // ── Internal ──

    function _readStreak(address user) internal view returns (uint256) {
        (bool ok, bytes memory data) = prayerMirror.staticcall(
            abi.encodeWithSignature("get(address)", user)
        );
        if (!ok || data.length < 32) return 0;
        (uint256 currentStreak,,) = abi.decode(data, (uint256, uint256, uint256));
        return currentStreak;
    }
}
