// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract PrayerMirror {
    /// Address of the rWASM registry that is authorized to sync state.
    address public registry;

    struct S {
        // Consecutive days prayed, resets on a miss.
        uint32 streak;
        // Highest streak ever achieved.
        uint32 longest;
        // All-time check-in count.
        uint32 total;
        // Bitmask of milestone badges. Bits 0..5 = days 7/14/21/28/60/90.
        uint32 milestones;
        // Daily devotional score (normalized by the client).
        uint16 score;
        // keccak256 hash of the private prayer text shown to the user.
        bytes32 prayerHash;
    }
    mapping(address => S) private _s;
    event Synced(address indexed user, S s);

    /// Restrict writes to the active registry instance.
    modifier onlyRegistry(){ require(msg.sender==registry, "not registry"); _; }

    /// Set the initial writer at deployment.
    constructor(address _r){ registry = _r; }
    /// Allow the registry to hand over control (e.g. after an upgrade).
    function setRegistry(address _r) external onlyRegistry {
        require(_r != address(0), "zero addr");
        registry=_r;
    }

    /// Single entry point used by the rWASM contract to mirror latest stats.
    function sync(
      address user, uint32 streak, uint32 longest, uint32 total,
      uint32 milestones, uint16 score, bytes32 prayerHash
    ) external onlyRegistry {
      _s[user] = S(streak,longest,total,milestones,score,prayerHash);
      emit Synced(user, _s[user]);
    }

    /// Read back the current mirror snapshot for UI, NFTs, or analytics.
    function get(address user)
      external view
      returns (uint32,uint32,uint32,uint32,uint16,bytes32)
    {
      S memory s=_s[user];
      return (s.streak,s.longest,s.total,s.milestones,s.score,s.prayerHash);
    }
}
