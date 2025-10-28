"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { useAccount, usePublicClient } from "wagmi";
import { BrowserProvider, Contract, Interface, isAddress, parseUnits } from "ethers";
import toast from "react-hot-toast";
import { FOID20_FACTORY_ABI } from "@/lib/foid20FactoryAbi";

const FACTORY_ADDRESS = process.env.NEXT_PUBLIC_FACTORY as `0x${string}` | undefined;
const EXPLORER_BASE = (process.env.NEXT_PUBLIC_FLUENT_SCAN_BASE ?? "https://testnet.fluentscan.xyz").replace(
  /\/+$/,
  "",
);
const ZERO_SALT = `0x${"0".repeat(64)}` as const;
const CHAIN_ID = Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? "20994") || 20994;

const PREDICT_ABI = [
  "function predictMyAddress(string name_,string symbol_,uint8 decimals_,uint256 cap_,address initialMintTo_,uint256 initialMintAmount_,bytes32 userSalt_) view returns (address predicted, bytes32 namespacedSalt)",
] as const;

const WALLET_ABI = [...FOID20_FACTORY_ABI, ...PREDICT_ABI] as const;
const EVENT_INTERFACE = new Interface(FOID20_FACTORY_ABI);

type Prediction = { predicted: string; namespacedSalt: string };

type DeployResult = {
  address: string;
  txHash: string | null;
  predicted?: string | null;
  userSalt?: string | null;
  via: "wallet" | "vanity";
};

export function LaunchpadForm() {
  const { address: connectedAddress } = useAccount();
  const publicClient = usePublicClient();

  const [name, setName] = useState("");
  const [symbol, setSymbol] = useState("");
  const [decimals, setDecimals] = useState("18");
  const [cap, setCap] = useState("100000000");
  const [initialMintTo, setInitialMintTo] = useState("");
  const [initialMintAmount, setInitialMintAmount] = useState("0");
  const [useHumanUnits, setUseHumanUnits] = useState(true);

  const [prediction, setPrediction] = useState<Prediction | null>(null);
  const [result, setResult] = useState<DeployResult | null>(null);

  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isWalletDeploying, setIsWalletDeploying] = useState(false);
  const [isVanityDeploying, setIsVanityDeploying] = useState(false);

  const lastAutofillRef = useRef<string | null>(null);

  useEffect(() => {
    if (!connectedAddress) return;
    setInitialMintTo((prev) => {
      if (!prev || prev === lastAutofillRef.current) {
        lastAutofillRef.current = connectedAddress;
        return connectedAddress;
      }
      return prev;
    });
  }, [connectedAddress]);

  if (!FACTORY_ADDRESS) {
    throw new Error("Missing NEXT_PUBLIC_FACTORY environment variable.");
  }

  const explorerUrl = (type: "address" | "tx", value: string) => `${EXPLORER_BASE}/${type}/${value}`;

  const parseDecimals = () => {
    const parsed = Number(decimals);
    if (!Number.isInteger(parsed) || parsed < 0 || parsed > 255) {
      throw new Error("Decimals must be between 0 and 255.");
    }
    return parsed;
  };

  const parseAmount = (input: string, decimalsValue: number) => {
    const trimmed = input.trim();
    if (!trimmed) {
      return 0n;
    }
    try {
      return useHumanUnits ? parseUnits(trimmed, decimalsValue) : BigInt(trimmed);
    } catch (error) {
      throw new Error("Invalid amount format.");
    }
  };

  const validateAddress = (value: string, label: string) => {
    if (!isAddress(value)) {
      throw new Error(`${label} must be a valid 0x address.`);
    }
  };

  const prepareDeployment = () => {
    if (!name.trim()) throw new Error("Token name is required.");
    if (!symbol.trim()) throw new Error("Token symbol is required.");

    const decimalsValue = parseDecimals();
    validateAddress(initialMintTo, "Initial mint recipient");
    const capValue = parseAmount(cap, decimalsValue);
    const mintValue = parseAmount(initialMintAmount, decimalsValue);

    return {
      decimalsValue,
      capValue,
      mintValue,
      recipient: initialMintTo as `0x${string}`,
    };
  };

  const handlePreview = async (event?: FormEvent) => {
    event?.preventDefault();
    if (!publicClient) {
      toast.error("Public client unavailable.");
      return;
    }
    if (!connectedAddress) {
      toast.error("Connect your wallet to preview.");
      return;
    }

    try {
      setIsPreviewing(true);
      setResult(null);

      const { decimalsValue, capValue, mintValue, recipient } = prepareDeployment();

      const [predicted, namespacedSalt] = (await publicClient.readContract({
        address: FACTORY_ADDRESS,
        abi: PREDICT_ABI,
        functionName: "predictMyAddress",
        args: [name.trim(), symbol.trim(), decimalsValue, capValue, recipient, mintValue, ZERO_SALT],
        account: connectedAddress as `0x${string}`,
      })) as readonly [string, string];

      setPrediction({ predicted, namespacedSalt });
      toast.success("Prediction ready.");
    } catch (error) {
      setPrediction(null);
      const message = error instanceof Error ? error.message : "Failed to preview deployment.";
      toast.error(message);
    } finally {
      setIsPreviewing(false);
    }
  };

  const handleWalletDeploy = async () => {
    if (typeof window === "undefined") return;
    const { ethereum } = window as typeof window & { ethereum?: unknown };
    if (!ethereum) {
      toast.error("No injected wallet detected.");
      return;
    }

    try {
      setIsWalletDeploying(true);
      setResult(null);

      const { decimalsValue, capValue, mintValue, recipient } = prepareDeployment();

      const provider = new BrowserProvider(ethereum);
      const network = await provider.getNetwork();
      if (Number(network.chainId) !== CHAIN_ID) {
        throw new Error(`Switch to Fluent Testnet (chainId ${CHAIN_ID}).`);
      }

      const signer = await provider.getSigner();
      const contract = new Contract(FACTORY_ADDRESS, WALLET_ABI, signer);

      const [predicted] = await contract.predictMyAddress.staticCall(
        name.trim(),
        symbol.trim(),
        decimalsValue,
        capValue,
        recipient,
        mintValue,
        ZERO_SALT,
      );

      const txResponse = await contract.deployToken(
        name.trim(),
        symbol.trim(),
        decimalsValue,
        capValue,
        recipient,
        mintValue,
        ZERO_SALT,
      );

      toast.loading("Waiting for confirmation…", { id: "wallet-deploy" });
      const receipt = await txResponse.wait();
      toast.dismiss("wallet-deploy");

      const tokenAddress = parseTokenFromLogs(receipt.logs) ?? (predicted as string | undefined) ?? null;
      if (!tokenAddress) {
        throw new Error("Could not determine deployed token address.");
      }

      setResult({
        address: tokenAddress,
        txHash: receipt.hash ?? null,
        predicted: predicted ?? null,
        via: "wallet",
      });
      toast.success("Token deployed from wallet.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Wallet deployment failed.";
      toast.error(message);
    } finally {
      setIsWalletDeploying(false);
    }
  };

  const handleVanityDeploy = async () => {
    if (typeof window === "undefined") return;
    const { ethereum } = window as typeof window & { ethereum?: unknown };
    if (!ethereum) {
      toast.error("No injected wallet detected.");
      return;
    }
    if (!connectedAddress) {
      toast.error("Connect wallet first.");
      return;
    }

    try {
      setIsVanityDeploying(true);
      setResult(null);

      const { decimalsValue, capValue, mintValue, recipient } = prepareDeployment();

      const response = await fetch("/api/vanity-deploy", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          symbol: symbol.trim(),
          decimals: decimalsValue,
          cap: capValue.toString(),
          initialMintTo: recipient,
          initialMintAmount: mintValue.toString(),
          creator: connectedAddress,
        }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload?.ok) {
        const msg = payload?.logs ?? payload?.error ?? "Vanity deployment failed.";
        throw new Error(msg);
      }

      const userSalt = payload.userSalt as string | undefined;
      if (!userSalt || typeof userSalt !== "string") {
        throw new Error("Server did not return a vanity salt.");
      }

      const serverPredicted = typeof payload.predicted === "string" ? payload.predicted.toLowerCase() : null;
      if (!serverPredicted || !serverPredicted.endsWith("f01d")) {
        throw new Error("Server returned an invalid vanity prediction.");
      }

      const saltHex = userSalt as `0x${string}`;

      const provider = new BrowserProvider(ethereum);
      const network = await provider.getNetwork();
      if (Number(network.chainId) !== CHAIN_ID) {
        throw new Error(`Switch to Fluent Testnet (chainId ${CHAIN_ID}).`);
      }

      const signer = await provider.getSigner();
      const contract = new Contract(FACTORY_ADDRESS, WALLET_ABI, signer);

      const [predicted] = await contract.predictMyAddress.staticCall(
        name.trim(),
        symbol.trim(),
        decimalsValue,
        capValue,
        recipient,
        mintValue,
        saltHex,
      );

      const predictedLower = (predicted as string)?.toLowerCase?.();
      if (predictedLower !== serverPredicted) {
        throw new Error("Predicted vanity address mismatch. Please retry.");
      }

      const txResponse = await contract.deployToken(
        name.trim(),
        symbol.trim(),
        decimalsValue,
        capValue,
        recipient,
        mintValue,
        saltHex,
      );

      toast.loading("Waiting for vanity confirmation…", { id: "vanity-deploy" });
      const receipt = await txResponse.wait();
      toast.dismiss("vanity-deploy");

      const tokenAddress =
        parseTokenFromLogs(receipt.logs) ?? (predicted as string | undefined) ?? serverPredicted ?? null;
      if (!tokenAddress) {
        throw new Error("Could not determine deployed token address.");
      }

      setResult({
        address: tokenAddress,
        txHash: receipt.hash ?? null,
        predicted: serverPredicted,
        userSalt: saltHex,
        via: "vanity",
      });
      toast.success("Vanity deployment complete.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Vanity deployment failed.";
      toast.error(message);
    } finally {
      setIsVanityDeploying(false);
    }
  };

  const capLabel = `Cap (${useHumanUnits ? "tokens" : "wei"})`;
  const mintLabel = `Initial Mint Amount (${useHumanUnits ? "tokens" : "wei"})`;
  const capPlaceholder = useHumanUnits ? "100000000" : "100000000000000000000000000";
  const mintPlaceholder = useHumanUnits ? "1000000" : "1000000000000000000000000";

  return (
    <form onSubmit={handlePreview} className="space-y-6 rounded-2xl border border-white/10 bg-black/50 p-6 shadow-xl backdrop-blur">
      <div className="grid gap-4 md:grid-cols-2">
        <label className="flex flex-col gap-2">
          <span className="text-sm font-medium text-white/80">Token Name</span>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="My FOID Token"
            className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-fluent-blue focus:outline-none"
          />
        </label>
        <label className="flex flex-col gap-2">
          <span className="text-sm font-medium text-white/80">Symbol</span>
          <input
            value={symbol}
            onChange={(event) => setSymbol(event.target.value.replace(/\s+/g, ""))}
            placeholder="FOID"
            className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-fluent-blue focus:outline-none uppercase"
          />
        </label>
        <label className="flex flex-col gap-2">
          <span className="text-sm font-medium text-white/80">Decimals</span>
          <input
            value={decimals}
            onChange={(event) => setDecimals(event.target.value.replace(/[^\d]/g, ""))}
            inputMode="numeric"
            className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-fluent-blue focus:outline-none"
          />
        </label>
        <label className="flex flex-col gap-2">
          <span className="text-sm font-medium text-white/80">{capLabel}</span>
          <input
            value={cap}
            onChange={(event) => setCap(event.target.value.trimStart())}
            placeholder={capPlaceholder}
            className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-fluent-blue focus:outline-none"
          />
        </label>
        <label className="flex flex-col gap-2 md:col-span-2">
          <span className="text-sm font-medium text-white/80">Initial Mint To</span>
          <input
            value={initialMintTo}
            onChange={(event) => {
              const next = event.target.value.trim();
              setInitialMintTo(next);
              lastAutofillRef.current = next;
            }}
            placeholder="0x..."
            className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-fluent-blue focus:outline-none"
          />
        </label>
        <label className="flex flex-col gap-2 md:col-span-2">
          <span className="text-sm font-medium text-white/80">{mintLabel}</span>
          <input
            value={initialMintAmount}
            onChange={(event) => setInitialMintAmount(event.target.value.trimStart())}
            placeholder={mintPlaceholder}
            className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-fluent-blue focus:outline-none"
          />
        </label>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4 border-t border-white/10 pt-4">
        <label className="flex items-center gap-3 text-sm text-white/80">
          <input
            type="checkbox"
            checked={useHumanUnits}
            onChange={(event) => setUseHumanUnits(event.target.checked)}
            className="h-4 w-4 accent-fluent-blue"
          />
          Interpret amounts as human units (use parseUnits)
        </label>
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          type="submit"
          disabled={isPreviewing}
          className="inline-flex items-center justify-center rounded-lg border border-fluent-blue/60 bg-fluent-blue/20 px-4 py-2 text-sm font-medium text-white transition hover:bg-fluent-blue/30 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isPreviewing ? "Previewing…" : "Preview"}
        </button>
        <button
          type="button"
          onClick={handleWalletDeploy}
          disabled={isWalletDeploying}
          className="inline-flex items-center justify-center rounded-lg border border-emerald-400/60 bg-emerald-500/20 px-4 py-2 text-sm font-medium text-emerald-100 transition hover:bg-emerald-500/30 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isWalletDeploying ? "Deploying…" : "Deploy (wallet)"}
        </button>
        <button
          type="button"
          onClick={handleVanityDeploy}
          disabled={isVanityDeploying}
          className="inline-flex items-center justify-center rounded-lg border border-fuchsia-400/60 bg-fuchsia-500/20 px-4 py-2 text-sm font-medium text-fuchsia-100 transition hover:bg-fuchsia-500/30 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isVanityDeploying ? "Grinding vanity…" : "Deploy Vanity (server)"}
        </button>
      </div>

      {prediction && (
        <div className="space-y-1 rounded-lg border border-white/10 bg-white/5 p-4 text-sm text-white/80">
          <p className="font-medium text-white">Preview</p>
          <p>
            Predicted address:{" "}
            <a
              href={explorerUrl("address", prediction.predicted)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-fluent-blue underline-offset-4 hover:underline"
            >
              {prediction.predicted}
            </a>
          </p>
          <p className="break-all text-xs text-white/60">Namespaced salt: {prediction.namespacedSalt}</p>
        </div>
      )}

      {result && (
        <div className="space-y-2 rounded-lg border border-white/10 bg-white/5 p-4 text-sm text-white">
          <p className="font-medium text-white">
            Deployment result <span className="text-xs text-white/60">({result.via === "wallet" ? "wallet" : "vanity"})</span>
          </p>
          <p className="flex flex-col md:flex-row md:items-center md:gap-2">
            <span>Token address:</span>
            <span className="break-all font-mono text-xs md:text-sm">{result.address}</span>
            <a
              href={explorerUrl("address", result.address)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-fluent-blue underline-offset-4 hover:underline"
            >
              View on explorer ↗
            </a>
          </p>
          {result.txHash && (
            <p className="flex flex-col md:flex-row md:items-center md:gap-2">
              <span>Tx hash:</span>
              <span className="break-all font-mono text-xs md:text-sm">{result.txHash}</span>
              <a
                href={explorerUrl("tx", result.txHash)}
                target="_blank"
                rel="noopener noreferrer"
                className="text-fluent-blue underline-offset-4 hover:underline"
              >
                View transaction ↗
              </a>
            </p>
          )}
          {result.userSalt && <p className="break-all text-xs text-white/70">Vanity userSalt: {result.userSalt}</p>}
          {result.predicted && result.predicted.toLowerCase() !== result.address.toLowerCase() && (
            <p className="text-xs text-amber-300/80">Warning: predicted address differs from final deployment.</p>
          )}
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
        return parsed.args?.token as string;
      }
    } catch {
      continue;
    }
  }
  return null;
}
