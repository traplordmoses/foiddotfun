"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import AppTitlebar, { type AppTitlebarWarning } from "@/app/(components)/AppTitlebar";
import { useAccount, usePublicClient, useReadContract, useWriteContract, useDisconnect, useConnect } from "wagmi";
import { keccak256, stringToBytes, type Hex, type Hash } from "viem";
import FoidMommyTerminal, {
  FEELING_LABELS,
  type FeelingKey,
} from "@/app/(components)/FoidMommyTerminal";

/* --- env --- */
function resolveEnv(): { registry?: Hex; mirror?: Hex; chainId: number } {
  let registry: string | undefined;
  let mirror: string | undefined;
  let chainId = 20994;

  try {
    if (typeof window !== "undefined") {
      const sp = new URLSearchParams(window.location.search);
      registry = sp.get("registry") ?? undefined;
      mirror = sp.get("mirror") ?? undefined;
      const chainParam = sp.get("chain");
      if (chainParam) chainId = Number(chainParam);
    }
    const g: any = (globalThis as any) ?? {};
    if (!registry && g.__ENV__?.NEXT_PUBLIC_FOIP_REGISTRY) registry = g.__ENV__.NEXT_PUBLIC_FOIP_REGISTRY;
    if (!mirror && g.__ENV__?.NEXT_PUBLIC_FOIP_MIRROR) mirror = g.__ENV__.NEXT_PUBLIC_FOIP_MIRROR;
    if (g.__ENV__?.NEXT_PUBLIC_FLUENT_CHAIN_ID && !Number.isNaN(Number(g.__ENV__.NEXT_PUBLIC_FLUENT_CHAIN_ID))) {
      chainId = Number(g.__ENV__.NEXT_PUBLIC_FLUENT_CHAIN_ID);
    }
    if (typeof process !== "undefined" && (process as any).env) {
      const env: any = (process as any).env;
      if (!registry && env.NEXT_PUBLIC_FOIP_REGISTRY) registry = env.NEXT_PUBLIC_FOIP_REGISTRY;
      if (!mirror && env.NEXT_PUBLIC_FOIP_MIRROR) mirror = env.NEXT_PUBLIC_FOIP_MIRROR;
      if (env.NEXT_PUBLIC_FLUENT_CHAIN_ID && !Number.isNaN(Number(env.NEXT_PUBLIC_FLUENT_CHAIN_ID))) {
        chainId = Number(env.NEXT_PUBLIC_FLUENT_CHAIN_ID);
      }
    }
  } catch {}
  return { registry: registry as Hex | undefined, mirror: mirror as Hex | undefined, chainId };
}

const PrayerRegistryAbi = [
  {
    type: "function",
    name: "checkIn",
    stateMutability: "nonpayable",
    inputs: [
      { name: "prayer_hash", type: "bytes32" },
      { name: "label", type: "uint8" },
    ],
    outputs: [
      { type: "uint256" }, { type: "uint256" }, { type: "uint256" }, { type: "uint256" },
      { type: "uint256" }, { type: "bytes32" }, { type: "uint256" }, { type: "uint256" },
    ],
  },
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


export default function PrayPage() {
  const { address, isConnected, chainId } = useAccount();
  const { writeContractAsync } = useWriteContract();
  const { disconnect } = useDisconnect();
  const { connect, connectors } = useConnect();
  const [mobileTab, setMobileTab] = useState<"terminal" | "manual" | "stats">("terminal");
  const [walletDropdownOpen, setWalletDropdownOpen] = useState(false);
  const [nowSeconds, setNowSeconds] = useState<number | null>(null);

  const env = useMemo(resolveEnv, []);
  const REGISTRY = env.registry;
  const MIRROR = env.mirror;
  const FLUENT_CHAIN_ID = env.chainId;
  const missingRegistry = !REGISTRY;
  const missingMirror = !MIRROR;
  const walletDisconnected = !isConnected || !address;
  const wrongChain = Boolean(isConnected && chainId && FLUENT_CHAIN_ID && chainId !== FLUENT_CHAIN_ID);
  const titlebarWarnings: AppTitlebarWarning[] = [];
  if (missingRegistry) titlebarWarnings.push({ key: "registry", message: "missing registry", variant: "error" });
  if (wrongChain) titlebarWarnings.push({ key: "chain", message: `wrong chain ${FLUENT_CHAIN_ID ?? "?"}`, variant: "mint" });
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

  const ensureWalletReady = useCallback(async () => {
    if (!isConnected || !address) throw new Error("please connect your wallet before anchoring your prayer.");
    if (FLUENT_CHAIN_ID && chainId && chainId !== FLUENT_CHAIN_ID) {
      throw new Error(`switch to fluent testnet (chain id ${FLUENT_CHAIN_ID}) to continue.`);
    }
  }, [FLUENT_CHAIN_ID, address, chainId, isConnected]);

  const submitPrayer = useCallback(async (prayer: string, feeling: FeelingKey) => {
    const registryAddress = registryRef.current;
    if (!registryAddress) throw new Error("missing registry address on this page.");
    const prayerHash = keccak256(stringToBytes(prayer));
    const label = FEELING_LABELS[feeling] ?? 1;
    const txHash = await writeContractAsync({
      address: registryAddress,
      abi: PrayerRegistryAbi,
      functionName: "checkIn",
      args: [prayerHash, label],
    });
    return { txHash };
  }, [writeContractAsync]);

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
    <main className="relative pray-dashboard bg-transparent text-white/90">
      <div className="pointer-events-none fixed inset-0 z-0 vignette" />
      <div className="pray-shell">
        <div className="pray-grid">
          <div className="vista-window vista-window--terminal w-full flex flex-col pray-panel pray-panel--main">
          {/* Titlebar */}
          <AppTitlebar
            title="FOID_MOMMY_PRAY.EXE"
            chainId={FLUENT_CHAIN_ID}
            connected={isConnected}
            address={address}
            isWalletDropdownOpen={walletDropdownOpen}
            onToggleWallet={() => setWalletDropdownOpen((prev) => !prev)}
            onDisconnect={() => disconnect()}
            onSwitchWallet={handleSwitchWallet}
            warnings={titlebarWarnings}
          />
            <div className="vista-window__body vista-window__body--flush mt-2 pray-panel__body">
              <div className="pray-mobile-tabs" role="tablist" aria-label="Prayer panels">
                <button type="button" role="tab" aria-selected={mobileTab === "terminal"} className={`pray-tab ${mobileTab === "terminal" ? "is-active" : ""}`} onClick={() => setMobileTab("terminal")}>Terminal</button>
                <button type="button" role="tab" aria-selected={mobileTab === "manual"} className={`pray-tab ${mobileTab === "manual" ? "is-active" : ""}`} onClick={() => setMobileTab("manual")}>Manual</button>
                <button type="button" role="tab" aria-selected={mobileTab === "stats"} className={`pray-tab ${mobileTab === "stats" ? "is-active" : ""}`} onClick={() => setMobileTab("stats")}>Stats</button>
              </div>

              <div className="pray-main-grid">
                {/* Terminal pane */}
                <div className={`pray-pane pray-pane--terminal pray-liquid-glass-terminal ${mobileTab === "terminal" ? "" : "pray-pane--mobile-hidden"}`}>
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
                <div className={`pray-pane pray-pane--manual pray-pane--panel ${mobileTab === "manual" ? "" : "pray-pane--mobile-hidden"}`}>
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
                <div className={`pray-pane pray-pane--stats pray-pane--panel ${mobileTab === "stats" ? "" : "pray-pane--mobile-hidden"}`}>
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
                        <div className="pray-chain-info__row"><span className="pray-chain-info__label">chain</span><span className="pray-chain-info__value">{FLUENT_CHAIN_ID ?? "?"}</span></div>
                        <div className="pray-chain-info__row"><span className="pray-chain-info__label">next allowed in</span><span className={`pray-chain-info__value ${!cooldownActive ? "pray-chain-info__value--ready" : ""}`}>{canRenderTime ? formatDurationShort(secondsLeft(nowSeconds, nextAllowed as bigint | undefined)) : "—"}</span></div>
                        {cooldownActive && <div className="pray-chain-info__row"><span className="pray-chain-info__label">next window</span><span className="pray-chain-info__value">{nextWindowLabel}</span></div>}
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

      {/* Enhanced styles */}
      <style jsx>{`
        :global(.pray-dashboard) { background: transparent !important; }
        :global(.vignette) {
          background-color: transparent !important;
          background-image: radial-gradient(ellipse at center, rgba(0,0,0,0) 0%, rgba(0,0,0,0.25) 55%, rgba(0,0,0,0.55) 100%) !important;
          opacity: 0.85;
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
          background: linear-gradient(135deg, rgba(0,255,213,0.3) 0%, rgba(0,180,200,0.1) 25%, rgba(0,255,255,0.15) 50%, rgba(0,180,200,0.1) 75%, rgba(0,255,213,0.3) 100%);
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
      `}</style>
    </main>
  );
}
