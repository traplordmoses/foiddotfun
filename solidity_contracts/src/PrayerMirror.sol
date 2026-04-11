// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title PrayerMirror
/// @notice On-chain oracle that mirrors prayer streak data from the rWASM Prayer Registry
///         into the EVM. The registry (or its alias) calls sync() to update a user's
///         prayer stats. Other contracts (PrayerTiers, StreakVotingPower) read via get().
contract PrayerMirror {
    // --- storage ---
    address public registry;       // rWASM alias that appears as msg.sender on EVM calls
    address public wasmRegistry;   // optional: the pure rWASM account if different
    address public owner;          // deployer / emergency admin
    address public lastSyncSender; // last successful caller of sync()

    // --- custom errors ---
    error NotAuthorized(address caller);
    error ZeroAddress();

    // --- events ---
    event Synced(address indexed user, S s);
    event RegistryUpdated(address indexed newRegistry);
    event WasmRegistryUpdated(address indexed newWasmRegistry);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    // --- mirrored payload ---
    struct S {
        uint32 streak;
        uint32 longest;
        uint32 total;
        uint32 milestones;
        uint16 score;
        bytes32 prayerHash;
    }
    mapping(address => S) private _s;

    // --- modifiers ---
    modifier onlyRegistry() {
        if (msg.sender != registry && msg.sender != wasmRegistry) {
            revert NotAuthorized(msg.sender);
        }
        _;
    }

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotAuthorized(msg.sender);
        _;
    }

    // --- ctor ---
    constructor(address _r) {
        if (_r == address(0)) revert ZeroAddress();
        owner = msg.sender;
        registry = _r;
        emit OwnershipTransferred(address(0), owner);
        emit RegistryUpdated(_r);
    }

    /// @notice Set the EVM-side registry alias. Callable by owner or current registry.
    function setRegistry(address _r) external {
        if (msg.sender != owner && msg.sender != registry && msg.sender != wasmRegistry) {
            revert NotAuthorized(msg.sender);
        }
        if (_r == address(0)) revert ZeroAddress();
        registry = _r;
        emit RegistryUpdated(_r);
    }

    /// @notice Set the pure rWASM registry address. Callable by owner or current registry.
    function setWasmRegistry(address _r) external {
        if (msg.sender != owner && msg.sender != registry && msg.sender != wasmRegistry) {
            revert NotAuthorized(msg.sender);
        }
        if (_r == address(0)) revert ZeroAddress();
        wasmRegistry = _r;
        emit WasmRegistryUpdated(_r);
    }

    /// @notice Set both registry addresses in one transaction. Same auth as setRegistry.
    function authorizeBoth(address _alias, address _wasm) external {
        if (msg.sender != owner && msg.sender != registry && msg.sender != wasmRegistry) {
            revert NotAuthorized(msg.sender);
        }
        if (_alias == address(0) || _wasm == address(0)) revert ZeroAddress();
        registry = _alias;
        wasmRegistry = _wasm;
        emit RegistryUpdated(_alias);
        emit WasmRegistryUpdated(_wasm);
    }

    /// @notice Transfer ownership to a new admin address. Owner only.
    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert ZeroAddress();
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }

    /// @notice Permanently renounce ownership. Cannot be undone.
    function renounceOwnership() external onlyOwner {
        emit OwnershipTransferred(owner, address(0));
        owner = address(0);
    }

    // --- helpers for safe narrowing ---
    function _n32(uint256 v) private pure returns (uint32) {
        require(v <= type(uint32).max, "PrayerMirror: u32 overflow");
        return uint32(v);
    }
    function _n16(uint256 v) private pure returns (uint16) {
        require(v <= type(uint16).max, "PrayerMirror: u16 overflow");
        return uint16(v);
    }

    /// @notice Mirror a user's prayer data from the rWASM registry. Registry-only.
    /// @dev Selector must match rWASM: 0x3f104dad.
    function sync(
        address user,
        uint256 streak,
        uint256 longest,
        uint256 total,
        uint256 milestones,
        uint256 score,
        bytes32 prayerHash
    ) external onlyRegistry {
        lastSyncSender = msg.sender;
        _s[user] = S(
            _n32(streak),
            _n32(longest),
            _n32(total),
            _n32(milestones),
            _n16(score),
            prayerHash
        );
        emit Synced(user, _s[user]);
    }

    /// @notice Read a user's mirrored prayer data.
    /// @return streak, longest, total, milestones, score, prayerHash
    function get(address user)
        external
        view
        returns (uint32,uint32,uint32,uint32,uint16,bytes32)
    {
        S memory s = _s[user];
        return (s.streak, s.longest, s.total, s.milestones, s.score, s.prayerHash);
    }

    /// @notice Returns both registry addresses in one call.
    function registryPair() external view returns (address aliasAddr, address wasmAddr) {
        return (registry, wasmRegistry);
    }

    /// @notice Contract version number.
    function version() external pure returns (uint32) { return 1; }

    /// @notice Returns the function selector for sync() (useful for rWASM integration).
    function syncSelector() external pure returns (bytes4) {
        return bytes4(keccak256("sync(address,uint256,uint256,uint256,uint256,uint256,bytes32)"));
    }
}
