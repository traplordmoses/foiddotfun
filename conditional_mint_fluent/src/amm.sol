// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @title SimpleSingleAMM
 * @dev Minimal constant-product AMM (x·y=k) with 0.3 % swap fee.
 *      Users only specify "amount in" and the contract calculates "amount out".
 *      Liquidity providers can deposit / withdraw proportionally.
 */
contract SimpleSingleAMM is ERC20 {
    /* ------------------------------------------------ *
     *  STORAGE                                         *
     * ------------------------------------------------ */
    ERC20 public immutable token0;
    ERC20 public immutable token1;

    uint112 private reserve0;
    uint112 private reserve1;
    uint32  private blockTimestampLast;

    uint private constant MINIMUM_LIQUIDITY = 1_000;
    uint private constant FEE_NUM           = 997; // 0.3 % fee
    uint private constant FEE_DEN           = 1_000;

    /* ------------------------------------------------ *
     *  EVENTS                                          *
     * ------------------------------------------------ */
    event Sync(uint112 reserve0, uint112 reserve1);
    event Mint(address indexed sender, uint amount0, uint amount1);
    event Burn(address indexed sender, uint amount0, uint amount1, address indexed to);
    event Swap(address indexed sender, uint amountIn, uint amountOut, bool zeroForOne, address indexed to);

    /* ------------------------------------------------ *
     *  CONSTRUCTOR                                     *
     * ------------------------------------------------ */
    constructor(address _token0, address _token1) ERC20("LP-V2", "LP") {
        require(_token0 != address(0) && _token1 != address(0), "Zero addr");
        require(_token0 != _token1, "Same token");
        token0 = ERC20(_token0);
        token1 = ERC20(_token1);
    }

    /* ------------------------------------------------ *
     *  VIEW HELPERS                                    *
     * ------------------------------------------------ */
    function getReserves() public view returns (uint112 _reserve0, uint112 _reserve1, uint32 _blockTimestampLast) {
        _reserve0 = reserve0;
        _reserve1 = reserve1;
        _blockTimestampLast = blockTimestampLast;
    }

    /* ------------------------------------------------ *
     *  DEPOSIT (add liquidity)                       *
     * ------------------------------------------------ */
    /**
     * @notice Deposit any desired amount of token0 and token1.
     *         Caller must transfer tokens before calling this function.
     * @return shares Number of LP tokens minted
     */
    function deposit() external returns (uint shares) {
        (uint112 _reserve0, uint112 _reserve1,) = getReserves();
        uint balance0 = token0.balanceOf(address(this));
        uint balance1 = token1.balanceOf(address(this));

        uint amount0 = balance0 - _reserve0;
        uint amount1 = balance1 - _reserve1;
        require(amount0 > 0 && amount1 > 0, "INSUFFICIENT_AMOUNTS");

        uint _totalSupply = totalSupply();
        if (_totalSupply == 0) {
            shares = sqrt(amount0 * amount1) - MINIMUM_LIQUIDITY;
            _mint(address(0), MINIMUM_LIQUIDITY); // permanently lock
        } else {
            shares = min(
                (amount0 * _totalSupply) / _reserve0,
                (amount1 * _totalSupply) / _reserve1
            );
        }
        require(shares > 0, "INSUFFICIENT_SHARES");
        _mint(msg.sender, shares);
        _update(balance0, balance1);
        emit Mint(msg.sender, amount0, amount1);
    }

    /* ------------------------------------------------ *
     *  WITHDRAW (remove liquidity)                    *
     * ------------------------------------------------ */
    /**
     * @notice Burn LP tokens and receive underlying assets proportionally.
     * @param shares How many LP tokens to burn
     * @param to Address that receives token0 & token1
     * @return amount0 Amount of token0 sent to `to`
     * @return amount1 Amount of token1 sent to `to`
     */
    function withdraw(uint shares, address to) external returns (uint amount0, uint amount1) {
        require(shares > 0, "ZERO_SHARES");
        uint _totalSupply = totalSupply();
        uint balance0 = token0.balanceOf(address(this));
        uint balance1 = token1.balanceOf(address(this));

        amount0 = (shares * balance0) / _totalSupply;
        amount1 = (shares * balance1) / _totalSupply;

        require(amount0 > 0 && amount1 > 0, "INSUFFICIENT_OUTPUT");

        _burn(msg.sender, shares);
        token0.transfer(to, amount0);
        token1.transfer(to, amount1);

        _update(token0.balanceOf(address(this)), token1.balanceOf(address(this)));
        emit Burn(msg.sender, amount0, amount1, to);
    }

    /* ------------------------------------------------ *
     *  SWAP                                            *
     * ------------------------------------------------ */
    /**
     * @notice Swap exact input amount for calculated output.
     * @param amountIn Exact tokens to pay
     * @param zeroForOne true = token0→token1, false = token1→token0
     * @param to Recipient of output tokens
     * @return amountOut Tokens received
     */
    function swap(uint amountIn, bool zeroForOne, address to) external returns (uint amountOut) {
        require(amountIn > 0, "ZERO_IN");
        (uint112 _reserve0, uint112 _reserve1,) = getReserves();
        (uint rIn, uint rOut) = zeroForOne ? (_reserve0, _reserve1) : (_reserve1, _reserve0);

        amountOut = (amountIn * FEE_NUM * rOut) / (rIn * FEE_DEN + amountIn * FEE_NUM);

        (ERC20 tokIn, ERC20 tokOut) = zeroForOne ? (token0, token1) : (token1, token0);
        tokIn.transferFrom(msg.sender, address(this), amountIn);
        tokOut.transfer(to, amountOut);

        _update(token0.balanceOf(address(this)), token1.balanceOf(address(this)));
        emit Swap(msg.sender, amountIn, amountOut, zeroForOne, to);
    }

    /* ------------------------------------------------ *
     *  INTERNALS                                       *
     * ------------------------------------------------ */
    function _update(uint balance0, uint balance1) private {
        reserve0 = uint112(balance0);
        reserve1 = uint112(balance1);
        blockTimestampLast = uint32(block.timestamp % 2**32);
        emit Sync(reserve0, reserve1);
    }

    function sqrt(uint x) private pure returns (uint y) {
        if (x == 0) return 0;
        uint z = (x + 1) / 2;
        y = x;
        while (z < y) { y = z; z = (x / z + z) / 2; }
    }

    function min(uint a, uint b) private pure returns (uint) {
        return a < b ? a : b;
    }
}