// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";

contract WrappedFoid is ERC20, AccessControl, Pausable {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");

    constructor(address admin) ERC20("Wrapped Foid", "wFOID") {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(PAUSER_ROLE, admin);
        // admin can later grant MINTER_ROLE to BridgeRouter and/or themselves for testing
    }

    // ---- mint / burn (0 supply at start) ----
    function mint(address to, uint256 amount) external onlyRole(MINTER_ROLE) {
        _mint(to, amount);
    }

    function burn(address from, uint256 amount) external onlyRole(MINTER_ROLE) {
        _burn(from, amount);
    }

    // ---- pause / unpause ----
    function pause() external onlyRole(PAUSER_ROLE) { _pause(); }
    function unpause() external onlyRole(PAUSER_ROLE) { _unpause(); }

    // ---- transfer checks ----
    function _update(address from, address to, uint256 value) internal override {
        if (paused()) revert("token paused");
        super._update(from, to, value);
    }
}
