"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useAccount } from "wagmi";
import {
  BrowserProvider,
  Contract,
  Interface,
  isAddress,
  parseUnits,
} from "ethers";
import toast from "react-hot-toast";
import { FOID20_FACTORY_ABI } from "@/lib/foid20FactoryAbi";

const FACTORY_ADDRESS = (
  process.env.NEXT_PUBLIC_FOID_FACTORY ??
  process.env.NEXT_PUBLIC_FACTORY
) as `0x${string}` | undefined;

const EXPLORER_BASE = (process.env.NEXT_PUBLIC_FLUENT_SCAN_BASE ??
  "https://testnet.fluentscan.xyz").replace(/\/+$/, "");

const DECIMALS = 18;
const ZERO_SALT = "0x".padEnd(66, "0");
const EVENT_INTERFACE = new Interface(FOID20_FACTORY_ABI);

type LaunchStatus = "idle" | "estimating" | "pending" | "confirmed";

type DeployResult = {
  address: string | null;
  txHash: string | null;
};

export function LaunchpadForm() {
  const { address: connectedAddress } = useAccount();

  const [tokenName, setTokenName] = useState("");
  const [symbol, setSymbol] = useState("");
  const [maxSupply, setMaxSupply] = useState("");
  const [recipient, setRecipient] = useState("");

  const [status, setStatus] = useState<LaunchStatus>("idle");
  const [result, setResult] = useState<DeployResult>({ address: null, txHash: null });

  useEffect(() => {
    if (!connectedAddress) return;
    setRecipient((prev) => (prev ? prev : connectedAddress));
  }, [connectedAddress]);

  const rawSupply = useMemo(() => {
    if (!maxSupply.trim()) return null;
    try {
      return parseUnits(maxSupply.trim(), DECIMALS);
    } catch {
      return null;
    }
  }, [maxSupply]);

  const supplyPreview = useMemo(() => {
    if (rawSupply === null) return "—";
    return rawSupply.toString();
  }, [rawSupply]);

  if (!FACTORY_ADDRESS) {
    throw new Error("Missing FOID factory address (set NEXT_PUBLIC_FOID_FACTORY).");
  }

  const explorerHref = (type: "address" | "tx", value: string) =>
    `${EXPLORER_BASE}/${type}/${value}`;

  const resetResult = () => {
    setResult({ address: null, txHash: null });
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    resetResult();
    setStatus("idle");

    const trimmedName = tokenName.trim();
    const trimmedSymbol = symbol.trim().toUpperCase().slice(0, 11);
    const trimmedRecipient = recipient.trim();

    if (!trimmedName) {
      toast.error("Token name required.");
      return;
    }
    if (!trimmedSymbol) {
      toast.error("Symbol required.");
      return;
    }
    if (!maxSupply.trim()) {
      toast.error("Max supply required.");
      return;
    }
    if (!rawSupply || rawSupply <= 0n) {
      toast.error("Max supply must be a positive number.");
      return;
    }
    if (!isAddress(trimmedRecipient)) {
      toast.error("Recipient must be a valid wallet address.");
      return;
    }

    if (typeof window === "undefined") return;
    const ethereum = (window as typeof window & { ethereum?: unknown }).ethereum;
    if (!ethereum) {
      toast.error("No injected wallet detected.");
      return;
    }

    try {
      setStatus("estimating");
      const provider = new BrowserProvider(ethereum);
      const signer = await provider.getSigner();
      const contract = new Contract(FACTORY_ADDRESS, FOID20_FACTORY_ABI, signer);

      setStatus("pending");
      const tx = await contract.deployToken(
        trimmedName,
        trimmedSymbol,
        DECIMALS,
        rawSupply,
        trimmedRecipient,
        rawSupply,
        ZERO_SALT,
      );

      toast.success("Deployment submitted.");
      const receipt = await tx.wait();

      let deployed: string | null = null;
      try {
        deployed = parseTokenFromLogs(receipt?.logs);
      } catch {
        deployed = null;
      }

      setResult({
        address: deployed,
        txHash: tx.hash,
      });
      setStatus("confirmed");
      toast.success("Token created on Fluent.");
    } catch (error: any) {
      setStatus("idle");
      const message = error?.message ?? "Deployment failed.";
      toast.error(message);
    }
  };

  const statusLabel =
    status === "idle"
      ? "status: idle"
      : status === "estimating"
        ? "status: estimating"
        : status === "pending"
          ? "status: pending"
          : "status: confirmed";

  return (
    <form
      onSubmit={handleSubmit}
      className="mx-auto flex max-w-3xl flex-col gap-6 rounded-3xl bg-neutral-950/85 p-8 ring-1 ring-neutral-800/40"
    >
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold text-neutral-50">launch without friction</h1>
        <p className="text-sm text-neutral-300">
          single form, four fields—nothing else. mint 100% of supply straight to your wallet.
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="flex flex-col gap-2">
          <span className="text-sm font-medium text-neutral-200">Token name</span>
          <input
            value={tokenName}
            onChange={(event) => setTokenName(event.target.value)}
            placeholder="My FOID experiment"
            className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-neutral-100 focus:border-fluent-pink/60 focus:outline-none"
          />
        </label>
        <label className="flex flex-col gap-2">
          <span className="text-sm font-medium text-neutral-200">Symbol (≤ 11 chars)</span>
          <input
            value={symbol}
            onChange={(event) => setSymbol(event.target.value.toUpperCase().slice(0, 11))}
            placeholder="FOID"
            className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm uppercase text-neutral-100 focus:border-fluent-pink/60 focus:outline-none"
          />
        </label>
        <label className="flex flex-col gap-2 md:col-span-2">
          <span className="text-sm font-medium text-neutral-200">Max supply</span>
          <input
            value={maxSupply}
            onChange={(event) => setMaxSupply(event.target.value.trimStart())}
            placeholder="1000000"
            className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-neutral-100 focus:border-fluent-pink/60 focus:outline-none"
          />
          <span className="text-xs uppercase tracking-[0.35em] text-neutral-500">
            10^18 preview → {supplyPreview}
          </span>
        </label>
        <label className="flex flex-col gap-2 md:col-span-2">
          <span className="text-sm font-medium text-neutral-200">Initial recipient</span>
          <input
            value={recipient}
            onChange={(event) => setRecipient(event.target.value.trim())}
            placeholder="0x..."
            className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-neutral-100 focus:border-fluent-pink/60 focus:outline-none"
          />
        </label>
      </div>

      <div className="flex flex-col gap-3 rounded-2xl bg-neutral-900/40 p-4 text-sm text-neutral-200">
        <span className="font-mono text-xs uppercase tracking-[0.35em] text-neutral-400">
          {statusLabel}
        </span>
        <p className="text-neutral-300">
          initialMint = 100% of maxSupply → sent to {recipient || "recipient"}.
        </p>
        <p className="text-xs uppercase tracking-[0.35em] text-neutral-500">
          clear states: estimating → pending → confirmed (view on explorer).
        </p>
      </div>

      <button
        type="submit"
        disabled={status === "pending" || status === "estimating"}
        className="inline-flex items-center justify-center rounded-2xl bg-fluent-pink/80 px-6 py-3 text-sm font-semibold uppercase tracking-[0.35em] text-black transition hover:bg-fluent-pink disabled:cursor-not-allowed disabled:opacity-60"
      >
        {status === "estimating"
          ? "estimating..."
          : status === "pending"
            ? "pending..."
            : "launch foid20"}
      </button>

      {result.txHash && (
        <div className="flex flex-col gap-2 rounded-2xl bg-neutral-900/40 p-4 text-sm text-neutral-200">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-neutral-100">Transaction</span>
            <a
              href={explorerHref("tx", result.txHash)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs uppercase tracking-[0.35em] text-fluent-blue hover:underline"
            >
              view on explorer →
            </a>
          </div>
          <span className="break-all font-mono text-xs uppercase tracking-[0.25em] text-neutral-400">
            {result.txHash}
          </span>
        </div>
      )}

      {result.address && (
        <div className="flex flex-col gap-2 rounded-2xl bg-neutral-900/40 p-4 text-sm text-neutral-200">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-neutral-100">Token address</span>
            <a
              href={explorerHref("address", result.address)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs uppercase tracking-[0.35em] text-fluent-blue hover:underline"
            >
              view on explorer →
            </a>
          </div>
          <span className="break-all font-mono text-xs uppercase tracking-[0.25em] text-neutral-400">
            {result.address}
          </span>
        </div>
      )}
    </form>
  );
}

function parseTokenFromLogs(logs: readonly unknown[] | undefined) {
  if (!logs) return null;
  for (const log of logs) {
    try {
      const parsed = EVENT_INTERFACE.parseLog(log as any);
      if (parsed?.name === "TokenDeployed") {
        return (parsed.args?.token as string) ?? null;
      }
    } catch {
      continue;
    }
  }
  return null;
}
