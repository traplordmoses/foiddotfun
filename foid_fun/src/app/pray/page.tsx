"use client";

import type { CSSProperties } from "react";
import { startTransition, useCallback, useEffect, useMemo, useRef, useState } from "react";
import AppTitlebar, { type AppTitlebarWarning } from "@/app/(components)/AppTitlebar";

import { useAccount, useChainId, usePublicClient, useReadContract, useDisconnect, useSwitchChain } from "wagmi";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { encodeAbiParameters, keccak256, stringToBytes, type Address, type Hex, type Hash } from "viem";
import FoidMommyTerminal, {
  FEELING_LABELS,
  type FeelingKey,
} from "@/app/(components)/FoidMommyTerminal";
import { getWalletClient, publicClient as staticPublicClient, isEmbeddedWalletActive } from "@/lib/viem";
import { formatViemError } from "@/lib/prayerErrors";
import { TARGET_CHAIN_ID } from "@/lib/chain";
import { MobileWalletButton } from "@/components/MobileWalletButton";
import { useHaptic } from "@/hooks/useHaptic";
import { tierAccent } from "@/lib/tierAccent";
import { PRAYER_REGISTRY_ABI } from "@/lib/contracts/abis/prayerRegistry";
import { PRAYER_MIRROR_ABI } from "@/lib/contracts/abis/prayerMirror";
import { parseEventLogs } from "viem";
import { PrayerErrorBoundary } from "@/components/PrayerErrorBoundary";
import { PrayErrorBoundary } from "./PrayErrorBoundary";
import { getTierFromStreak } from "@/hooks/usePrayerTiers";
import { usePrayerMemory, type JournalEntry } from "@/hooks/usePrayerMemory";
import { usePWAInstallPrompt } from "@/hooks/usePWAInstallPrompt";
import PrayerAltarStrip from "@/components/PrayerAltarStrip";
import PrayerJournalDrawer from "@/components/PrayerJournalDrawer";
import PrayerBoot from "@/components/PrayerBoot";
import TierUnlockCinematic from "@/components/TierUnlockCinematic";
import { useTierUnlockWatcher } from "@/hooks/useTierUnlockWatcher";
import WalletMenuPill from "@/components/WalletMenuPill";

/* --- env: prayer contract addresses from canonical config --- */
import { CONTRACTS } from "@/lib/contracts/addresses";
const DEFAULT_FOIP_REGISTRY: Hex = CONTRACTS.PRAYER_REGISTRY as Hex;
const DEFAULT_FOIP_MIRROR: Hex = CONTRACTS.PRAYER_MIRROR as Hex;
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
  } catch (err) {
    console.warn('[pray] resolveEnv non-fatal error:', err);
  }
  return {
    registry: (registry ?? DEFAULT_FOIP_REGISTRY) as Hex,
    mirror: (mirror ?? DEFAULT_FOIP_MIRROR) as Hex,
  };
}

// Using imported PRAYER_REGISTRY_ABI from lib/contracts/abis/prayerRegistry.ts


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

// Type-safe address helper
function safeAddress(addr: string | undefined): Hex {
  if (!addr || !addr.startsWith('0x')) {
    return "0x0000000000000000000000000000000000000000";
  }
  return addr as Hex;
}

function PrayPageContent() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { disconnect } = useDisconnect();
  const { openConnectModal } = useConnectModal();
  const { switchChainAsync } = useSwitchChain();
  const { trigger: triggerHaptic } = useHaptic();
  const { entries: journalEntries, hasConsent: hasJournalConsent } = usePrayerMemory(address);
  const { recordSuccess: recordPWASuccess } = usePWAInstallPrompt(address);
  const [nowSeconds, setNowSeconds] = useState<number | null>(null);
  const [hydrated, setHydrated] = useState(false);

  // Optimistic UI updates
  const [optimisticStreak, setOptimisticStreak] = useState<number | null>(null);
  const [optimisticTotal, setOptimisticTotal] = useState<number | null>(null);
  // Afterglow: ~3s halo around the altar after a successful prayer
  const [afterglow, setAfterglow] = useState(false);
  // Journal drawer (mobile swipe-up / tap)
  const [journalOpen, setJournalOpen] = useState(false);
  const afterglowTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Clear afterglow timer on unmount to avoid state updates on an unmounted
  // component if the user navigates away during the 3s window.
  useEffect(() => {
    return () => {
      if (afterglowTimerRef.current) {
        clearTimeout(afterglowTimerRef.current);
        afterglowTimerRef.current = null;
      }
    };
  }, []);
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

  // Ensure mobile viewport allows pinch-zoom (accessibility).
  // iOS auto-zoom on input focus is handled by bumping the terminal field
  // to 16px in globals.css — we do NOT disable user scaling.
  useEffect(() => {
    const isMobile = window.innerWidth < 1024;
    if (!isMobile) return;

    const OPEN = "width=device-width, initial-scale=1, viewport-fit=cover";
    const allMetas = document.querySelectorAll('meta[name="viewport"]');
    const originals = Array.from(allMetas).map((m) => m.getAttribute("content") ?? "");
    allMetas.forEach((m) => m.setAttribute("content", OPEN));

    return () => {
      allMetas.forEach((m, i) => m.setAttribute("content", originals[i]));
    };
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
    data: snap,
    isLoading: snapLoading,
    refetch: refetchSnap
  } = useReadContract({
    address: safeAddress(MIRROR),
    abi: PRAYER_MIRROR_ABI,
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
  const statsLoading = snapLoading || nextAllowedLoading;

  useEffect(() => {
    snapRef.current = async () => {
      await refetchSnap({ throwOnError: false, cancelRefetch: false });
    };
  }, [refetchSnap]);
  useEffect(() => { nextRef.current = refetchNext; }, [refetchNext]);
  useEffect(() => { registryRef.current = REGISTRY as Hex | undefined; }, [REGISTRY]);
  useEffect(() => {
    if (!address || !FLUENT_CHAIN_ID) return;
    if (MIRROR) {
      void refetchSnap({ throwOnError: false, cancelRefetch: false });
    }
    if (!REGISTRY) return;
    void refetchNext({ throwOnError: false, cancelRefetch: false });
  }, [MIRROR, REGISTRY, address, FLUENT_CHAIN_ID, refetchNext, refetchSnap]);

  useEffect(() => {
    const updateNow = () => setNowSeconds(Math.floor(Date.now() / 1000));
    updateNow();
    const interval = setInterval(updateNow, 1000);
    return () => clearInterval(interval);
  }, []);

  const ensureWalletReady = useCallback(async () => {
    if (!isConnected || !address) throw new Error("please connect your wallet before anchoring your prayer.");
    if (FLUENT_CHAIN_ID && chainId && chainId !== FLUENT_CHAIN_ID) {
      throw new Error(`switch to Fluent (chain id ${FLUENT_CHAIN_ID}) to continue.`);
    }
  }, [FLUENT_CHAIN_ID, address, chainId, isConnected]);

  const submitPrayer = useCallback(
    async (prayer: string, feeling: FeelingKey, onStatus?: (text: string) => void) => {
      const registryAddress = registryRef.current;
      if (!registryAddress) throw new Error("missing registry address on this page.");
      if (!address) throw new Error("connect your wallet before anchoring your prayer.");

      // Use the static public client (always points to Fluent RPC)
      // instead of the wagmi hook client which can be stale or on the wrong chain.
      const rpcClient = staticPublicClient;

      // Switch to Fluent if needed — switchChainAsync resolves only
      // after the wallet has actually switched, so no polling required.
      // This is the longest silent wait in the pipeline (1–3s), so narrate it.
      if (chainId !== FLUENT_CHAIN_ID) {
        try {
          onStatus?.("asking your wallet to switch to fluent...");
          await switchChainAsync?.({ chainId: FLUENT_CHAIN_ID });
          // Brief pause to let wallet provider settle after chain switch
          await new Promise(resolve => setTimeout(resolve, 300));
          onStatus?.("switched. preparing your prayer...");
        } catch (error: unknown) {
          const message = error instanceof Error ? error.message : "Failed to switch chain";
          throw new Error(`please switch to Fluent (chain ${FLUENT_CHAIN_ID}). ${message}`);
        }
      }

      // Pre-flight cooldown check — read fresh from chain to catch stale cache
      try {
        const freshNextAllowed = await rpcClient.readContract({
          address: registryAddress,
          abi: PRAYER_REGISTRY_ABI,
          functionName: "nextAllowedAt",
          args: [address as Address],
        }) as bigint;
        const nowSec = BigInt(Math.floor(Date.now() / 1000));
        if (freshNextAllowed > nowSec) {
          const waitSec = Number(freshNextAllowed - nowSec);
          const hours = Math.floor(waitSec / 3600);
          const mins = Math.floor((waitSec % 3600) / 60);
          throw new Error(
            `You can only pray once every 24 hours. Please wait ${hours}h ${mins}m for your cooldown to expire.`
          );
        }
      } catch (error: unknown) {
        // If it's our cooldown error, rethrow it
        if (error instanceof Error && error.message.includes("cooldown")) throw error;
        // Otherwise log and continue — simulation will catch real issues
        console.warn("cooldown pre-check failed (non-fatal):", error);
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

      if (process.env.NODE_ENV === 'development') {
        const transportInfo = rpcClient.transport as { url?: string; type?: string } | undefined;
        console.debug("submitPrayer", {
          chainId: rpcClient.chain?.id ?? FLUENT_CHAIN_ID,
          userChainId: chainId,
          rpc: transportInfo?.url ?? transportInfo?.type ?? "unknown",
          registry: registryAddress,
          selector: PRAYER_SELECTOR,
          args: [prayerHash, label, PRAYER_CATEGORY],
        });
      }

      onStatus?.("checking with the chain...");
      try {
        await rpcClient.call({ to: registryAddress, data, account: address as Address });
      } catch (error: unknown) {
        const message = formatViemError(error);
        console.error("prayer simulation failed:", message, error);
        throw new Error(message);
      }

      let gasEstimate: bigint;
      try {
        gasEstimate = await rpcClient.estimateGas({
          to: registryAddress,
          data,
          account: address as Address,
        });
      } catch (error: unknown) {
        console.warn("prayer gas estimation failed:", error);

        const message = formatViemError(error);

        // If it's a revert, don't use fallback - fail immediately
        if (message.includes('revert') || message.includes('execution reverted')) {
          throw new Error(`Transaction would fail: ${message}`);
        }

        // For network errors or estimation failures, use smart fallback
        // Base: 150k + 50k buffer = 200k (reasonable for most prayers)
        gasEstimate = BigInt(200_000);
      }

      // Add 20% margin to gas estimate for safety
      const gasMargin = (gasEstimate * 20n) / 100n;
      const gasLimit = gasEstimate + (gasMargin > 0 ? gasMargin : 1n);

      // Optimistic update: Show +1 streak and +1 total immediately
      const currentStreak = typeof snap?.[0] === 'bigint' ? Number(snap[0]) : (typeof snap?.[0] === 'number' ? snap[0] : 0);
      const currentTotal = typeof snap?.[2] === 'bigint' ? Number(snap[2]) : (typeof snap?.[2] === 'number' ? snap[2] : 0);
      startTransition(() => {
        setOptimisticStreak(currentStreak + 1);
        setOptimisticTotal(currentTotal + 1);
      });

      onStatus?.("awaiting wallet...");
      const walletClient = await getWalletClient();
      try {
        const txHash = await walletClient.sendTransaction({
          // Embedded wallet: account set on client. Injected: pass address.
          account: (walletClient.account ?? address) as Address,
          to: registryAddress,
          data,
          gas: gasLimit,
          chain: walletClient.chain,
        });
        return { txHash };
      } catch (error: unknown) {
        // Revert optimistic update on error
        startTransition(() => {
          setOptimisticStreak(null);
          setOptimisticTotal(null);
        });
        const message = formatViemError(error);
        console.error("prayer send failed:", message, error);
        throw new Error(message);
      }
    },
    [address, chainId, FLUENT_CHAIN_ID, switchChainAsync, snap],
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
        // Event name may differ but tx succeeded — no action needed
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
    startTransition(() => {
      setOptimisticStreak(null);
      setOptimisticTotal(null);
    });

    // Sacred beat: heartbeat haptic + 3s afterglow halo on the altar
    triggerHaptic('heartbeat');
    setAfterglow(true);
    if (afterglowTimerRef.current) clearTimeout(afterglowTimerRef.current);
    afterglowTimerRef.current = setTimeout(() => {
      setAfterglow(false);
      afterglowTimerRef.current = null;
    }, 3000);

    // PWA install prompt — after 3 confirmed prayers, Mommy asks to live on the home screen.
    recordPWASuccess();
  }, [publicClient, triggerHaptic, recordPWASuccess]);

  const handleSwitchWallet = useCallback(() => {
    triggerHaptic('medium');
    disconnect();
    setTimeout(() => openConnectModal?.(), 100);
  }, [disconnect, openConnectModal, triggerHaptic]);

  // snap is [currentStreak, longestStreak, totalPrayers] from the shared PRAYER_MIRROR_ABI
  const formattedPrayerHash = "–"; // mirror contract doesn't return prayer hash

  // Computed values with optimistic updates
  const displayStreak = optimisticStreak !== null ? optimisticStreak : snap?.[0];
  const displayLongest = snap?.[1];
  const displayTotal = optimisticTotal !== null ? optimisticTotal : snap?.[2];
  const displayMilestones = 0; // mirror contract doesn't expose milestones separately
  const hasAnyPrayers = Number(displayTotal ?? 0) > 0;
  const streakNumber = typeof displayStreak === 'bigint' ? Number(displayStreak) : typeof displayStreak === 'number' ? displayStreak : 0;
  const longestStreakNumber = typeof displayLongest === 'bigint' ? Number(displayLongest) : typeof displayLongest === 'number' ? displayLongest : 0;
  const totalPrayersNumber = typeof displayTotal === 'bigint' ? Number(displayTotal) : typeof displayTotal === 'number' ? displayTotal : 0;
  const tierProgress = useMemo(() => getTierFromStreak(streakNumber), [streakNumber]);

  // Page-level tier accent: lifts the cyan→gold evolution from the altar strip
  // to the whole <main>, so caret color, altar strip, and any downstream
  // consumers share a single --pray-accent custom property.
  const prayAccent = tierAccent(isConnected ? tierProgress.current.level : 0);

  // Tier-unlock cinematic watcher — fires a one-shot play when a user's streak
  // crosses a milestone day (7/14/21/30/45/60/75/90). Persisted per wallet.
  const { pendingUnlock, clearPendingUnlock } = useTierUnlockWatcher(
    streakNumber,
    isConnected,
    address,
  );

  // Day-90 pixel easter egg — renders iff the Mommy Milker cinematic has
  // played at least once (any wallet on this device). Re-read after each
  // unlock completes so a just-played tier 10 immediately toggles it.
  const [mommyPixelUnlocked, setMommyPixelUnlocked] = useState(false);
  useEffect(() => {
    try {
      setMommyPixelUnlocked(localStorage.getItem("foid_tier_10_pixel_unlocked") === "1");
    } catch {
      // noop
    }
  }, [pendingUnlock]);

  const canRenderTime = nowSeconds !== null;
  const nextAllowedSecondsRaw = typeof nextAllowed === "bigint" ? Number(nextAllowed) : typeof nextAllowed === "number" ? nextAllowed : null;
  const cooldownActive = canRenderTime && typeof nextAllowedSecondsRaw === "number" && nextAllowedSecondsRaw > nowSeconds;
  const nextWindowLabel = cooldownActive
    ? new Date(nextAllowedSecondsRaw * 1000).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
    : "";

  // Streak-loss deadline: PrayerRegistry resets streak if user prays > 48h
  // after their last check-in (lastCheckIn + 2 * DAY). Since nextAllowedAt =
  // lastCheckIn + 24h, the streak deadline is nextAllowedAt + 24h.
  // We only surface this once a user has actually prayed (nextAllowedSecondsRaw > 0).
  const streakDeadlineSeconds =
    typeof nextAllowedSecondsRaw === "number" && nextAllowedSecondsRaw > 0
      ? nextAllowedSecondsRaw + 86400
      : null;
  const streakSecondsLeft =
    canRenderTime && streakDeadlineSeconds !== null
      ? Math.max(0, streakDeadlineSeconds - nowSeconds)
      : null;
  // Urgent state: user can pray now AND streak deadline is within the
  // remaining 24h window. This is the "pray today or lose your streak" beat.
  const streakUrgent =
    !cooldownActive && streakSecondsLeft !== null && streakSecondsLeft > 0;
  const streakLost =
    streakSecondsLeft !== null && streakSecondsLeft <= 0 && hasAnyPrayers;

  return (
    <main
      className="pray-page relative bg-foid-bg text-white/90 overflow-hidden flex items-center justify-center"
      style={{ height: "100dvh", ["--pray-accent" as string]: prayAccent } as CSSProperties}
    >
      <div className="pointer-events-none fixed inset-0 z-0 vignette" />
      {/* Film grain — static SVG turbulence, pointer-events: none */}
      <div
        className="pointer-events-none fixed inset-0 pray-grain"
        aria-hidden="true"
        style={{ zIndex: 1 }}
      />
      {/* Pilot light — bottom-right amber pixel */}
      <div className="pray-pilot-light" aria-hidden="true" />

      {/* Mobile-only boot sequence (plays once per session) */}
      <div className="lg:hidden">
        <PrayerBoot />
      </div>

      {/* Tier unlock cinematic — plays once per (wallet, tier) on streak milestones */}
      {pendingUnlock !== null && (
        <TierUnlockCinematic
          tierLevel={pendingUnlock}
          onComplete={clearPendingUnlock}
        />
      )}

      {/* Day-90 easter egg — a 3×3 iridescent pixel, only after tier 10 has played */}
      {mommyPixelUnlocked && <span className="mommy-pixel lg:hidden" aria-hidden="true" />}

      {/* Mobile Layout — ritual-first, chrome-minimal */}
      <div
        className="lg:hidden relative z-10 flex flex-col w-full px-3 pb-safe"
        style={{ height: "100dvh", paddingTop: "max(env(safe-area-inset-top), 8px)" }}
      >
        {/* Clean titlebar: wordmark + inline wallet (no fake Windows chrome) */}
        <header className="pray-mobile-titlebar">
          <span className="pray-mobile-titlebar__wordmark">
            foid_mommy<span className="pray-mobile-titlebar__accent">.exe</span>
          </span>
          <div className="pray-mobile-titlebar__wallet">
            <WalletMenuPill
              address={address}
              isConnected={isConnected}
              onDisconnect={() => disconnect()}
              onSwitchWallet={handleSwitchWallet}
            />
          </div>
        </header>

        {/* Wrong Chain Warning */}
        {wrongChain && (
          <div className="pray-mobile-chain-warn">
            <span>⚠ switch to fluent</span>
          </div>
        )}

        {/* The altar — streak, tier, cooldown, Mommy portal */}
        <PrayerAltarStrip
          streak={streakNumber}
          tier={tierProgress}
          nowSeconds={nowSeconds}
          nextAllowedAt={nextAllowed as bigint | undefined}
          loading={statsLoading}
          connected={isConnected}
          afterglow={afterglow}
          hasEverPrayed={hasAnyPrayers}
          streakSecondsLeft={streakSecondsLeft}
          streakUrgent={streakUrgent}
        />

        {/* History trigger — pill below the altar that opens the journal drawer. */}
        <button
          type="button"
          className="pray-journey-trigger"
          onClick={() => {
            triggerHaptic('light');
            setJournalOpen(true);
          }}
          aria-label="View prayer history"
        >
          <span className="pray-journey-trigger__label">view history</span>
          <span className="pray-journey-trigger__chevron" aria-hidden="true">⌄</span>
        </button>

        {/* Terminal — fills remaining height */}
        <section className="pray-mobile-terminal">
          <div className="pray-liquid-glass-terminal pray-mobile-terminal__inner">
            <div className="frutiger-terminal flicker w-full h-full flex flex-col">
              <PrayErrorBoundary>
                <FoidMommyTerminal
                  className="w-full h-full min-h-0 mobile-terminal"
                  ensureWalletReady={ensureWalletReady}
                  submitPrayer={submitPrayer}
                  waitForReceipt={waitForReceipt}
                  nextAllowedAt={nextAllowed as bigint | undefined}
                  onChainStreak={streakNumber}
                  registryReady={!missingRegistry}
                  chainOk={!wrongChain}
                  requiredChainId={FLUENT_CHAIN_ID}
                  autoStart={false}
                  shadowMode={!isConnected}
                  walletAddress={address}
                  onRequestConnect={handleSwitchWallet}
                />
              </PrayErrorBoundary>
            </div>
          </div>
        </section>
      </div>

      {/* Desktop Layout */}
      <section className="hidden lg:block relative z-10 w-full max-w-full px-2 sm:px-4">
        <div className="mx-auto w-full max-w-6xl">
          <div className="pray-window-frame">
            <div className="vista-window vista-window--terminal vista-window--enhanced h-[94vh] max-h-[94vh] w-full flex flex-col pray-panel pray-panel--main">
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
                    <PrayErrorBoundary>
                      <FoidMommyTerminal
                        className="w-full h-full min-h-0"
                        ensureWalletReady={ensureWalletReady}
                        submitPrayer={submitPrayer}
                        waitForReceipt={waitForReceipt}
                        nextAllowedAt={nextAllowed as bigint | undefined}
                        onChainStreak={streakNumber}
                        registryReady={!missingRegistry}
                        chainOk={!wrongChain}
                        requiredChainId={FLUENT_CHAIN_ID}
                        autoStart={true}
                        shadowMode={!isConnected}
                        walletAddress={address}
                        onRequestConnect={handleSwitchWallet}
                      />
                    </PrayErrorBoundary>
                  </div>
                </div>

                {/* Sidebar pane - manual + stats merged */}
                <div className="pray-pane pray-pane--stats pray-pane--panel">
                  <div className="pray-pane__body font-terminal text-xs sm:text-[13px] leading-snug">
                    <div className="pray-scroll space-y-4">
                      <div className="pray-manual__section">
                        <h3 className="pray-manual__hero">F O I D &nbsp;&nbsp; M O M M Y</h3>
                        <span className="pray-manual__label">WELCOME TO FOID_MOMMY_TERMINAL.EXE</span>
                        <p className="pray-manual__intro">
                          <span className="block">
                            foid_mommy_terminal.exe is a daily onchain ritual. tell foid mommy how you&apos;re feeling.
                            she listens and helps you craft a prayer. submit it onchain. your words never leave your
                            device. hashed locally, only the hash is anchored onchain — proof you showed up, not what
                            you said. show up every day. build your streak. the more you pray, the bigger your
                            mifoid&apos;s boobs will be.
                          </span>
                          <span className="block mt-2" style={{ opacity: 0.55, fontSize: "0.85em" }}>
                            mommy remembers how you&apos;re feeling day to day — so she can meet you where you are.
                            only the feeling label and date are kept on your device. your prayers stay yours.
                            type /forget in the terminal to erase everything.
                          </span>
                        </p>
                      </div>
                      <div className="pray-sidebar-divider" aria-hidden="true" />
                      <div className="pray-sidebar-section-title">YOUR PRAYERS</div>
                      <div className="pray-stats-grid" role="region" aria-label="Prayer statistics">
                        <div className="pray-stats-cell" role="status" aria-label="Current prayer streak">
                          <span className="pray-stats-cell__label">CURRENT STREAK</span>
                          <span className="pray-stats-cell__value pray-stats-cell__value--primary" aria-live="polite">
                            {statsLoading ? (
                              <span className="animate-pulse opacity-50">···</span>
                            ) : !address ? (
                              <span className="pray-stats-ghost" aria-label="preview">7</span>
                            ) : !hasAnyPrayers ? (
                              "0"
                            ) : (
                              <>
                                {displayStreak?.toString?.() ?? "0"}
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
                            ) : !address ? (
                              <span className="pray-stats-ghost" aria-label="preview">21</span>
                            ) : !hasAnyPrayers ? (
                              "0"
                            ) : (
                              displayLongest?.toString?.() ?? "0"
                            )}
                          </span>
                        </div>
                        <div className="pray-stats-cell" role="status" aria-label="Total prayers submitted">
                          <span className="pray-stats-cell__label">TOTAL PRAYERS</span>
                          <span className="pray-stats-cell__value" aria-live="polite">
                            {statsLoading ? (
                              <span className="animate-pulse opacity-50">···</span>
                            ) : !address ? (
                              <span className="pray-stats-ghost" aria-label="preview">30</span>
                            ) : !hasAnyPrayers ? (
                              "0"
                            ) : (
                              <>
                                {displayTotal?.toString?.() ?? "0"}
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
                            ) : !address ? (
                              <span className="pray-stats-ghost" aria-label="preview">2</span>
                            ) : !hasAnyPrayers ? (
                              "0"
                            ) : (
                              displayMilestones.toString()
                            )}
                          </span>
                        </div>
                      </div>

                      {address && !statsLoading && !hasAnyPrayers && (
                        <div className="pray-streak-nudge">
                          pray to start your streak
                        </div>
                      )}

                      {/* Tier Progress Indicator */}
                      {address && !statsLoading && (
                        <div className="pray-tier-progress" role="region" aria-label="Prayer tier progress">
                          <div className="pray-tier-progress__row">
                            <span className="pray-tier-progress__label pray-tier-progress__label--current">{tierProgress.current.name}</span>
                            <div className="pray-tier-progress__bar">
                              <div
                                className="pray-tier-progress__fill"
                                style={{ width: `${tierProgress.next ? Math.max(tierProgress.progressPercent, 6) : 100}%` }}
                              />
                            </div>
                            <span className="pray-tier-progress__label pray-tier-progress__label--next">
                              {tierProgress.next ? tierProgress.next.name : "MAX"}
                            </span>
                          </div>
                          {tierProgress.next ? (
                            <div className="pray-tier-progress__meta">
                              <span>{tierProgress.current.multiplierBps / 100}x</span>
                              <span>{tierProgress.daysToNextTier}d to next tier</span>
                              <span>{tierProgress.next.multiplierBps / 100}x</span>
                            </div>
                          ) : (
                            <div className="pray-tier-progress__meta pray-tier-progress__meta--max">
                              Max tier reached — 5x voting power
                            </div>
                          )}
                        </div>
                      )}

                        <div className="pray-chain-info" role="region" aria-label="Onchain prayer information">
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
                          {hasAnyPrayers && streakSecondsLeft !== null && (
                            <div className="pray-chain-info__row">
                              <span className="pray-chain-info__label">streak resets in</span>
                              <span
                                className={`pray-chain-info__value ${streakUrgent ? "pray-chain-info__value--urgent" : ""}`}
                                role="timer"
                                aria-live="polite"
                                aria-label={
                                  streakLost
                                    ? "Streak has been lost"
                                    : `Streak resets in ${formatDurationShort(streakSecondsLeft)}`
                                }
                              >
                                {streakLost
                                  ? "lost"
                                  : formatDurationShort(streakSecondsLeft)}
                              </span>
                            </div>
                          )}
                        </div>
                        {missingMirror && <div className="pray-stats-notice">stats unavailable (mirror not set).</div>}
                        {walletDisconnected && (
                          <div className="pray-stats-notice">
                            this is what week three looks like. connect to begin —
                            streaks compound your loreboard vote up to 5×.
                          </div>
                        )}

                        {hasJournalConsent && journalEntries.length > 0 && (
                          <>
                            <div className="pray-sidebar-divider" aria-hidden="true" />
                            <div className="pray-sidebar-section-title">YOUR JOURNEY</div>
                            <div className="pray-journal">
                              {journalEntries.slice(-14).reverse().map((entry: JournalEntry, i: number) => {
                                const d = new Date(entry.date + "T00:00:00");
                                const dateLabel = d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
                                return (
                                  <div key={`${entry.date}-${i}`} className="pray-journal__entry">
                                    <span className="pray-journal__date">{dateLabel}</span>
                                    <span className="pray-journal__feeling">{entry.feelingKey}</span>
                                    <span className="pray-journal__time">{entry.timeOfDay}</span>
                                  </div>
                                );
                              })}
                            </div>
                          </>
                        )}
                      </div>
                  </div>
                </div>

              </div>
            </div>
          </div>
        </div>
        </div>
      </section>

      {/* Enhanced styles */}
      <style jsx>{`
        :global(.pray-dashboard) { background: transparent !important; }

        /* ===== Mobile titlebar + altar layout (ritual-first) ===== */
        .pray-mobile-titlebar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          height: 44px;
          padding: 0 4px;
          margin-bottom: 8px;
          flex-shrink: 0;
          flex-grow: 0;
        }
        .pray-mobile-titlebar__wordmark {
          font-family: var(--font-terminal, "JetBrains Mono", monospace);
          font-size: 12px;
          letter-spacing: 0.18em;
          text-transform: lowercase;
          color: rgba(255, 255, 255, 0.6);
          font-weight: 600;
        }
        .pray-mobile-titlebar__accent {
          color: var(--foid-cyan-electric);
          opacity: 0.7;
        }
        .pray-mobile-titlebar__wallet {
          display: flex;
          align-items: center;
        }
        .pray-mobile-titlebar__wallet :global(button) {
          min-height: 40px !important;
          font-size: 11px !important;
        }
        .pray-mobile-chain-warn {
          flex-shrink: 0;
          padding: 6px 10px;
          margin-bottom: 8px;
          background: rgba(120, 90, 0, 0.15);
          border: 1px solid rgba(255, 209, 102, 0.25);
          border-radius: 8px;
          font-family: var(--font-terminal, monospace);
          font-size: 11px;
          letter-spacing: 0.1em;
          color: #ffd166;
          text-align: center;
        }
        /* History trigger — tappable pill that opens the journal drawer.
           Chevron points down to signal "expand / reveal more below". */
        .pray-journey-trigger {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          align-self: center;
          margin: 10px 0 4px;
          padding: 6px 14px 8px;
          background: transparent;
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 999px;
          color: rgba(255, 255, 255, 0.7);
          font-family: var(--font-terminal, "JetBrains Mono", monospace);
          font-size: 11px;
          letter-spacing: 0.16em;
          text-transform: lowercase;
          cursor: pointer;
          flex-shrink: 0;
          transition: color 0.18s ease, border-color 0.18s ease,
            background 0.18s ease;
          min-height: 40px;
        }
        .pray-journey-trigger:hover,
        .pray-journey-trigger:active {
          color: var(--foid-cyan-electric);
          border-color: rgba(0, 255, 213, 0.45);
          background: rgba(0, 255, 213, 0.06);
        }
        .pray-journey-trigger__chevron {
          font-size: 14px;
          line-height: 1;
          opacity: 0.75;
          margin-top: -2px;
        }

        .pray-mobile-terminal {
          flex: 1;
          min-height: 0;
          margin-top: 6px;
          display: flex;
          flex-direction: column;
        }
        .pray-mobile-terminal__inner {
          flex: 1;
          min-height: 0;
          display: flex;
          flex-direction: column;
          padding: 8px !important;
        }

        .pray-page {
          display: flex;
          justify-content: center;
          align-items: center;
          position: relative;
          height: 100dvh;
          background: transparent;
          overflow: auto;
          padding: 24px;
          width: 100%;
          z-index: 0;
          overscroll-behavior: contain;
        }
        .pray-window-frame {
          width: 100%;
          margin: 0;
          display: flex;
          flex-direction: column;
          min-height: 0;
          overflow: hidden;
        }
        .pray-window-frame > .vista-window {
          width: 100%;
          min-height: 0;
          background: rgba(6, 10, 18, 0.88);
        }
        .pray-window-frame .vista-window__body {
          background:
            linear-gradient(
              to right,
              rgba(140, 235, 255, 0.04) 1px,
              transparent 1px
            ),
            linear-gradient(
              to bottom,
              rgba(140, 235, 255, 0.04) 1px,
              transparent 1px
            ),
            linear-gradient(
              180deg,
              rgba(40, 80, 120, 0.12) 0%,
              rgba(8, 14, 24, 0.85) 40%,
              rgba(4, 8, 16, 0.95) 100%
            );
          box-shadow: none;
          height: 100%;
        }
        :global(.vignette) {
          background-color: transparent !important;
          background-image: radial-gradient(ellipse at center, rgba(0,0,0,0) 0%, rgba(0,0,0,0.35) 55%, rgba(0,0,0,0.5) 100%) !important;
          opacity: 0.7;
        }

        /* Film grain — static SVG noise, rendered once, 3% opacity.
           Using a data-URI SVG keeps this zero-cost (no network, no animation). */
        :global(.pray-grain) {
          opacity: 0.03;
          mix-blend-mode: overlay;
          background-image: url("data:image/svg+xml;utf8,%3Csvg xmlns='http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 1 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
          background-size: 160px 160px;
          background-repeat: repeat;
        }

        /* Pilot light — 3x3 amber pixel, gently breathing. */
        :global(.pray-pilot-light) {
          position: fixed;
          right: calc(env(safe-area-inset-right, 0px) + 10px);
          bottom: calc(env(safe-area-inset-bottom, 0px) + 10px);
          width: 3px;
          height: 3px;
          background: #d88040;
          box-shadow: 0 0 6px rgba(216, 128, 64, 0.9), 0 0 12px rgba(216, 128, 64, 0.4);
          z-index: 2;
          pointer-events: none;
          animation: pray-pilot-pulse 2.6s ease-in-out infinite;
        }
        @keyframes pray-pilot-pulse {
          0%, 100% { opacity: 0.3; }
          50% { opacity: 1; }
        }

        /* Mommy pixel — 3×3 iridescent easter egg for day-90 unlockers.
           Static, no tooltip, no animation. Positioned inconspicuously near
           the top-left of the altar strip on mobile. */
        :global(.mommy-pixel) {
          position: fixed;
          top: calc(env(safe-area-inset-top, 0px) + 56px);
          left: 8px;
          width: 3px;
          height: 3px;
          background: conic-gradient(from 0deg, #8b5cf6, #ffcc5c, var(--foid-mint), #8b5cf6);
          z-index: 3;
          pointer-events: none;
        }

        /* Terminal focus glow — outer container glows when input is focused. */
        :global(.pray-liquid-glass-terminal) {
          transition: box-shadow 0.2s ease;
        }
        :global(.pray-page .pray-liquid-glass-terminal:has(:focus)) {
          box-shadow:
            inset 0 0 0 1px rgba(110, 234, 216, 0.25),
            inset 0 0 24px rgba(110, 234, 216, 0.08) !important;
        }

        @media (prefers-reduced-motion: reduce) {
          :global(.pray-pilot-light) {
            animation: none;
            opacity: 0.7;
          }
        }

        .pray-main-grid {
          display: grid;
          grid-template-columns: 2fr 1fr;
          padding: clamp(12px, 1.5vw, 18px);
          gap: clamp(12px, 1.5vw, 18px);
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
          border: 1px solid rgba(0, 255, 213, 0.25) !important;
          background: rgba(2, 14, 24, 0.6) !important;
          box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.25);
        }
        
        /* Status indicator */
        .pray-status-indicator { display: flex; align-items: center; gap: 8px; }
        .pray-status-dot { width: 8px; height: 8px; border-radius: 50%; }
        .pray-status-dot--online {
          background: var(--foid-cyan-electric);
          box-shadow: 0 0 10px rgba(0, 255, 213, 0.8), 0 0 20px rgba(0, 255, 213, 0.4);
          animation: pray-pulse 2s ease-in-out infinite;
        }
        .pray-status-dot--offline { background: var(--foid-red-vivid); box-shadow: 0 0 8px rgba(255, 71, 87, 0.6); }
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
          font-family: var(--font-terminal, monospace);
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
          font-size: 16px;
          font-weight: 800;
          letter-spacing: 0.22em;
          color: var(--foid-cyan-electric);
          text-shadow: 0 0 24px rgba(0, 255, 213, 0.5);
          margin-bottom: 8px;
          line-height: 1.2;
          white-space: nowrap;
        }
        .pray-manual__intro {
          font-size: 12px;
          line-height: 1.55;
          color: rgba(255, 255, 255, 0.6);
          padding-bottom: 0;
          border-bottom: none;
          margin-bottom: 0;
        }
        .pray-manual__section { margin-bottom: 4px; }

        /* Merged sidebar dividers + section titles */
        .pray-sidebar-divider {
          height: 1px;
          background: linear-gradient(90deg, transparent, rgba(0, 255, 213, 0.18), transparent);
          margin: 10px 0 6px 0;
        }
        .pray-sidebar-section-title {
          font-size: 10px;
          letter-spacing: 0.32em;
          text-transform: uppercase;
          color: rgba(255, 255, 255, 0.55);
          margin-bottom: 8px;
          font-weight: 600;
        }
        .pray-manual__label {
          display: block;
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 0.15em;
          color: var(--foid-cyan-electric);
          margin-bottom: 6px;
          opacity: 0.85;
          text-shadow: 0 0 10px rgba(0, 255, 213, 0.3);
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
          background: rgba(0, 255, 255, 0.06);
          border-radius: 6px;
          overflow: hidden;
          margin-bottom: 10px;
        }
        .pray-stats-cell {
          display: flex;
          flex-direction: column;
          gap: 4px;
          padding: 10px 12px;
          min-height: 64px;
          background: rgba(0, 16, 28, 0.6);
          backdrop-filter: blur(4px);
          transition: background 0.25s ease;
        }
        .pray-stats-cell:hover { background: rgba(0, 40, 55, 0.6); }
        .pray-stats-cell__label { font-size: 10px; font-weight: 600; letter-spacing: 0.1em; color: rgba(255, 255, 255, 0.35); text-transform: uppercase; }
        .pray-stats-cell__value {
          font-size: 20px;
          font-weight: 700;
          font-family: var(--font-terminal, monospace);
          color: #00e5ff;
          text-shadow: 0 0 18px rgba(0, 229, 255, 0.45);
          line-height: 1;
        }
        .pray-stats-cell__value--primary { color: #00e5ff; text-shadow: 0 0 18px rgba(0, 229, 255, 0.55); }
        
        /* Chain info */
        .pray-chain-info { display: flex; flex-direction: column; }
        .pray-chain-info__row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 7px 0;
          border-bottom: 1px solid rgba(255, 255, 255, 0.05);
        }
        .pray-chain-info__row:last-child { border-bottom: none; }
        .pray-chain-info__label { font-size: 11px; color: rgba(255, 255, 255, 0.4); }
        .pray-chain-info__value { font-size: 12px; font-family: var(--font-terminal, monospace); color: rgba(255, 255, 255, 0.8); font-weight: 600; }
        .pray-chain-info__value--hash { color: var(--foid-cyan-electric); }
        .pray-chain-info__value--ready { color: #00ff88; text-shadow: 0 0 8px rgba(0, 255, 136, 0.5); }
        /* Urgent variant — used by the streak-loss deadline once the cooldown
           has elapsed and the user has < 24h to pray or break their streak. */
        .pray-chain-info__value--urgent {
          color: #ffb84d;
          text-shadow: 0 0 8px rgba(255, 184, 77, 0.55);
          animation: pray-urgent-pulse 2.2s ease-in-out infinite;
        }
        @keyframes pray-urgent-pulse {
          0%, 100% { opacity: 0.85; }
          50% { opacity: 1; }
        }
        
        /* Streak nudge micro-copy */
        .pray-streak-nudge {
          margin-top: 8px;
          text-align: center;
          font-size: 12px;
          text-transform: uppercase;
          letter-spacing: 0.15em;
          color: rgba(255, 255, 255, 0.35);
          animation: pray-nudge-pulse 2.5s ease-in-out infinite;
        }
        @keyframes pray-nudge-pulse {
          0%, 100% { opacity: 0.35; }
          50% { opacity: 0.7; }
        }

        /* Tier progress bar */
        .pray-tier-progress {
          margin-top: 8px;
          margin-bottom: 6px;
          padding: 10px 12px;
          border-radius: 12px;
          border: 1px solid rgba(0, 229, 255, 0.12);
          background: rgba(0, 229, 255, 0.04);
        }
        .pray-tier-progress__row {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .pray-tier-progress__label {
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          white-space: nowrap;
          flex-shrink: 0;
        }
        .pray-tier-progress__label--current {
          color: #00e5ff;
          text-shadow: 0 0 8px rgba(0, 229, 255, 0.4);
        }
        .pray-tier-progress__label--next {
          color: rgba(255, 255, 255, 0.45);
        }
        .pray-tier-progress__bar {
          flex: 1;
          height: 8px;
          border-radius: 4px;
          background: rgba(255, 255, 255, 0.08);
          overflow: hidden;
        }
        .pray-tier-progress__fill {
          height: 100%;
          border-radius: 4px;
          background: linear-gradient(90deg, #00e5ff, #00b8d4);
          box-shadow: 0 0 10px rgba(0, 229, 255, 0.4);
          transition: width 0.5s ease;
        }
        .pray-tier-progress__meta {
          display: flex;
          justify-content: space-between;
          margin-top: 6px;
          font-size: 10px;
          color: rgba(255, 255, 255, 0.4);
          font-family: var(--font-terminal, monospace);
        }
        .pray-tier-progress__meta--max {
          justify-content: center;
          color: rgba(0, 229, 255, 0.7);
          font-weight: 600;
        }

        .pray-stats-notice {
          margin-top: 8px;
          padding: 8px;
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 0.12em;
          color: rgba(255, 255, 255, 0.4);
          text-align: center;
          border: 1px dashed rgba(255, 255, 255, 0.1);
          border-radius: 6px;
          background: rgba(0, 0, 0, 0.15);
        }

        /* Disconnected zero state: the stats grid shows a ghosted preview
           of a real week-three account instead of dashes that read as a
           rendering bug. The notice under it does the selling. */
        .pray-stats-ghost {
          opacity: 0.26;
          filter: blur(0.4px);
          user-select: none;
        }

        /* Glass backdrops */
        .pray-liquid-glass-terminal :global(.frutiger-terminal) {
          background: rgba(3, 8, 14, 0.7) !important;
          backdrop-filter: blur(14px) saturate(140%);
        }
        .pray-pane--panel {
          display: flex;
          flex-direction: column;
          background: rgba(4, 10, 18, 0.75) !important;
          backdrop-filter: blur(14px) saturate(140%);
          border: 1px solid rgba(0, 255, 213, 0.08);
          border-radius: 8px;
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04), inset 0 -1px 0 rgba(0, 0, 0, 0.35);
          padding: 14px;
          min-height: 0;
          flex: 1;
        }
        .pray-pane--panel > * { background: transparent !important; }

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
            padding: 8px;
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
            padding: 8px;
          }
          .pray-bracket {
            display: none;
          }
          .pray-stats-cell__value {
            font-size: 20px;
          }
          .pray-window-frame {
            padding-bottom: calc(var(--safe-bottom, 0px) + 8px);
          }

          /* Minimum 48px touch targets — scoped to tappable controls only so
             decorative chrome (vista dots, feeling chips, inline icons) isn't
             inflated. Apply .pray-tap to any button that should meet the
             guideline. The inline send button is exempt; it's a compact icon
             button sized to fit alongside the composer input. */
          .pray-tap,
          button[type="submit"]:not(.foid-terminal__send-btn),
          :global(.pray-tap),
          :global(button[type="submit"]:not(.foid-terminal__send-btn)) {
            min-height: 48px;
            min-width: 48px;
          }

          /* Stats cells should be tappable */
          .pray-stats-cell {
            min-height: 72px;
            padding: 12px 14px;
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
      <MobileWalletButton suppress />

      {/* Prayer journey drawer — mobile swipe-up / tap trigger above */}
      <PrayerJournalDrawer
        isOpen={journalOpen}
        onClose={() => setJournalOpen(false)}
        entries={journalEntries}
        hasConsent={hasJournalConsent}
        streak={streakNumber}
        longestStreak={longestStreakNumber}
        totalPrayers={totalPrayersNumber}
      />
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
