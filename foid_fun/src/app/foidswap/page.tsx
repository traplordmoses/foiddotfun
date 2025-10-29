"use client";

import { useAccount, useContractRead, useWaitForTransactionReceipt, useWriteContract, useSimulateContract } from "wagmi";
import { formatUnits, parseUnits, erc20Abi as viemErc20Abi } from "viem";
import { useMemo, useState } from "react";
import { WrappedFoid } from "@/lib/contracts";
import { routerAbi } from "@/lib/routerAbi";
import { NetworkGate } from "@/components/NetworkGate";
import { StatCard } from "@/components/StatCard";
import ParallaxTilt from "@/components/ParallaxTilt";

const ROUTER = (process.env.NEXT_PUBLIC_ROUTER || "").trim() as `0x${string}`;
const TOKEN_IN = WrappedFoid.address as `0x${string}`;

// TODO: set a real tokenOut you want to swap to (e.g., wFOID pair token)
const TOKEN_OUT = (process.env.NEXT_PUBLIC_TOKEN_OUT || TOKEN_IN) as `0x${string}`; // fallback to self
const ERC20_ABI = viemErc20Abi;

export default function FoidSwapPage() {
  const chainId = Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? "0");
  const { address } = useAccount();

  // Reads
  const { data: decimals } = useContractRead({
    address: TOKEN_IN,
    abi: ERC20_ABI,
    functionName: "decimals",
  });

  const decimalsNum = typeof decimals === "number" ? decimals : Number((decimals as any)?.toString() ?? 18);

  const { data: balance } = useContractRead({
    address: TOKEN_IN,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address, refetchInterval: 4000 },
  });

  const balanceFormatted = balance !== undefined ? formatUnits(balance as bigint, decimalsNum) : "0";

  // Allowance read
  const { data: allowance } = useContractRead({
    address: TOKEN_IN,
    abi: ERC20_ABI,
    functionName: "allowance",
    args: address ? [address, ROUTER] : undefined,
    query: { enabled: !!address && !!ROUTER, refetchInterval: 4000 },
  });

  // Local form state
  const [amountIn, setAmountIn] = useState<string>("");

  const amountInWei = useMemo(() => {
    try {
      return parseUnits(amountIn || "0", decimalsNum);
    } catch {
      return 0n;
    }
  }, [amountIn, decimalsNum]);

  const hasSufficientAllowance = useMemo(() => {
    if (!allowance) return false;
    try {
      return (allowance as bigint) >= amountInWei && amountInWei > 0n;
    } catch {
      return false;
    }
  }, [allowance, amountInWei]);

  // Approve
  const { writeContract: writeApprove, data: approveHash, isPending: approvePending, error: approveError } = useWriteContract();

  const onApprove = () => {
    if (!address) return;
    writeApprove({
      address: TOKEN_IN,
      abi: ERC20_ABI,
      functionName: "approve",
      args: [ROUTER, amountInWei],
    });
  };

  const { isLoading: approveLoading, isSuccess: approveSuccess } = useWaitForTransactionReceipt({
    hash: approveHash,
  });

  // Simulate & swap
  const { data: simSwap, error: simError } = useSimulateContract({
    address: ROUTER,
    abi: routerAbi,
    functionName: "swapExactTokensForTokens",
    args: [
      amountInWei,
      0n,               // amountOutMin (set slippage later)
      TOKEN_IN,
      TOKEN_OUT,
      address || "0x0000000000000000000000000000000000000000",
    ],
    query: { enabled: !!address && amountInWei > 0n && !!ROUTER },
  });

  const { writeContract: writeSwap, data: swapHash, isPending: swapPending, error: swapError } = useWriteContract();

  const onSwap = () => {
    if (!simSwap?.request) return;
    // use prepared request from simulate for the exact calldata/value
    writeSwap(simSwap.request);
  };

  const { isLoading: swapLoading, isSuccess: swapSuccess } = useWaitForTransactionReceipt({
    hash: swapHash,
  });

  return (
    <main className="space-y-6">
      <NetworkGate chainId={chainId}>
        <div className="p-4">
          <ParallaxTilt className="rounded-2xl">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <StatCard label="My Balance" value={`${balanceFormatted} wFOID`} />
              <StatCard label="Token Decimals" value={`${decimalsNum}`} />
              <StatCard label="Allowance OK?" value={String(hasSufficientAllowance)} />
            </div>
          </ParallaxTilt>
        </div>

        <div className="p-4">
          <div className="max-w-md space-y-3">
            <label className="block text-sm font-medium">Amount In (wFOID)</label>
            <input
              inputMode="decimal"
              placeholder="0.0"
              value={amountIn}
              onChange={(e) => setAmountIn(e.target.value)}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-900 p-3 outline-none"
            />

            {!hasSufficientAllowance ? (
              <button
                onClick={onApprove}
                disabled={approvePending || approveLoading || amountInWei === 0n}
                className="w-full rounded-xl bg-fuchsia-600 px-4 py-3 font-semibold hover:opacity-90 disabled:opacity-50"
              >
                {approvePending || approveLoading ? "Approving..." : "Approve wFOID"}
              </button>
            ) : (
              <button
                onClick={onSwap}
                disabled={swapPending || swapLoading || !simSwap}
                className="w-full rounded-xl bg-blue-600 px-4 py-3 font-semibold hover:opacity-90 disabled:opacity-50"
              >
                {swapPending || swapLoading ? "Swapping..." : "Swap"}
              </button>
            )}

            {/* Debug line to see simulation errors, remove later */}
            {simError && <p className="text-xs text-red-400">simulate error: {String(simError?.message || simError)}</p>}
            {swapError && <p className="text-xs text-red-400">swap error: {String(swapError?.message || swapError)}</p>}
            {approveError && <p className="text-xs text-red-400">approve error: {String(approveError?.message || approveError)}</p>}
            {approveSuccess && <p className="text-xs text-emerald-400">approve confirmed ✅</p>}
            {swapSuccess && <p className="text-xs text-emerald-400">swap confirmed ✅</p>}
          </div>
        </div>
      </NetworkGate>
    </main>
  );
}
