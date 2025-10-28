"use client";

import { useEffect, useState } from "react";
import {
  formatUnits,
  isAddress,
  parseUnits,
  zeroAddress,
  type Abi,
  type Address,
} from "viem";
import {
  useAccount,
  useContractRead,
  usePublicClient,
} from "wagmi";
import ParallaxTilt from "@/components/ParallaxTilt";
import { NetworkGate } from "@/components/NetworkGate";
import { StatCard } from "@/components/StatCard";
import { AmountInput } from "@/components/AmountInput";
import { TxButton } from "@/components/TxButton";
import {
  BLOCK_EXPLORER_URL,
  FLUENT_CHAIN_ID,
  SimpleSingleAMM,
  TOKEN0_ADDRESS,
  TOKEN0_METADATA,
  TOKEN1_ADDRESS,
  TOKEN1_METADATA,
} from "@/lib/contracts";
import { ShortAddress } from "@/components/ShortAddress";

const REFRESH_INTERVAL = 4000;
const FEE_NUM = 997n;
const FEE_DEN = 1000n;
const LP_DECIMALS = 18;
const MINIMUM_LIQUIDITY = 1000n;

const ERC20_MIN_ABI = [
  {
    type: "function",
    name: "symbol",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "string" }],
  },
  {
    type: "function",
    name: "decimals",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint8" }],
  },
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ type: "address" }],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "allowance",
    stateMutability: "view",
    inputs: [
      { type: "address" },
      { type: "address" },
    ],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { type: "address" },
      { type: "uint256" },
    ],
    outputs: [{ type: "bool" }],
  },
  {
    type: "function",
    name: "transfer",
    stateMutability: "nonpayable",
    inputs: [
      { type: "address" },
      { type: "uint256" },
    ],
    outputs: [{ type: "bool" }],
  },
  {
    type: "function",
    name: "transferFrom",
    stateMutability: "nonpayable",
    inputs: [
      { type: "address" },
      { type: "address" },
      { type: "uint256" },
    ],
    outputs: [{ type: "bool" }],
  },
] as const;

const AMM_EVENT_SET = new Set(["Sync", "Mint", "Burn", "Swap"]);

type AMMEventEntry = {
  id: string;
  name: string;
  args: Record<string, unknown>;
  blockNumber: bigint;
  logIndex: number;
};

const shortenAddress = (value?: string, chars = 4) => {
  if (!value) return "";
  return `${value.slice(0, 2 + chars)}…${value.slice(-chars)}`;
};

const toBigInt = (value: unknown): bigint | undefined => {
  if (typeof value === "bigint") return value;
  if (typeof value === "number") return BigInt(value);
  if (typeof value === "string" && value.length > 0) return BigInt(value);
  return undefined;
};

const parseAmount = (value: string, decimals: number): bigint | undefined => {
  if (!value) return undefined;
  try {
    const parsed = parseUnits(value, decimals);
    return parsed;
  } catch {
    return undefined;
  }
};

const formatAmount = (value: bigint | undefined, decimals: number, precision = 4) => {
  if (value === undefined) return "—";
  const formatted = formatUnits(value, decimals);
  if (formatted === "0") return "0";
  const [whole, fraction = ""] = formatted.split(".");
  const trimmedFraction = fraction.slice(0, precision).replace(/0+$/, "");
  return trimmedFraction ? `${whole}.${trimmedFraction}` : whole;
};

const sqrtBigInt = (value: bigint): bigint => {
  if (value <= 0n) return 0n;
  let z = value;
  let x = value / 2n + 1n;
  while (x < z) {
    z = x;
    x = (value / x + x) / 2n;
  }
  return z;
};

export default function AMMPage() {
  const chainId = FLUENT_CHAIN_ID;
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();

  const [swapAmountIn, setSwapAmountIn] = useState("");
  const [swapZeroForOne, setSwapZeroForOne] = useState(true);
  const [swapRecipient, setSwapRecipient] = useState("");

  const [depositAmount0, setDepositAmount0] = useState("");
  const [depositAmount1, setDepositAmount1] = useState("");
  const [token0Sent, setToken0Sent] = useState(false);
  const [token1Sent, setToken1Sent] = useState(false);
  const [withdrawShares, setWithdrawShares] = useState("");
  const [withdrawRecipient, setWithdrawRecipient] = useState("");

  const [events, setEvents] = useState<AMMEventEntry[] | null>(null);

  useEffect(() => {
    if (address && !swapRecipient) {
      setSwapRecipient(address);
    }
  }, [address, swapRecipient]);

  useEffect(() => {
    if (address && !withdrawRecipient) {
      setWithdrawRecipient(address);
    }
  }, [address, withdrawRecipient]);

  useEffect(() => setToken0Sent(false), [depositAmount0]);
  useEffect(() => setToken1Sent(false), [depositAmount1]);

  const {
    data: token0Data,
  } = useContractRead({
    ...SimpleSingleAMM,
    functionName: "token0",
  });
  const {
    data: token1Data,
  } = useContractRead({
    ...SimpleSingleAMM,
    functionName: "token1",
  });

  const {
    data: reservesData,
    refetch: refetchReserves,
  } = useContractRead({
    ...SimpleSingleAMM,
    functionName: "getReserves",
    query: { refetchInterval: REFRESH_INTERVAL },
  });

  const {
    data: totalSupplyData,
    refetch: refetchTotalSupply,
  } = useContractRead({
    ...SimpleSingleAMM,
    functionName: "totalSupply",
    query: { refetchInterval: REFRESH_INTERVAL },
  });

  const {
    data: lpBalanceData,
    refetch: refetchUserLpBalance,
  } = useContractRead({
    ...SimpleSingleAMM,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: {
      enabled: Boolean(address),
      refetchInterval: REFRESH_INTERVAL,
    },
  });

  const token0Address =
    ((token0Data ?? undefined) as Address | undefined) ??
    (TOKEN0_ADDRESS as Address | undefined);
  const token1Address =
    ((token1Data ?? undefined) as Address | undefined) ??
    (TOKEN1_ADDRESS as Address | undefined);

  const token0Name = TOKEN0_METADATA.name;
  const token1Name = TOKEN1_METADATA.name;
  const explorerAmmUrl = `${BLOCK_EXPLORER_URL}/address/${SimpleSingleAMM.address}`;
  const explorerToken0Url = token0Address
    ? `${BLOCK_EXPLORER_URL}/address/${token0Address}`
    : undefined;
  const explorerToken1Url = token1Address
    ? `${BLOCK_EXPLORER_URL}/address/${token1Address}`
    : undefined;

  const {
    data: token0SymbolData,
  } = useContractRead({
    address: token0Address ?? zeroAddress,
    abi: ERC20_MIN_ABI,
    functionName: "symbol",
    query: {
      enabled: Boolean(token0Address),
      refetchInterval: REFRESH_INTERVAL,
    },
  });

  const {
    data: token1SymbolData,
  } = useContractRead({
    address: token1Address ?? zeroAddress,
    abi: ERC20_MIN_ABI,
    functionName: "symbol",
    query: {
      enabled: Boolean(token1Address),
      refetchInterval: REFRESH_INTERVAL,
    },
  });

  const {
    data: token0DecimalsData,
  } = useContractRead({
    address: token0Address ?? zeroAddress,
    abi: ERC20_MIN_ABI,
    functionName: "decimals",
    query: {
      enabled: Boolean(token0Address),
      refetchInterval: REFRESH_INTERVAL,
    },
  });

  const {
    data: token1DecimalsData,
  } = useContractRead({
    address: token1Address ?? zeroAddress,
    abi: ERC20_MIN_ABI,
    functionName: "decimals",
    query: {
      enabled: Boolean(token1Address),
      refetchInterval: REFRESH_INTERVAL,
    },
  });

  const {
    data: userToken0BalanceData,
    refetch: refetchUserToken0Balance,
  } = useContractRead({
    address: token0Address ?? zeroAddress,
    abi: ERC20_MIN_ABI,
    functionName: "balanceOf",
    args: token0Address && address ? [address] : undefined,
    query: {
      enabled: Boolean(token0Address && address),
      refetchInterval: REFRESH_INTERVAL,
    },
  });

  const {
    data: userToken1BalanceData,
    refetch: refetchUserToken1Balance,
  } = useContractRead({
    address: token1Address ?? zeroAddress,
    abi: ERC20_MIN_ABI,
    functionName: "balanceOf",
    args: token1Address && address ? [address] : undefined,
    query: {
      enabled: Boolean(token1Address && address),
      refetchInterval: REFRESH_INTERVAL,
    },
  });

  const {
    data: allowance0Data,
    refetch: refetchAllowance0,
  } = useContractRead({
    address: token0Address ?? zeroAddress,
    abi: ERC20_MIN_ABI,
    functionName: "allowance",
    args: token0Address && address ? [address, SimpleSingleAMM.address] : undefined,
    query: {
      enabled: Boolean(token0Address && address),
      refetchInterval: REFRESH_INTERVAL,
    },
  });

  const {
    data: allowance1Data,
    refetch: refetchAllowance1,
  } = useContractRead({
    address: token1Address ?? zeroAddress,
    abi: ERC20_MIN_ABI,
    functionName: "allowance",
    args: token1Address && address ? [address, SimpleSingleAMM.address] : undefined,
    query: {
      enabled: Boolean(token1Address && address),
      refetchInterval: REFRESH_INTERVAL,
    },
  });

  const {
    data: poolToken0BalanceData,
    refetch: refetchPoolToken0Balance,
  } = useContractRead({
    address: token0Address ?? zeroAddress,
    abi: ERC20_MIN_ABI,
    functionName: "balanceOf",
    args: token0Address ? [SimpleSingleAMM.address] : undefined,
    query: {
      enabled: Boolean(token0Address),
      refetchInterval: REFRESH_INTERVAL,
    },
  });

  const {
    data: poolToken1BalanceData,
    refetch: refetchPoolToken1Balance,
  } = useContractRead({
    address: token1Address ?? zeroAddress,
    abi: ERC20_MIN_ABI,
    functionName: "balanceOf",
    args: token1Address ? [SimpleSingleAMM.address] : undefined,
    query: {
      enabled: Boolean(token1Address),
      refetchInterval: REFRESH_INTERVAL,
    },
  });

  const token0Symbol =
    typeof token0SymbolData === "string"
      ? token0SymbolData
      : TOKEN0_METADATA.symbol;
  const token1Symbol =
    typeof token1SymbolData === "string"
      ? token1SymbolData
      : TOKEN1_METADATA.symbol;
  const token0Decimals = token0DecimalsData !== undefined ? Number(token0DecimalsData) : 18;
  const token1Decimals = token1DecimalsData !== undefined ? Number(token1DecimalsData) : 18;

  const reserves = reservesData as readonly [bigint, bigint, bigint?] | undefined;
  const reserve0 = reserves ? reserves[0] : 0n;
  const reserve1 = reserves ? reserves[1] : 0n;
  const totalSupply = toBigInt(totalSupplyData) ?? 0n;
  const userLpBalance = toBigInt(lpBalanceData) ?? 0n;

  const userToken0Balance = toBigInt(userToken0BalanceData) ?? 0n;
  const userToken1Balance = toBigInt(userToken1BalanceData) ?? 0n;
  const allowance0 = toBigInt(allowance0Data) ?? 0n;
  const allowance1 = toBigInt(allowance1Data) ?? 0n;
  const poolToken0Balance = toBigInt(poolToken0BalanceData) ?? 0n;
  const poolToken1Balance = toBigInt(poolToken1BalanceData) ?? 0n;

  const inputSymbol = swapZeroForOne ? token0Symbol : token1Symbol;
  const outputSymbol = swapZeroForOne ? token1Symbol : token0Symbol;
  const inputDecimals = swapZeroForOne ? token0Decimals : token1Decimals;
  const outputDecimals = swapZeroForOne ? token1Decimals : token0Decimals;
  const inputAllowance = swapZeroForOne ? allowance0 : allowance1;
  const inputBalance = swapZeroForOne ? userToken0Balance : userToken1Balance;
  const reservesIn = swapZeroForOne ? reserve0 : reserve1;
  const reservesOut = swapZeroForOne ? reserve1 : reserve0;

  const swapAmountInValue = parseAmount(swapAmountIn, inputDecimals);
  const needsApproval =
    Boolean(swapAmountInValue && swapAmountInValue > inputAllowance);
  const hasBalanceForSwap =
    swapAmountInValue !== undefined ? swapAmountInValue <= inputBalance : true;

  const amountOutQuote =
    swapAmountInValue && swapAmountInValue > 0n && reservesIn > 0n && reservesOut > 0n
      ? (swapAmountInValue * FEE_NUM * reservesOut) /
        (reservesIn * FEE_DEN + swapAmountInValue * FEE_NUM)
      : undefined;

  const depositAmount0Value = parseAmount(depositAmount0, token0Decimals);
  const depositAmount1Value = parseAmount(depositAmount1, token1Decimals);
  const pendingToken0 =
    poolToken0Balance > reserve0 ? poolToken0Balance - reserve0 : 0n;
  const pendingToken1 =
    poolToken1Balance > reserve1 ? poolToken1Balance - reserve1 : 0n;
  const token0Ready = token0Sent || pendingToken0 > 0n;
  const token1Ready = token1Sent || pendingToken1 > 0n;
  const canSendToken0 =
    Boolean(
      isConnected &&
        token0Address &&
        depositAmount0Value &&
        depositAmount0Value > 0n &&
        depositAmount0Value <= userToken0Balance,
    );
  const canSendToken1 =
    Boolean(
      isConnected &&
        token1Address &&
        depositAmount1Value &&
        depositAmount1Value > 0n &&
        depositAmount1Value <= userToken1Balance,
    );
  const estimatedShares = (() => {
    if (pendingToken0 <= 0n || pendingToken1 <= 0n) return 0n;
    if (totalSupply === 0n) {
      const root = sqrtBigInt(pendingToken0 * pendingToken1);
      return root > MINIMUM_LIQUIDITY ? root - MINIMUM_LIQUIDITY : 0n;
    }
    const share0 = reserve0 > 0n ? (pendingToken0 * totalSupply) / reserve0 : 0n;
    const share1 = reserve1 > 0n ? (pendingToken1 * totalSupply) / reserve1 : 0n;
    return share0 < share1 ? share0 : share1;
  })();

  const canDeposit = Boolean(isConnected && token0Ready && token1Ready);

  const withdrawSharesValue = parseAmount(withdrawShares, LP_DECIMALS);
  const canWithdraw =
    Boolean(
      isConnected &&
        withdrawSharesValue &&
        withdrawSharesValue > 0n &&
        withdrawSharesValue <= userLpBalance &&
        withdrawRecipient &&
        isAddress(withdrawRecipient),
    );

  const withdrawPreview0 =
    withdrawSharesValue && totalSupply > 0n
      ? (withdrawSharesValue * poolToken0Balance) / totalSupply
      : undefined;
  const withdrawPreview1 =
    withdrawSharesValue && totalSupply > 0n
      ? (withdrawSharesValue * poolToken1Balance) / totalSupply
      : undefined;

  useEffect(() => {
    if (!publicClient) return;
    let mounted = true;

    const fetchEvents = async () => {
      try {
        const latest = await publicClient.getBlockNumber();
        const windowSize = 4000n;
        const fromBlock = latest > windowSize ? latest - windowSize : 0n;
        const logs = await publicClient.getContractEvents({
          address: SimpleSingleAMM.address as Address,
          abi: SimpleSingleAMM.abi as Abi,
          fromBlock,
          toBlock: latest,
        });
        const filtered = logs.filter((log) => AMM_EVENT_SET.has(log.eventName ?? ""));
        const decoded: AMMEventEntry[] = filtered
          .map((log) => {
            const blockNumber = log.blockNumber ?? 0n;
            const logIndex = log.logIndex ?? 0;
            return {
              id: `${blockNumber.toString()}-${logIndex}`,
              name: log.eventName ?? "Event",
              args: (log.args ?? {}) as Record<string, unknown>,
              blockNumber,
              logIndex,
            };
          })
          .sort((a, b) => {
            if (a.blockNumber === b.blockNumber) {
              return b.logIndex - a.logIndex;
            }
            return b.blockNumber > a.blockNumber ? 1 : -1;
          });
        if (mounted) setEvents(decoded.slice(0, 30));
      } catch {
        if (mounted) setEvents([]);
      }
    };

    fetchEvents();
    const interval = setInterval(fetchEvents, REFRESH_INTERVAL);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [publicClient]);

  const renderEventLine = (entry: AMMEventEntry) => {
    const name = entry.name;

    if (name === "Swap") {
      const amountIn = toBigInt(entry.args.amountIn) ?? 0n;
      const amountOut = toBigInt(entry.args.amountOut) ?? 0n;
      const zeroForOne = Boolean(entry.args.zeroForOne);
      const sender = entry.args.sender as string | undefined;
      const to = entry.args.to as string | undefined;
      const inSymbol = zeroForOne ? token0Symbol : token1Symbol;
      const outSymbol = zeroForOne ? token1Symbol : token0Symbol;
      const inDecimals = zeroForOne ? token0Decimals : token1Decimals;
      const outDecimals = zeroForOne ? token1Decimals : token0Decimals;
      return (
        <div key={entry.id} className="text-sm">
          <div className="font-mono text-fluent-pink">Swap</div>
          <div className="text-neutral-300">
            {formatAmount(amountIn, inDecimals)} {inSymbol} → {formatAmount(amountOut, outDecimals)} {outSymbol}
          </div>
          <div className="text-xs text-neutral-500">
            from {shortenAddress(sender)} to {shortenAddress(to)} · blk {entry.blockNumber.toString()}
          </div>
        </div>
      );
    }

    if (name === "Mint") {
      const sender = entry.args.sender as string | undefined;
      const amount0 = toBigInt(entry.args.amount0) ?? 0n;
      const amount1 = toBigInt(entry.args.amount1) ?? 0n;
      return (
        <div key={entry.id} className="text-sm">
          <div className="font-mono text-fluent-pink">Mint</div>
          <div className="text-neutral-300">
            {formatAmount(amount0, token0Decimals)} {token0Symbol} · {formatAmount(amount1, token1Decimals)} {token1Symbol}
          </div>
          <div className="text-xs text-neutral-500">
            by {shortenAddress(sender)} · blk {entry.blockNumber.toString()}
          </div>
        </div>
      );
    }

    if (name === "Burn") {
      const sender = entry.args.sender as string | undefined;
      const to = entry.args.to as string | undefined;
      const amount0 = toBigInt(entry.args.amount0) ?? 0n;
      const amount1 = toBigInt(entry.args.amount1) ?? 0n;
      return (
        <div key={entry.id} className="text-sm">
          <div className="font-mono text-fluent-pink">Burn</div>
          <div className="text-neutral-300">
            {formatAmount(amount0, token0Decimals)} {token0Symbol} · {formatAmount(amount1, token1Decimals)} {token1Symbol}
          </div>
          <div className="text-xs text-neutral-500">
            sender {shortenAddress(sender)} → {shortenAddress(to)} · blk {entry.blockNumber.toString()}
          </div>
        </div>
      );
    }

    if (name === "Sync") {
      const args = entry.args as Record<string, unknown>;
      const reserve0Event =
        toBigInt(args["reserve0"]) ?? toBigInt(args["0"]) ?? 0n;
      const reserve1Event =
        toBigInt(args["reserve1"]) ?? toBigInt(args["1"]) ?? 0n;
      return (
        <div key={entry.id} className="text-sm">
          <div className="font-mono text-fluent-pink">Sync</div>
          <div className="text-neutral-300">
            {formatAmount(reserve0Event, token0Decimals)} {token0Symbol} · {formatAmount(reserve1Event, token1Decimals)} {token1Symbol}
          </div>
          <div className="text-xs text-neutral-500">blk {entry.blockNumber.toString()}</div>
        </div>
      );
    }

    return (
      <div key={entry.id} className="text-sm">
        <div className="font-mono text-fluent-pink">{name}</div>
        <div className="text-neutral-400 text-xs">{JSON.stringify(entry.args)}</div>
      </div>
    );
  };

  const swapRecipientValid = swapRecipient ? isAddress(swapRecipient) : false;
  const withdrawRecipientValid = withdrawRecipient ? isAddress(withdrawRecipient) : false;

  const swapInsufficientBalance =
    Boolean(
      swapAmountInValue &&
        inputBalance !== undefined &&
        swapAmountInValue > inputBalance,
    );

  const handleAfterTransfer0 = () => {
    setToken0Sent(true);
    refetchUserToken0Balance();
    refetchPoolToken0Balance();
  };

  const handleAfterTransfer1 = () => {
    setToken1Sent(true);
    refetchUserToken1Balance();
    refetchPoolToken1Balance();
  };

  const handleAfterDeposit = () => {
    setDepositAmount0("");
    setDepositAmount1("");
    setToken0Sent(false);
    setToken1Sent(false);
    refetchReserves();
    refetchTotalSupply();
    refetchUserLpBalance();
    refetchPoolToken0Balance();
    refetchPoolToken1Balance();
  };

  const handleAfterSwap = () => {
    setSwapAmountIn("");
    refetchReserves();
    refetchUserToken0Balance();
    refetchUserToken1Balance();
    if (swapZeroForOne) {
      refetchAllowance0();
    } else {
      refetchAllowance1();
    }
  };

  const handleAfterWithdraw = () => {
    setWithdrawShares("");
    refetchReserves();
    refetchTotalSupply();
    refetchUserLpBalance();
    refetchUserToken0Balance();
    refetchUserToken1Balance();
    refetchPoolToken0Balance();
    refetchPoolToken1Balance();
  };

  const overviewReserve0 = `${formatAmount(reserve0, token0Decimals)} ${token0Symbol}`;
  const overviewReserve1 = `${formatAmount(reserve1, token1Decimals)} ${token1Symbol}`;
  const overviewSupply = `${formatAmount(totalSupply, LP_DECIMALS)} LP`;

  return (
    <main className="space-y-6">
      <NetworkGate chainId={chainId}>
        <div className="space-y-6 p-4">
          <ParallaxTilt className="card p-4 space-y-4">
            <h2 className="font-mono uppercase text-fluent-pink text-sm">Pool Overview</h2>
            <div className="text-xs text-neutral-400 flex flex-col md:flex-row md:items-center md:justify-between gap-2">
              <span>
                AMM:{" "}
                <a
                  href={explorerAmmUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline decoration-dotted"
                >
                  <ShortAddress address={SimpleSingleAMM.address} />
                </a>
              </span>
              <span className="flex flex-col md:flex-row md:items-center gap-2">
                <span>
                  {token0Name} (
                  <a
                    href={explorerToken0Url ?? "#"}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline decoration-dotted"
                  >
                    {token0Symbol}
                  </a>
                  )
                </span>
                <span className="hidden md:inline">·</span>
                <span>
                  {token1Name} (
                  <a
                    href={explorerToken1Url ?? "#"}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline decoration-dotted"
                  >
                    {token1Symbol}
                  </a>
                  )
                </span>
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <StatCard label={`Reserve ${token0Symbol}`} value={overviewReserve0} />
              <StatCard label={`Reserve ${token1Symbol}`} value={overviewReserve1} />
              <StatCard label="LP Total Supply" value={overviewSupply} />
            </div>
          </ParallaxTilt>

          <section className="card p-4 space-y-4">
            <h2 className="font-mono uppercase text-fluent-pink text-sm">Swap</h2>
            <div className="flex items-center justify-between">
              <span className="text-sm text-neutral-400">Direction</span>
              <button
                type="button"
                onClick={() => setSwapZeroForOne((prev) => !prev)}
                className="px-3 py-1 rounded-full bg-neutral-800 hover:bg-neutral-700 transition"
              >
                {swapZeroForOne ? `${token0Symbol} → ${token1Symbol}` : `${token1Symbol} → ${token0Symbol}`}
              </button>
            </div>
            <AmountInput
              value={swapAmountIn}
              onChange={setSwapAmountIn}
              placeholder={`Amount ${inputSymbol}`}
              max={formatAmount(inputBalance, inputDecimals)}
            />
            <input
              className="w-full p-2 rounded-lg bg-neutral-800 text-sm"
              placeholder="Recipient address"
              value={swapRecipient}
              onChange={(e) => setSwapRecipient(e.target.value)}
            />
            <div className="text-xs text-neutral-400">
              Balance: {formatAmount(inputBalance, inputDecimals)} {inputSymbol}
            </div>
            <div className="text-xs text-neutral-400">
              Allowance: {formatAmount(inputAllowance, inputDecimals)} {inputSymbol}
            </div>
            {swapInsufficientBalance && (
              <div className="text-xs text-red-400">Insufficient balance</div>
            )}
            {!swapRecipientValid && swapRecipient && (
              <div className="text-xs text-red-400">Recipient is not a valid address</div>
            )}
            <div className="text-sm text-neutral-200">
              Quote:{" "}
              {amountOutQuote !== undefined
                ? `${formatAmount(amountOutQuote, outputDecimals)} ${outputSymbol}`
                : "—"}
            </div>
            <div className="flex flex-wrap gap-3">
              {needsApproval && token0Address && token1Address && (
                <TxButton
                  contract={{
                    address: (swapZeroForOne ? token0Address : token1Address) as `0x${string}`,
                    abi: ERC20_MIN_ABI,
                  }}
                  functionName="approve"
                  args={[
                    SimpleSingleAMM.address,
                    swapAmountInValue ?? 0n,
                  ]}
                  enabled={
                    Boolean(
                      isConnected &&
                        swapAmountInValue &&
                        swapAmountInValue > 0n &&
                        swapRecipientValid &&
                        !(swapInsufficientBalance),
                    )
                  }
                  onSuccess={() => {
                    if (swapZeroForOne) {
                      refetchAllowance0();
                    } else {
                      refetchAllowance1();
                    }
                  }}
                >
                  Approve {inputSymbol}
                </TxButton>
              )}
              <TxButton
                contract={SimpleSingleAMM}
                functionName="swap"
                args={[
                  swapAmountInValue ?? 0n,
                  swapZeroForOne,
                  swapRecipientValid ? (swapRecipient as Address) : zeroAddress,
                ]}
                enabled={
                  Boolean(
                    isConnected &&
                      swapAmountInValue &&
                      swapAmountInValue > 0n &&
                      swapRecipientValid &&
                      !needsApproval &&
                      hasBalanceForSwap,
                  )
                }
                onSuccess={handleAfterSwap}
              >
                Swap
              </TxButton>
            </div>
          </section>

          <section className="card p-4 space-y-4">
            <h2 className="font-mono uppercase text-fluent-pink text-sm">Deposit</h2>
            <div className="space-y-3">
              <div>
                <label className="text-xs uppercase font-mono text-neutral-400 mb-1 block">
                  Send {token0Symbol}
                </label>
                <AmountInput
                  value={depositAmount0}
                  onChange={setDepositAmount0}
                  placeholder={`Amount ${token0Symbol}`}
                  max={formatAmount(userToken0Balance, token0Decimals)}
                />
                <div className="text-xs text-neutral-400 mt-1">
                  Balance: {formatAmount(userToken0Balance, token0Decimals)} {token0Symbol}
                </div>
                {depositAmount0Value && depositAmount0Value > userToken0Balance && (
                  <div className="text-xs text-red-400">Insufficient balance</div>
                )}
                <TxButton
                  contract={{
                    address: (token0Address ?? zeroAddress) as `0x${string}`,
                    abi: ERC20_MIN_ABI,
                  }}
                  functionName="transfer"
                  args={[
                    SimpleSingleAMM.address,
                    depositAmount0Value ?? 0n,
                  ]}
                  enabled={canSendToken0}
                  onSuccess={handleAfterTransfer0}
                >
                  Send {token0Symbol} to pool
                </TxButton>
                <div
                  className={`text-xs mt-1 ${token0Ready ? "text-fluent-blue" : "text-neutral-500"}`}
                >
                  {token0Ready
                    ? pendingToken0 > 0n
                      ? `Ready in pool: ${formatAmount(pendingToken0, token0Decimals)} ${token0Symbol}`
                      : "Transfer sent… waiting for index"
                    : "Awaiting transfer"}
                </div>
              </div>

              <div>
                <label className="text-xs uppercase font-mono text-neutral-400 mb-1 block">
                  Send {token1Symbol}
                </label>
                <AmountInput
                  value={depositAmount1}
                  onChange={setDepositAmount1}
                  placeholder={`Amount ${token1Symbol}`}
                  max={formatAmount(userToken1Balance, token1Decimals)}
                />
                <div className="text-xs text-neutral-400 mt-1">
                  Balance: {formatAmount(userToken1Balance, token1Decimals)} {token1Symbol}
                </div>
                {depositAmount1Value && depositAmount1Value > userToken1Balance && (
                  <div className="text-xs text-red-400">Insufficient balance</div>
                )}
                <TxButton
                  contract={{
                    address: (token1Address ?? zeroAddress) as `0x${string}`,
                    abi: ERC20_MIN_ABI,
                  }}
                  functionName="transfer"
                  args={[
                    SimpleSingleAMM.address,
                    depositAmount1Value ?? 0n,
                  ]}
                  enabled={canSendToken1}
                  onSuccess={handleAfterTransfer1}
                >
                  Send {token1Symbol} to pool
                </TxButton>
                <div
                  className={`text-xs mt-1 ${token1Ready ? "text-fluent-blue" : "text-neutral-500"}`}
                >
                  {token1Ready
                    ? pendingToken1 > 0n
                      ? `Ready in pool: ${formatAmount(pendingToken1, token1Decimals)} ${token1Symbol}`
                      : "Transfer sent… waiting for index"
                    : "Awaiting transfer"}
                </div>
              </div>
            </div>

            <TxButton
              contract={SimpleSingleAMM}
              functionName="deposit"
              onSuccess={handleAfterDeposit}
            >
              Deposit (Mint LP)
            </TxButton>
            <div className="text-xs text-neutral-400">
              Pending amounts: {formatAmount(pendingToken0, token0Decimals)} {token0Symbol} ·{" "}
              {formatAmount(pendingToken1, token1Decimals)} {token1Symbol}
            </div>
            {estimatedShares > 0n ? (
              <div className="text-xs text-fluent-blue">
                Estimated LP to mint: {formatAmount(estimatedShares, LP_DECIMALS)} LP
              </div>
            ) : (
              token0Ready &&
              token1Ready && (
                <div className="text-xs text-red-400">
                  Deposit too small to mint LP. Add more tokens or match pool ratio.
                </div>
              )
            )}
          </section>

          <section className="card p-4 space-y-4">
            <h2 className="font-mono uppercase text-fluent-pink text-sm">Withdraw</h2>
            <AmountInput
              value={withdrawShares}
              onChange={setWithdrawShares}
              placeholder="LP shares"
              max={formatAmount(userLpBalance, LP_DECIMALS)}
            />
            <div className="text-xs text-neutral-400">
              Your LP balance: {formatAmount(userLpBalance, LP_DECIMALS)} LP
            </div>
            {withdrawSharesValue && withdrawSharesValue > userLpBalance && (
              <div className="text-xs text-red-400">Insufficient LP balance</div>
            )}
            <input
              className="w-full p-2 rounded-lg bg-neutral-800 text-sm"
              placeholder="Recipient address"
              value={withdrawRecipient}
              onChange={(e) => setWithdrawRecipient(e.target.value)}
            />
            {!withdrawRecipientValid && withdrawRecipient && (
              <div className="text-xs text-red-400">Recipient is not a valid address</div>
            )}
            <div className="text-sm text-neutral-200">
              Estimated: {withdrawPreview0 !== undefined ? `${formatAmount(withdrawPreview0, token0Decimals)} ${token0Symbol}` : "—"}{" "}
              & {withdrawPreview1 !== undefined ? `${formatAmount(withdrawPreview1, token1Decimals)} ${token1Symbol}` : "—"}
            </div>
            <TxButton
              contract={SimpleSingleAMM}
              functionName="withdraw"
              args={[
                withdrawSharesValue ?? 0n,
                withdrawRecipientValid ? (withdrawRecipient as Address) : zeroAddress,
              ]}
              enabled={canWithdraw}
              onSuccess={handleAfterWithdraw}
            >
              Withdraw
            </TxButton>
          </section>

          <section className="card p-4 space-y-3">
            <h2 className="font-mono uppercase text-fluent-pink text-sm">Events</h2>
            {events === null && <div className="text-sm text-neutral-400">Loading events…</div>}
            {events !== null && events.length === 0 && (
              <div className="text-sm text-neutral-400">No recent events.</div>
            )}
            {events && events.length > 0 && <div className="space-y-3">{events.map(renderEventLine)}</div>}
          </section>
        </div>
      </NetworkGate>
    </main>
  );
}
