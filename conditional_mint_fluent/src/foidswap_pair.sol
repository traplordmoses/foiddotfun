// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ERC20, ERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

interface IPairFactory {
    function feeTo() external view returns (address);
}

contract Pair is ERC20, ERC20Permit, ReentrancyGuard {
    using SafeERC20 for IERC20;

    address public immutable factory;
    IERC20  public immutable token0;
    IERC20  public immutable token1;

    uint112 private reserve0;
    uint112 private reserve1;
    uint32  private blockTimestampLast;

    // protocol fee-on state
    uint256 public rootKLast; // stored as uint for arithmetic

    uint256 private constant MINIMUM_LIQUIDITY = 1_000;
    uint256 private constant FEE_NUM = 997; // 0.30% swap fee to LPs (pricing-side)
    uint256 private constant FEE_DEN = 1000;

    event Sync(uint112 reserve0, uint112 reserve1);
    event Mint(address indexed sender, uint256 amount0, uint256 amount1, address indexed to, uint256 shares);
    event Burn(address indexed sender, uint256 amount0, uint256 amount1, address indexed to, uint256 shares);
    event Swap(address indexed sender, bool zeroForOne, uint256 amountIn, uint256 amountOut, address indexed to);

    /// @notice Initializes the LP token with the two assets and records the factory deployer.
    constructor(address _token0, address _token1)
        ERC20("FoidSwap LP", "FLP") ERC20Permit("FoidSwap LP")
    {
        require(_token0 != address(0) && _token1 != address(0), "ZERO_ADDR");
        require(_token0 != _token1, "IDENTICAL");
        factory = msg.sender;
        token0 = IERC20(_token0);
        token1 = IERC20(_token1);
    }

    /// @notice Returns the most recent reserves and timestamp tracked in the AMM.
    function getReserves() public view returns (uint112, uint112, uint32) {
        return (reserve0, reserve1, blockTimestampLast);
    }

    /*//////////////////////////////////////////////////////////////
                         PROTOCOL FEE (FEE-ON)
    //////////////////////////////////////////////////////////////*/
    /// @dev Mints protocol fee liquidity if the factory has fee collection enabled.
    function _mintFee(uint256 _reserve0, uint256 _reserve1) private {
        address feeTo = IPairFactory(factory).feeTo();
        if (feeTo == address(0)) {
            if (rootKLast != 0) rootKLast = 0;
            return;
        }
        if (rootKLast == 0) {
            // initialize tracking on first fee-on transition
            rootKLast = _sqrt(_reserve0 * _reserve1);
            return;
        }
        uint256 rootK = _sqrt(_reserve0 * _reserve1);
        if (rootK <= rootKLast) return;

        uint256 _totalSupply = totalSupply();
        // liquidity to mint = ts * (rootK - rootKLast) / (rootK * 5 + rootKLast)
        // (≈ 1/6 of LP fees to feeTo)
        uint256 numerator   = _totalSupply * (rootK - rootKLast);
        uint256 denominator = rootK * 5 + rootKLast;
        uint256 liquidity   = numerator / denominator;
        if (liquidity > 0) _mint(feeTo, liquidity);

        rootKLast = rootK;
    }

    /*//////////////////////////////////////////////////////////////
                               LIQUIDITY
    //////////////////////////////////////////////////////////////*/
    /// @notice Adds liquidity using the optimal ratio, mints LP shares, and returns consumed token amounts.
    function deposit(
        uint256 amount0Desired,
        uint256 amount1Desired,
        uint256 amount0Min,
        uint256 amount1Min,
        address to,
        uint256 deadline
    ) external nonReentrant returns (uint256 shares, uint256 amount0, uint256 amount1) {
        require(block.timestamp <= deadline, "EXPIRED");
        require(to != address(0), "BAD_TO");

        (uint112 r0, uint112 r1,) = getReserves();

        // choose optimal amounts vs current reserves
        if (totalSupply() == 0) {
            amount0 = amount0Desired;
            amount1 = amount1Desired;
        } else {
            uint256 amount1Optimal = (amount0Desired * r1) / r0;
            if (amount1Optimal <= amount1Desired) {
                amount0 = amount0Desired;
                amount1 = amount1Optimal;
            } else {
                uint256 amount0Optimal = (amount1Desired * r0) / r1;
                amount0 = amount0Optimal;
                amount1 = amount1Desired;
            }
        }
        require(amount0 >= amount0Min && amount1 >= amount1Min, "SLIPPAGE");

        // pull funds
        token0.safeTransferFrom(msg.sender, address(this), amount0);
        token1.safeTransferFrom(msg.sender, address(this), amount1);

        // mint protocol fee (if feeTo set) based on pre-mint reserves
        _mintFee(r0, r1);

        // IMPORTANT: read totalSupply AFTER _mintFee (it may have minted LP to feeTo)
        uint256 _totalSupply = totalSupply();

        if (_totalSupply == 0) {
            uint256 initial = _sqrt(amount0 * amount1);
            require(initial > MINIMUM_LIQUIDITY, "MIN_LIQ");
            _mint(to, initial);
            _burn(to, MINIMUM_LIQUIDITY);
            shares = initial - MINIMUM_LIQUIDITY;
        } else {
            shares = _min((amount0 * _totalSupply) / r0, (amount1 * _totalSupply) / r1);
            require(shares > 0, "NO_SHARES");
            _mint(to, shares);
        }

        _update(_balance(token0), _balance(token1));
        emit Mint(msg.sender, amount0, amount1, to, shares);
    }

    /// @notice Burns LP shares for the underlying token amounts and sends them to the receiver.
    function withdraw(
        uint256 shares,
        address to,
        uint256 deadline
    ) external nonReentrant returns (uint256 amount0, uint256 amount1) {
        require(block.timestamp <= deadline, "EXPIRED");
        require(shares > 0, "ZERO_SHARES");
        require(to != address(0), "BAD_TO");

        uint256 bal0 = _balance(token0);
        uint256 bal1 = _balance(token1);

        // mint protocol fee before burning
        _mintFee(reserve0, reserve1);

        // IMPORTANT: read totalSupply AFTER _mintFee
        uint256 _totalSupply = totalSupply();

        amount0 = (shares * bal0) / _totalSupply;
        amount1 = (shares * bal1) / _totalSupply;
        require(amount0 > 0 && amount1 > 0, "ZERO_OUT");

        _burn(msg.sender, shares);
        token0.safeTransfer(to, amount0);
        token1.safeTransfer(to, amount1);

        _update(_balance(token0), _balance(token1));
        emit Burn(msg.sender, amount0, amount1, to, shares);
    }

    /*//////////////////////////////////////////////////////////////
                                   SWAP
    //////////////////////////////////////////////////////////////*/
    /// @notice Swaps one token in the pair for the other while enforcing the constant-product invariant.
    function swap(
        uint256 amountIn,
        bool zeroForOne,
        uint256 amountOutMin,
        address to,
        uint256 deadline
    ) external nonReentrant returns (uint256 amountOut) {
        require(block.timestamp <= deadline, "EXPIRED");
        require(amountIn > 0, "ZERO_IN");
        require(to != address(this), "BAD_TO");

        (uint112 r0, uint112 r1,) = getReserves();
        (IERC20 tokIn, IERC20 tokOut, uint256 rIn, uint256 rOut) =
            zeroForOne ? (token0, token1, r0, r1) : (token1, token0, r1, r0);

        uint256 balInBefore = _balance(tokIn);
        tokIn.safeTransferFrom(msg.sender, address(this), amountIn);
        uint256 actualIn = _balance(tokIn) - balInBefore;
        require(actualIn > 0, "ZERO_ACTUAL_IN");

        amountOut = (actualIn * FEE_NUM * rOut) / (rIn * FEE_DEN + actualIn * FEE_NUM);
        require(amountOut >= amountOutMin, "SLIPPAGE");

        tokOut.safeTransfer(to, amountOut);

        uint256 bal0 = _balance(token0);
        uint256 bal1 = _balance(token1);
        require(bal0 * bal1 >= uint256(r0) * uint256(r1), "K");

        _update(bal0, bal1);
        emit Swap(msg.sender, zeroForOne, actualIn, amountOut, to);
    }

    /*//////////////////////////////////////////////////////////////
                              MAINTENANCE
    //////////////////////////////////////////////////////////////*/
    /// @notice Transfers any excess token balances (over tracked reserves) to the target address.
    function skim(address to) external nonReentrant {
        require(to != address(0), "BAD_TO");
        token0.safeTransfer(to, _balance(token0) - reserve0);
        token1.safeTransfer(to, _balance(token1) - reserve1);
    }

    /// @notice Forces the reserves to match the actual token balances held by the pair.
    function sync() external nonReentrant {
        _update(_balance(token0), _balance(token1));
    }

    /*//////////////////////////////////////////////////////////////
                                 INTERNAL
    //////////////////////////////////////////////////////////////*/
    /// @dev Writes the latest balances to storage and keeps protocol fee accounting in sync.
    function _update(uint256 bal0, uint256 bal1) private {
        require(bal0 <= type(uint112).max && bal1 <= type(uint112).max, "OVERFLOW");
        reserve0 = uint112(bal0);
        reserve1 = uint112(bal1);
        blockTimestampLast = uint32(block.timestamp % 2**32);

        address feeTo = IPairFactory(factory).feeTo();
        if (feeTo != address(0)) {
            rootKLast = _sqrt(uint256(reserve0) * uint256(reserve1));
        } else if (rootKLast != 0) {
            rootKLast = 0;
        }
        emit Sync(reserve0, reserve1);
    }

    /// @dev Convenience helper to read the current token balance of the pair.
    function _balance(IERC20 t) private view returns (uint256) {
        return t.balanceOf(address(this));
    }

    /// @dev Integer square root using Babylonian method for reserve product calculations.
    function _sqrt(uint256 x) private pure returns (uint256 y) {
        if (x == 0) return 0;
        uint256 z = (x + 1) / 2;
        y = x;
        while (z < y) { y = z; z = (x / z + z) / 2; }
    }

    /// @dev Returns the smaller of two unsigned integers.
    function _min(uint256 a, uint256 b) private pure returns (uint256) {
        return a < b ? a : b;
    }
}
