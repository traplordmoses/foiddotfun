// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FOID20} from "./FOID20.sol";

/**
 * @title FOID20Factory
 * @notice FOID token "launchpad" using CREATE2 + salt namespacing.
 *         - Predictive addresses
 *         - Registry of created tokens
 *         - Stores the userSalt you used (for reproducibility)
 *
 * To get vanity suffix ...f01d, grind userSalt client-side (or via script)
 * against the exact constructor args you will pass.
 */
contract FOID20Factory {
    struct TokenMeta {
        address creator;
        string  name;
        string  symbol;
        uint8   decimals;
        uint256 cap;
        uint256 initialMint;
        address initialMintTo;
        bytes32 userSalt;     // un-namespaced salt you passed
        uint64  createdAt;
    }

    event TokenDeployed(
        address indexed token,
        address indexed creator,
        string  name,
        string  symbol,
        uint8   decimals,
        uint256 cap,
        uint256 initialMint,
        address initialMintTo,
        bytes32 userSalt,         // raw user-provided salt
        bytes32 namespacedSalt    // keccak256(creator, userSalt)
    );

    mapping(address => address[]) public tokensByCreator;
    mapping(address => TokenMeta) public metaByToken;

    // ---------- Helpers ----------

    function getTokensByCreator(address creator) external view returns (address[] memory) {
        return tokensByCreator[creator];
    }

    /// @notice Predict using an arbitrary initialOwner_ (advanced usage).
    function predictAddress(
        string memory name_,
        string memory symbol_,
        uint8 decimals_,
        uint256 cap_,
        address initialOwner_,
        address initialMintTo_,
        uint256 initialMintAmount_,
        bytes32 userSalt_
    ) external view returns (address predicted, bytes32 namespacedSalt) {
        return _predict(name_, symbol_, decimals_, cap_, initialOwner_, initialMintTo_, initialMintAmount_, userSalt_);
    }

    /// @notice Predict using msg.sender as initialOwner_ (safer for UIs).
    function predictMyAddress(
        string memory name_,
        string memory symbol_,
        uint8 decimals_,
        uint256 cap_,
        address initialMintTo_,
        uint256 initialMintAmount_,
        bytes32 userSalt_
    ) external view returns (address predicted, bytes32 namespacedSalt) {
        return _predict(name_, symbol_, decimals_, cap_, msg.sender, initialMintTo_, initialMintAmount_, userSalt_);
    }

    function _predict(
        string memory name_,
        string memory symbol_,
        uint8 decimals_,
        uint256 cap_,
        address initialOwner_,
        address initialMintTo_,
        uint256 initialMintAmount_,
        bytes32 userSalt_
    ) internal view returns (address predicted, bytes32 namespacedSalt) {
        bytes memory bytecode = abi.encodePacked(
            type(FOID20).creationCode,
            abi.encode(name_, symbol_, decimals_, cap_, initialOwner_, initialMintTo_, initialMintAmount_)
        );
        bytes32 codeHash = keccak256(bytecode);
        namespacedSalt = keccak256(abi.encode(initialOwner_, userSalt_));
        predicted = _computeCreate2Address(namespacedSalt, codeHash);
    }

    // ---------- Deploy (CREATE2) ----------

    function deployToken(
        string memory name_,
        string memory symbol_,
        uint8 decimals_,
        uint256 cap_,
        address initialMintTo_,
        uint256 initialMintAmount_,
        bytes32 userSalt_
    ) external returns (address token) {
        address creator = msg.sender;

        bytes memory bytecode = abi.encodePacked(
            type(FOID20).creationCode,
            abi.encode(name_, symbol_, decimals_, cap_, creator, initialMintTo_, initialMintAmount_)
        );

        bytes32 namespacedSalt = keccak256(abi.encode(creator, userSalt_));

        assembly {
            token := create2(0, add(bytecode, 0x20), mload(bytecode), namespacedSalt)
            if iszero(token) { revert(0, 0) }
        }

        tokensByCreator[creator].push(token);
        metaByToken[token] = TokenMeta({
            creator: creator,
            name: name_,
            symbol: symbol_,
            decimals: decimals_,
            cap: cap_,
            initialMint: initialMintAmount_,
            initialMintTo: initialMintTo_,
            userSalt: userSalt_,
            createdAt: uint64(block.timestamp)
        });

        emit TokenDeployed(
            token, creator, name_, symbol_, decimals_, cap_, initialMintAmount_, initialMintTo_, userSalt_, namespacedSalt
        );
    }

    // ---------- Internals ----------

    function _computeCreate2Address(bytes32 salt, bytes32 codeHash) internal view returns (address addr) {
        bytes32 digest = keccak256(abi.encodePacked(bytes1(0xff), address(this), salt, codeHash));
        addr = address(uint160(uint256(digest)));
    }
}
