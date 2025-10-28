// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

import {Pair} from "../src/foidswap_pair.sol";

contract MockERC20 is ERC20 {
    /// @notice Deploys the mock with free minting for tests.
    constructor(string memory name_, string memory symbol_) ERC20(name_, symbol_) {}

    /// @notice Mints test tokens to the requested account.
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

contract PairTest is Test {
    MockERC20 private token0;
    MockERC20 private token1;
    Pair private pair;

    address private constant LP = address(0xA11CE);
    address private constant TRADER = address(0xBEEF);
    address private constant RECIPIENT = address(0xCAFE);

    uint256 private constant STARTING_BALANCE = 1_000_000 ether;
    uint256 private constant TRADE_IN = 10 ether;
    uint256 private constant DEADLINE = type(uint256).max;
    uint256 private constant FEE_NUM = 997;
    uint256 private constant FEE_DEN = 1000;

    address public feeToAddress;

    /// @notice Provides the fee recipient interface expected by the pair.
    function feeTo() external view returns (address) {
        return feeToAddress;
    }

    /// @notice Sets up fresh tokens and a pair with approvals for each test.
    function setUp() public {
        token0 = new MockERC20("Token 0", "TK0");
        token1 = new MockERC20("Token 1", "TK1");

        token0.mint(LP, STARTING_BALANCE);
        token1.mint(LP, STARTING_BALANCE);
        token0.mint(TRADER, STARTING_BALANCE);
        token1.mint(TRADER, STARTING_BALANCE);

        pair = new Pair(address(token0), address(token1));

        vm.startPrank(LP);
        token0.approve(address(pair), type(uint256).max);
        token1.approve(address(pair), type(uint256).max);
        vm.stopPrank();

        vm.startPrank(TRADER);
        token0.approve(address(pair), type(uint256).max);
        token1.approve(address(pair), type(uint256).max);
        vm.stopPrank();
    }

    /// @dev Adds balanced liquidity from the LP helper account.
    function _addInitialLiquidity(uint256 amount0, uint256 amount1) internal returns (uint256 shares) {
        vm.startPrank(LP);
        (shares,,) = pair.deposit(amount0, amount1, 0, 0, LP, DEADLINE);
        vm.stopPrank();
    }

    /// @notice Verifies that the first deposit mints the expected LP supply and updates reserves.
    function testDepositMintsExpectedSharesAndReserves() public {
        uint256 amount = 100 ether;
        uint256 shares = _addInitialLiquidity(amount, amount);

        uint256 expectedShares = sqrt(amount * amount) - 1_000; // MINIMUM_LIQUIDITY
        assertEq(shares, expectedShares, "shares mismatch");
        assertEq(pair.balanceOf(LP), expectedShares, "LP balance mismatch");
        assertEq(pair.totalSupply(), expectedShares, "totalSupply mismatch");

        (uint112 r0, uint112 r1,) = pair.getReserves();
        assertEq(r0, amount, "reserve0 incorrect");
        assertEq(r1, amount, "reserve1 incorrect");
    }

    /// @notice Confirms a full withdrawal returns the underlying amounts to the LP.
    function testWithdrawBurnsSharesAndReturnsTokens() public {
        uint256 amount = 250 ether;
        uint256 shares = _addInitialLiquidity(amount, amount);

        vm.startPrank(LP);
        (uint256 out0, uint256 out1) = pair.withdraw(shares, LP, DEADLINE);
        vm.stopPrank();

        assertEq(out0, amount, "amount0 returned");
        assertEq(out1, amount, "amount1 returned");
        assertEq(pair.totalSupply(), 0, "supply not cleared");
        assertEq(pair.balanceOf(LP), 0, "LP still holds shares");
    }

    /// @notice Ensures swaps produce the Uniswap-style expected output and update reserves.
    function testSwapZeroForOneMatchesFormula() public {
        uint256 amount = 500 ether;
        _addInitialLiquidity(amount, amount);

        (uint112 r0, uint112 r1,) = pair.getReserves();
        uint256 expectedOut = (TRADE_IN * FEE_NUM * r1) / (uint256(r0) * FEE_DEN + TRADE_IN * FEE_NUM);

        vm.prank(TRADER);
        uint256 actualOut = pair.swap(TRADE_IN, true, 0, TRADER, DEADLINE);

        assertEq(actualOut, expectedOut, "swap output mismatch");
        assertEq(token1.balanceOf(TRADER), STARTING_BALANCE + expectedOut, "trader did not receive output");
        (uint112 newR0, uint112 newR1,) = pair.getReserves();
        assertEq(uint256(newR0), uint256(r0) + TRADE_IN, "reserve0 not incremented");
        assertEq(uint256(newR1), uint256(r1) - expectedOut, "reserve1 not decremented");
    }

    /// @notice Checks that the slippage guard rejects overly optimistic expectations.
    function testSwapRevertsWhenAmountOutMinTooHigh() public {
        uint256 amount = 400 ether;
        _addInitialLiquidity(amount, amount);

        (uint112 r0, uint112 r1,) = pair.getReserves();
        uint256 expectedOut = (TRADE_IN * FEE_NUM * r1) / (uint256(r0) * FEE_DEN + TRADE_IN * FEE_NUM);

        vm.expectRevert("SLIPPAGE");
        vm.prank(TRADER);
        pair.swap(TRADE_IN, true, expectedOut + 1, TRADER, DEADLINE);
    }

    /// @notice Validates that skim removes excess balances that are not tracked in reserves.
    function testSkimTransfersExcessTokens() public {
        uint256 amount = 300 ether;
        _addInitialLiquidity(amount, amount);

        token0.mint(address(pair), 2 ether);
        token1.mint(address(pair), 3 ether);

        uint256 before0 = token0.balanceOf(RECIPIENT);
        uint256 before1 = token1.balanceOf(RECIPIENT);

        pair.skim(RECIPIENT);

        assertEq(token0.balanceOf(RECIPIENT), before0 + 2 ether, "skimmed token0 incorrect");
        assertEq(token1.balanceOf(RECIPIENT), before1 + 3 ether, "skimmed token1 incorrect");
    }

    /// @notice Confirms sync aligns stored reserves with on-chain balances.
    function testSyncUpdatesReservesToMatchBalances() public {
        uint256 amount = 150 ether;
        _addInitialLiquidity(amount, amount);

        token0.mint(address(pair), 5 ether);
        token1.mint(address(pair), 8 ether);

        pair.sync();

        (uint112 r0, uint112 r1,) = pair.getReserves();
        assertEq(r0, amount + 5 ether, "reserve0 not synced");
        assertEq(r1, amount + 8 ether, "reserve1 not synced");
    }

    /// @notice Babylonian square root helper mirroring the pair implementation.
    function sqrt(uint256 x) internal pure returns (uint256 y) {
        if (x == 0) return 0;
        uint256 z = (x + 1) / 2;
        y = x;
        while (z < y) {
            y = z;
            z = (x / z + z) / 2;
        }
    }
}
