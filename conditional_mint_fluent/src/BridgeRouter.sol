// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {MessageHashUtils} from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import {WrappedFoid} from "./WrappedFoid.sol";
import {AttestorRegistry} from "./AttestorRegistry.sol";

contract BridgeRouter {
    using MessageHashUtils for bytes32; // OZ v5 helper for personal_sign prefix

    struct LockProof {
        bytes32 lockId;
        bytes32 moneroTx;
        address dest;
        uint256 amount;
        uint256 expiry;
    }

    WrappedFoid public immutable wFOID;
    AttestorRegistry public immutable registry;
    uint256 public immutable chainId;

    mapping(bytes32 => bool) public consumed;

    event Minted(bytes32 lockId, address dest, uint256 amount, address attestor);
    event RedeemRequested(address indexed user, uint256 amount, bytes moneroDest);

    constructor(WrappedFoid _wFOID, AttestorRegistry _registry) {
        wFOID = _wFOID;
        registry = _registry;
        uint256 id; assembly { id := chainid() }
        chainId = id;
    }

    // keccak256("BridgeMint(bytes32,bytes32,address,uint256,uint256,address,uint256)")
    bytes32 public constant MINT_TYPEHASH =
        keccak256("BridgeMint(bytes32,bytes32,address,uint256,uint256,address,uint256)");

    function _hash(LockProof memory p) internal view returns (bytes32) {
        return keccak256(
            abi.encode(
                MINT_TYPEHASH,
                p.lockId,
                p.moneroTx,
                p.dest,
                p.amount,
                p.expiry,
                address(this),
                chainId
            )
        );
    }

    function mintWithAttestation(LockProof calldata p, bytes calldata sig) external {
        require(block.timestamp <= p.expiry, "attestation expired");
        require(!consumed[p.lockId], "lockId used");
        require(p.amount > 0, "zero amount");
        require(p.dest != address(0), "bad dest");

        bytes32 digest = _hash(p).toEthSignedMessageHash(); // OZ v5 path
        address signer = ECDSA.recover(digest, sig);
        require(registry.isAttestor(signer), "bad signer");

        consumed[p.lockId] = true;
        wFOID.mint(p.dest, p.amount);

        emit Minted(p.lockId, p.dest, p.amount, signer);
    }

    function burnForRedeem(uint256 amount, bytes calldata moneroDest) external {
        wFOID.burn(msg.sender, amount);
        emit RedeemRequested(msg.sender, amount, moneroDest);
    }
}
