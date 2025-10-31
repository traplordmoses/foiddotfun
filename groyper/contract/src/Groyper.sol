// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

contract Groyper {
    address public constant admin = 0xcE716032dFe9d5BB840568171F541A6A046bBf90;

    event Deposit(address indexed depositor, uint256 amount, uint256 timestamp);

    modifier onlyAdmin() {
        require(msg.sender == admin, "not admin");
        _;
    }

    function deposit() external payable {
        emit Deposit(msg.sender, msg.value, block.timestamp);
    }

    function claim(uint256 amount, address payable recipient) external onlyAdmin {
        require(recipient != address(0), "bad recipient");
        require(address(this).balance >= amount, "insufficient");
        (bool ok, ) = recipient.call{value: amount}("");
        require(ok, "transfer failed");
    }
}
