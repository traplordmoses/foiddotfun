"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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

const PrayerRegistryAbi = [
  {
    type: "function",
    name: "nextAllowedAt",
    stateMutability: "view",
    inputs: [{ name: "user", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
] as const;

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

export default function PrayPage() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { disconnect } = useDisconnect();
  const { connect, connectors } = useConnect();
  const { switchChainAsync } = useSwitchChain();
  const [nowSeconds, setNowSeconds] = useState<number | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [boardProposals, setBoardProposals] = useState<ApiProposal[]>([]);
  const [boardLoading, setBoardLoading] = useState(false);
  const [boardError, setBoardError] = useState<string | null>(null);
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

  const { data: snapLegacy, refetch: refetchSnapLegacy } = useReadContract({
    address: (MIRROR ?? "0x0000000000000000000000000000000000000000") as Hex,
    abi: PrayerMirrorAbiLegacy,
    functionName: "get",
    args: [((address ?? "0x0000000000000000000000000000000000000000") as Hex)],
    chainId: FLUENT_CHAIN_ID,
    query: { enabled: Boolean(address && MIRROR && FLUENT_CHAIN_ID) },
  });

  const { data: snapLite, refetch: refetchSnapLite } = useReadContract({
    address: (MIRROR ?? "0x0000000000000000000000000000000000000000") as Hex,
    abi: PrayerMirrorAbiLite,
    functionName: "get",
    args: [((address ?? "0x0000000000000000000000000000000000000000") as Hex)],
    chainId: FLUENT_CHAIN_ID,
    query: { enabled: Boolean(address && MIRROR && FLUENT_CHAIN_ID) },
  });

  const { data: nextAllowed, refetch: refetchNext } = useReadContract({
    address: (REGISTRY ?? "0x0000000000000000000000000000000000000000") as Hex,
    abi: PrayerRegistryAbi,
    functionName: "nextAllowedAt",
    args: [((address ?? "0x0000000000000000000000000000000000000000") as Hex)],
    chainId: FLUENT_CHAIN_ID,
    query: { enabled: Boolean(address && REGISTRY && FLUENT_CHAIN_ID) },
  });

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
        if ((e as any)?.name === "AbortError") return;
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
          // Wait a bit for the chain to switch
          await new Promise(resolve => setTimeout(resolve, 500));
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
        console.warn("prayer gas estimation failed, using fallback:", error);
        // Fallback: 200k gas should be enough for prayers
        gasEstimate = BigInt(200_000);
      }
      const gasMargin = (gasEstimate * 20n) / 100n;
      const gasLimit = gasEstimate + (gasMargin > 0 ? gasMargin : 1n);

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
        const message = formatViemError(error);
        console.error("prayer send failed:", message, error);
        throw new Error(message);
      }
    },
    [address, chainId, FLUENT_CHAIN_ID, publicClient, switchChainAsync],
  );

  const waitForReceipt = useCallback(async (hash: string) => {
    if (publicClient) await publicClient.waitForTransactionReceipt({ hash: hash as Hash });
    const tasks: Promise<unknown>[] = [];
    if (snapRef.current) tasks.push(snapRef.current());
    if (nextRef.current) tasks.push(nextRef.current());
    if (tasks.length) await Promise.allSettled(tasks);
  }, [publicClient]);

  const handleSwitchWallet = useCallback(() => {
    disconnect();
    setTimeout(() => {
      const connector = connectors[0];
      if (connector) connect({ connector });
    }, 100);
  }, [disconnect, connect, connectors]);

  const snap = snapLegacy ?? snapLite;
  const snapValues = snap as readonly unknown[] | undefined;
  const prayerHash = snapValues && snapValues.length > 4 ? (snapValues.length > 5 ? snapValues[5] : snapValues[4]) : undefined;
  const formattedPrayerHash = typeof prayerHash === "string" ? shortHash(prayerHash) : "–";
  const canRenderTime = nowSeconds !== null;
  const nextAllowedSecondsRaw = typeof nextAllowed === "bigint" ? Number(nextAllowed) : typeof nextAllowed === "number" ? nextAllowed : null;
  const cooldownActive = canRenderTime && typeof nextAllowedSecondsRaw === "number" && nextAllowedSecondsRaw > nowSeconds;
  const nextWindowLabel = cooldownActive
    ? new Date(nextAllowedSecondsRaw * 1000).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
    : "";

  return (
    <main className="pray-page relative pray-dashboard bg-transparent text-white/90">
      <div className="pointer-events-none fixed inset-0 z-0 vignette" />
      <div className="pray-page__shell">
        <div className="pray-shell">
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
                      <div className="pray-manual__section">
                        <span className="pray-manual__label">HOW TO USE</span>
                        <ol className="pray-manual__list">
                          <li><span>1.</span> 1. type a prayer in the terminal</li>
                          <li><span>2.</span> 2. foid mommy listens and constructs a prayer</li>
                          <li><span>3.</span> 3. submit your prayer, for your proof of prayer</li>
                        </ol>
                      </div>
                      <div className="pray-manual__section">
                        <span className="pray-manual__label">DAILY RULES</span>
                        <p className="pray-manual__text">you can only pray once every 24 hours.</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Stats pane */}
                <div className="pray-pane pray-pane--stats pray-pane--panel">
                  <div className="pray-pane__title">YOUR PRAYERS</div>
                  <div className="pray-pane__body font-terminal text-xs sm:text-[13px] leading-snug">
                    <div className="pray-scroll">
                      <div className="pray-stats-grid">
                        <div className="pray-stats-cell">
                          <span className="pray-stats-cell__label">CURRENT STREAK</span>
                          <span className="pray-stats-cell__value pray-stats-cell__value--primary">{snap?.[0]?.toString?.() ?? (address ? "0" : "–")}</span>
                        </div>
                        <div className="pray-stats-cell">
                          <span className="pray-stats-cell__label">LONGEST STREAK</span>
                          <span className="pray-stats-cell__value">{snap?.[1]?.toString?.() ?? (address ? "0" : "–")}</span>
                        </div>
                        <div className="pray-stats-cell">
                          <span className="pray-stats-cell__label">TOTAL PRAYERS</span>
                          <span className="pray-stats-cell__value">{snap?.[2]?.toString?.() ?? (address ? "0" : "–")}</span>
                        </div>
                        <div className="pray-stats-cell">
                          <span className="pray-stats-cell__label">MILESTONES</span>
                          <span className="pray-stats-cell__value">{snap?.[3]?.toString?.() ?? (address ? "0" : "–")}</span>
                        </div>
                      </div>
                        <div className="pray-chain-info">
                          <div className="pray-chain-info__row"><span className="pray-chain-info__label">prayer hash</span><span className="pray-chain-info__value pray-chain-info__value--hash">{formattedPrayerHash}</span></div>
                          <div className="pray-chain-info__row"><span className="pray-chain-info__label">chain</span><span className="pray-chain-info__value">{TARGET_CHAIN_ID}</span></div>
                          <div className="pray-chain-info__row"><span className="pray-chain-info__label">next allowed in</span><span className={`pray-chain-info__value ${!cooldownActive ? "pray-chain-info__value--ready" : ""}`}>{canRenderTime ? formatDurationShort(secondsLeft(nowSeconds, nextAllowed as bigint | undefined)) : "—"}</span></div>
                          {cooldownActive && <div className="pray-chain-info__row"><span className="pray-chain-info__label">next window</span><span className="pray-chain-info__value">{nextWindowLabel}</span></div>}
                        </div>
                        <div className="mt-4 border-t border-white/10 pt-4">
                          <div className="flex items-center justify-between">
                            <span className="pray-chain-info__label">loreboard history</span>
                            <span className="pray-chain-info__value" style={{ fontSize: 11, opacity: 0.8 }}>
                              {boardLoading ? "loading…" : `${boardProposals.length} total`}
                            </span>
                          </div>

                          {boardError && (
                            <div className="mt-2 text-[10px] uppercase tracking-[0.12em] text-white/45">
                              failed to load placements: {boardError}
                            </div>
                          )}

                          {!boardError && !boardLoading && boardProposals.length === 0 && (
                            <div className="mt-2 text-[10px] uppercase tracking-[0.12em] text-white/45">
                              no placements found for this wallet yet.
                            </div>
                          )}

                          <div className="mt-3 space-y-2">
                            {boardProposals.slice(0, 8).map((p) => {
                              const yes = safeNumber(p.yes);
                              const no = safeNumber(p.no);
                              const total = yes + no;
                              const pctYes = typeof p.percentYes === "number" ? p.percentYes : total ? yes / total : 0;
                              const seconds = safeNumber(p.secondsLeft);
                              const status = p.isVotable ? "voting" : total > 0 ? "resolved" : "queued";
                              const title = (p.cid ?? p.name ?? p.id ?? "").replace(/^ipfs:\/\//, "");

                              return (
                                <div
                                  key={`${p.id}-${p.epochSubmitted}`}
                                  className="rounded-md border border-white/10 bg-black/10 px-3 py-2"
                                >
                                  <div className="flex items-center justify-between gap-3">
                                    <div className="min-w-0">
                                      <div className="truncate text-[11px] font-terminal text-white/85">
                                        epoch {safeNumber(p.epochSubmitted)} • {status}
                                      </div>
                                      <div className="truncate text-[10px] font-terminal text-white/45">
                                        {shortId(title) || shortId(p.id)}
                                      </div>
                                    </div>

                                    <div className="flex shrink-0 flex-col items-end">
                                      <div className="text-[10px] font-terminal text-white/70">
                                        {total ? `${yes}/${total} yes` : "no votes"}
                                      </div>
                                      <div className={`text-[10px] font-terminal ${seconds > 0 ? "text-white/60" : "text-white/35"}`}>
                                        {seconds > 0 ? formatDurationShort(seconds) : "—"}
                                      </div>
                                    </div>
                                  </div>

                                  <div className="mt-2 h-[6px] w-full overflow-hidden rounded-full bg-white/10">
                                    <div
                                      className="h-full rounded-full bg-white/40"
                                      style={{ width: `${Math.round(Math.max(0, Math.min(1, pctYes)) * 100)}%` }}
                                    />
                                  </div>
                                </div>
                              );
                            })}
                          </div>
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
          padding: 28px;
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
          padding: 20px 24px;
        }
        
        .pray-liquid-glass-terminal :global(.frutiger-terminal *) { border-color: transparent; }
        
        /* Input styling with spacing fix */
        .pray-liquid-glass-terminal :global(.foid-terminal__prompt) { margin-right: 12px; }
        .pray-liquid-glass-terminal :global(.foid-terminal__field) { padding-left: 8px; }
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
        }
      `}</style>
    </main>
  );
}
