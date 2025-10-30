// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

contract Counter {
    address public constant admin = 0xcE716032dFe9d5BB840568171F541A6A046bBf90;

    modifier onlyAdmin() {
        require(msg.sender == admin, "not admin");
        _;
    }

    // Accept ETH via direct transfers
    receive() external payable {}

    // Optional explicit deposit function
    function deposit() external payable {}

    // Admin can pay out ETH from the contract to a recipient
    function claim(uint256 amount, address payable recipient) external onlyAdmin {
        require(recipient != address(0), "bad recipient");
        require(address(this).balance >= amount, "insufficient");
        (bool ok, ) = recipient.call{value: amount}("");
        require(ok, "transfer failed");
    }
}
