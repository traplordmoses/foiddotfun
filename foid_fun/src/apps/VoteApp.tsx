// src/apps/VoteApp.tsx
// VOTE.EXE — the swipe-voting deck, extracted from the /vote route so the
// same component renders in BOTH presentations (multi-window plan §4):
//   - the /vote route page (thin wrapper: main + vista-window + titlebar)
//   - a desktop shell window (<OSWindow appId="vote">) — the default
//     vote surface on lg+ viewports since Stage C (routes hand off)
//
// Stage-B blockers handled here (plan §4 VOTE row):
//   - Full-screen overlays (UndoPill, DetailDrawer, TxOverlay,
//     VictoryCelebration) render through <BodyPortal> — they are viewport
//     takeovers with position:fixed, and .vista-window's backdrop-filter
//     makes the frame a containing block for fixed descendants, which
//     would trap them inside the window. Portaling to <body> keeps them
//     viewport-fixed in both presentations. (All four render null until
//     interaction, so SSR markup is unchanged.)
//   - The global Z-to-undo keydown gates on useOSWindowFocused(): in the
//     shell it only listens while VOTE is the foreground window, so typing
//     in another window never triggers an undo. Route presentation is
//     always "focused". (DetailDrawer's Escape handler stays as is — the
//     drawer is a modal takeover and owns the keyboard while open. Card
//     swipe gestures are element-scoped already.)
//   - sfx are module singletons — safe across presentations.
//   - In-card effect layers (GlowFlash, SwipeParticles, StreakBadge,
//     VoteResultText) are absolutely positioned in the card area — they
//     stay inline, window-relative is correct for them.
//
// vote-animations.css is imported HERE — the shared location both the
// route and the shell load (it used to live in vote/layout.tsx, which the
// shell never mounts). It is all @keyframes (global once loaded); the
// /vote/[id] and /vote/submit routes don't use them.
"use client";

import "@/app/vote/vote-animations.css";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useAccount, useReadContract } from "wagmi";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import Link from "next/link";
import { CONTRACTS, CHAIN_CONFIG } from "@/lib/contracts/addresses";
import { LOREBOARD_ABI } from "@/lib/contracts/abis/loreboard";
import { submitVoteBatch } from "@/lib/voteBatch";
import { getWalletClient, publicClient } from "@/lib/viem";

import toast from "react-hot-toast";
import { cidToHttpUrl } from "@/lib/ipfsUrl";
import { CHAIN_ID, CHAIN_NAME, RPC_URL } from "@/config/canonical";
import { useSwipeVotingPower } from "@/hooks/useSwipeVotingPower";
import { useBoardEvents } from "@/hooks/useBoardEvents";
import { useShadowVotes } from "@/hooks/useShadowVotes";
import { useVoteEffects } from "@/hooks/useVoteEffects";
import { playUndoWhoosh } from "@/lib/sfx";
import { useOSWindowFocused } from "@/components/os/windowContext";
import { tryNextGateway, truncateAddress, CARD_VISUALS } from "@/lib/swipeConstants";
import type { SwipeProposal } from "@/types/vote";
import {
  SwipeParticles, StreakBadge, GlowFlash, VoteResultText,
  UndoPill, DetailDrawer, TxOverlay, VictoryCelebration,
  SwipeCard, BatchReview, EmptyState,
} from "@/components/vote";

/* ─── localStorage helpers (wallet-scoped voted IDs) ─── */
function votedIdsKey(wallet: string): string {
  const contract = (CONTRACTS.SWIPE ?? "").toLowerCase().slice(0, 10);
  return `foid-voted-${contract}-${wallet.toLowerCase()}`;
}

function getVotedIds(wallet?: string): Set<number> {
  if (!wallet) return new Set();
  try {
    const raw = localStorage.getItem(votedIdsKey(wallet));
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as number[]);
  } catch { return new Set(); }
}

function saveVotedIds(wallet: string, ids: Set<number>) {
  try { localStorage.setItem(votedIdsKey(wallet), JSON.stringify([...ids])); } catch { /* storage can be disabled */ }
}

/** Mounts children at <body> level — null on the server and the first
 *  client render, so SSR/hydration markup never diverges. The overlays it
 *  carries are interaction-driven, so the one-frame delay is invisible. */
function BodyPortal({ children }: { children: React.ReactNode }) {
  const [host, setHost] = useState<HTMLElement | null>(null);
  useEffect(() => { setHost(document.body); }, []);
  return host ? createPortal(children, host) : null;
}

/* ═══════════════════════════ THE APP (window body) ═══════════════════════ */
export default function VoteApp() {
  const { address, isConnected } = useAccount();
  const accountRef = useRef(address);
  accountRef.current = address;
  const { multiplier, tierName, isLoading: powerLoading } = useSwipeVotingPower();
  const { addShadowVote, getReplayableVotes, clearShadowVotes } = useShadowVotes();
  const { openConnectModal } = useConnectModal();
  const effects = useVoteEffects();
  /** Shell: only the foreground window owns global keys. Route: always true. */
  const shellFocused = useOSWindowFocused();

  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);
  const [tab, setTab] = useState<"active" | "completed" | "history">("active");
  const [proposals, setProposals] = useState<SwipeProposal[]>([]);
  const [nextCursor, setNextCursor] = useState<number | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [dataStale, setDataStale] = useState(false);
  const historyCursorRef = useRef<number | null>(null);
  const loadOlder = async () => {
    if (nextCursor === null || historyLoading) return;
    setHistoryLoading(true);
    try {
      const res = await fetch(`/api/swipe/proposals?scope=history&cursor=${nextCursor}`, { signal: AbortSignal.timeout(20_000) });
      if (!res.ok) throw new Error("History unavailable");
      const data = await res.json();
      setProposals((current) => [...new Map([...current, ...data.proposals].map((p) => [p.id, p])).values()]);
      historyCursorRef.current = nextCursor;
      setNextCursor(data.nextCursor ?? null);
    } catch { toast.error("Could not load older proposals. Please retry."); }
    finally { setHistoryLoading(false); }
  };
  const [votedIds, setVotedIds] = useState<Set<number>>(new Set());
  const [voteChoices, setVoteChoices] = useState<Map<number, boolean>>(new Map());
  const [skippedIds, setSkippedIds] = useState<Set<number>>(new Set());
  const votedIdsRef = useRef(votedIds);
  votedIdsRef.current = votedIds;

  // Batch mode
  const [pendingDecisions, setPendingDecisions] = useState<Map<number, boolean>>(new Map());
  const [batchSigning, setBatchSigning] = useState(false);
  const [transactionError, setTransactionError] = useState<string | null>(null);
  const [uncertainVotes, setUncertainVotes] = useState<{ id: number; hash: `0x${string}` }[]>([]);
  const [batchProgress, setBatchProgress] = useState({ signed: 0, total: 0 });
  const [txStage, setTxStage] = useState<"preparing" | "confirm" | "broadcasting" | "done">("preparing");
  const [txHashes, setTxHashes] = useState<string[]>([]);

  // Victory / drawer / undo
  const [showVictory, setShowVictory] = useState(false);
  const [victoryCount, setVictoryCount] = useState(0);
  const [drawerProposal, setDrawerProposal] = useState<SwipeProposal | null>(null);
  const [lastVotedId, setLastVotedId] = useState<number | null>(null);
  const [showUndo, setShowUndo] = useState(false);

  const pendingRef = useRef(pendingDecisions);
  pendingRef.current = pendingDecisions;
  const uncertainRef = useRef(uncertainVotes);
  uncertainRef.current = uncertainVotes;
  const fetchVersion = useRef(0);
  const rememberUncertain = useCallback((votes: typeof uncertainVotes) => {
    if (accountRef.current === address) setUncertainVotes(votes);
    if (address) try { localStorage.setItem(`${votedIdsKey(address)}-pending`, JSON.stringify(votes)); } catch { /* display remains available */ }
  }, [address]);
  // Never carry unsigned choices across accounts. Restore public transaction
  // hashes so a reload cannot turn a pending receipt into a duplicate vote.
  useEffect(() => {
    setVotedIds(getVotedIds(address));
    setPendingDecisions(new Map());
    setTransactionError(null);
    let pending: typeof uncertainVotes = [];
    if (address) try {
      const value = JSON.parse(localStorage.getItem(`${votedIdsKey(address)}-pending`) ?? "[]");
      if (Array.isArray(value)) pending = value.filter((v) => Number.isSafeInteger(v.id) && /^0x[\da-f]{64}$/i.test(v.hash));
    } catch { /* invalid local state */ }
    setUncertainVotes(pending);
  }, [address]);

  const contractAddr = (CONTRACTS.SWIPE ?? "") as `0x${string}`;
  const hasContract = !!CONTRACTS.SWIPE;

  const { data: proposalCount } = useReadContract({
    address: contractAddr,
    abi: LOREBOARD_ABI,
    functionName: "proposalCount",
    query: { enabled: hasContract },
  });

  // ── Fetch proposals ──
  //
  // `forceFresh` skips the server's 15s in-memory cache (via ?bust=1).
  // Scheduled polls and visibility-change refetches leave it off so the
  // cache still coalesces bursts across users. Two moments flip it on:
  //   1. Supabase `useBoardEvents` notifies us a proposal was just
  //      created or finalized — the cached snapshot predates the event.
  //   2. After the user votes — they expect the next active proposal
  //      to reflect the vote they just cast.
  const refetchProposals = useCallback(async (opts: { forceFresh?: boolean } = {}) => {
    const version = ++fetchVersion.current;
    const url = opts.forceFresh
      ? "/api/swipe/proposals?bust=1"
      : "/api/swipe/proposals";
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(20_000) });
      if (!res.ok) throw new Error("fetch failed");
      const data = await res.json();
      if (version !== fetchVersion.current) return;
      setProposals((current) => {
        const older = historyCursorRef.current === null ? [] : current.filter((p) => p.finalized);
        return [...new Map([...older, ...(data.proposals ?? [])].map((p: SwipeProposal) => [p.id, p])).values()] as SwipeProposal[];
      });
      if (historyCursorRef.current === null) setNextCursor(data.nextCursor ?? null);
      setDataStale(Boolean(data.stale));
      setFetchError(false);
    } catch (err) {
      console.warn("[vote] loadProposals:", err);
      if (version === fetchVersion.current) setFetchError(true);
    } finally {
      if (version === fetchVersion.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Initial mount: bust the server cache. Users typically land on
    // /vote right after submitting a proposal elsewhere (/vote/submit, /board)
    // — a 15s-stale cache would hide their submission. One extra
    // proposalCount probe per visit is cheap; subsequent polls reuse
    // the cache as normal.
    refetchProposals({ forceFresh: true });
    const interval = setInterval(() => { if (!document.hidden) void refetchProposals(); }, 15_000);
    let debounceTimer: ReturnType<typeof setTimeout>;
    const onVis = () => {
      if (document.visibilityState === "visible") {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => refetchProposals(), 2000);
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => { clearInterval(interval); document.removeEventListener("visibilitychange", onVis); clearTimeout(debounceTimer); };
  }, [refetchProposals]);

  useBoardEvents(useCallback(() => { refetchProposals({ forceFresh: true }); }, [refetchProposals]));

  // ── Multicall hasVoted check (Phase 5: single RPC instead of N+1) ──
  useEffect(() => {
    if (!address || !contractAddr || proposals.length === 0) return;
    let alive = true;
    const check = async () => {
      try {
        const { createPublicClient, http } = await import("viem");
        const client = createPublicClient({
          chain: { id: CHAIN_ID, name: CHAIN_NAME, nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 }, rpcUrls: { default: { http: [RPC_URL] } } },
          transport: http(),
        });
        const calls = proposals.map((p) => ({
          address: contractAddr,
          abi: LOREBOARD_ABI,
          functionName: "hasVoted" as const,
          args: [BigInt(p.id), address as `0x${string}`],
        }));
        const results = await client.multicall({ contracts: calls, allowFailure: true });
        if (!alive) return;
        const local = getVotedIds(address);
        results.forEach((r, i) => {
          if (r.status === "success") {
            if (r.result) local.add(proposals[i].id);
            else local.delete(proposals[i].id);
          }
        });
        saveVotedIds(address, local);
        setVotedIds(new Set([...local, ...pendingRef.current.keys(), ...uncertainRef.current.map((v) => v.id)]));
      } catch { /* multicall failed — localStorage fallback is still valid */ }
    };
    check();
    return () => { alive = false; };
  }, [address, contractAddr, proposals]);

  // ── Undo handler (Phase 10: fix stale closure) ──
  const handleUndo = useCallback(() => {
    if (lastVotedId == null) return;
    playUndoWhoosh();
    setPendingDecisions((prev) => { const n = new Map(prev); n.delete(lastVotedId); return n; });
    setVotedIds((prev) => { const n = new Set(prev); n.delete(lastVotedId); return n; });
    setVoteChoices((prev) => { const n = new Map(prev); n.delete(lastVotedId); return n; });
    setLastVotedId(null);
    setShowUndo(false);
  }, [lastVotedId]);

  useEffect(() => {
    // Shell: detach entirely while another window is foreground, so Z in a
    // prayer/chat input can never undo a vote here.
    if (!shellFocused) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "z" || e.key === "Z") {
        const tag = (e.target as HTMLElement)?.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA") return;
        handleUndo();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleUndo, shellFocused]);

  // ── Memoized filtered proposals (Phase 13) ──
  const now = Math.floor(Date.now() / 1000);
  const activeProposals = useMemo(() => {
    const n = Math.floor(Date.now() / 1000);
    return proposals
      .filter((p) => !p.finalized && n < p.votingEndsAt && !votedIds.has(p.id) && !skippedIds.has(p.id))
      .concat(proposals.filter((p) => !p.finalized && n < p.votingEndsAt && !votedIds.has(p.id) && skippedIds.has(p.id)));
  }, [proposals, votedIds, skippedIds]);
  const closedProposals = useMemo(() => proposals.filter((p) => p.finalized || now >= p.votingEndsAt), [proposals, now]);
  const currentProposal = activeProposals[0] ?? null;

  // ── Image preloading for next card (Phase 13a) ──
  useEffect(() => {
    const nextCid = activeProposals[1]?.ipfsCid;
    if (!nextCid) return;
    const img = new Image();
    img.src = cidToHttpUrl(nextCid);
  }, [activeProposals]);

  // ── Vote handler ──
  const handleVote = useCallback((proposalId: number, approve: boolean) => {
    if (!isConnected || !address) {
      addShadowVote(proposalId, approve);
      setVotedIds((prev) => { const n = new Set(prev); n.add(proposalId); return n; });
      setVoteChoices((prev) => { const n = new Map(prev); n.set(proposalId, approve); return n; });
      setLastVotedId(proposalId);
      setShowUndo(true);
      setTimeout(() => {
        toast(
          (t) => (
            <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "center", textAlign: "center" }}>
              <span style={{ fontSize: 13, color: "#e0d0ff" }}>Your vote was felt.</span>
              <button
                onClick={() => { toast.dismiss(t.id); openConnectModal?.(); }}
                style={{
                  padding: "6px 16px", borderRadius: 8, fontSize: 12, fontWeight: 700,
                  background: "linear-gradient(135deg,#e040fb,#f06292)", color: "#fff",
                  border: "none", cursor: "pointer", letterSpacing: "0.05em",
                }}
              >
                CONNECT TO MAKE IT PERMANENT
              </button>
            </div>
          ),
          { duration: 5000, style: { background: "#1a1a2e", border: "1px solid rgba(168,130,255,0.3)", borderRadius: 12 } }
        );
      }, 800);
      return;
    }
    setPendingDecisions((prev) => { const n = new Map(prev); n.set(proposalId, approve); return n; });
    setVotedIds((prev) => { const n = new Set(prev); n.add(proposalId); return n; });
    setVoteChoices((prev) => { const n = new Map(prev); n.set(proposalId, approve); return n; });
    setLastVotedId(proposalId);
    setShowUndo(true);
  }, [address, isConnected, addShadowVote, openConnectModal]);

  // ── Replay shadow votes when wallet connects ──
  const shadowReplayedRef = useRef(false);
  useEffect(() => {
    if (!isConnected || !address || shadowReplayedRef.current) return;
    const replayable = getReplayableVotes();
    if (replayable.length === 0) return;
    shadowReplayedRef.current = true;
    setPendingDecisions((prev) => {
      const n = new Map(prev);
      replayable.forEach((v) => n.set(v.proposalId, v.approve));
      return n;
    });
    clearShadowVotes();
    toast.success(`${replayable.length} shadow vote${replayable.length > 1 ? "s" : ""} queued for signing!`, { duration: 3000 });
  }, [isConnected, address, getReplayableVotes, clearShadowVotes]);

  const handleSkip = useCallback((proposalId: number) => {
    setSkippedIds((prev) => { const n = new Set(prev); n.add(proposalId); return n; });
  }, []);

  // ── Batch sign (Phase 7: fix chain reference) ──
  const handleBatchSign = useCallback(async () => {
    if (!address || !isConnected || pendingDecisions.size === 0 || uncertainVotes.length > 0) return;
    setBatchSigning(true);
    const entries = Array.from(pendingDecisions.entries());
    setBatchProgress({ signed: 0, total: entries.length });
    setTxStage("preparing");
    setTxHashes([]);

    setTransactionError(null);
    try {
      const walletClient = await getWalletClient();
      const { TARGET_CHAIN } = await import("@/lib/chain");
      const outcome = await submitVoteBatch(entries, async (proposalId, approve) => {
        if (accountRef.current !== address) throw new Error("Wallet changed");
        setTxStage("confirm");
        return walletClient.writeContract({ account: (walletClient.account ?? address) as `0x${string}`, address: contractAddr, abi: LOREBOARD_ABI, functionName: "castVote", args: [BigInt(proposalId), approve], chain: TARGET_CHAIN });
      }, (hash) => publicClient.waitForTransactionReceipt({ hash, timeout: 30_000 }), (item) => {
        rememberUncertain([{ id: item.id, hash: item.hash }]);
        setTxStage("broadcasting");
        setBatchProgress((prev) => ({ ...prev, signed: prev.signed + 1 }));
      });
      const confirmed = outcome.submissions.filter((r) => r.status === "confirmed");
      const pending = outcome.submissions.filter((r) => r.status === "pending");
      const sent = new Set([...confirmed, ...pending].map((r) => r.id));
      rememberUncertain(pending);
      if (accountRef.current === address) setPendingDecisions((current) => new Map([...current].filter(([id]) => !sent.has(id))));
      const saved = getVotedIds(address);
      confirmed.forEach((r) => saved.add(r.id));
      saveVotedIds(address, saved);
      if (accountRef.current !== address) return;
      setTransactionError(outcome.errors.join(" ") || null);
      if (confirmed.length) {
        setTxStage("done");
        setTxHashes(confirmed.map((r) => r.hash));
        setVictoryCount(confirmed.length);
        setShowVictory(true);
      }
      void refetchProposals({ forceFresh: true });
    } catch {
      setTransactionError("Votes could not be submitted. Your choices are kept; check your wallet and retry.");
    } finally { setBatchSigning(false); }

  }, [address, isConnected, pendingDecisions, contractAddr, uncertainVotes, rememberUncertain, refetchProposals]);

  const totalOnChain = proposalCount !== undefined ? Number(proposalCount) : 0;

  return (
    <>
      {/* Viewport takeovers — <body>-level so .vista-window's
          backdrop-filter containing block can't trap their position:fixed
          inside the frame. All render null until interaction. */}
      <BodyPortal>
        <UndoPill visible={showUndo && lastVotedId != null} onUndo={handleUndo} />

        {drawerProposal && (
          <DetailDrawer
            proposal={drawerProposal}
            onClose={() => setDrawerProposal(null)}
            onVote={(approve) => {
              handleVote(drawerProposal.id, approve);
              effects.fireSwipe(approve ? "right" : "left");
            }}
          />
        )}

        {batchSigning && (
          <TxOverlay stage={txStage} progress={batchProgress.signed} total={batchProgress.total} />
        )}

        {showVictory && (
          <VictoryCelebration count={victoryCount} txHashes={txHashes} onDismiss={() => setShowVictory(false)} />
        )}
      </BodyPortal>

      <div className="vista-window__body vote-readable-surface" style={{ overflow: "hidden", flex: 1, minHeight: 0, position: "relative" }}>
        <div className="p-3 md:p-4 flex flex-col h-full" style={{ minHeight: 0 }}>
          <div className="foid-focal-glow" aria-hidden="true" />

          {(dataStale || fetchError) && <p role="status" className="text-sm text-amber-200 mb-2">Showing the last available snapshot. Live updates will resume automatically.</p>}
          {transactionError && <p role="alert" className="rounded-lg bg-red-950 p-3 text-sm text-red-100 mb-2">{transactionError}</p>}
          {uncertainVotes.length > 0 && <div role="status" className="rounded-lg bg-slate-900 p-3 text-sm text-white mb-2">
            {uncertainVotes.map((vote) => <a className="underline mr-3" key={vote.id} href={`${CHAIN_CONFIG.blockExplorer}/tx/${vote.hash}`} target="_blank" rel="noreferrer">Check pending vote #{vote.id}</a>)}
            <button type="button" className="underline min-h-11" onClick={async () => {
              const unresolved: typeof uncertainVotes = [];
              const saved = getVotedIds(address);
              for (const vote of uncertainVotes) {
                try {
                  const receipt = await publicClient.getTransactionReceipt({ hash: vote.hash });
                  if (receipt.status === "success") saved.add(vote.id);
                  else setVotedIds((ids) => { const next = new Set(ids); next.delete(vote.id); return next; });
                } catch { unresolved.push(vote); }
              }
              if (address) saveVotedIds(address, saved);
              rememberUncertain(unresolved);
              if (!unresolved.length) setTransactionError(null);
              void refetchProposals();
            }}>Refresh transaction status</button>
          </div>}
          {/* Header with tabs */}
          <div className="flex-shrink-0 flex items-center justify-between gap-2 mb-2">
            <div className="flex flex-wrap items-center gap-2 min-w-0">
              <h1 className="foid-h3 foid-gradient-text flex-shrink-0">
                Vote
              </h1>
              <div className="flex gap-1" role="tablist" aria-label="Vote tabs">
                {(["active", "completed", "history"] as const).map((t) => (
                  <button key={t} onClick={() => setTab(t)}
                    role="tab"
                    aria-selected={tab === t}
                    aria-controls={`vote-panel-${t}`}
                    className={`min-h-11 rounded-full px-3 text-[9px] sm:text-[10px] font-semibold uppercase tracking-wider transition ${
                      tab === t ? "bg-white/10 text-white ring-1 ring-[var(--foid-border-subtle)] shadow-[var(--foid-shadow-chip)]" : "text-white/45 hover:bg-white/[0.06] hover:text-white/75"
                    }`}>
                    {t === "active" ? `Live (${activeProposals.length})` : t === "completed" ? `Closed (${closedProposals.length})` : `My Votes (${votedIds.size})`}
                  </button>
                ))}
              </div>
              {totalOnChain > 0 && <span className="hidden sm:inline text-[10px] text-white/25">{totalOnChain} onchain</span>}
            </div>
            <Link
              href="/vote/submit"
              className="hidden min-h-11 shrink-0 items-center rounded-xl border border-white/15 bg-white/[0.07] px-3 text-[10px] font-semibold uppercase tracking-wider text-white/70 transition hover:bg-white/10 hover:text-white sm:inline-flex"
            >
              + Propose
            </Link>
          </div>

          {/* Main content */}
          <div id={`vote-panel-${tab}`} role="tabpanel">
          {loading ? (
            <div className="flex flex-1 items-center justify-center" style={{ minHeight: "50vh" }}>
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-purple-500 border-t-transparent" role="status">
                <span className="sr-only">Loading proposals...</span>
              </div>
            </div>
          ) : fetchError && proposals.length === 0 ? (
            <div className="flex flex-col flex-1 min-h-0 items-center justify-center text-center px-4" style={{ minHeight: "50vh" }}>
              <div className="mb-3 text-4xl opacity-30" aria-hidden="true">&#x26A0;</div>
              <h2 className="text-base font-medium text-white/70">Failed to load proposals</h2>
              <p className="mt-2 text-sm text-white/40">Check your connection and try again.</p>
              <button onClick={() => refetchProposals({ forceFresh: true })} className="foid-cta-btn mt-4 min-h-11 px-5 text-xs font-semibold">
                Retry
              </button>
            </div>
          ) : tab === "active" ? (
            currentProposal ? (
              <div className="flex flex-col flex-1 min-h-0 items-center justify-center gap-2 relative"
                style={effects.shaking ? { animation: "swipe-shake 150ms ease-in-out" } : undefined}>
                <GlowFlash direction={effects.glow.direction} trigger={effects.glow.trigger} />
                <SwipeParticles direction={effects.particle.direction} trigger={effects.particle.trigger} />
                <StreakBadge count={effects.sessionVoteCount} trigger={effects.streakTrigger} />
                <VoteResultText direction={effects.result.direction} trigger={effects.result.trigger} />
                <SwipeCard
                  proposal={currentProposal}
                  onVote={handleVote}
                  onSkip={handleSkip}
                  nextProposal={activeProposals[1] ?? null}
                  onSwipeComplete={effects.fireSwipe}
                  cardKey={effects.cardKey}
                  onTap={() => setDrawerProposal(currentProposal)}
                  isFirst={effects.isFirstCard}
                />
                <div className="flex-shrink-0 text-center mt-1 space-y-0.5">
                  {address && multiplier > 0 && !powerLoading && (
                    <div className="text-[10px] text-purple-300/60">
                      Your vote weighs {multiplier.toFixed(1)}x{tierName ? ` (${tierName})` : ""}
                    </div>
                  )}
                  <div className="text-[10px] text-white/25">
                    {activeProposals.length} remaining
                    {pendingDecisions.size > 0 && <span className="ml-2 text-purple-400/50">{pendingDecisions.size} queued</span>}
                  </div>
                </div>
              </div>
            ) : pendingDecisions.size > 0 ? (
              <BatchReview
                pendingDecisions={pendingDecisions}
                proposals={proposals}
                multiplier={multiplier}
                tierName={tierName}
                powerLoading={powerLoading}
                batchSigning={batchSigning}
                batchProgress={batchProgress}
                onToggleVote={(pid) => {
                  setPendingDecisions((prev) => { const n = new Map(prev); n.set(pid, !prev.get(pid)); return n; });
                  setVoteChoices((prev) => { const n = new Map(prev); n.set(pid, !prev.get(pid)); return n; });
                }}
                onRemoveVote={(pid) => {
                  setPendingDecisions((prev) => { const n = new Map(prev); n.delete(pid); return n; });
                  setVotedIds((prev) => { const n = new Set(prev); n.delete(pid); return n; });
                }}
                onBatchSign={handleBatchSign}
              />
            ) : (
              <EmptyState proposals={proposals} sessionVoteCount={effects.sessionVoteCount} />
            )
          ) : tab === "completed" ? (
            closedProposals.length > 0 ? (
              <div className="flex-1 min-h-0 overflow-auto mt-1 grid gap-3 sm:grid-cols-2 auto-rows-min">
                {closedProposals.map((proposal) => {
                  const forC = proposal.forCount ?? 0;
                  const againstC = proposal.againstCount ?? 0;
                  const total = forC + againstC;
                  const pct = total > 0 ? Math.round((forC / total) * 100) : 0;
                  const passing = pct >= 51;
                  const myChoice = voteChoices.get(proposal.id);
                  return (
                    <Link key={proposal.id} href={`/vote/${proposal.id}`}
                      className="group block rounded-xl border border-[var(--foid-glass-panel-border)] bg-[var(--foid-glass-panel-bg)] p-2 shadow-[var(--foid-shadow-panel)] backdrop-blur-md transition hover:border-[var(--foid-border-subtle)]">
                      <div className="mb-1.5 flex items-center justify-between">
                        <span className="text-[10px] text-white/40">Prop #{proposal.id}</span>
                        <div className="flex items-center gap-1.5">
                          {votedIds.has(proposal.id) && (
                            <span className={`rounded-full px-1.5 py-0.5 text-[8px] font-semibold uppercase ${
                              myChoice === true ? "bg-green-600/20 text-green-400" : myChoice === false ? "bg-red-600/20 text-red-400" : "bg-purple-600/20 text-purple-300"
                            }`}>{myChoice === true ? "You: YES" : myChoice === false ? "You: NO" : "Voted"}</span>
                          )}
                          <span className={`rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase ${
                            proposal.approved ? "bg-green-600/20 text-green-400" : "bg-red-600/20 text-red-400"
                          }`}>{!proposal.finalized ? "Awaiting finalization" : proposal.approved ? "Canonized" : "Rejected"}</span>
                        </div>
                      </div>
                      <div className="overflow-hidden rounded-lg bg-white/[0.05]">
                        <div className="aspect-square max-h-[160px]">
                          {proposal.ipfsCid ? (
                            <img src={cidToHttpUrl(proposal.ipfsCid)} alt={`Proposal #${proposal.id}`} className="h-full w-full object-cover" loading="lazy" onError={(e) => tryNextGateway(e.currentTarget, proposal.ipfsCid)} />
                          ) : (
                            <div className="flex h-full items-center justify-center" style={{ background: CARD_VISUALS[proposal.id % CARD_VISUALS.length].gradient }}>
                              <span className="text-xl" aria-hidden="true">{CARD_VISUALS[proposal.id % CARD_VISUALS.length].symbol}</span>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="mt-2 rounded-lg border border-white/[0.06] bg-white/[0.05] px-2.5 py-1.5">
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <span className="text-green-400 text-[10px] font-bold">{forC}Y</span>
                            <span className="text-white/20 text-[9px]">vs</span>
                            <span className="text-red-400 text-[10px] font-bold">{againstC}N</span>
                          </div>
                          {total > 0 && <span className={`text-[9px] font-semibold ${passing ? "text-green-400" : "text-red-400"}`}>{pct}%</span>}
                        </div>
                        <div className="relative flex h-1.5 overflow-hidden rounded-full bg-white/10" role="progressbar" aria-valuenow={pct} aria-valuemax={100} aria-label={`${pct}% approval`}>
                          {total > 0 ? (
                            <>
                              <div className="bg-green-500 transition-all duration-300" style={{ width: `${(forC / total) * 100}%` }} />
                              <div className="bg-red-500 transition-all duration-300" style={{ width: `${(againstC / total) * 100}%` }} />
                            </>
                          ) : <div className="flex-1 bg-neutral-600/40" />}
                          <div className="absolute top-0 bottom-0 w-px bg-white/30" style={{ left: "51%" }} />
                        </div>
                      </div>
                      <p className="mt-2 text-xs text-slate-200">{!proposal.finalized ? "Voting has ended; the result is not finalized yet." : proposal.approved ? "Approved and placed on the board." : proposal.overlapRejected ? "Placement overlaps existing content." : proposal.voteCount !== undefined && proposal.voteCount < 3 ? `Quorum not reached: ${proposal.voteCount} of 3 required voters.` : pct < 51 ? "Weighted approval was below 51%." : "Not approved under the finalization rules; open for details."}</p>
                      <p className="text-xs text-slate-300">{proposal.voteCount === undefined ? "Voter count unavailable" : `${proposal.voteCount} unique voters`} · {forC} yes / {againstC} no weighted support</p>
                      <div className="mt-1.5 flex items-center justify-between text-[10px] text-neutral-400">
                        <span className="font-mono">{truncateAddress(proposal.proposer)}</span>
                        {proposal.approved && <span className="text-green-400">On Board <span aria-hidden="true">&rarr;</span></span>}
                      </div>
                    </Link>
                  );
                })}
                {nextCursor !== null && <button type="button" onClick={loadOlder} disabled={historyLoading} className="min-h-11 rounded-lg border border-slate-400 p-3 text-sm sm:col-span-2">{historyLoading ? "Loading history…" : "Load older proposals"}</button>}
              </div>
            ) : (
              <div className="flex flex-col flex-1 min-h-0 items-center justify-center text-center" style={{ minHeight: "50vh" }}>
                <div className="mb-3 text-4xl opacity-30" aria-hidden="true">&#x2694;</div>
                <h2 className="text-base font-medium text-white/70">No closed proposals yet</h2>
              </div>
            )
          ) : /* history tab */ (() => {
            const myVotedProposals = proposals.filter((p) => votedIds.has(p.id));
            return myVotedProposals.length > 0 ? (
              <div className="flex-1 min-h-0 overflow-auto mt-1 grid gap-3 sm:grid-cols-2 auto-rows-min">
                {myVotedProposals.map((proposal) => {
                  const forC = proposal.forCount ?? 0;
                  const againstC = proposal.againstCount ?? 0;
                  const total = forC + againstC;
                  const pct = total > 0 ? Math.round((forC / total) * 100) : 0;
                  const passing = pct >= 51;
                  const myChoice = voteChoices.get(proposal.id);
                  const pending = pendingDecisions.has(proposal.id);
                  const isLive = !proposal.finalized && now < proposal.votingEndsAt;
                  return (
                    <div key={proposal.id} className="block rounded-xl border border-neutral-800 bg-neutral-900/40 p-2 relative overflow-hidden">
                      <div className="mb-1.5 flex items-center justify-between">
                        <span className="text-[10px] text-white/40">Prop #{proposal.id}</span>
                        <div className="flex items-center gap-1.5">
                          <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold uppercase ${
                            myChoice === true ? "bg-green-600/25 text-green-400 ring-1 ring-green-500/30" : myChoice === false ? "bg-red-600/25 text-red-400 ring-1 ring-red-500/30" : "bg-purple-600/20 text-purple-300"
                          }`}>
                            {myChoice === true ? "YES" : myChoice === false ? "NO" : "Voted"}
                            {pending && " (pending)"}
                          </span>
                          {proposal.finalized ? (
                            <span className={`rounded-full px-1.5 py-0.5 text-[8px] font-semibold uppercase ${
                              proposal.approved ? "bg-green-600/15 text-green-400/70" : "bg-red-600/15 text-red-400/70"
                            }`}>{proposal.approved ? "Passed" : "Failed"}</span>
                          ) : isLive ? (
                            <span className="rounded-full px-1.5 py-0.5 text-[8px] font-semibold uppercase bg-purple-600/20 text-purple-300 ring-1 ring-purple-500/25">
                              <span className="inline-block h-1 w-1 rounded-full bg-purple-400 animate-pulse mr-1 align-middle" aria-hidden="true" />Live
                            </span>
                          ) : null}
                        </div>
                      </div>
                      <div className="overflow-hidden rounded-lg bg-neutral-800/50">
                        <div className="aspect-square max-h-[160px]">
                          {proposal.ipfsCid ? (
                            <img src={cidToHttpUrl(proposal.ipfsCid)} alt={`Proposal #${proposal.id}`} className="h-full w-full object-cover" loading="lazy" onError={(e) => tryNextGateway(e.currentTarget, proposal.ipfsCid)} />
                          ) : (
                            <div className="flex h-full items-center justify-center" style={{ background: CARD_VISUALS[proposal.id % CARD_VISUALS.length].gradient }}>
                              <span className="text-xl" aria-hidden="true">{CARD_VISUALS[proposal.id % CARD_VISUALS.length].symbol}</span>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="mt-2 rounded-lg bg-neutral-800/60 px-2.5 py-2">
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-2 text-[10px]">
                            <span className="text-green-400 font-bold"><span className="text-xs">{forC}</span><span className="text-green-400/50 ml-0.5">for</span></span>
                            <span className="text-white/15">/</span>
                            <span className="text-red-400 font-bold"><span className="text-xs">{againstC}</span><span className="text-red-400/50 ml-0.5">against</span></span>
                          </div>
                          {total > 0 && <span className={`text-[10px] font-bold ${passing ? "text-green-400" : "text-amber-400"}`}>{pct}%</span>}
                        </div>
                        <div className="relative flex h-2 overflow-hidden rounded-full bg-neutral-700/50" role="progressbar" aria-valuenow={pct} aria-valuemax={100} aria-label={`${pct}% approval`}>
                          {total > 0 ? (
                            <>
                              <div className="bg-green-500 transition-all duration-300 rounded-l-full" style={{ width: `${(forC / total) * 100}%` }} />
                              <div className="bg-red-500 transition-all duration-300 rounded-r-full" style={{ width: `${(againstC / total) * 100}%` }} />
                            </>
                          ) : <div className="flex-1 bg-neutral-600/40 rounded-full" />}
                          <div className="absolute top-0 bottom-0 w-px bg-white/40" style={{ left: "51%" }} />
                        </div>
                      </div>
                      <p className="mt-2 text-xs text-slate-200">{!proposal.finalized ? "Voting has ended; the result is not finalized yet." : proposal.approved ? "Approved and placed on the board." : proposal.overlapRejected ? "Placement overlaps existing content." : proposal.voteCount !== undefined && proposal.voteCount < 3 ? `Quorum not reached: ${proposal.voteCount} of 3 required voters.` : pct < 51 ? "Weighted approval was below 51%." : "Not approved under the finalization rules; open for details."}</p>
                      <p className="text-xs text-slate-300">{proposal.voteCount === undefined ? "Voter count unavailable" : `${proposal.voteCount} unique voters`} · {forC} yes / {againstC} no weighted support</p>
                      <div className="mt-1.5 flex items-center justify-between text-[10px] text-neutral-400">
                        <span className="font-mono">{truncateAddress(proposal.proposer)}</span>
                        {proposal.approved && <span className="text-green-400">On Board</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col flex-1 min-h-0 items-center justify-center text-center px-4" style={{ minHeight: "50vh" }}>
                <div className="mb-3 text-4xl opacity-30" aria-hidden="true">&#x1F5F3;</div>
                <h2 className="text-base font-medium text-white/70">No votes yet</h2>
                <p className="mt-2 text-sm text-white/40">Swipe on proposals in the Live tab to start voting.</p>
              </div>
            );
          })()}
          </div>
        </div>
      </div>
    </>
  );
}
