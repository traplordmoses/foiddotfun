// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/* -------------------- Interfaces -------------------- */
interface IPair {
    function token0() external view returns (address);
    function token1() external view returns (address);
    function getReserves() external view returns (uint112, uint112, uint32);
    function deposit(
        uint256 a0Des, uint256 a1Des, uint256 a0Min, uint256 a1Min, address to, uint256 deadline
    ) external returns (uint256 shares, uint256 amount0, uint256 amount1);
    function withdraw(uint256 shares, address to, uint256 deadline)
        external returns (uint256 amount0, uint256 amount1);
    function swap(
        uint256 amountIn, bool zeroForOne, uint256 amountOutMin, address to, uint256 deadline
    ) external returns (uint256 amountOut);
}

interface IFactory {
    function getPair(address, address) external view returns (address);
}

/* ---------------------- Router ---------------------- */
contract Router {
    IFactory public immutable factory;

    constructor(address _factory) {
        factory = IFactory(_factory);
    }

    /* ------------------ Liquidity ------------------ */

    function addLiquidity(
        address tokenA,
        address tokenB,
        uint256 amountADesired,
        uint256 amountBDesired,
        uint256 amountAMin,
        uint256 amountBMin,
        address to,
        uint256 deadline
    ) external returns (uint256 shares, uint256 amountA, uint256 amountB) {
        address pair = pairFor(tokenA, tokenB);
        (address t0, ) = sortTokens(tokenA, tokenB);

        // pull tokens to router
        SafeERC20.safeTransferFrom(IERC20(tokenA), msg.sender, address(this), amountADesired);
        SafeERC20.safeTransferFrom(IERC20(tokenB), msg.sender, address(this), amountBDesired);

        // approve pair to pull exactly what it needs (handles USDT-style reset)
        SafeERC20.forceApprove(IERC20(tokenA), pair, amountADesired);
        SafeERC20.forceApprove(IERC20(tokenB), pair, amountBDesired);

        if (t0 == tokenA) {
            (shares, amountA, amountB) =
                IPair(pair).deposit(amountADesired, amountBDesired, amountAMin, amountBMin, to, deadline);
        } else {
            (shares, amountB, amountA) =
                IPair(pair).deposit(amountBDesired, amountADesired, amountBMin, amountAMin, to, deadline);
        }

        // clear any residual allowances after the pull to avoid lingering approvals
        SafeERC20.forceApprove(IERC20(tokenA), pair, 0);
        SafeERC20.forceApprove(IERC20(tokenB), pair, 0);

        // refund dust (if any) from router back to user
        uint256 dustA = IERC20(tokenA).balanceOf(address(this));
        uint256 dustB = IERC20(tokenB).balanceOf(address(this));
        if (dustA > 0) SafeERC20.safeTransfer(IERC20(tokenA), msg.sender, dustA);
        if (dustB > 0) SafeERC20.safeTransfer(IERC20(tokenB), msg.sender, dustB);
    }

    function removeLiquidity(
        address tokenA,
        address tokenB,
        uint256 shares,
        address to,
        uint256 deadline
    ) external returns (uint256 amountA, uint256 amountB) {
        address pair = pairFor(tokenA, tokenB);

        // pull LP to router, then redeem underlying assets to `to`
        SafeERC20.safeTransferFrom(IERC20(pair), msg.sender, address(this), shares);

        (uint256 a0, uint256 a1) = IPair(pair).withdraw(shares, to, deadline);
        (address t0, ) = sortTokens(tokenA, tokenB);
        if (t0 == tokenA) { amountA = a0; amountB = a1; } else { amountA = a1; amountB = a0; }
    }

    /* -------------------- Swaps -------------------- */

    function swapExactTokensForTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external returns (uint256[] memory amounts) {
        require(path.length >= 2, "PATH_LEN");
        amounts = getAmountsOut(amountIn, path);
        require(amounts[amounts.length - 1] >= amountOutMin, "SLIPPAGE");

        // pull first token to router
        SafeERC20.safeTransferFrom(IERC20(path[0]), msg.sender, address(this), amounts[0]);

        for (uint256 i = 0; i < path.length - 1; i++) {
            address input  = path[i];
            address output = path[i + 1];
            address pair   = pairFor(input, output);

            (address t0, ) = sortTokens(input, output);
            bool zeroForOne = (t0 == input);

            // approve pair to pull exactly what it needs at each hop
            SafeERC20.forceApprove(IERC20(input), pair, amounts[i]);

            // send intermediate output back to the router so it can approve the next hop
            address recipient = (i < path.length - 2) ? address(this) : to;

            // pair pulls `amounts[i]` from router and sends output tokens onward
            IPair(pair).swap(amounts[i], zeroForOne, 0, recipient, deadline);

            // clear allowance for the hop we just used
            SafeERC20.forceApprove(IERC20(input), pair, 0);
        }
    }

    /* --------------- Pricing helpers --------------- */

    function quote(uint256 amountA, uint256 reserveA, uint256 reserveB) public pure returns (uint256) {
        require(amountA > 0, "INSUFFICIENT_AMOUNT");
        require(reserveA > 0 && reserveB > 0, "INSUFFICIENT_LIQ");
        return (amountA * reserveB) / reserveA;
    }

    function getAmountOut(uint256 amountIn, uint256 reserveIn, uint256 reserveOut) public pure returns (uint256) {
        require(amountIn > 0, "INSUFFICIENT_INPUT");
        require(reserveIn > 0 && reserveOut > 0, "INSUFFICIENT_LIQ");
        uint256 amountInWithFee = amountIn * 997; // 0.3% fee
        return (amountInWithFee * reserveOut) / (reserveIn * 1000 + amountInWithFee);
    }

    function getAmountsOut(uint256 amountIn, address[] calldata path) public view returns (uint256[] memory amounts) {
        require(path.length >= 2, "PATH_LEN");
        amounts = new uint256[](path.length);
        amounts[0] = amountIn;
        for (uint256 i = 0; i < path.length - 1; i++) {
            address pair = pairFor(path[i], path[i + 1]);
            (uint112 r0, uint112 r1,) = IPair(pair).getReserves();
            (address t0, ) = sortTokens(path[i], path[i + 1]);
            (uint256 reserveIn, uint256 reserveOut) = (t0 == path[i]) ? (r0, r1) : (r1, r0);
            amounts[i + 1] = getAmountOut(amounts[i], reserveIn, reserveOut);
        }
    }

    /* --------------------- Utils --------------------- */

    function pairFor(address a, address b) public view returns (address pair) {
        pair = IFactory(address(factory)).getPair(a, b);
        require(pair != address(0), "NO_PAIR");
    }

    function sortTokens(address a, address b) public pure returns (address t0, address t1) {
        require(a != b, "IDENTICAL");
        (t0, t1) = a < b ? (a, b) : (b, a);
        require(t0 != address(0), "ZERO");
    }
}
