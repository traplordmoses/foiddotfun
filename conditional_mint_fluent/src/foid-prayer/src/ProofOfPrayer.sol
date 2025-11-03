// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract PrayerMirror {
    // --- storage ---
    address public registry;         // rWASM alias that appears as msg.sender on EVM calls
    address public wasmRegistry;     // optional: the pure rWASM account if different
    address public owner;            // deployer / emergency admin
    address public lastSyncSender;   // last successful caller of sync()
    mapping(address => bool) public isAuthorizedRegistry; // allowlist of permitted senders

    // --- custom errors ---
    error NotAuthorized(address caller);
    error ZeroAddress();

    // --- events ---
    event Synced(address indexed user, S s);
    event RegistryAuthorization(address indexed account, bool allowed);
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
        if (!isAuthorizedRegistry[msg.sender]) {
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
        _setAuthorized(_r, true);
        emit OwnershipTransferred(address(0), owner);
        emit RegistryUpdated(_r);
    }

    // --- admin (owner OR current registry/wasmRegistry may rotate) ---
    function setRegistry(address _r) external {
        if (msg.sender != owner && msg.sender != registry && msg.sender != wasmRegistry) {
            revert NotAuthorized(msg.sender);
        }
        if (_r == address(0)) revert ZeroAddress();
        registry = _r;
        _setAuthorized(_r, true);
        emit RegistryUpdated(_r);
    }

    function setWasmRegistry(address _r) external {
        if (msg.sender != owner && msg.sender != registry && msg.sender != wasmRegistry) {
            revert NotAuthorized(msg.sender);
        }
        if (_r == address(0)) revert ZeroAddress();
        wasmRegistry = _r;
        _setAuthorized(_r, true);
        emit WasmRegistryUpdated(_r);
    }

    /// convenience: set both in one tx (same auth as above)
    function authorizeBoth(address _alias, address _wasm) external {
        if (msg.sender != owner && msg.sender != registry && msg.sender != wasmRegistry) {
            revert NotAuthorized(msg.sender);
        }
        if (_alias == address(0) || _wasm == address(0)) revert ZeroAddress();
        registry = _alias;
        wasmRegistry = _wasm;
        _setAuthorized(_alias, true);
        _setAuthorized(_wasm, true);
        emit RegistryUpdated(_alias);
        emit WasmRegistryUpdated(_wasm);
    }

    /// optional ownership ops
    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert ZeroAddress();
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }

    function renounceOwnership() external onlyOwner {
        emit OwnershipTransferred(owner, address(0));
        owner = address(0);
    }

    /// owner-controlled toggling for advanced scenarios (e.g., multi-registry)
    function setRegistryAuthorization(address account, bool allowed) external onlyOwner {
        if (account == address(0)) revert ZeroAddress();
        _setAuthorized(account, allowed);
    }

    // --- helpers for safe narrowing ---
    function _n32(uint256 v) private pure returns (uint32) { return uint32(v); }
    function _n16(uint256 v) private pure returns (uint16) { return uint16(v); }

    // --- mirror entrypoint (must match rWASM selector 0x3f104dad) ---
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

    function _setAuthorized(address account, bool allowed) private {
        if (isAuthorizedRegistry[account] == allowed) return;
        isAuthorizedRegistry[account] = allowed;
        emit RegistryAuthorization(account, allowed);
    }

    // --- reads ---
    function get(address user)
        external
        view
        returns (uint32,uint32,uint32,uint32,uint16,bytes32)
    {
        S memory s = _s[user];
        return (s.streak, s.longest, s.total, s.milestones, s.score, s.prayerHash);
    }

    /// small QoL view to fetch both registry addresses at once
    function registryPair() external view returns (address aliasAddr, address wasmAddr) {
        return (registry, wasmRegistry);
    }

    /// static metadata (useful in UIs/debug)
    function version() external pure returns (uint32) { return 1; }
    function syncSelector() external pure returns (bytes4) {
        return bytes4(keccak256("sync(address,uint256,uint256,uint256,uint256,uint256,bytes32)"));
    }
}
