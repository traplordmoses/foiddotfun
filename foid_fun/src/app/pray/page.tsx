"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import AppTitlebar, { type AppTitlebarWarning } from "@/app/(components)/AppTitlebar";
import { useAccount, useChainId, usePublicClient, useReadContract, useDisconnect, useConnect, useSwitchChain } from "wagmi";
import { encodeAbiParameters, keccak256, stringToBytes, type Address, type Hex, type Hash } from "viem";
import FoidMommyTerminal, {
  FEELING_LABELS,
  type FeelingKey,
} from "@/app/(components)/FoidMommyTerminal";
import { getWalletClient } from "@/lib/viem";
import { formatViemError } from "@/lib/prayerErrors";
import { TARGET_CHAIN_ID } from "@/lib/chain";
import { MobileWalletButton } from "@/components/MobileWalletButton";
import { useHaptic } from "@/hooks/useHaptic";
import { PRAYER_REGISTRY_ABI } from "@/lib/contracts/abis/prayerRegistry";
import { parseEventLogs, type ContractFunctionRevertedError } from "viem";
import { PrayerErrorBoundary } from "@/components/PrayerErrorBoundary";

/* --- env --- */
const DEFAULT_FOIP_REGISTRY: Hex = "0x6FC7301fad7Ca0294152b23FD4f0467200376d65";
const DEFAULT_FOIP_MIRROR: Hex = "0x8ff39c2a78FaF7d655e4Dab03076Cb26C97007FF";
const PRAYER_SELECTOR = "0xedf32f27";
const PRAYER_CATEGORY = 1n;

function resolveEnv(): { registry?: Hex; mirror?: Hex } {
  let registry: string | undefined;
  let mirror: string | undefined;

  try {
    if (typeof window !== "undefined") {
      const sp = new URLSearchParams(window.location.search);
      registry = sp.get("registry") ?? undefined;
      mirror = sp.get("mirror") ?? undefined;
    }
    const g = globalThis as { __ENV__?: Record<string, string> };
    if (!registry && g.__ENV__?.NEXT_PUBLIC_FOIP_REGISTRY) {
      registry = g.__ENV__.NEXT_PUBLIC_FOIP_REGISTRY;
    }
    if (!mirror && g.__ENV__?.NEXT_PUBLIC_FOIP_MIRROR) {
      mirror = g.__ENV__.NEXT_PUBLIC_FOIP_MIRROR;
    }
    if (typeof process !== "undefined") {
      const env = process.env;
      if (!registry && env.NEXT_PUBLIC_FOIP_REGISTRY) registry = env.NEXT_PUBLIC_FOIP_REGISTRY;
      if (!mirror && env.NEXT_PUBLIC_FOIP_MIRROR) mirror = env.NEXT_PUBLIC_FOIP_MIRROR;
    }
  } catch {}
  return {
    registry: (registry ?? DEFAULT_FOIP_REGISTRY) as Hex,
    mirror: (mirror ?? DEFAULT_FOIP_MIRROR) as Hex,
  };
}

// Using imported PRAYER_REGISTRY_ABI from lib/contracts/abis/prayerRegistry.ts

const PrayerMirrorAbiLegacy = [
  {
    type: "function",
    name: "get",
    stateMutability: "view",
    inputs: [{ name: "user", type: "address" }],
    outputs: [
      { name: "streak", type: "uint32" },
      { name: "longest", type: "uint32" },
      { name: "total", type: "uint32" },
      { name: "milestones", type: "uint32" },
      { name: "legacyMetric", type: "uint16" },
      { name: "prayerHash", type: "bytes32" },
    ],
  },
] as const;

const PrayerMirrorAbiLite = [
  {
    type: "function",
    name: "get",
    stateMutability: "view",
    inputs: [{ name: "user", type: "address" }],
    outputs: [
      { name: "streak", type: "uint32" },
      { name: "longest", type: "uint32" },
      { name: "total", type: "uint32" },
      { name: "milestones", type: "uint32" },
      { name: "prayerHash", type: "bytes32" },
    ],
  },
] as const;

function secondsLeft(tsNow: number, tsNext: bigint | undefined) {
  if (!tsNext) return 0;
  const left = Number(tsNext) - tsNow;
  return left > 0 ? left : 0;
}

function formatDurationShort(seconds: number) {
  if (seconds <= 0) return "ready now";
  const units = [
    { label: "d", value: 86400 },
    { label: "h", value: 3600 },
    { label: "m", value: 60 },
    { label: "s", value: 1 },
  ] as const;
  const parts: string[] = [];
  let remaining = seconds;
  for (const unit of units) {
    if (remaining >= unit.value || (unit.label === "s" && parts.length === 0)) {
      const count = Math.floor(remaining / unit.value);
      if (count > 0) parts.push(`${count}${unit.label}`);
      remaining -= count * unit.value;
    }
    if (parts.length === 2) break;
  }
  return parts.join(" ");
}

function shortHash(hash?: string) {
  if (!hash) return "–";
  if (hash.length <= 10) return hash;
  return `${hash.slice(0, 6)}…${hash.slice(-4)}`;
}

type ApiProposal = {
  id: string; // placementId (0x...)
  owner: string;
  epochSubmitted: number;
  voteEndsAtEpoch: number;
  voteEndsAtSec: number;
  secondsLeft?: number;
  yes?: number;
  no?: number;
  percentYes?: number;
  isVotable?: boolean;
  cid?: string;
  name?: string;
  rect?: { x: number; y: number; w: number; h: number };
};

function safeNumber(v: unknown, fallback = 0) {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function shortId(id?: string) {
  if (!id) return "–";
  if (id.length <= 12) return id;
  return `${id.slice(0, 8)}…${id.slice(-4)}`;
}

// Type-safe address helper
function safeAddress(addr: string | undefined): Hex {
  if (!addr || !addr.startsWith('0x')) {
    return "0x0000000000000000000000000000000000000000";
  }
  return addr as Hex;
}

type VoteWire = {
  epochId: string;
  placementId: `0x${string}`;
  voter: `0x${string}`;
  support: boolean;
  weight: string;
  blockNumber: string | null;
  txHash: `0x${string}` | null;
  logIndex: string | null;
};

function PrayPageContent() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { disconnect } = useDisconnect();
  const { connect, connectors } = useConnect();
  const { switchChainAsync } = useSwitchChain();
  const { trigger: triggerHaptic } = useHaptic();
  const [nowSeconds, setNowSeconds] = useState<number | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [boardProposals, setBoardProposals] = useState<ApiProposal[]>([]);
  const [boardLoading, setBoardLoading] = useState(false);
  const [boardError, setBoardError] = useState<string | null>(null);

  // Optimistic UI updates
  const [optimisticStreak, setOptimisticStreak] = useState<number | null>(null);
  const [optimisticTotal, setOptimisticTotal] = useState<number | null>(null);
  // const [votes, setVotes] = useState<VoteWire[]>([]);
  // const [votesLoading, setVotesLoading] = useState(false);
  // const [votesError, setVotesError] = useState<string | null>(null);

  const env = useMemo(resolveEnv, []);
  const REGISTRY = env.registry;
  const MIRROR = env.mirror;
  const FLUENT_CHAIN_ID = TARGET_CHAIN_ID;
  useEffect(() => {
    setHydrated(true);
  }, []);
  const missingRegistry = !REGISTRY;
  const missingMirror = !MIRROR;
  const walletDisconnected = !isConnected || !address;
  const wrongChain = Boolean(hydrated && isConnected && chainId && FLUENT_CHAIN_ID && chainId !== FLUENT_CHAIN_ID);
  const titlebarWarnings: AppTitlebarWarning[] = [];
  if (missingRegistry) titlebarWarnings.push({ key: "registry", message: "missing registry", variant: "error" });
  if (wrongChain) titlebarWarnings.push({ key: "chain", message: `wrong chain ${TARGET_CHAIN_ID}`, variant: "mint" });
  if (missingMirror) titlebarWarnings.push({ key: "mirror", message: "mirror missing", variant: "error" });
  const publicClient = usePublicClient();
  const snapRef = useRef<(() => Promise<unknown>) | null>(null);
  const nextRef = useRef<(() => Promise<unknown>) | null>(null);
  const registryRef = useRef<Hex | undefined>(REGISTRY);

  const {
    data: snapLegacy,
    isLoading: snapLegacyLoading,
    refetch: refetchSnapLegacy
  } = useReadContract({
    address: safeAddress(MIRROR),
    abi: PrayerMirrorAbiLegacy,
    functionName: "get",
    args: [safeAddress(address)],
    chainId: FLUENT_CHAIN_ID,
    query: { enabled: Boolean(address && MIRROR && FLUENT_CHAIN_ID) },
  });

  const {
    data: snapLite,
    isLoading: snapLiteLoading,
    refetch: refetchSnapLite
  } = useReadContract({
    address: safeAddress(MIRROR),
    abi: PrayerMirrorAbiLite,
    functionName: "get",
    args: [safeAddress(address)],
    chainId: FLUENT_CHAIN_ID,
    query: { enabled: Boolean(address && MIRROR && FLUENT_CHAIN_ID) },
  });

  const {
    data: nextAllowed,
    isLoading: nextAllowedLoading,
    refetch: refetchNext
  } = useReadContract({
    address: safeAddress(REGISTRY),
    abi: PRAYER_REGISTRY_ABI,
    functionName: "nextAllowedAt",
    args: [safeAddress(address)],
    chainId: FLUENT_CHAIN_ID,
    query: { enabled: Boolean(address && REGISTRY && FLUENT_CHAIN_ID) },
  });

  // Combined loading state
  const statsLoading = snapLegacyLoading || snapLiteLoading || nextAllowedLoading;

  useEffect(() => {
    snapRef.current = async () => {
      await Promise.allSettled([
        refetchSnapLegacy({ throwOnError: false, cancelRefetch: false }),
        refetchSnapLite({ throwOnError: false, cancelRefetch: false }),
      ]);
    };
  }, [refetchSnapLegacy, refetchSnapLite]);
  useEffect(() => { nextRef.current = refetchNext; }, [refetchNext]);
  useEffect(() => { registryRef.current = REGISTRY as Hex | undefined; }, [REGISTRY]);
  useEffect(() => {
    if (!address || !FLUENT_CHAIN_ID) return;
    if (MIRROR) {
      void refetchSnapLegacy({ throwOnError: false, cancelRefetch: false });
      void refetchSnapLite({ throwOnError: false, cancelRefetch: false });
    }
    if (!REGISTRY) return;
    void refetchNext({ throwOnError: false, cancelRefetch: false });
  }, [MIRROR, REGISTRY, address, FLUENT_CHAIN_ID, refetchNext, refetchSnapLegacy, refetchSnapLite]);

  useEffect(() => {
    const updateNow = () => setNowSeconds(Math.floor(Date.now() / 1000));
    updateNow();
    const interval = setInterval(updateNow, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!address) {
      setBoardProposals([]);
      setBoardError(null);
      setBoardLoading(false);
      return;
    }

    const controller = new AbortController();

    const run = async () => {
      try {
        setBoardLoading(true);
        setBoardError(null);

        const res = await fetch(`/api/proposals?owner=${address}`, {
          cache: "no-store",
          signal: controller.signal,
        });

        if (!res.ok) {
          const text = await res.text().catch(() => "");
          throw new Error(`proposals fetch failed (${res.status}) ${text}`.trim());
        }

        const json = (await res.json()) as { proposals?: ApiProposal[] };
        const proposals = Array.isArray(json.proposals) ? json.proposals : [];

        proposals.sort((a, b) => safeNumber(b.epochSubmitted) - safeNumber(a.epochSubmitted));

        setBoardProposals(proposals);
      } catch (e) {
        // Type-safe abort check
        if (e instanceof Error && 'name' in e && e.name === 'AbortError') return;
        setBoardError(e instanceof Error ? e.message : String(e));
        setBoardProposals([]);
      } finally {
        setBoardLoading(false);
      }
    };

    run();

    const t = setInterval(run, 10_000);

    return () => {
      clearInterval(t);
      controller.abort();
    };
  }, [address]);

  // useEffect(() => {
  //   if (!address) {
  //     setVotes([]);
  //     setVotesError(null);
  //     setVotesLoading(false);
  //     return;
  //   }

  //   const ctrl = new AbortController();

  //   const run = async () => {
  //     try {
  //       setVotesLoading(true);
  //       setVotesError(null);
  //       const res = await fetch(`/api/votes?address=${address}`, {
  //         cache: "no-store",
  //         signal: ctrl.signal,
  //       });
  //       if (!res.ok) {
  //         const text = await res.text().catch(() => "");
  //         throw new Error(`votes fetch failed (${res.status}) ${text}`.trim());
  //       }
  //       const json = (await res.json()) as { votes?: VoteWire[] };
  //       setVotes(Array.isArray(json.votes) ? json.votes : []);
  //     } catch (e) {
  //       if ((e as any)?.name === "AbortError") return;
  //       setVotesError(e instanceof Error ? e.message : String(e));
  //       setVotes([]);
  //     } finally {
  //       setVotesLoading(false);
  //     }
  //   };

  //   run();
  //   const t = setInterval(run, 10_000);

  //   return () => {
  //     clearInterval(t);
  //     ctrl.abort();
  //   };
  // }, [address]);

  const ensureWalletReady = useCallback(async () => {
    if (!isConnected || !address) throw new Error("please connect your wallet before anchoring your prayer.");
    if (FLUENT_CHAIN_ID && chainId && chainId !== FLUENT_CHAIN_ID) {
      throw new Error(`switch to fluent testnet (chain id ${FLUENT_CHAIN_ID}) to continue.`);
    }
  }, [FLUENT_CHAIN_ID, address, chainId, isConnected]);

  const submitPrayer = useCallback(
    async (prayer: string, feeling: FeelingKey) => {
      const registryAddress = registryRef.current;
      if (!registryAddress) throw new Error("missing registry address on this page.");
      if (!publicClient) throw new Error("public client not ready.");
      if (!address) throw new Error("connect your wallet before anchoring your prayer.");

      // Switch to Fluent Testnet if needed
      if (chainId !== FLUENT_CHAIN_ID) {
        try {
          await switchChainAsync?.({ chainId: FLUENT_CHAIN_ID });

          // Poll for chain change confirmation (max 5 seconds)
          const maxAttempts = 50; // 50 * 100ms = 5 seconds
          let attempts = 0;

          while (attempts < maxAttempts) {
            // Check if chain has switched
            if (chainId === FLUENT_CHAIN_ID) {
              console.log('Chain switched successfully to', FLUENT_CHAIN_ID);
              break;
            }

            // Wait 100ms before checking again
            await new Promise(resolve => setTimeout(resolve, 100));
            attempts++;
          }

          // If chain still hasn't switched after 5 seconds, throw error
          if (chainId !== FLUENT_CHAIN_ID) {
            throw new Error('Chain switch timed out after 5 seconds');
          }
        } catch (error: unknown) {
          const message = error instanceof Error ? error.message : "Failed to switch chain";
          throw new Error(`please switch to fluent testnet (chain ${FLUENT_CHAIN_ID}). ${message}`);
        }
      }

      const prayerHash = keccak256(stringToBytes(prayer));
      const label = BigInt(FEELING_LABELS[feeling] ?? 1);
      const encodedArgs = encodeAbiParameters(
        [
          { name: "prayer_hash", type: "bytes32" },
          { name: "label", type: "uint256" },
          { name: "category", type: "uint256" },
        ],
        [prayerHash, label, PRAYER_CATEGORY],
      );
      const data = (`${PRAYER_SELECTOR}${encodedArgs.slice(2)}` as `0x${string}`);

      const transportInfo = publicClient.transport as { url?: string; type?: string } | undefined;
      console.debug("submitPrayer", {
        chainId: publicClient.chain?.id ?? FLUENT_CHAIN_ID,
        userChainId: chainId,
        rpc: transportInfo?.url ?? transportInfo?.type ?? "unknown",
        registry: registryAddress,
        selector: PRAYER_SELECTOR,
        args: [prayerHash, label, PRAYER_CATEGORY],
      });

      try {
        await publicClient.call({ to: registryAddress, data, account: address as Address });
      } catch (error: unknown) {
        const message = formatViemError(error);
        console.error("prayer simulation failed:", message, error);
        throw new Error(message);
      }

      let gasEstimate: bigint;
      try {
        gasEstimate = await publicClient.estimateGas({
          to: registryAddress,
          data,
          account: address as Address,
        });
      } catch (error: unknown) {
        console.warn("prayer gas estimation failed:", error);

        // Try to get a better estimate from simulation
        // If simulation passed earlier but estimation fails, use conservative fallback
        // Based on typical prayer transactions: ~150k-180k gas
        const message = formatViemError(error);

        // If it's a revert, don't use fallback - fail immediately
        if (message.includes('revert') || message.includes('execution reverted')) {
          throw new Error(`Transaction would fail: ${message}`);
        }

        // For network errors or estimation failures, use smart fallback
        // Base: 150k + 50k buffer = 200k (reasonable for most prayers)
        gasEstimate = BigInt(200_000);
        console.log("Using fallback gas estimate:", gasEstimate.toString());
      }

      // Add 20% margin to gas estimate for safety
      const gasMargin = (gasEstimate * 20n) / 100n;
      const gasLimit = gasEstimate + (gasMargin > 0 ? gasMargin : 1n);

      // Optimistic update: Show +1 streak and +1 total immediately
      const snap = snapLegacy ?? snapLite;
      const currentStreak = typeof snap?.[0] === 'bigint' ? Number(snap[0]) : (typeof snap?.[0] === 'number' ? snap[0] : 0);
      const currentTotal = typeof snap?.[2] === 'bigint' ? Number(snap[2]) : (typeof snap?.[2] === 'number' ? snap[2] : 0);
      setOptimisticStreak(currentStreak + 1);
      setOptimisticTotal(currentTotal + 1);

      const walletClient = await getWalletClient();
      try {
        const txHash = await walletClient.sendTransaction({
          account: address as Address,
          to: registryAddress,
          data,
          gas: gasLimit,
          chain: walletClient.chain,
        });
        return { txHash };
      } catch (error: unknown) {
        // Revert optimistic update on error
        setOptimisticStreak(null);
        setOptimisticTotal(null);
        const message = formatViemError(error);
        console.error("prayer send failed:", message, error);
        throw new Error(message);
      }
    },
    [address, chainId, FLUENT_CHAIN_ID, publicClient, switchChainAsync, snapLegacy, snapLite],
  );

  const waitForReceipt = useCallback(async (hash: string) => {
    if (!publicClient) throw new Error("public client not available");

    // Wait for transaction to be mined
    const receipt = await publicClient.waitForTransactionReceipt({ hash: hash as Hash });

    // Parse and verify PrayerSubmitted event
    try {
      const logs = parseEventLogs({
        abi: PRAYER_REGISTRY_ABI,
        logs: receipt.logs,
        eventName: 'PrayerSubmitted',
      });

      if (logs.length === 0) {
        console.warn('Warning: PrayerSubmitted event not found in transaction logs');
        // Don't throw - maybe event name is different, but tx succeeded
      } else {
        const prayerEvent = logs[0];
        console.log('Prayer verified on-chain:', {
          user: prayerEvent.args.user,
          prayerHash: prayerEvent.args.prayerHash,
          timestamp: prayerEvent.args.timestamp,
        });
      }
    } catch (error) {
      console.error('Error parsing prayer events:', error);
      // Continue - transaction succeeded even if we can't parse events
    }

    // Refetch user stats and cooldown
    const tasks: Promise<unknown>[] = [];
    if (snapRef.current) tasks.push(snapRef.current());
    if (nextRef.current) tasks.push(nextRef.current());
    if (tasks.length) await Promise.all(tasks); // Use Promise.all instead of allSettled

    // Clear optimistic updates after real data is fetched
    setOptimisticStreak(null);
    setOptimisticTotal(null);
  }, [publicClient]);

  const handleSwitchWallet = useCallback(() => {
    triggerHaptic('medium');
    disconnect();
    setTimeout(() => {
      const connector = connectors[0];
      if (connector) connect({ connector });
    }, 100);
  }, [disconnect, connect, connectors, triggerHaptic]);

  const snap = snapLegacy ?? snapLite;
  const snapValues = snap as readonly unknown[] | undefined;
  const prayerHash = snapValues && snapValues.length > 4 ? (snapValues.length > 5 ? snapValues[5] : snapValues[4]) : undefined;
  const formattedPrayerHash = typeof prayerHash === "string" ? shortHash(prayerHash) : "–";

  // Computed values with optimistic updates
  const displayStreak = optimisticStreak !== null ? optimisticStreak : snap?.[0];
  const displayLongest = snap?.[1];
  const displayTotal = optimisticTotal !== null ? optimisticTotal : snap?.[2];
  const displayMilestones = snap?.[3];
  const canRenderTime = nowSeconds !== null;
  const nextAllowedSecondsRaw = typeof nextAllowed === "bigint" ? Number(nextAllowed) : typeof nextAllowed === "number" ? nextAllowed : null;
  const cooldownActive = canRenderTime && typeof nextAllowedSecondsRaw === "number" && nextAllowedSecondsRaw > nowSeconds;
  const nextWindowLabel = cooldownActive
    ? new Date(nextAllowedSecondsRaw * 1000).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
    : "";

  return (
    <main className="pray-page relative bg-foid-bg text-white/90 min-h-screen overflow-x-hidden overflow-y-auto">
      <div className="pointer-events-none fixed inset-0 z-0 vignette" />

      {/* Mobile Layout */}
      <div className="lg:hidden relative z-10 flex items-center justify-center min-h-screen px-2 sm:px-4 pb-28 pb-safe">
        {/* NOT CONNECTED - Show connect button */}
        {!isConnected ? (
          <div className="flex flex-col items-center justify-center gap-6 w-full max-w-md">
            <Image src="/foidmommy.gif" alt="Foid Mommy" width={120} height={120} className="rounded-2xl" />
            <button
              onClick={handleSwitchWallet}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleSwitchWallet();
                }
              }}
              aria-label="Connect wallet to start praying"
              className="w-full min-h-[56px] px-8 py-5 text-lg font-bold tracking-wide rounded-2xl shadow-lg transition-all duration-200 touch-manipulation active:scale-[0.98] hover:scale-[1.02] focus:outline-none focus:ring-4 focus:ring-green-500/50"
              style={{
                background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
                boxShadow: '0 0 24px rgba(34, 197, 94, 0.4), 0 10px 30px rgba(0, 0, 0, 0.3)',
                color: '#000',
                border: '2px solid rgba(255, 255, 255, 0.2)',
              }}
            >
              CONNECT & START PRAYING
            </button>
          </div>
        ) : (
          /* CONNECTED - Show terminal immediately */
          <section className="vista-window vista-window--media flex flex-col h-[75vh] max-h-[75vh] mb-4 overflow-hidden">
            <div className="vista-window__titlebar flex-shrink-0">
              <div className="vista-window__controls" aria-hidden="true">
                <span className="vista-window__control vista-window__control--minimize" />
                <span className="vista-window__control vista-window__control--restore" />
                <span className="vista-window__control vista-window__control--close" />
              </div>
              <span className="vista-window__title text-[12px]">
                <Image
                  src="/foidmommy.gif"
                  alt=""
                  width={40}
                  height={40}
                  className="inline-block h-10 w-10"
                />
                {" "}foid_mommy_terminal.exe
              </span>
            </div>

            <div className="vista-window__body vista-window__body--flush flex-1 min-h-0 overflow-hidden !border-0 !bg-transparent">
              {/* Wrong Chain Warning */}
              {wrongChain && (
                <div className="px-3 py-2 bg-yellow-900/20 border-b border-yellow-500/30 flex-shrink-0">
                  <p className="text-xs text-yellow-400 font-terminal">⚠ SWITCH TO FLUENT TESTNET</p>
                </div>
              )}

              {/* Terminal */}
              <div className="flex-1 min-h-0 relative pray-liquid-glass-terminal overflow-hidden">
                <div className="frutiger-terminal flicker w-full h-full flex flex-col">
                  <FoidMommyTerminal
                    className="w-full h-full min-h-0 mobile-terminal"
                    ensureWalletReady={ensureWalletReady}
                    submitPrayer={submitPrayer}
                    waitForReceipt={waitForReceipt}
                    nextAllowedAt={nextAllowed as bigint | undefined}
                    registryReady={!missingRegistry}
                    chainOk={!wrongChain}
                    requiredChainId={FLUENT_CHAIN_ID}
                    autoStart={false}
                  />
                </div>
              </div>
            </div>
          </section>
        )}
      </div>

      {/* Desktop Layout */}
      <div className="hidden lg:block pray-page__shell max-w-full">
        <div className="pray-shell max-w-full">
          <div className="pray-grid">
            <div className="pray-window-frame">
              <div className="vista-window vista-window--terminal w-full flex flex-col pray-panel pray-panel--main">
          {/* Titlebar */}
          <AppTitlebar
            title="FOID_MOMMY_TERMINAL.EXE"
            chainId={FLUENT_CHAIN_ID}
            connected={isConnected}
            address={address}
            onDisconnect={() => disconnect()}
            onSwitchWallet={handleSwitchWallet}
            warnings={titlebarWarnings}
          />
            <div className="vista-window__body vista-window__body--flush mt-2 pray-panel__body">
              <div className="pray-main-grid">
                {/* Terminal pane */}
                <div className="pray-pane pray-pane--terminal pray-liquid-glass-terminal">
                  <svg className="pray-bracket pray-bracket--tl" width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M2 22V2H22" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                  <svg className="pray-bracket pray-bracket--tr" width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M22 22V2H2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                  <svg className="pray-bracket pray-bracket--bl" width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M2 2V22H22" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                  <svg className="pray-bracket pray-bracket--br" width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M22 2V22H2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>

                  <div className="frutiger-terminal flicker w-full flex min-h-0 flex-1 flex-col">
                    <FoidMommyTerminal
                      className="w-full h-full min-h-0"
                      ensureWalletReady={ensureWalletReady}
                      submitPrayer={submitPrayer}
                      waitForReceipt={waitForReceipt}
                      nextAllowedAt={nextAllowed as bigint | undefined}
                      registryReady={!missingRegistry}
                      chainOk={!wrongChain}
                      requiredChainId={FLUENT_CHAIN_ID}
                      autoStart={true}
                    />
                  </div>
                </div>

                {/* Manual pane - no header */}
                <div className="pray-pane pray-pane--manual pray-pane--panel">
                  <div className="pray-pane__body pray-pane__body--no-header">
                    <div className="pray-scroll space-y-4 text-sm">
                      <h3 className="pray-manual__hero">F O I D &nbsp;&nbsp; M O M M Y</h3>
                      <span className="pray-manual__label">WELCOME TO FOID_MOMMY_TERMINAL.EXE</span>
                      <p className="pray-manual__intro">
                        <span className="block">
                          foid_mommy_terminal.exe is a daily on-chain ritual. tell foid mommy how you&apos;re feeling,
                          she&apos;ll listen and construct a prayer. submit your prayer on-chain, so your proof of prayer
                          is recorded. your message is private. it&apos;s hashed locally and only the hash is anchored
                          on-chain. show up each day to build your streak. the more you pray, the bigger your mifoid&apos;s
                          boobs will be.
                        </span>
                      </p>
                    </div>
                  </div>
                </div>

                {/* Stats pane */}
                <div className="pray-pane pray-pane--stats pray-pane--panel">
                  <div className="pray-pane__title">YOUR PRAYERS</div>
                  <div className="pray-pane__body font-terminal text-xs sm:text-[13px] leading-snug">
                    <div className="pray-scroll">
                      <div className="pray-stats-grid" role="region" aria-label="Prayer statistics">
                        <div className="pray-stats-cell" role="status" aria-label="Current prayer streak">
                          <span className="pray-stats-cell__label">CURRENT STREAK</span>
                          <span className="pray-stats-cell__value pray-stats-cell__value--primary" aria-live="polite">
                            {statsLoading ? (
                              <span className="animate-pulse opacity-50">···</span>
                            ) : (
                              <>
                                {displayStreak?.toString?.() ?? (address ? "0" : "–")}
                                {optimisticStreak !== null && <span className="text-xs ml-1 opacity-60">↑</span>}
                              </>
                            )}
                          </span>
                        </div>
                        <div className="pray-stats-cell" role="status" aria-label="Longest prayer streak">
                          <span className="pray-stats-cell__label">LONGEST STREAK</span>
                          <span className="pray-stats-cell__value" aria-live="polite">
                            {statsLoading ? (
                              <span className="animate-pulse opacity-50">···</span>
                            ) : (
                              displayLongest?.toString?.() ?? (address ? "0" : "–")
                            )}
                          </span>
                        </div>
                        <div className="pray-stats-cell" role="status" aria-label="Total prayers submitted">
                          <span className="pray-stats-cell__label">TOTAL PRAYERS</span>
                          <span className="pray-stats-cell__value" aria-live="polite">
                            {statsLoading ? (
                              <span className="animate-pulse opacity-50">···</span>
                            ) : (
                              <>
                                {displayTotal?.toString?.() ?? (address ? "0" : "–")}
                                {optimisticTotal !== null && <span className="text-xs ml-1 opacity-60">↑</span>}
                              </>
                            )}
                          </span>
                        </div>
                        <div className="pray-stats-cell" role="status" aria-label="Prayer milestones reached">
                          <span className="pray-stats-cell__label">MILESTONES</span>
                          <span className="pray-stats-cell__value" aria-live="polite">
                            {statsLoading ? (
                              <span className="animate-pulse opacity-50">···</span>
                            ) : (
                              displayMilestones?.toString?.() ?? (address ? "0" : "–")
                            )}
                          </span>
                        </div>
                      </div>
                        <div className="pray-chain-info" role="region" aria-label="On-chain prayer information">
                          <div className="pray-chain-info__row">
                            <span className="pray-chain-info__label">prayer hash</span>
                            <span className="pray-chain-info__value pray-chain-info__value--hash" aria-label={`Prayer hash: ${formattedPrayerHash}`}>{formattedPrayerHash}</span>
                          </div>
                          <div className="pray-chain-info__row">
                            <span className="pray-chain-info__label">chain</span>
                            <span className="pray-chain-info__value" aria-label={`Chain ID: ${TARGET_CHAIN_ID}`}>{TARGET_CHAIN_ID}</span>
                          </div>
                          <div className="pray-chain-info__row">
                            <span className="pray-chain-info__label">next allowed in</span>
                            <span
                              className={`pray-chain-info__value ${!cooldownActive ? "pray-chain-info__value--ready" : ""}`}
                              role="timer"
                              aria-live="polite"
                              aria-label={cooldownActive ? `Next prayer allowed in ${formatDurationShort(secondsLeft(nowSeconds, nextAllowed as bigint | undefined))}` : "Ready to pray now"}
                            >
                              {nextAllowedLoading ? (
                                <span className="animate-pulse opacity-50">loading...</span>
                              ) : (
                                canRenderTime ? formatDurationShort(secondsLeft(nowSeconds, nextAllowed as bigint | undefined)) : "—"
                              )}
                            </span>
                          </div>
                          {cooldownActive && (
                            <div className="pray-chain-info__row">
                              <span className="pray-chain-info__label">next window</span>
                              <span className="pray-chain-info__value" aria-label={`Next prayer window opens at ${nextWindowLabel}`}>{nextWindowLabel}</span>
                            </div>
                          )}
                        </div>
                        {missingMirror && <div className="pray-stats-notice">stats unavailable (mirror not set).</div>}
                        {walletDisconnected && <div className="pray-stats-notice">connect your wallet to start logging prayers.</div>}
                      </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>

      {/* Enhanced styles */}
      <style jsx>{`
        :global(.pray-dashboard) { background: transparent !important; }
        .pray-page {
          display: flex;
          justify-content: center;
          align-items: center;
          position: relative;
          min-height: min(100svh, 100dvh);
          min-height: 100svh;
          min-height: 100dvh;
          background: transparent;
          overflow: auto;
          padding: 0;
          width: 100%;
          z-index: 0;
          overscroll-behavior: contain;
        }
        .pray-page__shell {
          display: flex;
          flex-direction: column;
          align-items: stretch;
          justify-content: center;
          flex: 1;
          width: 100%;
          max-width: 100%;
          padding: clamp(12px, 3vw, 24px);
          gap: 12px;
        }
        .pray-window-frame {
          width: min(1800px, calc(100vw - clamp(28px, 5vw, 44px)));
          max-width: 100%;
          max-height: calc(100svh - clamp(32px, 4vw, 48px));
          height: min(100svh, 100dvh);
          margin: 0 auto;
          display: flex;
          flex-direction: column;
          min-height: 0;
          overflow: hidden;
        }
        .pray-window-frame > .vista-window {
          border: none !important;
          box-shadow: none !important;
          width: 100%;
          height: 100%;
          max-height: 100%;
          min-height: 0;
          background: rgba(6, 10, 18, 0.8);
        }
        .pray-window-frame .vista-window__body {
          background:
            linear-gradient(
              to right,
              rgba(140, 235, 255, 0.07) 1px,
              transparent 1px
            ),
            linear-gradient(
              to bottom,
              rgba(140, 235, 255, 0.07) 1px,
              transparent 1px
            ),
            linear-gradient(
              180deg,
              rgba(92, 191, 232, 0.16) 0%,
              rgba(8, 18, 30, 0.6) 55%,
              rgba(5, 10, 22, 0.9) 100%
            ),
            linear-gradient(
              180deg,
              rgba(255, 255, 255, 0.05) 0%,
              rgba(255, 255, 255, 0) 65%
            );
          box-shadow: none;
          height: 100%;
        }
        :global(.vignette) {
          background-color: transparent !important;
          background-image: radial-gradient(ellipse at center, rgba(0,0,0,0) 0%, rgba(0,0,0,0.25) 55%, rgba(0,0,0,0.35) 100%) !important;
          opacity: 0.55;
        }

        .pray-main-grid {
          display: grid;
          grid-template-columns: 1.8fr 1fr;
          padding: 16px;
          gap: 20px;
          width: 100%;
          height: 100%;
        }

        .pray-pane {
          display: flex;
          flex-direction: column;
          min-height: 0;
          overflow: hidden;
        }

        .pray-pane__body {
          flex: 1;
          min-height: 0;
          overflow: auto;
          -webkit-overflow-scrolling: touch;
          height: 100%;
        }

        /* Terminal pane */
        .pray-liquid-glass-terminal {
          position: relative;
          background: transparent !important;
          border-radius: 12px;
          overflow: hidden;
          padding: 16px;
          border: none !important;
          box-shadow: none !important;
        }
        
        .pray-liquid-glass-terminal::before {
          content: '';
          position: absolute;
          inset: 0;
          border-radius: 12px;
          padding: 1px;
          background: linear-gradient(135deg, rgba(255, 255, 255, 0.08) 0%, rgba(255, 255, 255, 0.02) 40%, rgba(255, 255, 255, 0.02) 60%, rgba(255, 255, 255, 0.08) 100%);
          -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
          -webkit-mask-composite: xor;
          mask-composite: exclude;
          pointer-events: none;
        }
        
        .pray-liquid-glass-terminal :global(.frutiger-terminal) {
          background: transparent !important;
          border: none !important;
          box-shadow: none !important;
          padding: 12px 16px;
        }
        
        .pray-liquid-glass-terminal :global(.frutiger-terminal *) { border-color: transparent; }
        
        /* Input styling with spacing fix */
        .pray-liquid-glass-terminal :global(.foid-terminal__prompt) { margin-right: 12px; }
        .pray-liquid-glass-terminal :global(.foid-terminal__field) { padding-left: 8px; }
        .pray-liquid-glass-terminal :global(.foid-terminal__field)::placeholder {
          font-size: 0.85em;
          padding-left: 4px;
        }
        .pray-liquid-glass-terminal :global(.foid-terminal__input) {
          border: 1px solid rgba(0, 255, 213, 0.3) !important;
          background: rgba(0, 20, 30, 0.4) !important;
        }
        
        /* Status indicator */
        .pray-status-indicator { display: flex; align-items: center; gap: 8px; }
        .pray-status-dot { width: 8px; height: 8px; border-radius: 50%; }
        .pray-status-dot--online {
          background: #00ffd5;
          box-shadow: 0 0 10px rgba(0, 255, 213, 0.8), 0 0 20px rgba(0, 255, 213, 0.4);
          animation: pray-pulse 2s ease-in-out infinite;
        }
        .pray-status-dot--offline { background: #ff4757; box-shadow: 0 0 8px rgba(255, 71, 87, 0.6); }
        .pray-status-text { font-size: 11px; letter-spacing: 0.08em; color: rgba(255, 255, 255, 0.7); }
        @keyframes pray-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.6; } }
        
        /* Clean Wallet Dropdown */
        .pray-wallet-pill {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 4px 10px;
          background: linear-gradient(180deg, rgba(233, 221, 80, 0.95), rgba(214, 180, 52, 0.95));
          border: 1px solid rgba(26, 26, 26, 0.6);
          border-radius: 9px;
          min-height: 28px;
          font-size: 9px;
          font-weight: 600;
          letter-spacing: 0.12em;
          color: #1a1a1a;
          cursor: pointer;
          transition: border-color 0.2s ease, transform 0.2s ease;
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.45), 0 4px 10px rgba(0, 0, 0, 0.25);
        }
        .pray-wallet-pill:hover {
          border-color: rgba(26, 26, 26, 0.8);
          transform: translateY(-1px);
        }
        .pray-wallet-pill__label {
          font-size: 8px;
          letter-spacing: 0.2em;
          text-transform: uppercase;
        }
        .pray-wallet-pill__address {
          font-size: 10px;
          font-family: var(--font-mono, monospace);
          color: #0f0f0f;
        }
        .pray-wallet-chevron {
          color: #0f0f0f;
          transition: transform 0.2s ease;
        }
        .pray-wallet-chevron--open { transform: rotate(180deg); }
        
        :global(.pray-wallet-menu) {
          display: flex;
          flex-direction: column;
          gap: 6px;
          background: linear-gradient(180deg, rgba(233, 221, 80, 0.95), rgba(214, 180, 52, 0.95));
          border: 1px solid rgba(26, 26, 26, 0.6);
          border-radius: 10px;
          padding: 8px;
          z-index: 9999;
          box-shadow: 0 12px 36px rgba(0, 0, 0, 0.45), 0 0 0 1px rgba(26, 26, 26, 0.35);
          animation: pray-dropdown-enter 0.16s ease-out;
        }
        @keyframes pray-dropdown-enter { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: translateY(0); } }

        :global(.pray-wallet-menu__item) {
          display: block;
          width: 100%;
          padding: 8px 10px;
          background: #fff0d8;
          border: 1px solid rgba(26, 26, 26, 0.25);
          border-radius: 6px;
          color: #1a1a1a;
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          cursor: pointer;
          transition: border-color 0.12s ease, background 0.12s ease;
          text-align: left;
        }
        :global(.pray-wallet-menu__item:hover) {
          background: #ffefaf;
          border-color: rgba(26, 26, 26, 0.5);
        }
        :global(.pray-wallet-menu__item--danger) {
          background: #ffd7db;
          border-color: rgba(26, 26, 26, 0.3);
          color: #1a1a1a;
        }
        :global(.pray-wallet-menu__item--danger:hover) {
          background: #ff7a89;
          border-color: rgba(26, 26, 26, 0.5);
          color: #1a1a1a;
        }
        
        /* Corner brackets */
        .pray-bracket {
          position: absolute;
          color: rgba(0, 255, 213, 0.4);
          z-index: 10;
          pointer-events: none;
          filter: drop-shadow(0 0 4px rgba(0, 255, 213, 0.4));
        }
        .pray-bracket--tl { top: 18px; left: 18px; }
        .pray-bracket--tr { top: 18px; right: 18px; }
        .pray-bracket--bl { bottom: 18px; left: 18px; }
        .pray-bracket--br { bottom: 18px; right: 18px; }
        
        /* Manual pane - no header */
        .pray-pane__body--no-header { padding-top: 0; }
        .pray-manual__hero {
          font-size: 18px;
          font-weight: 700;
          letter-spacing: 0.25em;
          color: #00ffd5;
          text-shadow: 0 0 20px rgba(0, 255, 213, 0.5);
          margin-bottom: 10px;
        }
        .pray-manual__intro {
          font-size: 12px;
          line-height: 1.6;
          color: rgba(255, 255, 255, 0.75);
          padding-bottom: 10px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
        }
        .pray-manual__section { margin-bottom: 10px; }
        .pray-manual__label {
          display: block;
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 0.18em;
          color: #00ffd5;
          margin-bottom: 5px;
          opacity: 0.9;
        }
        .pray-manual__list { list-style: none; padding: 0; margin: 0; }
        .pray-manual__list li {
          display: flex;
          gap: 6px;
          font-size: 11px;
          line-height: 1.45;
          color: rgba(255, 255, 255, 0.7);
          padding: 2px 0;
        }
        .pray-manual__list li span { color: rgba(0, 255, 213, 0.6); font-weight: 600; min-width: 16px; }
        .pray-manual__text { font-size: 11px; line-height: 1.45; color: rgba(255, 255, 255, 0.65); }
        
        /* Stats grid */
        .pray-stats-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1px;
          background: rgba(0, 255, 255, 0.08);
          border-radius: 8px;
          overflow: hidden;
          margin-bottom: 16px;
        }
        .pray-stats-cell {
          display: flex;
          flex-direction: column;
          gap: 6px;
          padding: 14px 16px;
          background: rgba(0, 20, 35, 0.5);
          backdrop-filter: blur(4px);
          transition: background 0.2s ease;
        }
        .pray-stats-cell:hover { background: rgba(0, 40, 55, 0.6); }
        .pray-stats-cell__label { font-size: 9px; font-weight: 500; letter-spacing: 0.1em; color: rgba(255, 255, 255, 0.45); }
        .pray-stats-cell__value {
          font-size: 28px;
          font-weight: 700;
          font-family: var(--font-mono, monospace);
          color: #00ffd5;
          text-shadow: 0 0 16px rgba(0, 255, 213, 0.5);
          line-height: 1;
        }
        .pray-stats-cell__value--primary { color: #00ff88; text-shadow: 0 0 16px rgba(0, 255, 136, 0.6); }
        
        /* Chain info */
        .pray-chain-info { display: flex; flex-direction: column; }
        .pray-chain-info__row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 10px 0;
          border-bottom: 1px solid rgba(255, 255, 255, 0.05);
        }
        .pray-chain-info__row:last-child { border-bottom: none; }
        .pray-chain-info__label { font-size: 11px; color: rgba(255, 255, 255, 0.45); }
        .pray-chain-info__value { font-size: 12px; font-family: var(--font-mono, monospace); color: rgba(255, 255, 255, 0.8); }
        .pray-chain-info__value--hash { color: #00ffd5; }
        .pray-chain-info__value--ready { color: #00ff88; text-shadow: 0 0 8px rgba(0, 255, 136, 0.5); }
        
        .pray-stats-notice {
          margin-top: 14px;
          padding: 12px;
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 0.12em;
          color: rgba(255, 255, 255, 0.4);
          text-align: center;
          border: 1px dashed rgba(255, 255, 255, 0.1);
          border-radius: 6px;
          background: rgba(0, 0, 0, 0.15);
        }

        /* Glass backdrops */
        .pray-liquid-glass-terminal :global(.frutiger-terminal) {
          background: rgba(5, 12, 18, 0.55) !important;
          backdrop-filter: blur(14px) saturate(140%);
        }
        .pray-pane--panel {
          background: rgba(5, 12, 18, 0.55) !important;
          backdrop-filter: blur(14px) saturate(140%);
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.06), inset 0 -1px 0 rgba(0, 0, 0, 0.35);
          padding: 16px;
        }
        .pray-pane--panel > * { background: transparent !important; }
        .pray-main-grid { padding: 16px; gap: 20px; }

        @media (max-width: 1024px) {
          :global(.pray-dashboard) {
            height: auto;
            min-height: 100svh;
            overflow: visible;
          }
          .pray-page {
            position: relative;
            height: auto;
            min-height: 100svh;
            overflow: visible;
          }
          .pray-page__shell {
            padding: clamp(10px, 4vw, 16px);
          }
          .pray-window-frame {
            width: 100%;
            height: auto;
            min-height: 0;
          }
          .pray-window-frame > .vista-window {
            height: auto;
            min-height: 0;
          }
          .pray-panel__body {
            overflow: visible;
          }
          .pray-liquid-glass-terminal {
            padding: 18px;
          }
          .pray-liquid-glass-terminal :global(.frutiger-terminal) {
            padding: 14px 16px;
          }
          .pray-main-grid {
            padding: 12px;
            grid-template-columns: minmax(0, 1fr);
            grid-template-rows: auto;
            grid-template-areas:
              "terminal"
              "manual"
              "stats";
            gap: 16px;
          }
          .pray-window-frame {
            max-height: calc(100svh - clamp(64px, 10vw, 96px));
          }
          .pray-window-frame > .vista-window {
            max-height: none;
          }
        }

        @media (max-width: 768px) {
          /* Mobile: Match about page container sizing */
          .vista-window--media {
            height: 80vh !important;
            min-height: 80vh !important;
            max-height: 80vh !important;
          }
        }

        @media (max-width: 640px) {
          .pray-liquid-glass-terminal {
            padding: 14px;
          }
          .pray-liquid-glass-terminal :global(.frutiger-terminal) {
            padding: 12px;
          }
          .pray-bracket {
            display: none;
          }
          .pray-stats-cell__value {
            font-size: 22px;
          }
          .pray-window-frame {
            padding-bottom: calc(var(--safe-bottom, 0px) + 8px);
          }

          /* Ensure minimum 48px touch targets on mobile */
          button,
          :global(button),
          [role="button"],
          :global([role="button"]) {
            min-height: 48px;
            min-width: 48px;
          }

          /* Stats cells should be tappable */
          .pray-stats-cell {
            min-height: 80px;
            padding: 16px 18px;
          }

          /* Increase label font sizes for better readability */
          .pray-stats-cell__label {
            font-size: 11px;
          }

          .pray-chain-info__label {
            font-size: 12px;
          }

          .pray-chain-info__value {
            font-size: 13px;
          }
        }
      `}</style>
      <MobileWalletButton />
    </main>
  );
}

// Wrap with error boundary to prevent crashes
export default function PrayPage() {
  return (
    <PrayerErrorBoundary>
      <PrayPageContent />
    </PrayerErrorBoundary>
  );
}
