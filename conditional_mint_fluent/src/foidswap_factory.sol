// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Pair} from "./foidswap_pair.sol";

contract PairFactory {
    address public feeTo;
    address public feeToSetter;

    mapping(address => mapping(address => address)) public getPair;
    address[] public allPairs;

    event PairCreated(address indexed token0, address indexed token1, address pair, uint256 allPairsLength);
    event SetFeeTo(address indexed account);
    event SetFeeToSetter(address indexed account);

    /// @notice Sets the account authorized to configure protocol fee collection.
    constructor(address _feeToSetter) {
        feeToSetter = _feeToSetter;
    }

    /// @notice Returns the total number of pairs created by this factory.
    function allPairsLength() external view returns (uint256) {
        return allPairs.length;
    }

    /// @notice Deploys a new trading pair for the provided token addresses.
    function createPair(address tokenA, address tokenB) external returns (address pair) {
        require(tokenA != tokenB, "IDENTICAL");
        (address t0, address t1) = tokenA < tokenB ? (tokenA, tokenB) : (tokenB, tokenA);
        require(t0 != address(0), "ZERO");
        require(getPair[t0][t1] == address(0), "EXISTS");

        pair = address(new Pair(t0, t1));
        getPair[t0][t1] = pair;
        getPair[t1][t0] = pair;
        allPairs.push(pair);
        emit PairCreated(t0, t1, pair, allPairs.length);
    }

    /// @notice Updates the address that will collect protocol fees from pairs.
    function setFeeTo(address _feeTo) external {
        require(msg.sender == feeToSetter, "FORBIDDEN");
        feeTo = _feeTo;
        emit SetFeeTo(_feeTo);
    }

    /// @notice Transfers control over fee configuration to a new account.
    function setFeeToSetter(address _feeToSetter) external {
        require(msg.sender == feeToSetter, "FORBIDDEN");
        feeToSetter = _feeToSetter;
        emit SetFeeToSetter(_feeToSetter);
    }
}
