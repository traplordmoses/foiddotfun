// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract AttestorRegistry is Ownable {
    mapping(address => bool) public isAttestor;

    event AttestorAdded(address attestor);
    event AttestorRemoved(address attestor);

    // OZ v5: must pass the initial owner
    constructor(address initialOwner) Ownable(initialOwner) {}

    function addAttestor(address a) external onlyOwner {
        isAttestor[a] = true;
        emit AttestorAdded(a);
    }

    function removeAttestor(address a) external onlyOwner {
        isAttestor[a] = false;
        emit AttestorRemoved(a);
    }
}
