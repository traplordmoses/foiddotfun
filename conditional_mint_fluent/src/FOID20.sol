// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC20Burnable} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title FOID20
 * @notice Minimal, capped, mintable/burnable ERC20 with custom decimals.
 *         Owner can mint up to CAP; you can renounceOwnership() after distribution.
 * @dev Requires OpenZeppelin ^5.x (Ownable(initialOwner_) ctor).
 */
contract FOID20 is ERC20, ERC20Burnable, Ownable {
    uint8 public immutable DECIMALS;
    uint256 public immutable CAP;

    constructor(
        string memory name_,
        string memory symbol_,
        uint8 decimals_,
        uint256 cap_,
        address initialOwner_,
        address initialMintTo_,
        uint256 initialMintAmount_
    ) ERC20(name_, symbol_) Ownable(initialOwner_) {
        require(bytes(name_).length != 0, "NAME");
        require(bytes(symbol_).length != 0, "SYMBOL");
        require(decimals_ > 0 && decimals_ <= 30, "DECIMALS");
        require(cap_ > 0, "CAP");
        require(initialMintAmount_ <= cap_, "INITIAL_EXCEEDS_CAP");

        DECIMALS = decimals_;
        CAP = cap_;

        if (initialMintAmount_ > 0) {
            require(initialMintTo_ != address(0), "MINT_TO_ZERO");
            _mint(initialMintTo_, initialMintAmount_);
            require(totalSupply() <= CAP, "CAP_EXCEEDED");
        }
    }

    function decimals() public view override returns (uint8) {
        return DECIMALS;
    }

    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
        require(totalSupply() <= CAP, "CAP_EXCEEDED");
    }
}
