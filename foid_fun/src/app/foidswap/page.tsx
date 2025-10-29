"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Address,
  formatUnits,
  isAddress,
  parseUnits,
  zeroAddress,
} from "viem";
import { useAccount, usePublicClient, useWalletClient } from "wagmi";
import toast from "react-hot-toast";
import { NetworkGate } from "@/components/NetworkGate";
import { BLOCK_EXPLORER_URL } from "@/lib/contracts";

// ------ Minimal ABIs ------
const erc20Abi = [
  {
    type: "function",
    name: "balanceOf",
    inputs: [{ name: "owner", type: "address" }],
    outputs: [{ type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "allowance",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "approve",
    inputs: [
      { name: "spender", type: "address" },
      { name: "value", type: "uint256" },
    ],
    outputs: [{ type: "bool" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "decimals",
    inputs: [],
    outputs: [{ type: "uint8" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "symbol",
    inputs: [],
    outputs: [{ type: "string" }],
    stateMutability: "view",
  },
] as const;

const routerAbi = [
  {
    type: "function",
    name: "getAmountsOut",
    inputs: [
      { name: "amountIn", type: "uint256" },
      { name: "path", type: "address[]" },
    ],
    outputs: [{ type: "uint256[]" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "swapExactTokensForTokens",
    inputs: [
      { name: "amountIn", type: "uint256" },
      { name: "amountOutMin", type: "uint256" },
      { name: "path", type: "address[]" },
      { name: "to", type: "address" },
      { name: "deadline", type: "uint256" },
    ],
    outputs: [{ type: "uint256[]" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "addLiquidity",
    inputs: [
      { name: "tokenA", type: "address" },
      { name: "tokenB", type: "address" },
      { name: "amountADesired", type: "uint256" },
      { name: "amountBDesired", type: "uint256" },
      { name: "amountAMin", type: "uint256" },
      { name: "amountBMin", type: "uint256" },
      { name: "to", type: "address" },
      { name: "deadline", type: "uint256" },
    ],
    outputs: [
      { name: "shares", type: "uint256" },
      { name: "amountA", type: "uint256" },
      { name: "amountB", type: "uint256" },
    ],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "removeLiquidity",
    inputs: [
      { name: "tokenA", type: "address" },
      { name: "tokenB", type: "address" },
      { name: "shares", type: "uint256" },
      { name: "to", type: "address" },
      { name: "deadline", type: "uint256" },
    ],
    outputs: [
      { name: "amountA", type: "uint256" },
      { name: "amountB", type: "uint256" },
    ],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "pairFor",
    inputs: [
      { name: "a", type: "address" },
      { name: "b", type: "address" },
    ],
    outputs: [{ type: "address" }],
    stateMutability: "view",
  },
] as const;

const factoryAbi = [
  {
    type: "function",
    name: "getPair",
    inputs: [{ type: "address" }, { type: "address" }],
    outputs: [{ type: "address" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "createPair",
    inputs: [{ type: "address" }, { type: "address" }],
    outputs: [{ type: "address" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "allPairsLength",
    inputs: [],
    outputs: [{ type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "allPairs",
    inputs: [{ type: "uint256" }],
    outputs: [{ type: "address" }],
    stateMutability: "view",
  },
] as const;

const pairAbi = [
  {
    type: "function",
    name: "getReserves",
    inputs: [],
    outputs: [
      { type: "uint112" },
      { type: "uint112" },
      { type: "uint32" },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "token0",
    inputs: [],
    outputs: [{ type: "address" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "token1",
    inputs: [],
    outputs: [{ type: "address" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "balanceOf",
    inputs: [{ type: "address" }],
    outputs: [{ type: "uint256" }],
    stateMutability: "view",
  },
] as const;

// ------ Helpers ------
const FALLBACK_CHAIN_ID = 20994;
const deadlineFromMinutes = (minutes: number) =>
  Math.floor(Date.now() / 1000) + Math.max(0, Math.round(minutes * 60));

const applySlippage = (amount: bigint, slippageBps: number) =>
  (amount * BigInt(10_000 - slippageBps)) / 10_000n;

const formatBigNumber = (value: bigint | undefined, decimals: number, precision = 6) => {
  if (value === undefined) return "0";
  const formatted = Number(formatUnits(value, decimals));
  if (!Number.isFinite(formatted)) return "0";
  return formatted.toLocaleString(undefined, {
    maximumFractionDigits: precision,
    minimumFractionDigits: Math.min(2, precision),
  });
};

const explorerBase = BLOCK_EXPLORER_URL.replace(/\/+$/, "");
const configuredChainId = Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? FALLBACK_CHAIN_ID);

const DEFAULT_FACTORY = "0xe97639fd6Ff7231ed270Ea16BD9Ba2c79f4cD2cc" as const;
const DEFAULT_ROUTER = "0xd71330e54eAA2e4248E75067F8f23bB2a6568613" as const;
const DEFAULT_TOKEN_A = "0x403ECF8ba28E58CE4d1847C1C95ac54651fAB151" as const;
const DEFAULT_TOKEN_B = "0xC08c0a41725F2329A9a315C643FE9b1a012D6213" as const;

const resolveAddress = (...candidates: (string | undefined)[]): Address | undefined => {
  for (const candidate of candidates) {
    const trimmed = candidate?.trim();
    if (trimmed && isAddress(trimmed)) {
      return trimmed as Address;
    }
  }
  return undefined;
};

type ViewKey = "swap" | "pairs" | "liquidity";
type LiquidityMode = "add" | "remove";

interface TokenState {
  address?: Address;
  symbol?: string;
  decimals?: number;
  balance?: bigint;
  allowance?: bigint;
}

export default function FoidSwapPage() {
  const chainId = Number.isFinite(configuredChainId)
    ? configuredChainId
    : FALLBACK_CHAIN_ID;
  const factoryAddress = resolveAddress(
    process.env.NEXT_PUBLIC_FACTORY as string | undefined,
    process.env.NEXT_PUBLIC_PAIR_FACTORY as string | undefined,
    DEFAULT_FACTORY,
  );
  const routerAddress = resolveAddress(
    process.env.NEXT_PUBLIC_ROUTER as string | undefined,
    process.env.NEXT_PUBLIC_BRIDGE as string | undefined,
    DEFAULT_ROUTER,
  );
  const tokenAAddress = resolveAddress(
    process.env.NEXT_PUBLIC_TOKEN_A as string | undefined,
    process.env.NEXT_PUBLIC_TOKEN0 as string | undefined,
    process.env.NEXT_PUBLIC_WFOID as string | undefined,
    DEFAULT_TOKEN_A,
  );
  const tokenBAddress = resolveAddress(
    process.env.NEXT_PUBLIC_TOKEN_B as string | undefined,
    process.env.NEXT_PUBLIC_TOKEN1 as string | undefined,
    DEFAULT_TOKEN_B,
  );

  const [activeView, setActiveView] = useState<ViewKey>("swap");
  const [liquidityMode, setLiquidityMode] = useState<LiquidityMode>("add");
  const [tokenIn, setTokenIn] = useState<Address | undefined>(tokenAAddress);
  const [tokenOut, setTokenOut] = useState<Address | undefined>(tokenBAddress);
  const [amountIn, setAmountIn] = useState("");
  const [swapSlippage, setSwapSlippage] = useState("0.5");
  const [swapDeadline, setSwapDeadline] = useState("10");

  const [liqAmountA, setLiqAmountA] = useState("");
  const [liqAmountB, setLiqAmountB] = useState("");
  const [liqSlippage, setLiqSlippage] = useState("1");
  const [liqDeadline, setLiqDeadline] = useState("15");

  const [removeShares, setRemoveShares] = useState("");
  const [removeSlippage, setRemoveSlippage] = useState("1");
  const [removeDeadline, setRemoveDeadline] = useState("15");

  const [quoteOut, setQuoteOut] = useState<bigint | undefined>();
  const [quoteImpact, setQuoteImpact] = useState<number | undefined>();

  const [expectedAddResult, setExpectedAddResult] = useState<
    { shares: bigint; amountA: bigint; amountB: bigint } | undefined
  >(undefined);
  const [expectedRemoveResult, setExpectedRemoveResult] = useState<
    { amountA: bigint; amountB: bigint; minA: bigint; minB: bigint } | undefined
  >(undefined);

  const { address: account, isConnected } = useAccount();
  const publicClient = usePublicClient({ chainId });
  const { data: walletClient } = useWalletClient();

  const [tokenInState, setTokenInState] = useState<TokenState>({});
  const [tokenOutState, setTokenOutState] = useState<TokenState>({});
  const [tokenAState, setTokenAState] = useState<TokenState>({});
  const [tokenBState, setTokenBState] = useState<TokenState>({});

  const [pairAddress, setPairAddress] = useState<Address | undefined>();
  const [pairToken0, setPairToken0] = useState<Address | undefined>();
  const [pairReserves, setPairReserves] = useState<[bigint, bigint, number] | undefined>();
  const [pairAllowance, setPairAllowance] = useState<bigint | undefined>();
  const [pairBalance, setPairBalance] = useState<bigint | undefined>();
  const [creatingPair, setCreatingPair] = useState(false);
  const [manualToken0, setManualToken0] = useState("");
  const [manualToken1, setManualToken1] = useState("");
  const [factoryPairs, setFactoryPairs] = useState<Address[]>([]);
  const [factoryPairsLoading, setFactoryPairsLoading] = useState(false);
  const [factoryPairsError, setFactoryPairsError] = useState<string | null>(null);
  const [pairRefreshNonce, setPairRefreshNonce] = useState(0);

  const tokenOptions = [
    {
      address: tokenAAddress,
      label: `${tokenAState.symbol ?? "Token A"} (${tokenAAddress?.slice(0, 6)}…${tokenAAddress?.slice(-4)})`,
    },
    {
      address: tokenBAddress,
      label: `${tokenBState.symbol ?? "Token B"} (${tokenBAddress?.slice(0, 6)}…${tokenBAddress?.slice(-4)})`,
    },
  ].filter((opt): opt is { address: Address; label: string } => Boolean(opt.address));
  const manualToken0IsValid = manualToken0 ? isAddress(manualToken0) : false;
  const manualToken1IsValid = manualToken1 ? isAddress(manualToken1) : false;

  const tokenAddresses = useMemo(
    () =>
      [tokenAAddress, tokenBAddress].filter(
        (addr): addr is Address => Boolean(addr) && addr !== zeroAddress,
      ),
    [tokenAAddress, tokenBAddress],
  );

  const envOk =
    routerAddress && factoryAddress && tokenAddresses.length === 2;

  const handleCreatePair = useCallback(
    async (
      token0Override?: Address,
      token1Override?: Address,
      options?: { silent?: boolean },
    ): Promise<Address | undefined> => {
      if (!publicClient || !factoryAddress) {
        toast.error("Factory configuration missing");
        return undefined;
      }

      const targetToken0 = token0Override ?? tokenAAddress;
      const targetToken1 = token1Override ?? tokenBAddress;
      if (!targetToken0 || !targetToken1) {
        toast.error("Specify both token addresses");
        return undefined;
      }
      if (targetToken0.toLowerCase() === targetToken1.toLowerCase()) {
        toast.error("Token addresses must differ");
        return undefined;
      }

      const normalizePair = (a: Address, b: Address) => {
        const [x, y] = [a.toLowerCase(), b.toLowerCase()].sort();
        return `${x}:${y}`;
      };
      const selectedKey =
        tokenAAddress && tokenBAddress ? normalizePair(tokenAAddress, tokenBAddress) : undefined;
      const targetKey = normalizePair(targetToken0, targetToken1);

      try {
        const existingPair = (await publicClient.readContract({
          address: factoryAddress,
          abi: factoryAbi,
          functionName: "getPair",
          args: [targetToken0, targetToken1],
        })) as Address;
        if (existingPair && existingPair !== zeroAddress) {
          if (!options?.silent) {
            toast.success("Pair already exists");
          }
          setPairRefreshNonce((n) => n + 1);
          if (selectedKey && selectedKey === targetKey) {
            setPairToken0(undefined);
            setPairReserves(undefined);
            setPairAllowance(undefined);
            setPairBalance(undefined);
            setPairAddress(existingPair);
          }
          return existingPair;
        }
      } catch (err) {
        console.error("getPair lookup failed", err);
        if (!walletClient) {
          toast.error("Unable to lookup pair without wallet connection");
          return undefined;
        }
      }

      if (!walletClient) {
        toast.error("Connect a wallet to deploy the pair");
        return undefined;
      }

      const toastId = options?.silent ? null : toast.loading("Creating pair…");
      setCreatingPair(true);
      try {
        const simulation = await publicClient.simulateContract({
          account: walletClient.account,
          address: factoryAddress,
          abi: factoryAbi,
          functionName: "createPair",
          args: [targetToken0, targetToken1],
        });
        const hash = await walletClient.writeContract(simulation.request);
        if (toastId) toast.dismiss(toastId);
        if (!options?.silent) {
          toast.success(
            () => (
              <span>
                Pair deployment submitted.{" "}
                <a
                  href={`${explorerBase}/tx/${hash}`}
                  className="underline text-fluent-blue"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  View tx ↗
                </a>
              </span>
            ),
          );
        }
        await publicClient.waitForTransactionReceipt({ hash });

        let createdPair = simulation.result as Address | undefined;
        if (!createdPair || createdPair === zeroAddress) {
          createdPair = (await publicClient.readContract({
            address: factoryAddress,
            abi: factoryAbi,
            functionName: "getPair",
            args: [targetToken0, targetToken1],
          })) as Address;
        }
        if (createdPair && createdPair !== zeroAddress) {
          if (selectedKey && selectedKey === targetKey) {
            setPairToken0(undefined);
            setPairReserves(undefined);
            setPairAllowance(undefined);
            setPairBalance(undefined);
            setPairAddress(createdPair);
          }
          setPairRefreshNonce((n) => n + 1);
          return createdPair;
        }
        toast.error("Pair creation succeeded but address unreadable");
        return undefined;
      } catch (err: any) {
        console.error(err);
        if (toastId) toast.dismiss(toastId);
        toast.error(err?.shortMessage || err?.message || "Pair creation failed");
        return undefined;
      } finally {
        setCreatingPair(false);
      }
    },
    [explorerBase, factoryAddress, publicClient, tokenAAddress, tokenBAddress, walletClient],
  );

  const fetchTokenData = useCallback(
    async (tokenAddress: Address | undefined, assign: (state: TokenState) => void) => {
      if (!publicClient || !tokenAddress) {
        assign({});
        return;
      }
      try {
        const [symbol, decimals] = await Promise.all([
          publicClient.readContract({
            address: tokenAddress,
            abi: erc20Abi,
            functionName: "symbol",
          }),
          publicClient.readContract({
            address: tokenAddress,
            abi: erc20Abi,
            functionName: "decimals",
          }),
        ]);

        const balancePromise =
          account && account !== zeroAddress
            ? publicClient.readContract({
                address: tokenAddress,
                abi: erc20Abi,
                functionName: "balanceOf",
                args: [account],
              })
            : Promise.resolve(undefined);

        const allowancePromise =
          account && routerAddress
            ? publicClient.readContract({
                address: tokenAddress,
                abi: erc20Abi,
                functionName: "allowance",
                args: [account, routerAddress],
              })
            : Promise.resolve(undefined);

        const [balance, allowance] = await Promise.all([balancePromise, allowancePromise]);
        assign({
          address: tokenAddress,
          symbol: typeof symbol === "string" ? symbol : undefined,
          decimals: Number(decimals ?? 18),
          balance: balance as bigint | undefined,
          allowance: allowance as bigint | undefined,
        });
      } catch (err) {
        console.error("token metadata fetch failed", err);
        assign({});
      }
    },
    [account, publicClient, routerAddress],
  );

  // prime token states when inputs change
  useEffect(() => {
    if (!envOk) return;
    void fetchTokenData(tokenIn, setTokenInState);
  }, [fetchTokenData, tokenIn, envOk]);

  useEffect(() => {
    if (!envOk) return;
    void fetchTokenData(tokenOut, setTokenOutState);
  }, [fetchTokenData, tokenOut, envOk]);

  useEffect(() => {
    if (!envOk) return;
    void fetchTokenData(tokenAAddress, setTokenAState);
    void fetchTokenData(tokenBAddress, setTokenBState);
  }, [envOk, fetchTokenData, tokenAAddress, tokenBAddress]);

  // fetch pair address when tokens ready
  useEffect(() => {
    if (!publicClient || !factoryAddress || tokenAddresses.length !== 2) {
      setPairAddress(undefined);
      return;
    }
    const [token0, token1] = tokenAddresses;
    let cancelled = false;
    const loadPair = async () => {
      try {
        const addr = (await publicClient.readContract({
          address: factoryAddress,
          abi: factoryAbi,
          functionName: "getPair",
          args: [token0, token1],
        })) as Address;
        if (!cancelled && addr && addr !== zeroAddress) {
          setPairAddress(addr);
        } else if (!cancelled) {
          setPairAddress(undefined);
        }
      } catch (err) {
        console.error("getPair failed", err);
        if (!cancelled) setPairAddress(undefined);
      }
    };
    void loadPair();
    return () => {
      cancelled = true;
    };
  }, [factoryAddress, publicClient, tokenAddresses]);

  // pair metadata
  useEffect(() => {
    if (!publicClient || !pairAddress || pairAddress === zeroAddress) {
      setPairToken0(undefined);
      setPairReserves(undefined);
      return;
    }
    let cancelled = false;
    const loadPairMeta = async () => {
      try {
        const [token0, reserves] = await Promise.all([
          publicClient.readContract({
            address: pairAddress,
            abi: pairAbi,
            functionName: "token0",
          }),
          publicClient.readContract({
            address: pairAddress,
            abi: pairAbi,
            functionName: "getReserves",
          }),
        ]);
        if (!cancelled) {
          setPairToken0(token0 as Address);
          setPairReserves(reserves as [bigint, bigint, number]);
        }
      } catch (err) {
        console.error("pair metadata fetch failed", err);
        if (!cancelled) {
          setPairToken0(undefined);
          setPairReserves(undefined);
        }
      }
    };
    void loadPairMeta();
    return () => {
      cancelled = true;
    };
  }, [pairAddress, publicClient]);

  // pair allowance/balance
  useEffect(() => {
    if (!publicClient || !pairAddress || !account || !routerAddress) {
      setPairAllowance(undefined);
      setPairBalance(undefined);
      return;
    }
    let cancelled = false;
    const load = async () => {
      try {
        const [allowance, balance] = await Promise.all([
          publicClient.readContract({
            address: pairAddress,
            abi: erc20Abi,
            functionName: "allowance",
            args: [account, routerAddress],
          }),
          publicClient.readContract({
            address: pairAddress,
            abi: pairAbi,
            functionName: "balanceOf",
            args: [account],
          }),
        ]);
        if (!cancelled) {
          setPairAllowance(allowance as bigint);
          setPairBalance(balance as bigint);
        }
      } catch (err) {
        console.error("pair allowance fetch failed", err);
        if (!cancelled) {
          setPairAllowance(undefined);
          setPairBalance(undefined);
        }
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [account, pairAddress, publicClient, routerAddress]);

  // fetch factory pairs list for pairs view
  useEffect(() => {
    if (!publicClient || !factoryAddress) {
      setFactoryPairs([]);
      return;
    }
    let cancelled = false;
    const fetchPairs = async () => {
      try {
        setFactoryPairsLoading(true);
        setFactoryPairsError(null);
        const length = (await publicClient.readContract({
          address: factoryAddress,
          abi: factoryAbi,
          functionName: "allPairsLength",
        })) as bigint;
        const total = Number(length);
        if (total === 0) {
          if (!cancelled) setFactoryPairs([]);
          return;
        }
        const maxFetch = Math.min(total, 25);
        const indices = Array.from({ length: maxFetch }, (_, i) => BigInt(i));
        const addresses = (await Promise.all(
          indices.map((idx) =>
            publicClient.readContract({
              address: factoryAddress,
              abi: factoryAbi,
              functionName: "allPairs",
              args: [idx],
            }),
          ),
        )) as string[];
        const filtered = addresses
          .map((addr) => addr as Address)
          .filter((addr) => addr !== zeroAddress);
        if (!cancelled) {
          setFactoryPairs(filtered);
        }
      } catch (err: any) {
        if (!cancelled) {
          setFactoryPairsError(err?.message || "Unable to load pairs");
        }
      } finally {
        if (!cancelled) setFactoryPairsLoading(false);
      }
    };
    void fetchPairs();
    return () => {
      cancelled = true;
    };
  }, [factoryAddress, pairRefreshNonce, publicClient]);

  // swap quote
  useEffect(() => {
    if (!publicClient || !routerAddress || !tokenIn || !tokenOut) {
      setQuoteOut(undefined);
      setQuoteImpact(undefined);
      return;
    }
    if (!tokenInState.decimals || !tokenOutState.decimals || !pairReserves || !pairToken0) {
      setQuoteOut(undefined);
      setQuoteImpact(undefined);
      return;
    }
    let cancelled = false;
    const run = async () => {
      try {
        if (!amountIn || Number(amountIn) <= 0) {
          setQuoteOut(undefined);
          setQuoteImpact(undefined);
          return;
        }
        const parsed = parseUnits(amountIn, tokenInState.decimals);
        if (parsed <= 0n) {
          setQuoteOut(undefined);
          setQuoteImpact(undefined);
          return;
        }

        const amounts = (await publicClient.readContract({
          address: routerAddress,
          abi: routerAbi,
          functionName: "getAmountsOut",
          args: [parsed, [tokenIn, tokenOut]],
        })) as bigint[];

        if (cancelled || !Array.isArray(amounts) || amounts.length < 2) return;

        const out = amounts[amounts.length - 1];
        const [reserve0, reserve1] = pairReserves;

        const reserveIn = tokenIn === pairToken0 ? reserve0 : reserve1;
        const reserveOut = tokenIn === pairToken0 ? reserve1 : reserve0;
        if (reserveIn === 0n || reserveOut === 0n) {
          setQuoteOut(out);
          setQuoteImpact(undefined);
          return;
        }

        const executionPrice =
          Number(formatUnits(out, tokenOutState.decimals)) /
          Number(formatUnits(parsed, tokenInState.decimals));
        const spotPrice =
          Number(formatUnits(reserveOut, tokenOutState.decimals)) /
          Number(formatUnits(reserveIn, tokenInState.decimals));

        const impact =
          executionPrice > 0 && spotPrice > 0
            ? ((spotPrice - executionPrice) / spotPrice) * 100
            : undefined;

        setQuoteOut(out);
        setQuoteImpact(impact);
      } catch (err) {
        console.error("getAmountsOut failed", err);
        if (!cancelled) {
          setQuoteOut(undefined);
          setQuoteImpact(undefined);
        }
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [amountIn, publicClient, routerAddress, tokenIn, tokenOut, tokenInState.decimals, tokenOutState.decimals, pairReserves, pairToken0]);

  const handleApprove = useCallback(
    async (tokenAddress: Address | undefined, amount: bigint, label: string) => {
      if (!walletClient || !publicClient || !routerAddress || !tokenAddress) {
        toast.error("Missing configuration to approve");
        return;
      }
      const toastId = toast.loading(`Approving ${label}…`);
      try {
        const { request } = await publicClient.simulateContract({
          account: walletClient.account,
          address: tokenAddress,
          abi: erc20Abi,
          functionName: "approve",
          args: [routerAddress, amount],
        });
        const hash = await walletClient.writeContract(request);
        await publicClient.waitForTransactionReceipt({ hash });
        toast.dismiss(toastId);
        toast.success(
          () => (
            <span>
              Approved {label}.{" "}
              <a
                href={`${explorerBase}/tx/${hash}`}
                className="underline text-fluent-blue"
                target="_blank"
                rel="noopener noreferrer"
              >
                View tx ↗
              </a>
            </span>
          ),
        );
        // refresh allowances
        void fetchTokenData(tokenAddress, (state) => {
          if (tokenAddress === tokenIn) setTokenInState(state);
          if (tokenAddress === tokenOut) setTokenOutState(state);
          if (tokenAddress === tokenAAddress) setTokenAState(state);
          if (tokenAddress === tokenBAddress) setTokenBState(state);
        });
        if (tokenAddress === pairAddress) {
          // refresh pair allowance
          const allowance = (await publicClient.readContract({
            address: pairAddress,
            abi: erc20Abi,
            functionName: "allowance",
            args: [walletClient.account.address, routerAddress],
          })) as bigint;
          setPairAllowance(allowance);
        }
      } catch (err: any) {
        console.error(err);
        toast.dismiss(toastId);
        toast.error(err?.shortMessage || err?.message || "Approve failed");
      }
    },
    [
      fetchTokenData,
      publicClient,
      routerAddress,
      walletClient,
      tokenIn,
      tokenOut,
      tokenAAddress,
      tokenBAddress,
      pairAddress,
    ],
  );

  const executeSwap = useCallback(async () => {
    if (!walletClient || !publicClient || !routerAddress || !tokenIn || !tokenOut) {
      toast.error("Swap not ready");
      return;
    }
    if (!tokenInState.decimals || !tokenOutState.decimals) {
      toast.error("Token metadata missing");
      return;
    }
    if (!amountIn || Number(amountIn) <= 0) {
      toast.error("Enter an amount");
      return;
    }
    try {
      const parsedAmountIn = parseUnits(amountIn, tokenInState.decimals);
      const amountOutExpected = quoteOut ?? 0n;
      const slippagePct = Number(swapSlippage || "0");
      const slippageBps = Math.max(0, Math.round(slippagePct * 100));
      const deadlineMinutes = Number(swapDeadline || "10");
      const deadline = deadlineFromMinutes(deadlineMinutes);
      const amountOutMin = applySlippage(amountOutExpected, slippageBps);

      const { request } = await publicClient.simulateContract({
        account: walletClient.account,
        address: routerAddress,
        abi: routerAbi,
        functionName: "swapExactTokensForTokens",
        args: [parsedAmountIn, amountOutMin, [tokenIn, tokenOut], walletClient.account.address, BigInt(deadline)],
      });
      const loadingId = toast.loading("Submitting swap…");
      const hash = await walletClient.writeContract(request);
      toast.dismiss(loadingId);
      toast.success(
        () => (
          <span>
            Swap submitted.{" "}
            <a
              href={`${explorerBase}/tx/${hash}`}
              className="underline text-fluent-blue"
              target="_blank"
              rel="noopener noreferrer"
            >
              View tx ↗
            </a>
          </span>
        ),
      );
      await publicClient.waitForTransactionReceipt({ hash });
      await Promise.all([
        fetchTokenData(tokenIn, setTokenInState),
        fetchTokenData(tokenOut, setTokenOutState),
      ]);
      setAmountIn("");
    } catch (err: any) {
      console.error(err);
      toast.dismiss();
      toast.error(err?.shortMessage || err?.message || "Swap failed");
    }
  }, [
    amountIn,
    fetchTokenData,
    publicClient,
    quoteOut,
    routerAddress,
    swapDeadline,
    swapSlippage,
    tokenIn,
    tokenInState.decimals,
    tokenOut,
    tokenOutState.decimals,
    walletClient,
  ]);

  const executeAddLiquidity = useCallback(async () => {
    if (!walletClient || !publicClient || !routerAddress || !tokenAAddress || !tokenBAddress) {
      toast.error("Liquidity add not ready");
      return;
    }
    if (!tokenAState.decimals || !tokenBState.decimals) {
      toast.error("Token metadata missing");
      return;
    }
    if (!liqAmountA || !liqAmountB) {
      toast.error("Enter both token amounts");
      return;
    }
    try {
      const ensuredPair = await handleCreatePair(undefined, undefined, { silent: true });
      if (!ensuredPair || ensuredPair === zeroAddress) {
        toast.error("Pair is not deployed");
        return;
      }

      const amountAParsed = parseUnits(liqAmountA, tokenAState.decimals);
      const amountBParsed = parseUnits(liqAmountB, tokenBState.decimals);
      const slippagePct = Number(liqSlippage || "0");
      const slippageBps = Math.max(0, Math.round(slippagePct * 100));
      const deadline = deadlineFromMinutes(Number(liqDeadline || "15"));

      const baseSimulation = await publicClient.simulateContract({
        account: walletClient.account,
        address: routerAddress,
        abi: routerAbi,
        functionName: "addLiquidity",
        args: [
          tokenAAddress,
          tokenBAddress,
          amountAParsed,
          amountBParsed,
          0n,
          0n,
          walletClient.account.address,
          BigInt(deadline),
        ],
      });

      const consumedA = baseSimulation.result[1] as bigint;
      const consumedB = baseSimulation.result[2] as bigint;

      const minA = applySlippage(consumedA, slippageBps);
      const minB = applySlippage(consumedB, slippageBps);

      const finalSimulation = await publicClient.simulateContract({
        account: walletClient.account,
        address: routerAddress,
        abi: routerAbi,
        functionName: "addLiquidity",
        args: [
          tokenAAddress,
          tokenBAddress,
          amountAParsed,
          amountBParsed,
          minA,
          minB,
          walletClient.account.address,
          BigInt(deadline),
        ],
      });
      setExpectedAddResult({
        shares: finalSimulation.result[0] as bigint,
        amountA: finalSimulation.result[1] as bigint,
        amountB: finalSimulation.result[2] as bigint,
      });

      const loadingId = toast.loading("Adding liquidity…");
      const hash = await walletClient.writeContract(finalSimulation.request);
      toast.dismiss(loadingId);
      toast.success(
        () => (
          <span>
            Liquidity submitted.{" "}
            <a
              href={`${explorerBase}/tx/${hash}`}
              className="underline text-fluent-blue"
              target="_blank"
              rel="noopener noreferrer"
            >
              View tx ↗
            </a>
          </span>
        ),
      );
      await publicClient.waitForTransactionReceipt({ hash });
      await Promise.all([
        fetchTokenData(tokenAAddress, setTokenAState),
        fetchTokenData(tokenBAddress, setTokenBState),
      ]);
      setLiqAmountA("");
      setLiqAmountB("");
    } catch (err: any) {
      console.error(err);
      toast.dismiss();
      toast.error(err?.shortMessage || err?.message || "Add liquidity failed");
    }
  }, [
    fetchTokenData,
    handleCreatePair,
    liqAmountA,
    liqAmountB,
    liqDeadline,
    liqSlippage,
    publicClient,
    routerAddress,
    tokenAAddress,
    tokenAState.decimals,
    tokenBAddress,
    tokenBState.decimals,
    walletClient,
  ]);

  const executeRemoveLiquidity = useCallback(async () => {
    if (!walletClient || !publicClient || !routerAddress || !tokenAAddress || !tokenBAddress) {
      toast.error("Remove not ready");
      return;
    }
    if (!pairAddress) {
      toast.error("Pair not found");
      return;
    }
    if (!removeShares || Number(removeShares) <= 0) {
      toast.error("Enter share amount");
      return;
    }
    try {
      const decimals = 18; // LP tokens typically 18 decimals
      const sharesParsed = parseUnits(removeShares, decimals);
      if (pairBalance !== undefined && sharesParsed > pairBalance) {
        toast.error("Insufficient LP balance");
        return;
      }
      const slippageBps = Math.max(0, Math.round(Number(removeSlippage || "0") * 100));
      const deadline = deadlineFromMinutes(Number(removeDeadline || "15"));

      const simulation = await publicClient.simulateContract({
        account: walletClient.account,
        address: routerAddress,
        abi: routerAbi,
        functionName: "removeLiquidity",
        args: [
          tokenAAddress,
          tokenBAddress,
          sharesParsed,
          walletClient.account.address,
          BigInt(deadline),
        ],
      });
      const amountAOut = simulation.result[0] as bigint;
      const amountBOut = simulation.result[1] as bigint;
      const minA = applySlippage(amountAOut, slippageBps);
      const minB = applySlippage(amountBOut, slippageBps);

      setExpectedRemoveResult({ amountA: amountAOut, amountB: amountBOut, minA, minB });

      const loadingId = toast.loading("Removing liquidity…");
      const hash = await walletClient.writeContract(simulation.request);
      toast.dismiss(loadingId);
      toast.success(
        () => (
          <span>
            Remove submitted.{" "}
            <a
              href={`${explorerBase}/tx/${hash}`}
              className="underline text-fluent-blue"
              target="_blank"
              rel="noopener noreferrer"
            >
              View tx ↗
            </a>
          </span>
        ),
      );
      await publicClient.waitForTransactionReceipt({ hash });
      await Promise.all([
        fetchTokenData(tokenAAddress, setTokenAState),
        fetchTokenData(tokenBAddress, setTokenBState),
      ]);
      const allowance = (await publicClient.readContract({
        address: pairAddress,
        abi: erc20Abi,
        functionName: "allowance",
        args: [walletClient.account.address, routerAddress],
      })) as bigint;
      const balance = (await publicClient.readContract({
        address: pairAddress,
        abi: pairAbi,
        functionName: "balanceOf",
        args: [walletClient.account.address],
      })) as bigint;
      setPairAllowance(allowance);
      setPairBalance(balance);
      setRemoveShares("");
    } catch (err: any) {
      console.error(err);
      toast.dismiss();
      toast.error(err?.shortMessage || err?.message || "Remove liquidity failed");
    }
  }, [
    fetchTokenData,
    pairAddress,
    pairBalance,
    publicClient,
    removeDeadline,
    removeShares,
    removeSlippage,
    routerAddress,
    tokenAAddress,
    tokenBAddress,
    walletClient,
  ]);

  const swapNeedsApproval = useMemo(() => {
    if (!tokenInState.allowance || !tokenInState.decimals) return true;
    if (!amountIn || Number(amountIn) <= 0) return false;
    try {
      const parsed = parseUnits(amountIn, tokenInState.decimals);
      return tokenInState.allowance < parsed;
    } catch {
      return true;
    }
  }, [amountIn, tokenInState.allowance, tokenInState.decimals]);

  const addNeedsApprovalA = useMemo(() => {
    if (!tokenAState.allowance || !tokenAState.decimals) return true;
    if (!liqAmountA || Number(liqAmountA) <= 0) return false;
    try {
      const parsed = parseUnits(liqAmountA, tokenAState.decimals);
      return tokenAState.allowance < parsed;
    } catch {
      return true;
    }
  }, [liqAmountA, tokenAState.allowance, tokenAState.decimals]);

  const addNeedsApprovalB = useMemo(() => {
    if (!tokenBState.allowance || !tokenBState.decimals) return true;
    if (!liqAmountB || Number(liqAmountB) <= 0) return false;
    try {
      const parsed = parseUnits(liqAmountB, tokenBState.decimals);
      return tokenBState.allowance < parsed;
    } catch {
      return true;
    }
  }, [liqAmountB, tokenBState.allowance, tokenBState.decimals]);

  const removeNeedsApproval = useMemo(() => {
    if (!pairAllowance) return true;
    if (!removeShares || Number(removeShares) <= 0) return false;
    try {
      const parsed = parseUnits(removeShares, 18);
      return pairAllowance < parsed;
    } catch {
      return true;
    }
  }, [pairAllowance, removeShares]);

  const poolPrice = useMemo(() => {
    if (!pairReserves || !pairToken0 || !tokenAState.decimals || !tokenBState.decimals) {
      return undefined;
    }
    const [reserve0, reserve1] = pairReserves;
    const reserveA = tokenAAddress === pairToken0 ? reserve0 : reserve1;
    const reserveB = tokenAAddress === pairToken0 ? reserve1 : reserve0;
    if (reserveA === 0n || reserveB === 0n) return undefined;
    const priceAB =
      Number(formatUnits(reserveB, tokenBState.decimals)) /
      Number(formatUnits(reserveA, tokenAState.decimals));
    const priceBA =
      Number(formatUnits(reserveA, tokenAState.decimals)) /
      Number(formatUnits(reserveB, tokenBState.decimals));
    return {
      priceAB,
      priceBA,
    };
  }, [pairReserves, pairToken0, tokenAAddress, tokenAState.decimals, tokenBState.decimals]);

  const dailyEstimate = useMemo(() => {
    if (!poolPrice) return undefined;
    return {
      priceAB: poolPrice.priceAB,
      priceBA: poolPrice.priceBA,
    };
  }, [poolPrice]);

  const switchTokens = () => {
    setTokenIn(tokenOut);
    setTokenOut(tokenIn);
    setAmountIn("");
    setQuoteOut(undefined);
    setQuoteImpact(undefined);
  };

  const renderTokenOverview = () => (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-4">
      <h2 className="text-sm font-semibold text-neutral-200 mb-2">Token overview</h2>
      <div className="space-y-3 text-sm text-neutral-300">
        <div className="flex justify-between">
          <span>{tokenAState.symbol ?? "Token A"} balance</span>
          <span>{formatBigNumber(tokenAState.balance, tokenAState.decimals ?? 18)}</span>
        </div>
        <div className="flex justify-between">
          <span>{tokenBState.symbol ?? "Token B"} balance</span>
          <span>{formatBigNumber(tokenBState.balance, tokenBState.decimals ?? 18)}</span>
        </div>
        <div className="flex justify-between">
          <span>LP balance</span>
          <span>{formatBigNumber(pairBalance, 18)}</span>
        </div>
        <div className="flex justify-between text-xs text-neutral-500">
          <span>Router</span>
          <a
            className="text-fluent-blue underline"
            href={`${explorerBase}/address/${routerAddress}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            {routerAddress?.slice(0, 10)}… ↗
          </a>
        </div>
      </div>
    </div>
  );

  const renderPoolStats = (showCreate: boolean) => (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-4">
      <h2 className="text-sm font-semibold text-neutral-200 mb-2">Pool stats</h2>
      {pairAddress ? (
        <div className="space-y-3 text-sm text-neutral-300">
          <div className="flex justify-between">
            <span>Pair</span>
            <a
              className="text-fluent-blue underline"
              href={`${explorerBase}/address/${pairAddress}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              {pairAddress.slice(0, 10)}… ↗
            </a>
          </div>
          <div className="flex justify-between">
            <span>Reserves</span>
            <span>
              {formatBigNumber(pairReserves?.[0], tokenAState.decimals ?? 18)} /{" "}
              {formatBigNumber(pairReserves?.[1], tokenBState.decimals ?? 18)}
            </span>
          </div>
          <div className="flex justify-between">
            <span>
              Price ({tokenAState.symbol ?? "Token A"} → {tokenBState.symbol ?? "Token B"})
            </span>
            <span>
              {poolPrice
                ? poolPrice.priceAB.toLocaleString(undefined, { maximumFractionDigits: 6 })
                : "—"}
            </span>
          </div>
          <div className="flex justify-between text-xs text-neutral-500">
            <span>24h est.</span>
            <span>
              {dailyEstimate
                ? dailyEstimate.priceAB.toLocaleString(undefined, { maximumFractionDigits: 6 })
                : "—"}{" "}
              (assuming static reserves)
            </span>
          </div>
        </div>
      ) : (
        <div className="space-y-3 text-sm text-neutral-300">
          <p>Pair not deployed yet for the selected tokens.</p>
          {showCreate && (
            <button
              className="w-full rounded-full bg-fluent-purple px-4 py-2 text-sm text-white hover:bg-fluent-pink disabled:opacity-40"
              disabled={!isConnected || creatingPair || !tokenAAddress || !tokenBAddress}
              onClick={() => void handleCreatePair(tokenAAddress, tokenBAddress)}
            >
              {creatingPair ? "Creating pair…" : "Create Pair"}
            </button>
          )}
          <p className="text-xs text-neutral-500">
            Factory:{" "}
            <a
              className="text-fluent-blue underline"
              href={`${explorerBase}/address/${factoryAddress}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              {factoryAddress?.slice(0, 10)}… ↗
            </a>
          </p>
        </div>
      )}
    </div>
  );

  const renderPairsManager = () => (
    <div className="space-y-6">
      <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-4">
        <h2 className="text-sm font-semibold text-neutral-200 mb-3">Factory pairs</h2>
        {factoryPairsLoading ? (
          <p className="text-neutral-400 text-sm">Loading pairs…</p>
        ) : factoryPairsError ? (
          <p className="text-sm text-red-400">{factoryPairsError}</p>
        ) : factoryPairs.length === 0 ? (
          <p className="text-sm text-neutral-400">No pairs deployed yet.</p>
        ) : (
          <ul className="space-y-2 text-sm text-neutral-300">
            {factoryPairs.map((address) => {
              const isSelected = pairAddress && address.toLowerCase() === pairAddress.toLowerCase();
              return (
                <li
                  key={address}
                  className={`flex items-center justify-between rounded-lg border px-3 py-2 ${
                    isSelected
                      ? "border-fluent-purple/80 bg-fluent-purple/10"
                      : "border-neutral-800 bg-neutral-950/60"
                  }`}
                >
                  <div className="flex flex-col">
                    <a
                      className="text-fluent-blue underline"
                      href={`${explorerBase}/address/${address}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {address.slice(0, 10)}…{address.slice(-4)}
                    </a>
                    {isSelected && (
                      <span className="text-xs text-fluent-purple/80">Selected pair</span>
                    )}
                  </div>
                  <button
                    type="button"
                    className="text-xs text-neutral-400 hover:text-white"
                    onClick={() => {
                      setPairAddress(address);
                      setPairToken0(undefined);
                      setPairReserves(undefined);
                      setPairAllowance(undefined);
                      setPairBalance(undefined);
                    }}
                  >
                    Inspect
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-4 space-y-3">
        <h2 className="text-sm font-semibold text-neutral-200">Manual pair creation</h2>
        <label className="text-xs uppercase tracking-wide text-neutral-400">
          Token 0 address
          <input
            type="text"
            value={manualToken0}
            onChange={(event) => setManualToken0(event.target.value.trim())}
            placeholder="0x..."
            className={`mt-1 w-full rounded-lg border px-3 py-2 text-white outline-none bg-neutral-950 ${
              manualToken0.length > 0 && !manualToken0IsValid
                ? "border-red-500 focus:border-red-500"
                : "border-neutral-700 focus:border-fluent-purple"
            }`}
          />
          {manualToken0.length > 0 && !manualToken0IsValid && (
            <span className="mt-1 block text-xs text-red-400">Enter a valid address.</span>
          )}
        </label>
        <label className="text-xs uppercase tracking-wide text-neutral-400">
          Token 1 address
          <input
            type="text"
            value={manualToken1}
            onChange={(event) => setManualToken1(event.target.value.trim())}
            placeholder="0x..."
            className={`mt-1 w-full rounded-lg border px-3 py-2 text-white outline-none bg-neutral-950 ${
              manualToken1.length > 0 && !manualToken1IsValid
                ? "border-red-500 focus:border-red-500"
                : "border-neutral-700 focus:border-fluent-purple"
            }`}
          />
          {manualToken1.length > 0 && !manualToken1IsValid && (
            <span className="mt-1 block text-xs text-red-400">Enter a valid address.</span>
          )}
        </label>
        <button
          className="w-full rounded-full bg-fluent-blue px-4 py-2 text-sm text-white hover:bg-fluent-purple disabled:opacity-40"
          disabled={
            !isConnected ||
            creatingPair ||
            !manualToken0IsValid ||
            !manualToken1IsValid ||
            manualToken0.toLowerCase() === manualToken1.toLowerCase()
          }
          onClick={() => {
            if (!manualToken0IsValid || !manualToken1IsValid) {
              toast.error("Enter valid token addresses");
              return;
            }
            if (manualToken0.toLowerCase() === manualToken1.toLowerCase()) {
              toast.error("Token addresses must differ");
              return;
            }
            void (async () => {
              const pair = await handleCreatePair(
                manualToken0 as Address,
                manualToken1 as Address,
                { silent: true },
              );
              if (pair && pair !== zeroAddress) {
                const manualKey = [manualToken0, manualToken1]
                  .map((addr) => addr.toLowerCase())
                  .sort()
                  .join(":");
                const defaultKey =
                  tokenAAddress && tokenBAddress
                    ? [tokenAAddress, tokenBAddress]
                        .map((addr) => addr.toLowerCase())
                        .sort()
                        .join(":")
                    : undefined;
                if (defaultKey && manualKey === defaultKey) {
                  setTokenIn(manualToken0 as Address);
                  setTokenOut(manualToken1 as Address);
                }
                toast.success(
                  () => (
                    <span>
                      Pair ready at{" "}
                      <a
                        className="underline text-fluent-blue"
                        href={`${explorerBase}/address/${pair}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {pair.slice(0, 10)}… ↗
                      </a>
                    </span>
                  ),
                );
              }
            })();
          }}
        >
          {creatingPair ? "Creating pair…" : "Create Pair"}
        </button>
      </div>
    </div>
  );

  const renderSwapForm = () => (
    <div className="space-y-4">
      <label className="text-sm text-neutral-300">
        Amount in
        <input
          type="text"
          value={amountIn}
          onChange={(event) => setAmountIn(event.target.value)}
          placeholder="0.0"
          className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-white outline-none focus:border-fluent-purple"
        />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="text-sm text-neutral-300">
          Slippage (%)
          <input
            type="number"
            min="0"
            step="0.1"
            value={swapSlippage}
            onChange={(event) => setSwapSlippage(event.target.value)}
            className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-white outline-none focus:border-fluent-purple"
          />
        </label>
        <label className="text-sm text-neutral-300">
          Deadline (min)
          <input
            type="number"
            min="1"
            step="1"
            value={swapDeadline}
            onChange={(event) => setSwapDeadline(event.target.value)}
            className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-white outline-none focus:border-fluent-purple"
          />
        </label>
      </div>
      <div className="rounded-lg border border-neutral-800 bg-neutral-950/70 p-3 text-sm text-neutral-200">
        <div className="flex justify-between">
          <span>Estimated out</span>
          <span>
            {quoteOut && tokenOutState.decimals
              ? formatUnits(quoteOut, tokenOutState.decimals)
              : "—"}
          </span>
        </div>
        <div className="flex justify-between text-xs text-neutral-500 mt-1">
          <span>Price impact</span>
          <span>{quoteImpact !== undefined ? `${quoteImpact.toFixed(2)}%` : "n/a"}</span>
        </div>
      </div>
      <div className="flex flex-col gap-3">
        {swapNeedsApproval && (
          <button
            className="w-full rounded-full bg-fluent-purple px-4 py-2 text-sm text-white hover:bg-fluent-pink disabled:opacity-40"
            disabled={!isConnected || !tokenInState.decimals || !amountIn}
            onClick={() => {
              if (!tokenInState.decimals || !amountIn) return;
              try {
                const value = parseUnits(amountIn || "0", tokenInState.decimals);
                void handleApprove(tokenIn, value, tokenInState.symbol ?? "token");
              } catch {
                toast.error("invalid amount");
              }
            }}
          >
            Approve {tokenInState.symbol ?? "Token"}
          </button>
        )}
        <button
          className="w-full rounded-full bg-fluent-blue px-4 py-2 text-sm text-white hover:bg-fluent-purple disabled:opacity-40"
          disabled={!isConnected || swapNeedsApproval}
          onClick={() => void executeSwap()}
        >
          Swap
        </button>
      </div>
      <p className="text-xs text-neutral-500">
        Tip: if you see a SLIPPAGE error, match your deposit to the current pool ratio or loosen
        the slippage tolerance.
      </p>
    </div>
  );

  const renderAddLiquidityForm = () => (
    <div className="space-y-4">
      <div className="grid gap-3">
        <label className="text-sm text-neutral-300">
          Amount A ({tokenAState.symbol ?? "Token A"})
          <input
            type="text"
            value={liqAmountA}
            onChange={(event) => setLiqAmountA(event.target.value)}
            placeholder="0.0"
            className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-white outline-none focus:border-fluent-purple"
          />
        </label>
        <label className="text-sm text-neutral-300">
          Amount B ({tokenBState.symbol ?? "Token B"})
          <input
            type="text"
            value={liqAmountB}
            onChange={(event) => setLiqAmountB(event.target.value)}
            placeholder="0.0"
            className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-white outline-none focus:border-fluent-purple"
          />
        </label>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <label className="text-sm text-neutral-300">
          Slippage (%)
          <input
            type="number"
            min="0"
            step="0.1"
            value={liqSlippage}
            onChange={(event) => setLiqSlippage(event.target.value)}
            className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-white outline-none focus:border-fluent-purple"
          />
        </label>
        <label className="text-sm text-neutral-300">
          Deadline (min)
          <input
            type="number"
            min="1"
            step="1"
            value={liqDeadline}
            onChange={(event) => setLiqDeadline(event.target.value)}
            className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-white outline-none focus:border-fluent-purple"
          />
        </label>
      </div>
      <div className="rounded-lg border border-neutral-800 bg-neutral-950/70 p-3 text-sm text-neutral-200">
        <div className="flex justify-between">
          <span>Expected shares</span>
          <span>
            {expectedAddResult ? formatUnits(expectedAddResult.shares, 18) : "—"}
          </span>
        </div>
        <div className="flex justify-between text-xs text-neutral-500 mt-1">
          <span>Deposits</span>
          <span>
            {expectedAddResult && tokenAState.decimals
              ? formatUnits(expectedAddResult.amountA, tokenAState.decimals)
              : "—"}{" "}
            /{" "}
            {expectedAddResult && tokenBState.decimals
              ? formatUnits(expectedAddResult.amountB, tokenBState.decimals)
              : "—"}
          </span>
        </div>
      </div>
      <div className="flex flex-col gap-3">
        {addNeedsApprovalA && (
          <button
            className="w-full rounded-full bg-fluent-purple px-4 py-2 text-sm text-white hover:bg-fluent-pink disabled:opacity-40"
            disabled={!isConnected || !liqAmountA || !tokenAState.decimals}
            onClick={() => {
              if (!tokenAState.decimals || !liqAmountA) return;
              try {
                const value = parseUnits(liqAmountA, tokenAState.decimals);
                void handleApprove(tokenAAddress, value, tokenAState.symbol ?? "Token A");
              } catch {
                toast.error("invalid amount");
              }
            }}
          >
            Approve {tokenAState.symbol ?? "Token A"}
          </button>
        )}
        {addNeedsApprovalB && (
          <button
            className="w-full rounded-full bg-fluent-purple px-4 py-2 text-sm text-white hover:bg-fluent-pink disabled:opacity-40"
            disabled={!isConnected || !liqAmountB || !tokenBState.decimals}
            onClick={() => {
              if (!tokenBState.decimals || !liqAmountB) return;
              try {
                const value = parseUnits(liqAmountB, tokenBState.decimals);
                void handleApprove(tokenBAddress, value, tokenBState.symbol ?? "Token B");
              } catch {
                toast.error("invalid amount");
              }
            }}
          >
            Approve {tokenBState.symbol ?? "Token B"}
          </button>
        )}
        <button
          className="w-full rounded-full bg-fluent-blue px-4 py-2 text-sm text-white hover:bg-fluent-purple disabled:opacity-40"
          disabled={!isConnected || addNeedsApprovalA || addNeedsApprovalB}
          onClick={() => void executeAddLiquidity()}
        >
          Add Liquidity
        </button>
      </div>
      <p className="text-xs text-neutral-500">
        Pool ratio is currently{" "}
        {poolPrice
          ? `${(1).toLocaleString(undefined, { maximumFractionDigits: 2 })} ${tokenAState.symbol ?? "Token A"} ≈ ${poolPrice.priceAB.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${tokenBState.symbol ?? "Token B"}`
          : "not available"}. Align your deposits with this ratio to avoid SLIPPAGE reverts.
      </p>
    </div>
  );

  const renderRemoveLiquidityForm = () => (
    <div className="space-y-4">
      <label className="text-sm text-neutral-300">
        <span className="flex items-center justify-between">
          Shares to burn
          <button
            type="button"
            className="text-xs text-fluent-blue hover:underline"
            onClick={() => {
              if (!pairBalance) return;
              setRemoveShares(formatUnits(pairBalance, 18));
            }}
          >
            Max
          </button>
        </span>
        <input
          type="text"
          value={removeShares}
          onChange={(event) => setRemoveShares(event.target.value)}
          placeholder="0.0"
          className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-white outline-none focus:border-fluent-purple"
        />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="text-sm text-neutral-300">
          Slippage (%)
          <input
            type="number"
            min="0"
            step="0.1"
            value={removeSlippage}
            onChange={(event) => setRemoveSlippage(event.target.value)}
            className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-white outline-none focus:border-fluent-purple"
          />
        </label>
        <label className="text-sm text-neutral-300">
          Deadline (min)
          <input
            type="number"
            min="1"
            step="1"
            value={removeDeadline}
            onChange={(event) => setRemoveDeadline(event.target.value)}
            className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-white outline-none focus:border-fluent-purple"
          />
        </label>
      </div>
      <div className="rounded-lg border border-neutral-800 bg-neutral-950/70 p-3 text-sm text-neutral-200">
        <div className="flex justify-between">
          <span>Expected return</span>
          <span>
            {expectedRemoveResult && tokenAState.decimals
              ? formatUnits(expectedRemoveResult.amountA, tokenAState.decimals)
              : "—"}{" "}
            /{" "}
            {expectedRemoveResult && tokenBState.decimals
              ? formatUnits(expectedRemoveResult.amountB, tokenBState.decimals)
              : "—"}
          </span>
        </div>
        <div className="flex justify-between text-xs text-neutral-500 mt-1">
          <span>Slippage floor</span>
          <span>
            {expectedRemoveResult && tokenAState.decimals
              ? formatUnits(expectedRemoveResult.minA, tokenAState.decimals)
              : "—"}{" "}
            /{" "}
            {expectedRemoveResult && tokenBState.decimals
              ? formatUnits(expectedRemoveResult.minB, tokenBState.decimals)
              : "—"}
          </span>
        </div>
      </div>
      <div className="flex flex-col gap-3">
        {removeNeedsApproval && (
          <button
            className="w-full rounded-full bg-fluent-purple px-4 py-2 text-sm text-white hover:bg-fluent-pink disabled:opacity-40"
            disabled={!isConnected || !pairAddress || !removeShares}
            onClick={() => {
              if (!pairAddress || !removeShares) return;
              try {
                const value = parseUnits(removeShares, 18);
                void handleApprove(pairAddress, value, "LP token");
              } catch {
                toast.error("invalid share amount");
              }
            }}
          >
            Approve LP
          </button>
        )}
        <button
          className="w-full rounded-full bg-fluent-blue px-4 py-2 text-sm text-white hover:bg-fluent-purple disabled:opacity-40"
          disabled={!isConnected || removeNeedsApproval || !pairAddress}
          onClick={() => void executeRemoveLiquidity()}
        >
          Remove Liquidity
        </button>
      </div>
    </div>
  );

  const renderTokenSelectors = () => (
    <div className="grid gap-4 md:grid-cols-2">
      <label className="text-sm text-neutral-300">
        From token
        <select
          className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-white outline-none focus:border-fluent-purple"
          value={tokenIn ?? ""}
          onChange={(e) => setTokenIn(e.target.value as Address)}
        >
          {tokenOptions.map((option) => (
            <option key={option.label} value={option.address}>
              {option.label}
            </option>
          ))}
        </select>
        <span className="mt-1 block text-xs text-neutral-500">
          Allowance: {formatBigNumber(tokenInState.allowance, tokenInState.decimals ?? 18)}
        </span>
      </label>
      <label className="text-sm text-neutral-300">
        To token
        <select
          className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-white outline-none focus:border-fluent-purple"
          value={tokenOut ?? ""}
          onChange={(e) => setTokenOut(e.target.value as Address)}
        >
          {tokenOptions.map((option) => (
            <option key={option.label} value={option.address}>
              {option.label}
            </option>
          ))}
        </select>
        <span className="mt-1 block text-xs text-neutral-500">
          Allowance: {formatBigNumber(tokenOutState.allowance, tokenOutState.decimals ?? 18)}
        </span>
      </label>
      <button
        className="w-full rounded-lg border border-neutral-700/80 bg-neutral-950/80 py-2 text-sm text-neutral-300 hover:text-white md:col-span-2"
        onClick={switchTokens}
      >
        Swap tokens
      </button>
    </div>
  );

  if (!envOk) {
    return (
      <main className="py-10">
        <div className="rounded-2xl border border-red-500/40 bg-red-500/10 p-6 text-center">
          <h1 className="text-2xl font-semibold mb-2">Missing configuration</h1>
          <p className="text-sm text-red-200">
            Set NEXT_PUBLIC_FACTORY, NEXT_PUBLIC_ROUTER, NEXT_PUBLIC_TOKEN_A, and NEXT_PUBLIC_TOKEN_B in
            your <code>.env.local</code>, then restart the dev server.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="space-y-6 py-8">
      <NetworkGate chainId={chainId}>
        <section className="rounded-2xl border border-neutral-800/60 bg-neutral-950/70 p-6 shadow-xl shadow-black/20 backdrop-blur">
          <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
            <div>
              <h1 className="text-2xl font-semibold text-white">FoidSwap Router</h1>
              <p className="text-sm text-neutral-400">
                Tools for swapping, managing pairs, and providing liquidity on Fluent Testnet.
              </p>
            </div>
            <div className="flex gap-2 bg-neutral-900/80 p-1 rounded-full">
              {(["swap", "pairs", "liquidity"] as ViewKey[]).map((view) => (
                <button
                  key={view}
                  onClick={() => setActiveView(view)}
                  className={`px-4 py-2 rounded-full text-sm transition ${
                    activeView === view ? "bg-fluent-purple text-white" : "text-neutral-300 hover:text-white"
                  }`}
                >
                  {view === "swap" ? "Swap" : view === "pairs" ? "Pairs" : "Liquidity"}
                </button>
              ))}
            </div>
          </header>

          <div className="grid gap-6 md:grid-cols-[320px,1fr]">
            <aside className="space-y-4">
              {renderTokenOverview()}
              {renderPoolStats(activeView === "pairs")}
            </aside>

            <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-6 space-y-6">
              {activeView !== "pairs" && renderTokenSelectors()}

              {activeView === "swap" && renderSwapForm()}

              {activeView === "liquidity" && (
                <>
                  <div className="flex gap-2 bg-neutral-900/80 p-1 rounded-full">
                    {(["add", "remove"] as LiquidityMode[]).map((mode) => (
                      <button
                        key={mode}
                        onClick={() => setLiquidityMode(mode)}
                        className={`px-4 py-2 rounded-full text-sm transition ${
                          liquidityMode === mode
                            ? "bg-fluent-purple text-white"
                            : "text-neutral-300 hover:text-white"
                        }`}
                      >
                        {mode === "add" ? "Add Liquidity" : "Remove Liquidity"}
                      </button>
                    ))}
                  </div>
                  {liquidityMode === "add" ? renderAddLiquidityForm() : renderRemoveLiquidityForm()}
                </>
              )}

              {activeView === "pairs" && renderPairsManager()}
            </div>
          </div>
        </section>
      </NetworkGate>
    </main>
  );
}
