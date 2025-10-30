"use client";

import { useMemo, useState } from "react";
import { useAccount, useBalance, useContractRead } from "wagmi";
import { formatEther, formatUnits, parseEther, parseUnits } from "viem";
import { NetworkGate } from "@/components/NetworkGate";
import { StatCard } from "@/components/StatCard";
import { TxButton } from "@/components/TxButton";
import { FLUENT_CHAIN_ID, WETH9Contract } from "@/lib/contracts";

const FALLBACK_DECIMALS = 18;

const formatWithUnits = (value: bigint | undefined, decimals: number, fraction = 6) => {
  if (value === undefined) return "0";
  try {
    const formatted = Number.parseFloat(formatUnits(value, decimals));
    if (!Number.isFinite(formatted)) {
      return formatUnits(value, decimals);
    }
    return formatted.toLocaleString(undefined, { maximumFractionDigits: fraction });
  } catch {
    return formatUnits(value, decimals);
  }
};

export default function WrapPage() {
  const { address } = useAccount();
  const [wrapAmount, setWrapAmount] = useState("");
  const [unwrapAmount, setUnwrapAmount] = useState("");

  const { data: ethBalance } = useBalance({
    address,
    query: {
      enabled: Boolean(address),
      refetchInterval: 4000,
    },
  });

  const { data: wethBalance } = useContractRead({
    ...WETH9Contract,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: {
      enabled: Boolean(address),
      refetchInterval: 4000,
    },
  });

  const { data: decimalsData } = useContractRead({
    ...WETH9Contract,
    functionName: "decimals",
  });

  const { data: symbolData } = useContractRead({
    ...WETH9Contract,
    functionName: "symbol",
  });

  const { data: totalSupplyData } = useContractRead({
    ...WETH9Contract,
    functionName: "totalSupply",
    query: { refetchInterval: 6000 },
  });

  const decimals =
    typeof decimalsData === "number"
      ? decimalsData
      : Number((decimalsData as any)?.toString?.() ?? FALLBACK_DECIMALS);
  const symbol = typeof symbolData === "string" && symbolData.length > 0 ? symbolData : "WETH";

  const wethBalanceBigInt = wethBalance as bigint | undefined;
  const totalSupplyBigInt = totalSupplyData as bigint | undefined;

  const ethBalanceDisplay =
    ethBalance?.value !== undefined
      ? (() => {
          try {
            const formatted = Number.parseFloat(formatEther(ethBalance.value));
            if (!Number.isFinite(formatted)) {
              return formatEther(ethBalance.value);
            }
            return formatted.toLocaleString(undefined, { maximumFractionDigits: 6 });
          } catch {
            return formatEther(ethBalance.value);
          }
        })()
      : "0";

  const wethBalanceDisplay = formatWithUnits(wethBalanceBigInt, decimals);
  const totalSupplyDisplay = formatWithUnits(totalSupplyBigInt, decimals, 2);

  const wrapValue = useMemo(() => {
    if (!wrapAmount) return null;
    try {
      const parsed = parseEther(wrapAmount);
      return parsed > 0n ? parsed : null;
    } catch {
      return null;
    }
  }, [wrapAmount]);

  const unwrapValue = useMemo(() => {
    if (!unwrapAmount) return null;
    try {
      const parsed = parseUnits(unwrapAmount, decimals);
      return parsed > 0n ? parsed : null;
    } catch {
      return null;
    }
  }, [decimals, unwrapAmount]);

  const hasEnoughEth =
    wrapValue !== null && ethBalance?.value !== undefined
      ? wrapValue <= ethBalance.value
      : true;
  const hasEnoughWeth =
    unwrapValue !== null && wethBalanceBigInt !== undefined
      ? unwrapValue <= wethBalanceBigInt
      : true;

  const canWrap = Boolean(address && wrapValue && wrapValue > 0n && hasEnoughEth);
  const canUnwrap = Boolean(address && unwrapValue && unwrapValue > 0n && hasEnoughWeth);

  return (
    <main className="space-y-8 py-8">
      <NetworkGate chainId={FLUENT_CHAIN_ID}>
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <StatCard label="ETH balance" value={`${ethBalanceDisplay} ETH`} />
          <StatCard label={`${symbol} balance`} value={`${wethBalanceDisplay} ${symbol}`} />
          <StatCard label={`${symbol} supply`} value={`${totalSupplyDisplay} ${symbol}`} />
        </section>

        <div className="grid gap-6 lg:grid-cols-2">
          <section className="card space-y-5">
            <header className="space-y-1">
              <h2 className="text-lg font-semibold text-white">Wrap ETH</h2>
              <p className="text-sm text-neutral-400">
                Deposit native ETH into the canonical {symbol} contract. Leave a little ETH for gas.
              </p>
            </header>
            <label className="text-sm text-neutral-300">
              <span className="mb-1 block font-medium text-neutral-200">Amount (ETH)</span>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="0.0"
                  value={wrapAmount}
                  onChange={(event) => setWrapAmount(event.target.value)}
                  className="flex-1 rounded-lg border border-neutral-700/80 bg-neutral-950/70 px-3 py-2 text-white outline-none transition focus:border-fluent-purple"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (!ethBalance?.value) return;
                    setWrapAmount(formatEther(ethBalance.value));
                  }}
                  className="rounded-lg border border-neutral-700/80 px-3 py-2 text-xs font-semibold text-neutral-300 transition hover:border-neutral-600 hover:text-white"
                >
                  Max
                </button>
              </div>
              <span className="mt-1 block text-xs text-neutral-500">
                Available: {ethBalanceDisplay} ETH
              </span>
            </label>
            {!hasEnoughEth && (
              <p className="text-xs text-amber-300">
                Not enough ETH to cover this wrap amount (and gas). Adjust the value or choose Max.
              </p>
            )}
            <TxButton
              contract={WETH9Contract}
              functionName="deposit"
              args={[]}
              value={wrapValue ?? undefined}
              enabled={canWrap}
              onSuccess={() => setWrapAmount("")}
            >
              Wrap ETH
            </TxButton>
          </section>

          <section className="card space-y-5">
            <header className="space-y-1">
              <h2 className="text-lg font-semibold text-white">Unwrap {symbol}</h2>
              <p className="text-sm text-neutral-400">
                Withdraw {symbol} back into native ETH. The unwrapped ETH returns to your wallet.
              </p>
            </header>
            <label className="text-sm text-neutral-300">
              <span className="mb-1 block font-medium text-neutral-200">
                Amount ({symbol})
              </span>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="0.0"
                  value={unwrapAmount}
                  onChange={(event) => setUnwrapAmount(event.target.value)}
                  className="flex-1 rounded-lg border border-neutral-700/80 bg-neutral-950/70 px-3 py-2 text-white outline-none transition focus:border-fluent-purple"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (!wethBalanceBigInt) return;
                    setUnwrapAmount(formatUnits(wethBalanceBigInt, decimals));
                  }}
                  className="rounded-lg border border-neutral-700/80 px-3 py-2 text-xs font-semibold text-neutral-300 transition hover:border-neutral-600 hover:text-white"
                >
                  Max
                </button>
              </div>
              <span className="mt-1 block text-xs text-neutral-500">
                Available: {wethBalanceDisplay} {symbol}
              </span>
            </label>
            {!hasEnoughWeth && (
              <p className="text-xs text-amber-300">
                You do not have enough {symbol} to unwrap this amount.
              </p>
            )}
            <TxButton
              contract={WETH9Contract}
              functionName="withdraw"
              args={[unwrapValue ?? 0n]}
              enabled={canUnwrap}
              onSuccess={() => setUnwrapAmount("")}
            >
              Unwrap to ETH
            </TxButton>
          </section>
        </div>
      </NetworkGate>
    </main>
  );
}
