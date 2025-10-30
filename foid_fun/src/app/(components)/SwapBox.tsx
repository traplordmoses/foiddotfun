"use client";

import { motion } from "framer-motion";
import { useCallback, useMemo, useState } from "react";
import { useAccount, useChainId, useSwitchChain } from "wagmi";
import { toast } from "react-hot-toast";
import { Stamp } from "./Stamp";
import { BLOCK_EXPLORER_URL } from "@/lib/contracts";

const FLUENT_CHAIN_ID = 20994;
const FLUENT_CHAIN_NAME = "Fluent Testnet";
const RPC_URL = "https://rpc.testnet.fluent.xyz";

interface QuoteHop {
  from: string;
  to: string;
  feeBps: number;
}

interface RouteQuote {
  path: string[];
  hops: QuoteHop[];
  amountIn: string;
  amountOut: string;
  minReceived: string;
  slippage: string;
  deadlineMinutes: number;
}

function useNetworkGate(expectedChainId: number) {
  const { chain, isConnected } = useAccount();
  const connectedChainId = useChainId();
  const { switchChainAsync } = useSwitchChain();
  const [isSwitching, setIsSwitching] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);

  const currentChainId = useMemo<number | undefined>(() => {
    if (chain?.id) return chain.id;
    if (connectedChainId && connectedChainId > 0) return connectedChainId;
    return undefined;
  }, [chain?.id, connectedChainId]);

  const needsNetwork = Boolean(
    isConnected && currentChainId !== undefined && currentChainId !== expectedChainId,
  );

  const addNetwork = useCallback(async () => {
    if (typeof window === "undefined") return;
    const ethereum = (window as typeof window & { ethereum?: any }).ethereum;
    if (!ethereum) {
      setLastError("No injected wallet detected.");
      return;
    }

    setIsSwitching(true);
    setLastError(null);
    try {
      await ethereum.request({
        method: "wallet_addEthereumChain",
        params: [
          {
            chainId: `0x${expectedChainId.toString(16)}`,
            chainName: FLUENT_CHAIN_NAME,
            rpcUrls: [RPC_URL],
            blockExplorerUrls: [BLOCK_EXPLORER_URL],
            nativeCurrency: { name: "Ethereum", symbol: "ETH", decimals: 18 },
          },
        ],
      });
      toast.success("Fluent Testnet added.");
    } catch (error: any) {
      setLastError(error?.message ?? "Add network was cancelled.");
    } finally {
      setIsSwitching(false);
    }
  }, [expectedChainId]);

  const switchNetwork = useCallback(async () => {
    if (!switchChainAsync) return;
    setIsSwitching(true);
    setLastError(null);
    try {
      await switchChainAsync({ chainId: expectedChainId });
      toast.success("Switched to Fluent Testnet.");
    } catch (error: any) {
      setLastError(error?.message ?? "Switch rejected.");
    } finally {
      setIsSwitching(false);
    }
  }, [expectedChainId, switchChainAsync]);

  return {
    needsNetwork,
    currentChainId,
    isSwitching,
    lastError,
    addNetwork,
    switchNetwork,
  };
}

function useRouteQuote(_from: string, _to: string, _amountIn: string): RouteQuote {
  // TODO: wire viem reads and router getAmountsOut.
  return useMemo<RouteQuote>(
    () => ({
      path: [_from || "A", "wFOID", _to || "B"],
      hops: [
        { from: _from || "A", to: "wFOID", feeBps: 30 },
        { from: "wFOID", to: _to || "B", feeBps: 30 },
      ],
      amountIn: _amountIn || "0.00",
      amountOut: _amountIn ? "0.98" : "0.00",
      minReceived: _amountIn ? "0.96" : "0.00",
      slippage: "0.5%",
      deadlineMinutes: 15,
    }),
    [_amountIn, _from, _to],
  );
}

export function SwapBox() {
  const { isConnected } = useAccount();
  const [fromToken, setFromToken] = useState("A");
  const [toToken, setToToken] = useState("B");
  const [amountIn, setAmountIn] = useState("");
  const [memo, setMemo] = useState("");
  const [pasteValue, setPasteValue] = useState("");
  const [isPasting, setIsPasting] = useState(false);

  const quote = useRouteQuote(fromToken, toToken, amountIn);
  const {
    needsNetwork,
    currentChainId,
    isSwitching,
    lastError,
    addNetwork,
    switchNetwork,
  } = useNetworkGate(FLUENT_CHAIN_ID);

  const amplitude = 1.1;

  const handlePaste = useCallback(async () => {
    if (typeof navigator === "undefined" || !navigator.clipboard) return;
    try {
      setIsPasting(true);
      const text = await navigator.clipboard.readText();
      setPasteValue(text);
      setFromToken(text);
      toast.success("Token address pasted.");
    } catch (error: any) {
      toast.error(error?.message ?? "Unable to read clipboard.");
    } finally {
      setIsPasting(false);
    }
  }, []);

  const canSubmit = isConnected && !needsNetwork && Number(amountIn) > 0;

  return (
    <motion.section
      id="swap"
      className="relative overflow-hidden rounded-2xl border border-emerald-500/30 bg-black/60 text-emerald-200 shadow-[0_0_50px_rgba(23,255,170,0.08)]"
      initial={false}
      animate={{
        rotateZ: [0, amplitude, -amplitude, 0],
        x: [-amplitude * 2, amplitude * 2, 0],
      }}
      transition={{
        duration: 6,
        repeat: Infinity,
        repeatType: "mirror",
      }}
    >
      <div
        className="pointer-events-none absolute inset-0 moire mix-blend-screen"
        style={{ opacity: 0.16 }}
      />
      <div
        className="pointer-events-none absolute inset-0 scanlines"
        style={{ opacity: 0.12 }}
      />
      <div className="pointer-events-none absolute inset-0 vignette" />
      <div className="relative space-y-6 p-6 font-mono text-sm">
        <div className="flex flex-col gap-2 text-emerald-400/90 sm:flex-row sm:items-center sm:justify-between">
          <span className="tracking-[0.4em] text-xs uppercase">
            scanned terminal interface
          </span>
          <span className="text-xs text-emerald-500/80">
            fluent testnet · chain {FLUENT_CHAIN_ID}
          </span>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-3 rounded-lg border border-emerald-500/30 bg-black/60 p-4 shadow-inner">
            <label className="text-xs uppercase tracking-widest text-emerald-500/90">
              token selector—from
            </label>
            <input
              value={fromToken}
              onChange={(event) => setFromToken(event.target.value)}
              placeholder="Search symbol or paste address"
              className="w-full border border-emerald-500/30 bg-black/80 px-3 py-2 text-emerald-100 placeholder:text-emerald-500/40 focus:outline-none focus:ring-2 focus:ring-emerald-400/80"
            />
            <div className="flex gap-2 text-xs text-emerald-500/80">
              <button
                className="border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 uppercase tracking-wide hover:bg-emerald-500/20 disabled:opacity-60"
                type="button"
                onClick={handlePaste}
                disabled={isPasting}
              >
                {isPasting ? "reading..." : "paste address"}
              </button>
              <input
                value={pasteValue}
                onChange={(event) => setPasteValue(event.target.value)}
                placeholder="clipboard echo"
                className="flex-1 border border-emerald-500/20 bg-black/70 px-2 py-1 text-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-400/60"
              />
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs uppercase tracking-widest text-emerald-500/90">
                amount in
              </span>
              <input
                type="number"
                min="0"
                step="0.0001"
                placeholder="0.00"
                value={amountIn}
                onChange={(event) => setAmountIn(event.target.value)}
                className="flex-1 border border-emerald-500/40 bg-black/80 px-3 py-2 text-emerald-100 focus:outline-none focus:ring-2 focus:ring-emerald-400/80"
              />
              <button
                type="button"
                className="border border-emerald-400/50 bg-emerald-400/10 px-3 py-2 text-xs uppercase tracking-[0.3em] hover:bg-emerald-400/20 focus:outline-none focus:ring-2 focus:ring-emerald-300/70"
              >
                max
              </button>
            </div>
          </div>

          <div className="space-y-3 rounded-lg border border-emerald-500/30 bg-black/60 p-4 shadow-inner">
            <label className="text-xs uppercase tracking-widest text-emerald-500/90">
              token selector—to
            </label>
            <input
              value={toToken}
              onChange={(event) => setToToken(event.target.value)}
              placeholder="Search symbol or paste address"
              className="w-full border border-emerald-500/30 bg-black/80 px-3 py-2 text-emerald-100 placeholder:text-emerald-500/40 focus:outline-none focus:ring-2 focus:ring-emerald-400/80"
            />
            <div className="flex items-center justify-between border border-emerald-500/20 bg-black/80 px-3 py-2 text-xs uppercase tracking-widest text-emerald-500/80">
              <span>amount out</span>
              <span>{quote.amountOut}</span>
            </div>
            <textarea
              value={memo}
              onChange={(event) => setMemo(event.target.value)}
              placeholder="memo (broadcast notes, ocr fodder)"
              rows={3}
              className="w-full border border-emerald-500/30 bg-black/80 px-3 py-2 text-emerald-100 placeholder:text-emerald-500/40 focus:outline-none focus:ring-2 focus:ring-emerald-400/80"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs uppercase text-emerald-400/90">
          {quote.hops.map((hop, index) => (
            <div
              key={`${hop.from}-${hop.to}-${index}`}
              className="flex items-center gap-2 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 tracking-[0.3em]"
            >
              <span>{hop.from}</span>
              <span>→</span>
              <span>{hop.to}</span>
              <span className="rounded-full border border-emerald-500/30 bg-emerald-500/20 px-2 py-[2px] text-[0.65rem] tracking-[0.2em] text-emerald-200">
                fee {(hop.feeBps / 100).toFixed(1)}%
              </span>
            </div>
          ))}
        </div>

        <div className="grid gap-3 rounded-lg border border-emerald-500/20 bg-black/70 p-4 text-xs uppercase tracking-[0.3em] text-emerald-400/80 md:grid-cols-4">
          <div>
            <span className="block text-emerald-500/90">slippage</span>
            <span className="text-emerald-100">{quote.slippage}</span>
          </div>
          <div>
            <span className="block text-emerald-500/90">min received</span>
            <span className="text-emerald-100">{quote.minReceived}</span>
          </div>
          <div>
            <span className="block text-emerald-500/90">deadline</span>
            <span className="text-emerald-100">{quote.deadlineMinutes}m</span>
          </div>
          <div>
            <span className="block text-emerald-500/90">status</span>
            <span className="text-emerald-100">
              {needsNetwork ? "network gate" : isConnected ? "ready" : "connect wallet"}
            </span>
          </div>
        </div>

        {needsNetwork ? (
          <div className="rounded-lg border border-yellow-400/40 bg-yellow-900/20 p-4 text-xs uppercase tracking-[0.2em] text-yellow-200">
            <p className="mb-2">
              network gate // connect to chain {FLUENT_CHAIN_ID} for route quoting.
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={switchNetwork}
                disabled={isSwitching}
                className="border border-yellow-400/40 bg-yellow-400/10 px-3 py-2 hover:bg-yellow-400/20 focus:outline-none focus:ring-2 focus:ring-yellow-300/70 disabled:opacity-60"
              >
                {isSwitching ? "switching…" : "switch to fluent"}
              </button>
              <button
                type="button"
                onClick={addNetwork}
                disabled={isSwitching}
                className="border border-yellow-400/40 bg-yellow-400/10 px-3 py-2 hover:bg-yellow-400/20 focus:outline-none focus:ring-2 focus:ring-yellow-300/70 disabled:opacity-60"
              >
                {isSwitching ? "requesting…" : "add network"}
              </button>
              {currentChainId && (
                <span className="rounded border border-yellow-400/20 px-3 py-2 text-yellow-200/70">
                  detected chain {currentChainId}
                </span>
              )}
            </div>
            {lastError && (
              <p className="mt-2 text-[0.7rem] normal-case text-yellow-200/60">
                {lastError}
              </p>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4">
            <button
              type="button"
              disabled={!canSubmit}
              className="rounded border border-emerald-400/60 bg-emerald-500/30 px-4 py-3 text-sm uppercase tracking-[0.3em] text-emerald-50 transition hover:bg-emerald-400/40 disabled:border-emerald-500/20 disabled:bg-transparent disabled:text-emerald-400/40"
            >
              simulate swap
            </button>
            <p className="text-[0.65rem] uppercase tracking-[0.3em] text-emerald-400/70">
              fluent auto-router computes per-hop fees · constant product pools chained on demand.
            </p>
            <Stamp text="APPROVED" className="self-end text-[0.7rem]" />
          </div>
        )}
      </div>
    </motion.section>
  );
}
