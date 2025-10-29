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
const BLOCKSCOUT_API_BASE = (process.env.NEXT_PUBLIC_BLOCKSCOUT_API ?? process.env.BLOCKSCOUT_API ?? "https://testnet.fluentscan.xyz/api/").replace(/\/?$/, "");
const transferEvent = {
  type: "event",
  name: "Transfer",
  inputs: [
    { indexed: true, name: "from", type: "address" },
    { indexed: true, name: "to", type: "address" },
    { indexed: false, name: "value", type: "uint256" },
  ],
} as const;
const tokenDeployedEvent = {
  type: "event",
  name: "TokenDeployed",
  inputs: [
    { indexed: true, name: "token", type: "address" },
    { indexed: true, name: "creator", type: "address" },
    { indexed: false, name: "name", type: "string" },
    { indexed: false, name: "symbol", type: "string" },
    { indexed: false, name: "decimals", type: "uint8" },
    { indexed: false, name: "cap", type: "uint256" },
    { indexed: false, name: "initialMint", type: "uint256" },
    { indexed: false, name: "initialMintTo", type: "address" },
    { indexed: false, name: "userSalt", type: "bytes32" },
    { indexed: false, name: "namespacedSalt", type: "bytes32" },
  ],
} as const;

type WalletTokenHint = {
  address: Address;
  symbol?: string;
  decimals?: number;
  balance?: bigint;
};

const parseMaybeBigInt = (value: unknown): bigint | undefined => {
  if (typeof value === "bigint") return value;
  if (typeof value === "number" && Number.isFinite(value)) {
    try {
      return BigInt(Math.trunc(value));
    } catch {
      return undefined;
    }
  }
  if (typeof value === "string" && value.trim().length > 0) {
    try {
      return BigInt(value);
    } catch {
      return undefined;
    }
  }
  return undefined;
};

const fetchBlockscoutWalletTokens = async (wallet: Address): Promise<WalletTokenHint[]> => {
  if (!BLOCKSCOUT_API_BASE) return [];

  const base = BLOCKSCOUT_API_BASE.replace(/\/$/, "");
  const collected = new Map<string, WalletTokenHint>();

  const upsert = (candidate: any) => {
    if (!candidate) return;
    const tokenData = candidate.token ?? candidate.tokenData ?? candidate.token_metadata ?? candidate;
    const addressCandidate =
      tokenData?.address ??
      candidate.token_address ??
      candidate.contract_address ??
      candidate.contractAddress ??
      candidate.address;
    if (typeof addressCandidate !== "string") return;
    const normalized = addressCandidate.trim();
    if (!isAddress(normalized)) return;
    const decimalsRaw =
      tokenData?.decimals ??
      candidate.token_decimals ??
      candidate.tokenDecimal ??
      candidate.decimals;
    const symbolRaw =
      tokenData?.symbol ??
      candidate.token_symbol ??
      candidate.tokenSymbol ??
      candidate.symbol;
    const balanceRaw =
      candidate.balance ??
      candidate.token_balance ??
      candidate.tokenBalance ??
      candidate.value ??
      candidate.value_rounded ??
      candidate.quantity;

    const decimals =
      typeof decimalsRaw === "number" && Number.isFinite(decimalsRaw)
        ? decimalsRaw
        : Number.parseInt(
            typeof decimalsRaw === "string" && decimalsRaw.trim().length > 0
              ? decimalsRaw
              : "",
            10,
          );
    const balance = parseMaybeBigInt(balanceRaw);

    const lower = normalized.toLowerCase();
    const existing = collected.get(lower);
    collected.set(lower, {
      address: normalized as Address,
      symbol:
        typeof symbolRaw === "string" && symbolRaw.trim().length > 0
          ? symbolRaw.trim()
          : existing?.symbol,
      decimals: Number.isFinite(decimals) ? decimals : existing?.decimals,
      balance: balance ?? existing?.balance,
    });
  };

  const tryJson = async (url: string) => {
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) return false;
      const data = await res.json();
      const candidates =
        (Array.isArray(data?.items) && data.items) ||
        (Array.isArray(data?.result) && data.result) ||
        (Array.isArray(data?.data) && data.data) ||
        (Array.isArray(data?.tokens) && data.tokens) ||
        (Array.isArray(data) && data) ||
        [];
      candidates.forEach(upsert);
      return candidates.length > 0;
    } catch (error) {
      console.debug("blockscout fetch failed", { url, error });
      return false;
    }
  };

  const attempts = [
    `${base}/v2/addresses/${wallet}/token-balances?type=ERC-20&include=token&page=1&per_page=200`,
    `${base}/v2/addresses/${wallet}/token-holdings?page=1&per_page=200`,
    `${base}/v2/addresses/${wallet}/tokens?type=ERC-20&page=1&per_page=200`,
  ];

  for (const url of attempts) {
    const ok = await tryJson(url);
    if (ok && collected.size > 0) break;
  }

  if (collected.size === 0) {
    const qs = new URLSearchParams({
      module: "account",
      action: "addresstokenbalance",
      address: wallet,
      page: "1",
      offset: "500",
      sort: "desc",
    });
    await tryJson(`${base}?${qs.toString()}`);
  }

  return Array.from(collected.values()).filter(
    (item) => typeof item.balance === "bigint" && item.balance > 0n,
  );
};

const resolveAddress = (...candidates: (string | undefined)[]): Address | undefined => {
  for (const candidate of candidates) {
    const trimmed = candidate?.trim();
    if (trimmed && isAddress(trimmed)) {
      return trimmed as Address;
    }
  }
  return undefined;
};

const sortPairAddresses = (a: Address, b: Address): [Address, Address] => {
  return a.toLowerCase() < b.toLowerCase() ? [a, b] : [b, a];
};

const unwrapErrorMessage = (error: unknown): string | undefined => {
  if (!error) return undefined;
  if (typeof error === "string") return error;
  if (error instanceof Error) {
    return error.message || unwrapErrorMessage((error as any).cause);
  }
  if (typeof error === "object") {
    const maybeMessage =
      (error as { shortMessage?: unknown }).shortMessage ??
      (error as { details?: unknown }).details ??
      (error as { message?: unknown }).message;
    if (typeof maybeMessage === "string" && maybeMessage.trim().length > 0) {
      return maybeMessage;
    }
    const dataField = (error as { data?: unknown }).data;
    if (typeof dataField === "string" && dataField.trim().length > 0) {
      return dataField;
    }
    if (typeof dataField === "object" && dataField !== null) {
      const nestedMessage =
        (dataField as { message?: unknown }).message ??
        (dataField as { shortMessage?: unknown }).shortMessage ??
        (dataField as { details?: unknown }).details;
      if (typeof nestedMessage === "string" && nestedMessage.trim().length > 0) {
        return nestedMessage;
      }
      const nestedCause = (dataField as { cause?: unknown }).cause;
      const viaNested = unwrapErrorMessage(nestedCause);
      if (viaNested) return viaNested;
    }
    return unwrapErrorMessage((error as { cause?: unknown }).cause);
  }
  return undefined;
};

const isContractRevertError = (error: unknown) => {
  const message = unwrapErrorMessage(error)?.toLowerCase() ?? "";
  return message.includes("revert") || message.includes("contractfunctionexecutionerror");
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

interface WalletToken {
  address: Address;
  symbol: string;
  decimals: number;
  balance: bigint;
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

  const fallbackPairAddress = resolveAddress(
    process.env.NEXT_PUBLIC_PAIR as string | undefined,
    process.env.NEXT_PUBLIC_AMM as string | undefined,
  );

  const [activeView, setActiveView] = useState<ViewKey>("swap");
  const [liquidityMode, setLiquidityMode] = useState<LiquidityMode>("add");
  const [tokenIn, setTokenIn] = useState<Address | undefined>(tokenAAddress);
  const [tokenOut, setTokenOut] = useState<Address | undefined>(tokenBAddress);
  const [tokenInEntry, setTokenInEntry] = useState(tokenIn ?? "");
  const [tokenOutEntry, setTokenOutEntry] = useState(tokenOut ?? "");
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

  useEffect(() => {
    setTokenInEntry(tokenIn ?? "");
  }, [tokenIn]);

  useEffect(() => {
    setTokenOutEntry(tokenOut ?? "");
  }, [tokenOut]);

  const [pairAddress, setPairAddress] = useState<Address | undefined>(fallbackPairAddress);
  const [pairToken0, setPairToken0] = useState<Address | undefined>();
  const [pairReserves, setPairReserves] = useState<[bigint, bigint, number] | undefined>();
  const [pairAllowance, setPairAllowance] = useState<bigint | undefined>();
  const [pairBalance, setPairBalance] = useState<bigint | undefined>();
  const [pairDecimals, setPairDecimals] = useState<number>(18);
  const [creatingPair, setCreatingPair] = useState(false);
  const [manualToken0, setManualToken0] = useState("");
  const [manualToken1, setManualToken1] = useState("");
  const [factoryPairs, setFactoryPairs] = useState<Address[]>(
    fallbackPairAddress ? [fallbackPairAddress] : [],
  );
  const [factoryPairsLoading, setFactoryPairsLoading] = useState(false);
  const [factoryPairsError, setFactoryPairsError] = useState<string | null>(null);
  const [pairRefreshNonce, setPairRefreshNonce] = useState(0);
  const [walletTokens, setWalletTokens] = useState<WalletToken[]>([]);

  const tokenOptions = useMemo(() => {
    const map = new Map<string, { address: Address; label: string }>();

    walletTokens.forEach((token) => {
      const lower = token.address.toLowerCase();
      if (!map.has(lower)) {
        const labelSymbol = token.symbol || "Token";
        map.set(lower, {
          address: token.address,
          label: `${labelSymbol} (${token.address.slice(0, 6)}…${token.address.slice(-4)})`,
        });
      }
    });

    const ensureOption = (addr?: Address, symbolHint?: string) => {
      if (!addr || addr === zeroAddress) return;
      const lower = addr.toLowerCase();
      if (!map.has(lower)) {
        map.set(lower, {
          address: addr,
          label: `${symbolHint ?? "Token"} (${addr.slice(0, 6)}…${addr.slice(-4)})`,
        });
      }
    };

    ensureOption(tokenIn as Address | undefined, tokenInState.symbol);
    ensureOption(tokenOut as Address | undefined, tokenOutState.symbol);
    return Array.from(map.values());
  }, [
    tokenIn,
    tokenInState.symbol,
    tokenOut,
    tokenOutState.symbol,
    walletTokens,
  ]);
  const tokenInEntryValid = tokenInEntry.length === 0 || isAddress(tokenInEntry);
  const tokenOutEntryValid = tokenOutEntry.length === 0 || isAddress(tokenOutEntry);
  const manualToken0IsValid = manualToken0 ? isAddress(manualToken0) : false;
  const manualToken1IsValid = manualToken1 ? isAddress(manualToken1) : false;

  useEffect(() => {
    if (!walletTokens.length) {
      setManualToken0("");
      setManualToken1("");
      return;
    }

    const primary = manualToken0 && isAddress(manualToken0)
      ? manualToken0
      : walletTokens[0].address;

    if (primary !== manualToken0) {
      setManualToken0(primary);
    }

    const fallback = walletTokens.find(
      (token) => token.address.toLowerCase() !== primary.toLowerCase(),
    );
    const desiredSecondary =
      manualToken1 && isAddress(manualToken1) && manualToken1.toLowerCase() !== primary.toLowerCase()
        ? manualToken1
        : fallback?.address ?? "";

    if (desiredSecondary !== manualToken1) {
      setManualToken1(desiredSecondary);
    }
  }, [manualToken0, manualToken1, walletTokens]);

  useEffect(() => {
    if (!walletTokens.length) return;
    const hasToken = (addr?: Address) =>
      !!addr && walletTokens.some((token) => token.address.toLowerCase() === addr.toLowerCase());

    let nextTokenIn = tokenIn;
    if (!hasToken(tokenIn)) {
      nextTokenIn = walletTokens[0].address;
      setTokenIn(nextTokenIn);
    }

    const fallbackSecond = walletTokens.find(
      (token) => token.address.toLowerCase() !== (nextTokenIn ?? "").toLowerCase(),
    );
    if (!hasToken(tokenOut) || (nextTokenIn && tokenOut && tokenOut.toLowerCase() === nextTokenIn.toLowerCase())) {
      if (fallbackSecond) {
        setTokenOut(fallbackSecond.address);
      } else if (tokenOut !== undefined) {
        setTokenOut(undefined);
      }
    }
  }, [tokenIn, tokenOut, walletTokens]);

  const tokenAddresses = useMemo(
    () =>
      [tokenIn, tokenOut].filter(
        (addr): addr is Address => Boolean(addr) && addr !== zeroAddress,
      ),
    [tokenIn, tokenOut],
  );

  const defaultPairKey = useMemo(() => {
    if (!tokenAAddress || !tokenBAddress) return null;
    const [a, b] = sortPairAddresses(tokenAAddress as Address, tokenBAddress as Address);
    return `${a.toLowerCase()}:${b.toLowerCase()}`;
  }, [tokenAAddress, tokenBAddress]);

  const selectedPairKey = useMemo(() => {
    if (tokenAddresses.length !== 2) return null;
    const [a, b] = sortPairAddresses(tokenAddresses[0], tokenAddresses[1]);
    return `${a.toLowerCase()}:${b.toLowerCase()}`;
  }, [tokenAddresses]);

  const routerReady = Boolean(routerAddress);
  const envOk = routerReady;

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
      const [queryToken0, queryToken1] = sortPairAddresses(targetToken0, targetToken1);

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
          args: [queryToken0, queryToken1],
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
        if (!isContractRevertError(err)) {
          console.debug("getPair lookup failed", err);
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
          args: [queryToken0, queryToken1],
        }).catch((err) => {
          const message = unwrapErrorMessage(err) ?? "Pair simulation failed";
          if (toastId) toast.dismiss(toastId);
          toast.error(message);
          return null;
        });
        if (!simulation) {
          return undefined;
        }
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
            args: [queryToken0, queryToken1],
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
        if (toastId) toast.dismiss(toastId);
        const message = unwrapErrorMessage(err) ?? "Pair creation failed";
        const normalized = message.toLowerCase();
        if (
          normalized.includes("user rejected") ||
          normalized.includes("user denied") ||
          normalized.includes("rejected the request")
        ) {
          toast.error("Transaction signature was rejected in the wallet.");
          return undefined;
        }
        if (normalized.includes("pair already")) {
          const existingPair = (await publicClient.readContract({
            address: factoryAddress,
            abi: factoryAbi,
            functionName: "getPair",
            args: [queryToken0, queryToken1],
          })) as Address;
          if (existingPair && existingPair !== zeroAddress) {
            toast.success("Pair already exists");
            setPairRefreshNonce((n) => n + 1);
            if (selectedKey && selectedKey === targetKey) {
              setPairToken0(undefined);
              setPairReserves(undefined);
              setPairAllowance(undefined);
              setPairBalance(undefined);
              setPairAddress(existingPair);
            }
            setCreatingPair(false);
            return existingPair;
          }
        }
        if (normalized.includes("forbidden")) {
          toast.error("Factory rejected the pair (FORBIDDEN). Check roles/permissions.");
          return undefined;
        }
        if (normalized.includes("identical")) {
          toast.error("Provide two distinct token addresses.");
          return undefined;
        }
        toast.error(message);
        return undefined;
      } finally {
        setCreatingPair(false);
      }
  },
  [explorerBase, factoryAddress, publicClient, tokenAAddress, tokenBAddress, walletClient],
);

  const loadTokenSummary = useCallback(
    async (tokenAddress: Address): Promise<WalletToken | null> => {
      if (!publicClient || !account || tokenAddress === zeroAddress) {
        return null;
      }
      try {
        const [rawSymbol, rawDecimals, balance] = await Promise.all([
          publicClient
            .readContract({
              address: tokenAddress,
              abi: erc20Abi,
              functionName: "symbol",
            })
            .catch(() => ""),
          publicClient.readContract({
            address: tokenAddress,
            abi: erc20Abi,
            functionName: "decimals",
          }),
          publicClient
            .readContract({
              address: tokenAddress,
              abi: erc20Abi,
              functionName: "balanceOf",
              args: [account],
            })
            .catch(() => 0n),
        ]);

        const decimalsNumber = (() => {
          if (typeof rawDecimals === "number" && Number.isFinite(rawDecimals)) return rawDecimals;
          const parsed = Number((rawDecimals as any)?.toString?.() ?? "18");
          return Number.isFinite(parsed) ? parsed : 18;
        })();
        const symbol =
          typeof rawSymbol === "string" && rawSymbol.trim().length > 0
            ? rawSymbol.trim()
            : "Token";

        return {
          address: tokenAddress,
          symbol,
          decimals: decimalsNumber,
          balance: (balance as bigint) ?? 0n,
        };
      } catch (error) {
        console.debug("wallet token summary failed", error);
        return null;
      }
    },
    [account, publicClient],
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
    if (!routerReady || !tokenIn) return;
    void fetchTokenData(tokenIn, setTokenInState);
  }, [fetchTokenData, routerReady, tokenIn]);

  useEffect(() => {
    if (!routerReady || !tokenOut) return;
    void fetchTokenData(tokenOut, setTokenOutState);
  }, [fetchTokenData, routerReady, tokenOut]);

  useEffect(() => {
    if (!routerReady) return;
    void fetchTokenData(tokenAAddress, setTokenAState);
    void fetchTokenData(tokenBAddress, setTokenBState);
  }, [fetchTokenData, routerReady, tokenAAddress, tokenBAddress]);

  useEffect(() => {
    if (!publicClient || !account) {
      setWalletTokens([]);
      return;
    }
    let cancelled = false;
    const gather = async () => {
      const lowerToAddress = new Map<string, Address>();
      const blockscoutMeta = new Map<string, WalletToken>();

      const addAddress = (addr?: Address, meta?: Partial<WalletToken>) => {
        if (!addr || addr === zeroAddress) return;
        const lower = addr.toLowerCase() as Address;
        if (!lowerToAddress.has(lower)) {
          lowerToAddress.set(lower, addr);
        }
        if (meta) {
          blockscoutMeta.set(lower, {
            address: addr,
            symbol: meta.symbol ?? "Token",
            decimals: meta.decimals ?? 18,
            balance: meta.balance ?? 0n,
          });
        }
      };

      try {
        const accountLower = account.toLowerCase();

        try {
          const hints = await fetchBlockscoutWalletTokens(account as Address);
          hints.forEach((hint) =>
            addAddress(hint.address, {
              symbol: hint.symbol,
              decimals: hint.decimals,
              balance: hint.balance,
            }),
          );
        } catch (apiErr) {
          console.debug("blockscout scan failed", apiErr);
        }

        const latestBlock = await publicClient.getBlockNumber();
        const batchSize = 200_000n;

        const fetchLogsChunked = async ({
          event,
          args,
          address,
        }: {
          event: typeof transferEvent | typeof tokenDeployedEvent;
          args?: Record<string, unknown>;
          address?: Address;
        }) => {
          const logs: any[] = [];
          let cursor = 0n;
          while (cursor <= latestBlock) {
            const chunkEnd = cursor + batchSize > latestBlock ? latestBlock : cursor + batchSize;
            try {
              const chunk = await publicClient.getLogs({
                address,
                event,
                args: args as any,
                fromBlock: cursor,
                toBlock: chunkEnd,
              });
              logs.push(...chunk);
            } catch (err) {
              console.debug("log chunk fetch failed", err);
            }
            cursor = chunkEnd + 1n;
          }
          return logs;
        };

        const logsIn = await fetchLogsChunked({
          event: transferEvent,
          args: { to: account as Address },
        });
        const logsOut = await fetchLogsChunked({
          event: transferEvent,
          args: { from: account as Address },
        });

        [...logsIn, ...logsOut].forEach((log) => addAddress(log.address as Address));

        if (factoryAddress) {
          const creationLogs = await fetchLogsChunked({
            address: factoryAddress,
            event: tokenDeployedEvent,
          });
          creationLogs.forEach((log) => {
            const tokenAddress = (log.args?.token as Address) ?? (log.address as Address);
            const creator = log.args?.creator as Address | undefined;
            const initialMintTo = log.args?.initialMintTo as Address | undefined;
            if (
              tokenAddress &&
              (creator?.toLowerCase() === accountLower || initialMintTo?.toLowerCase() === accountLower)
            ) {
              addAddress(tokenAddress, {
                symbol: (log.args?.symbol as string) ?? "Token",
                decimals: Number(log.args?.decimals ?? 18),
              });
            }
          });
        }
      } catch (error) {
        console.debug("wallet token discovery failed", error);
      }

      const pairsToInspect = new Set<Address>();
      [fallbackPairAddress, pairAddress, ...factoryPairs].forEach((maybePair) => {
        if (maybePair && maybePair !== zeroAddress) {
          pairsToInspect.add(maybePair);
        }
      });

      const pairTokens = await Promise.all(
        Array.from(pairsToInspect).map(async (pair) => {
          try {
            const [token0, token1] = await Promise.all([
              publicClient.readContract({
                address: pair,
                abi: pairAbi,
                functionName: "token0",
              }),
              publicClient.readContract({
                address: pair,
                abi: pairAbi,
                functionName: "token1",
              }),
            ]);
            return [token0 as Address, token1 as Address];
          } catch (error) {
            console.debug("pair token fetch failed", error);
            return [] as Address[];
          }
        }),
      );

      pairTokens.forEach(([maybeToken0, maybeToken1]) => {
        addAddress(maybeToken0 as Address | undefined);
        addAddress(maybeToken1 as Address | undefined);
      });

      if (pairAddress && pairBalance && pairBalance > 0n) {
        addAddress(pairAddress);
      }
      if (fallbackPairAddress && pairAddress !== fallbackPairAddress) {
        addAddress(fallbackPairAddress);
      }

      const addressList = Array.from(lowerToAddress.values());
      const summaries = await Promise.all(
        addressList.map((addr) => {
          const cached = blockscoutMeta.get(addr.toLowerCase());
          if (cached) return cached;
          return loadTokenSummary(addr);
        }),
      );
      const filtered = summaries
        .filter((token): token is WalletToken => Boolean(token) && (token as WalletToken).balance > 0n)
        .sort((a, b) => a.symbol.localeCompare(b.symbol));

      if (!cancelled) {
        setWalletTokens(filtered);
      }
    };

    void gather();
    return () => {
      cancelled = true;
    };
  }, [
    account,
    factoryPairs,
    fallbackPairAddress,
    loadTokenSummary,
    pairAddress,
    pairBalance,
    pairToken0,
    publicClient,
    tokenAAddress,
    tokenBAddress,
    factoryAddress,
  ]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      (window as any).__foid = {
        ...(window as any).__foid,
        walletTokens,
      };
    }
  }, [walletTokens]);

  // fetch pair address when tokens ready
  useEffect(() => {
    const shouldFallback =
      Boolean(
        fallbackPairAddress &&
          defaultPairKey &&
          selectedPairKey &&
          selectedPairKey === defaultPairKey,
      );

    if (!publicClient || tokenAddresses.length !== 2) {
      setPairAddress(shouldFallback ? fallbackPairAddress : undefined);
      return;
    }
    if (!factoryAddress) {
      setPairAddress(shouldFallback ? fallbackPairAddress : undefined);
      return;
    }
    const [raw0, raw1] = tokenAddresses;
    const [token0, token1] = sortPairAddresses(raw0, raw1);
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
          setPairAddress(shouldFallback ? fallbackPairAddress : undefined);
        }
      } catch (err) {
        if (!isContractRevertError(err)) {
          console.debug("getPair failed", err);
        }
        if (!cancelled) setPairAddress(shouldFallback ? fallbackPairAddress : undefined);
      }
    };
    void loadPair();
    return () => {
      cancelled = true;
    };
  }, [
    defaultPairKey,
    fallbackPairAddress,
    factoryAddress,
    publicClient,
    selectedPairKey,
    tokenAddresses,
  ]);

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

  useEffect(() => {
    if (!publicClient || !pairAddress || pairAddress === zeroAddress) {
      setPairDecimals(18);
      return;
    }
    let cancelled = false;
    const load = async () => {
      try {
        const decimals = await publicClient
          .readContract({
            address: pairAddress,
            abi: erc20Abi,
            functionName: "decimals",
          })
          .catch(() => 18);
        if (!cancelled) {
          const parsed = Number((decimals as number | string | bigint) ?? 18);
          setPairDecimals(Number.isFinite(parsed) ? parsed : 18);
        }
      } catch (err) {
        console.debug("pair decimals fetch failed", err);
        if (!cancelled) setPairDecimals(18);
      }
    };
    void load();
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
        const combined = Array.from(
          new Set([
            ...(fallbackPairAddress && fallbackPairAddress !== zeroAddress
              ? [fallbackPairAddress]
              : []),
            ...(pairAddress && pairAddress !== zeroAddress ? [pairAddress] : []),
            ...filtered,
          ]),
        );
        if (!cancelled) {
          setFactoryPairs(combined);
          setFactoryPairsError(null);
        }
      } catch (err: any) {
        if (!cancelled) {
          const fallback = Array.from(
            new Set([
              ...(fallbackPairAddress && fallbackPairAddress !== zeroAddress
                ? [fallbackPairAddress]
                : []),
              ...(pairAddress && pairAddress !== zeroAddress ? [pairAddress] : []),
            ]),
          );
          if (fallback.length > 0) {
            setFactoryPairs(fallback);
            setFactoryPairsError(null);
          } else {
            const message = unwrapErrorMessage(err) ?? "Unable to load pairs";
            setFactoryPairs([]);
            setFactoryPairsError(message);
          }
        }
      } finally {
        if (!cancelled) setFactoryPairsLoading(false);
      }
    };
    void fetchPairs();
    return () => {
      cancelled = true;
    };
  }, [factoryAddress, fallbackPairAddress, pairAddress, pairRefreshNonce, publicClient]);

  // swap quote
  useEffect(() => {
    if (!publicClient || !routerAddress || !tokenIn || !tokenOut) {
      setQuoteOut(undefined);
      setQuoteImpact(undefined);
      return;
    }
    if (
      tokenInState.decimals === undefined ||
      tokenOutState.decimals === undefined ||
      !pairReserves ||
      !pairToken0
    ) {
      setQuoteOut(undefined);
      setQuoteImpact(undefined);
      return;
    }
    const tokenInDecimals = tokenInState.decimals;
    const tokenOutDecimals = tokenOutState.decimals;
    let cancelled = false;
    const run = async () => {
      try {
        if (!amountIn || Number(amountIn) <= 0) {
          setQuoteOut(undefined);
          setQuoteImpact(undefined);
          return;
        }
        const parsed = parseUnits(amountIn, tokenInDecimals);
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
          Number(formatUnits(out, tokenOutDecimals)) /
          Number(formatUnits(parsed, tokenInDecimals));
        const spotPrice =
          Number(formatUnits(reserveOut, tokenOutDecimals)) /
          Number(formatUnits(reserveIn, tokenInDecimals));

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
      const decimals = Number.isFinite(pairDecimals) ? pairDecimals : 18;
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
    pairDecimals,
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
      const decimals = Number.isFinite(pairDecimals) ? pairDecimals : 18;
      const parsed = parseUnits(removeShares, decimals);
      return pairAllowance < parsed;
    } catch {
      return true;
    }
  }, [pairAllowance, pairDecimals, removeShares]);

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
    if (!tokenIn || !tokenOut) return;
    setTokenIn(tokenOut);
    setTokenOut(tokenIn);
    setAmountIn("");
    setQuoteOut(undefined);
    setQuoteImpact(undefined);
  };

  const renderTokenOverview = () => (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-4">
      <h2 className="text-sm font-semibold text-neutral-200 mb-2">Wallet tokens</h2>
      {walletTokens.length === 0 ? (
        <p className="text-xs text-neutral-400">
          Hold ERC-20 tokens in this wallet to see balances and quickly create pools.
        </p>
      ) : (
        <div className="max-h-64 overflow-y-auto space-y-2 text-sm text-neutral-200">
          {walletTokens.map((token) => {
            const balanceFormatted = (() => {
              try {
                return Number.parseFloat(formatUnits(token.balance, token.decimals)).toLocaleString(
                  undefined,
                  { maximumFractionDigits: 6 },
                );
              } catch {
                return token.balance.toString();
              }
            })();
            return (
              <div
                key={token.address}
                className="flex items-center justify-between rounded-lg border border-neutral-800 bg-neutral-950/60 px-3 py-2"
              >
                <div className="flex flex-col">
                  <span className="font-medium">
                    {token.symbol || "Token"}
                    <span className="text-xs text-neutral-500"> · {token.address.slice(0, 6)}…{token.address.slice(-4)}</span>
                  </span>
                </div>
                <span>{balanceFormatted}</span>
              </div>
            );
          })}
        </div>
      )}
      <div className="mt-3 flex justify-between text-xs text-neutral-500">
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

  const renderPairsManager = () => {
    const secondaryOptions = walletTokens.filter((token) =>
      manualToken0 ? token.address.toLowerCase() !== manualToken0.toLowerCase() : true,
    );
    const token0Preview =
      manualToken0 && manualToken0.length >= 10
        ? `${manualToken0.slice(0, 6)}…${manualToken0.slice(-4)}`
        : "Token A";
    const manualPairDisabled =
      !isConnected ||
      creatingPair ||
      !manualToken0IsValid ||
      !manualToken1IsValid ||
      manualToken0.toLowerCase() === manualToken1.toLowerCase();
    const handleManualToken0Change = (nextRaw: string) => {
      const next = nextRaw.trim();
      setManualToken0(next);
      if (!next || !manualToken1) return;
      if (!isAddress(next) || !isAddress(manualToken1)) return;
      if (next.toLowerCase() === manualToken1.toLowerCase()) {
        const alternative = walletTokens.find(
          (token) => token.address.toLowerCase() !== next.toLowerCase(),
        );
        setManualToken1(alternative?.address ?? "");
      }
    };
    const handleManualToken1Change = (nextRaw: string) => {
      setManualToken1(nextRaw.trim());
    };

    return (
      <div className="space-y-6">
        <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-4">
          <h2 className="text-sm font-semibold text-neutral-200 mb-3">Active pairs</h2>
          {factoryPairsLoading ? (
            <p className="text-neutral-400 text-sm">Loading pairs…</p>
          ) : factoryPairs.length === 0 ? (
            <p className="text-sm text-neutral-400">
              {factoryPairsError ?? "No pools detected for this factory yet."}
            </p>
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
          <h2 className="text-sm font-semibold text-neutral-200">Create a New Pair</h2>
          {walletTokens.length === 0 ? (
            <p className="text-xs text-neutral-400">
              Hold tokens in this wallet to unlock quick pair creation.
            </p>
          ) : (
            <>
              <label className="text-xs uppercase tracking-wide text-neutral-400">
                Token A
                <div className="mt-1 space-y-2">
                  <input
                    type="text"
                    autoComplete="off"
                    spellCheck={false}
                    placeholder="0x…"
                    value={manualToken0}
                    onChange={(event) => handleManualToken0Change(event.target.value)}
                    className={`w-full rounded-lg bg-neutral-950 px-3 py-2 text-sm text-white outline-none ${
                      manualToken0.length === 0 || manualToken0IsValid
                        ? "border border-neutral-700 focus:border-fluent-purple"
                        : "border border-red-500 focus:border-red-400"
                    }`}
                  />
                  {manualToken0.length > 0 && !manualToken0IsValid && (
                    <span className="block text-[11px] text-red-400">
                      Paste a valid ERC-20 token address or pick one below.
                    </span>
                  )}
                  <select
                    value={manualToken0}
                    onChange={(event) => handleManualToken0Change(event.target.value)}
                    className="w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-white outline-none focus:border-fluent-purple"
                  >
                    {walletTokens.map((token) => {
                      const formattedBalance = (() => {
                        try {
                          return Number.parseFloat(
                            formatUnits(token.balance, token.decimals),
                          ).toFixed(4);
                        } catch {
                          return "0";
                        }
                      })();
                      return (
                        <option key={token.address} value={token.address}>
                          {token.symbol || "Token"} · {formattedBalance} ({token.address.slice(0, 6)}…
                          {token.address.slice(-4)})
                        </option>
                      );
                    })}
                  </select>
                </div>
              </label>
              <label className="text-xs uppercase tracking-wide text-neutral-400">
                Token B
                <div className="mt-1 space-y-2">
                  <input
                    type="text"
                    autoComplete="off"
                    spellCheck={false}
                    placeholder="0x…"
                    value={manualToken1}
                    onChange={(event) => handleManualToken1Change(event.target.value)}
                    className={`w-full rounded-lg bg-neutral-950 px-3 py-2 text-sm text-white outline-none ${
                      manualToken1.length === 0 || manualToken1IsValid
                        ? "border border-neutral-700 focus:border-fluent-purple"
                        : "border border-red-500 focus:border-red-400"
                    }`}
                  />
                  {manualToken1.length > 0 && !manualToken1IsValid && (
                    <span className="block text-[11px] text-red-400">
                      Paste a valid ERC-20 token address or pick one below.
                    </span>
                  )}
                  {secondaryOptions.length > 0 ? (
                    <select
                      value={manualToken1}
                      onChange={(event) => handleManualToken1Change(event.target.value)}
                      className="w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-white outline-none focus:border-fluent-purple"
                    >
                      {secondaryOptions.map((token) => {
                        const formattedBalance = (() => {
                          try {
                            return Number.parseFloat(
                              formatUnits(token.balance, token.decimals),
                            ).toFixed(4);
                          } catch {
                            return "0";
                          }
                        })();
                        return (
                          <option key={token.address} value={token.address}>
                            {token.symbol || "Token"} · {formattedBalance} (
                            {token.address.slice(0, 6)}…{token.address.slice(-4)})
                          </option>
                        );
                      })}
                    </select>
                  ) : (
                    <p className="rounded-lg border border-dashed border-neutral-700 bg-neutral-950 px-3 py-2 text-xs text-neutral-400">
                      Hold another ERC-20 (different from {token0Preview}) or paste an address above.
                    </p>
                  )}
                </div>
              </label>
            <button
              className="w-full rounded-full bg-fluent-blue px-4 py-2 text-sm text-white hover:bg-fluent-purple disabled:opacity-40"
              disabled={manualPairDisabled}
              onClick={() => {
                if (!manualToken0IsValid || !manualToken1IsValid) {
                  toast.error("Pick two tokens to continue");
                  return;
                }
                if (manualToken0.toLowerCase() === manualToken1.toLowerCase()) {
                  toast.error("Token addresses must differ");
                  return;
                }
                void (async () => {
                  const token0 = manualToken0 as Address;
                  const token1 = manualToken1 as Address;
                  const pair = await handleCreatePair(token0, token1, { silent: true });
                  if (pair && pair !== zeroAddress) {
                    setTokenIn(token0);
                    setTokenOut(token1);
                    setPairAddress(pair);
                    setActiveView("liquidity");
                    setLiquidityMode("add");
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
          </>
        )}
      </div>
    </div>
  );
};

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
          disabled={!isConnected || swapNeedsApproval || !pairAddress}
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
        From Token A
        <div className="mt-1 space-y-2">
          <input
            type="text"
            autoComplete="off"
            spellCheck={false}
            placeholder="0x…"
            value={tokenInEntry}
            onChange={(event) => {
              const next = event.target.value.trim();
              setTokenInEntry(next);
              if (next.length === 0) {
                setTokenIn(undefined);
                return;
              }
              if (isAddress(next)) {
                setTokenIn(next as Address);
              }
            }}
            className={`w-full rounded-lg bg-neutral-950 px-3 py-2 text-white outline-none ${
              tokenInEntryValid
                ? "border border-neutral-700 focus:border-fluent-purple"
                : "border border-red-500 focus:border-red-400"
            }`}
          />
          {!tokenInEntryValid && (
            <span className="block text-xs text-red-400">
              Enter a valid 0x token address or pick from the list.
            </span>
          )}
          <select
            className="w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-white outline-none focus:border-fluent-purple"
            value={tokenIn ?? ""}
            onChange={(event) => {
              const next = event.target.value;
              setTokenInEntry(next);
              setTokenIn(next ? (next as Address) : undefined);
            }}
          >
            <option value="" disabled>
              Select Token A
            </option>
            {tokenOptions.map((option) => (
              <option key={option.address} value={option.address}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <span className="mt-1 block text-xs text-neutral-500">
          Allowance: {formatBigNumber(tokenInState.allowance, tokenInState.decimals ?? 18)}
        </span>
      </label>
      <label className="text-sm text-neutral-300">
        To Token B
        <div className="mt-1 space-y-2">
          <input
            type="text"
            autoComplete="off"
            spellCheck={false}
            placeholder="0x…"
            value={tokenOutEntry}
            onChange={(event) => {
              const next = event.target.value.trim();
              setTokenOutEntry(next);
              if (next.length === 0) {
                setTokenOut(undefined);
                return;
              }
              if (isAddress(next)) {
                setTokenOut(next as Address);
              }
            }}
            className={`w-full rounded-lg bg-neutral-950 px-3 py-2 text-white outline-none ${
              tokenOutEntryValid
                ? "border border-neutral-700 focus:border-fluent-purple"
                : "border border-red-500 focus:border-red-400"
            }`}
          />
          {!tokenOutEntryValid && (
            <span className="block text-xs text-red-400">
              Enter a valid 0x token address or pick from the list.
            </span>
          )}
          <select
            className="w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-white outline-none focus:border-fluent-purple"
            value={tokenOut ?? ""}
            onChange={(event) => {
              const next = event.target.value;
              setTokenOutEntry(next);
              setTokenOut(next ? (next as Address) : undefined);
            }}
          >
            <option value="" disabled>
              Select Token B
            </option>
            {tokenOptions.map((option) => (
              <option key={option.address} value={option.address}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
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
      {!pairAddress && tokenIn && tokenOut && (
        <div className="md:col-span-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
          Please create a pool for this pair before swapping.
        </div>
      )}
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
