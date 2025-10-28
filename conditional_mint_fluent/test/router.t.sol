// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {Pair} from "../src/foidswap_pair.sol";
import {PairFactory} from "../src/foidswap_factory.sol";
import {Router} from "../src/foidswap_router.sol";

contract MockERC20 is ERC20 {
    /// @notice Deploys a mintable ERC20 for router-focused tests.
    constructor(string memory name_, string memory symbol_) ERC20(name_, symbol_) {}

    /// @notice Mints tokens to any recipient for test setup.
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

contract RouterTest is Test {
    MockERC20 private tokenA;
    MockERC20 private tokenB;
    PairFactory private factory;
    Router private router;
    Pair private pair;

    address private lp;
    address private trader;

    uint256 private constant DEADLINE = type(uint256).max;
    uint256 private constant LIQUIDITY_SEED = 1_000 ether;
    uint256 private constant AMOUNT_IN = 25 ether;

    /// @notice Deploys core contracts and supplies accounts with test balances.
    function setUp() public {
        tokenA = new MockERC20("Token A", "TKA");
        tokenB = new MockERC20("Token B", "TKB");

        lp = makeAddr("LP");
        trader = makeAddr("Trader");

        tokenA.mint(lp, 1_000_000 ether);
        tokenB.mint(lp, 1_000_000 ether);
        tokenA.mint(trader, 1_000_000 ether);
        tokenB.mint(trader, 1_000_000 ether);

        factory = new PairFactory(address(this));
        router = new Router(address(factory));
        pair = Pair(factory.createPair(address(tokenA), address(tokenB)));
    }

    /// @dev Supplies balanced liquidity from the LP helper account.
    function _provideLiquidity(uint256 amountA, uint256 amountB) internal returns (uint256 shares) {
        vm.startPrank(lp);
        tokenA.approve(address(router), amountA);
        tokenB.approve(address(router), amountB);
        (shares,,) = router.addLiquidity(address(tokenA), address(tokenB), amountA, amountB, 0, 0, lp, DEADLINE);
        vm.stopPrank();
    }

    /// @notice Confirms addLiquidity forwards the caller balances and returns LP shares.
    function testAddLiquidityMintsSharesAndClearsDust() public {
        uint256 expectedShares = sqrt(LIQUIDITY_SEED * LIQUIDITY_SEED) - 1_000;

        uint256 shares = _provideLiquidity(LIQUIDITY_SEED, LIQUIDITY_SEED);
        assertEq(shares, expectedShares, "shares mismatch");
        assertEq(pair.balanceOf(lp), expectedShares, "LP share balance incorrect");

        // Router should not retain stray balances or lingering approvals.
        assertEq(tokenA.balanceOf(address(router)), 0, "router keeps tokenA");
        assertEq(tokenB.balanceOf(address(router)), 0, "router keeps tokenB");
        assertEq(tokenA.allowance(address(router), address(pair)), 0, "allowance A not cleared");
        assertEq(tokenB.allowance(address(router), address(pair)), 0, "allowance B not cleared");
    }

    /// @notice Verifies removeLiquidity redeems the expected underlying amounts.
    function testRemoveLiquidityReturnsUnderlyingTokens() public {
        uint256 shares = _provideLiquidity(LIQUIDITY_SEED, LIQUIDITY_SEED);

        vm.prank(lp);
        IERC20(address(pair)).approve(address(router), shares);

        vm.prank(lp);
        (uint256 amountA, uint256 amountB) =
            router.removeLiquidity(address(tokenA), address(tokenB), shares, lp, DEADLINE);

        assertEq(amountA, LIQUIDITY_SEED, "amountA mismatch");
        assertEq(amountB, LIQUIDITY_SEED, "amountB mismatch");
        assertEq(pair.balanceOf(lp), 0, "LP share balance not zeroed");
    }

    /// @notice Ensures single-hop swaps route through the pair and deliver the quoted output.
    function testSwapExactTokensForTokensSingleHop() public {
        _provideLiquidity(LIQUIDITY_SEED, LIQUIDITY_SEED);

        address[] memory path = new address[](2);
        path[0] = address(tokenA);
        path[1] = address(tokenB);

        uint256[] memory quoted = router.getAmountsOut(AMOUNT_IN, path);

        vm.startPrank(trader);
        tokenA.approve(address(router), AMOUNT_IN);
        uint256 balanceBefore = tokenB.balanceOf(trader);
        uint256[] memory amounts =
            router.swapExactTokensForTokens(AMOUNT_IN, quoted[quoted.length - 1], path, trader, DEADLINE);
        vm.stopPrank();

        assertEq(amounts[0], AMOUNT_IN, "input amount mismatch");
        assertEq(amounts[1], quoted[1], "quoted output mismatch");
        assertEq(tokenB.balanceOf(trader), balanceBefore + quoted[1], "trader output balance incorrect");
        assertEq(tokenA.allowance(address(router), address(pair)), 0, "router allowance not consumed");
        assertEq(tokenA.balanceOf(address(router)), 0, "router retains input");
        assertEq(tokenB.balanceOf(address(router)), 0, "router retains output");
    }

    /// @notice Checks that malformed swap paths are rejected.
    function testSwapExactTokensForTokensRevertsOnShortPath() public {
        _provideLiquidity(LIQUIDITY_SEED, LIQUIDITY_SEED);

        address[] memory path = new address[](1);
        path[0] = address(tokenA);

        vm.startPrank(trader);
        tokenA.approve(address(router), AMOUNT_IN);
        vm.expectRevert("PATH_LEN");
        router.swapExactTokensForTokens(AMOUNT_IN, 0, path, trader, DEADLINE);
        vm.stopPrank();
    }

    /// @notice Babylonian square root helper mirroring pair math for expected shares.
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
