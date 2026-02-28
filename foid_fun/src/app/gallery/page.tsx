"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAccount, useReadContract, useDisconnect, useConnect } from "wagmi";
import Link from "next/link";
import { CONTRACTS } from "@/lib/contracts/addresses";
import { FOID_TREST_ABI } from "@/lib/contracts/abis/foidTrest";
import {
  useFoidTrestGovernance,
  useFlagCount,
  useHasFlagged,
  useActiveVote,
  useRemovalVote,
  useHasVotedOnRemoval,
} from "@/hooks/useFoidTrestGovernance";
import AppTitlebar from "@/app/(components)/AppTitlebar";

type TrestEntry = {
  id: number;
  creator: string;
  ipfsCid: string;
  title: string;
  description: string;
  placedAt: number;
  path: number; // 0 = direct, 1 = duel
  duelId: number;
  visible: boolean;
};

type FilterMode = "all" | "canonized";

const IPFS_GATEWAY = "https://ipfs.io/ipfs/";

function cidToUrl(cid: string): string {
  if (!cid) return "";
  if (cid.startsWith("http")) return cid;
  return `${IPFS_GATEWAY}${cid}`;
}

function truncateAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function formatTimestamp(unix: number): string {
  return new Date(unix * 1000).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatEth(wei: bigint): string {
  const eth = Number(wei) / 1e18;
  if (eth < 0.001) return "<0.001";
  return eth.toFixed(4);
}

// ── Gradient + symbol combos for trest cards ──
const TREST_VISUALS = [
  { gradient: "linear-gradient(135deg, #1a0a2e 0%, #4a1a8e 50%, #0f0c29 100%)", symbol: "\u2728" },
  { gradient: "linear-gradient(135deg, #0a1a2e 0%, #1a4a8e 50%, #0c1929 100%)", symbol: "\u{1F30A}" },
  { gradient: "linear-gradient(135deg, #2e0a1a 0%, #8e1a4a 50%, #290c0f 100%)", symbol: "\u{1F339}" },
  { gradient: "linear-gradient(135deg, #0a2e1a 0%, #1a8e4a 50%, #0c290f 100%)", symbol: "\u{1F331}" },
  { gradient: "linear-gradient(135deg, #2e2e0a 0%, #8e8e1a 50%, #29290c 100%)", symbol: "\u{1F31F}" },
  { gradient: "linear-gradient(135deg, #0a0a2e 0%, #2a1a6e 50%, #0c0c29 100%)", symbol: "\u{1F52E}" },
];

// ── Mock gallery entries for demo (init in useEffect to avoid hydration mismatch) ──
function makeMockEntries(): TrestEntry[] {
  const now = Math.floor(Date.now() / 1000);
  return [
    { id: 1, creator: "0x1234567890abcdef1234567890abcdef12345678", ipfsCid: "", title: "", description: "", placedAt: now - 86400 * 7, path: 1, duelId: 1, visible: true },
    { id: 2, creator: "0xabcdef1234567890abcdef1234567890abcdef12", ipfsCid: "", title: "", description: "", placedAt: now - 86400 * 5, path: 1, duelId: 2, visible: true },
    { id: 3, creator: "0x2222222222222222222222222222222222222222", ipfsCid: "", title: "", description: "", placedAt: now - 86400 * 3, path: 0, duelId: 0, visible: true },
    { id: 4, creator: "0x3333333333333333333333333333333333333333", ipfsCid: "", title: "", description: "", placedAt: now - 86400 * 2, path: 1, duelId: 3, visible: true },
    { id: 5, creator: "0x4444444444444444444444444444444444444444", ipfsCid: "", title: "", description: "", placedAt: now - 86400, path: 1, duelId: 4, visible: true },
    { id: 6, creator: "0x5555555555555555555555555555555555555555", ipfsCid: "", title: "", description: "", placedAt: now - 43200, path: 0, duelId: 0, visible: true },
  ];
}

/** Governance panel for a single entry: flag button + active vote UI */
function GovernancePanel({ entryId }: { entryId: number }) {
  const { address } = useAccount();
  const { flagFeeWei, flagThreshold, flagPost, voteOnRemoval, resolveRemovalVote } = useFoidTrestGovernance();
  const { flagCount } = useFlagCount(entryId);
  const alreadyFlagged = useHasFlagged(entryId);
  const activeVoteId = useActiveVote(entryId);
  const { vote } = useRemovalVote(activeVoteId);
  const hasVoted = useHasVotedOnRemoval(activeVoteId);

  const [flagging, setFlagging] = useState(false);
  const [voting, setVoting] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const handleFlag = useCallback(async () => {
    try {
      setFlagging(true);
      await flagPost(entryId);
      setShowConfirm(false);
    } catch (err: any) {
      console.error("Flag failed:", err?.message);
    } finally {
      setFlagging(false);
    }
  }, [flagPost, entryId]);

  const handleVote = useCallback(async (support: boolean) => {
    try {
      setVoting(true);
      await voteOnRemoval(activeVoteId, support);
    } catch (err: any) {
      console.error("Vote failed:", err?.message);
    } finally {
      setVoting(false);
    }
  }, [voteOnRemoval, activeVoteId]);

  const handleResolve = useCallback(async () => {
    try {
      setResolving(true);
      await resolveRemovalVote(activeVoteId);
    } catch (err: any) {
      console.error("Resolve failed:", err?.message);
    } finally {
      setResolving(false);
    }
  }, [resolveRemovalVote, activeVoteId]);

  const [govNow, setGovNow] = useState(0);
  useEffect(() => { setGovNow(Math.floor(Date.now() / 1000)); }, []);
  const voteEnded = vote && govNow > 0 && Number(vote.endsAt) < govNow;
  const voteActive = activeVoteId > 0 && vote && !vote.resolved;

  return (
    <div className="border-t border-white/5 px-2 py-1.5">
      {voteActive ? (
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-red-400 animate-pulse" />
            <span className="text-[10px] font-semibold uppercase tracking-wider text-red-300">
              Removal Vote Active
            </span>
          </div>
          <div className="flex gap-2 text-[10px]">
            <span className="text-red-400">Remove: {vote.votesFor.toString()}</span>
            <span className="text-green-400">Keep: {vote.votesAgainst.toString()}</span>
          </div>
          {voteEnded ? (
            <button onClick={handleResolve} disabled={resolving} className="w-full rounded-lg bg-purple-600/30 px-2 py-1 text-[10px] font-medium text-purple-200 transition hover:bg-purple-600/50 disabled:opacity-50">
              {resolving ? "Resolving..." : "Resolve Vote"}
            </button>
          ) : address && !hasVoted ? (
            <div className="flex gap-1.5">
              <button onClick={() => handleVote(true)} disabled={voting} className="flex-1 rounded-lg bg-red-600/20 px-2 py-1 text-[10px] font-medium text-red-300 transition hover:bg-red-600/40 disabled:opacity-50">Remove</button>
              <button onClick={() => handleVote(false)} disabled={voting} className="flex-1 rounded-lg bg-green-600/20 px-2 py-1 text-[10px] font-medium text-green-300 transition hover:bg-green-600/40 disabled:opacity-50">Keep</button>
            </div>
          ) : hasVoted ? (
            <div className="text-[10px] text-neutral-500 italic">You already voted</div>
          ) : null}
        </div>
      ) : (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-[10px] text-neutral-500">
            {flagCount > 0 && (
              <span className="rounded-full bg-red-600/20 px-1.5 py-0.5 text-red-300 font-medium">
                {flagCount}/{flagThreshold} flags
              </span>
            )}
          </div>
          {address && !alreadyFlagged ? (
            showConfirm ? (
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-neutral-400">{formatEth(flagFeeWei)} ETH fee</span>
                <button onClick={handleFlag} disabled={flagging} className="rounded-md bg-red-600/30 px-2 py-0.5 text-[10px] font-medium text-red-300 transition hover:bg-red-600/50 disabled:opacity-50">
                  {flagging ? "..." : "Confirm"}
                </button>
                <button onClick={() => setShowConfirm(false)} className="text-[10px] text-neutral-500 hover:text-neutral-300">Cancel</button>
              </div>
            ) : (
              <button onClick={() => setShowConfirm(true)} className="rounded-md px-2 py-0.5 text-[10px] text-neutral-500 transition hover:bg-red-600/10 hover:text-red-300" title="Flag for review">
                Flag
              </button>
            )
          ) : alreadyFlagged ? (
            <span className="text-[10px] text-neutral-600 italic">Flagged</span>
          ) : null}
        </div>
      )}
    </div>
  );
}

function TrestCard({ entry }: { entry: TrestEntry }) {
  const [loaded, setLoaded] = useState(false);

  return (
    <div className="group relative overflow-hidden rounded-xl border border-purple-500/15 bg-neutral-900/70 hover:border-purple-500/40 hover:shadow-[0_0_24px_rgba(139,92,246,0.2)] [perspective:600px] hover:[transform:scale(1.03)_rotateY(2deg)_rotateX(-1deg)]" style={{ transition: "transform 200ms ease-out, border-color 200ms ease, box-shadow 200ms ease" }}>
      <div className="relative aspect-square overflow-hidden bg-neutral-800/40">
        {entry.ipfsCid ? (
          <>
            {!loaded && <div className="absolute inset-0 animate-pulse bg-neutral-800" />}
            <img
              src={cidToUrl(entry.ipfsCid)}
              alt={entry.title || "FOIDREST entry"}
              className={`h-full w-full object-cover transition-opacity duration-500 ${loaded ? "opacity-100" : "opacity-0"}`}
              onLoad={() => setLoaded(true)}
            />
          </>
        ) : (
          <div
            className="flex h-full items-center justify-center relative"
            style={{ background: TREST_VISUALS[(entry.id - 1) % TREST_VISUALS.length].gradient }}
          >
            <div className="absolute inset-0 opacity-[0.06]" style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")", backgroundSize: "150px" }} />
            <span className="text-5xl drop-shadow-[0_0_20px_rgba(255,255,255,0.15)]">
              {TREST_VISUALS[(entry.id - 1) % TREST_VISUALS.length].symbol}
            </span>
          </div>
        )}
        <div className="absolute right-2 top-2">
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
            entry.path === 1
              ? "bg-amber-400/90 text-amber-900 shadow-[0_0_8px_rgba(251,191,36,0.5)]"
              : "bg-slate-400/80 text-slate-900 shadow-[0_0_8px_rgba(148,163,184,0.4)]"
          }`}>
            {entry.path === 0 ? "Placed" : "Won"}
          </span>
        </div>
      </div>
      <div className="space-y-1 p-2">
        {entry.title && <h3 className="truncate text-xs font-medium text-neutral-100">{entry.title}</h3>}
        <div className="flex items-center justify-between text-[10px] text-neutral-400">
          <span className="font-mono">{truncateAddress(entry.creator)}</span>
          <span suppressHydrationWarning>{formatTimestamp(entry.placedAt)}</span>
        </div>
      </div>
      <GovernancePanel entryId={entry.id} />
    </div>
  );
}

export default function TrestPage() {
  const { address, isConnected } = useAccount();
  const { disconnect } = useDisconnect();
  const { connectors } = useConnect();
  const [filter, setFilter] = useState<FilterMode>("all");
  const [loading, setLoading] = useState(true);

  // Use mock entries, merged with on-chain data when available
  const [entries, setEntries] = useState<TrestEntry[]>([]);

  const { data: entryCount } = useReadContract({
    address: (CONTRACTS.FOID_TREST ?? "") as `0x${string}`,
    abi: FOID_TREST_ABI,
    functionName: "entryCount",
    query: { enabled: !!CONTRACTS.FOID_TREST },
  });

  void entryCount;

  useEffect(() => {
    setEntries(makeMockEntries());
    const timer = setTimeout(() => setLoading(false), 400);
    return () => clearTimeout(timer);
  }, []);

  const filtered = useMemo(() => {
    return entries.filter((e) => {
      if (!e.visible) return false;
      if (filter === "canonized") return e.path === 1;
      return true;
    });
  }, [entries, filter]);

  const handleSwitchWallet = useCallback(() => {
    const injected = connectors.find((c) => c.id === "injected") ?? connectors[0];
    if (injected) injected.connect?.();
  }, [connectors]);

  return (
    <main className="relative bg-foid-bg text-white/90 overflow-hidden flex items-center justify-center" style={{ height: "100vh" }}>
      <div className="pointer-events-none fixed inset-0 z-0 vignette" />
      <section className="relative z-10 w-full max-w-full px-2 sm:px-4">
        <div className="mx-auto w-full max-w-6xl">
          <div className="vista-window vista-window--terminal vista-window--enhanced h-[90vh] max-h-[90vh] w-full flex flex-col">
            <AppTitlebar
              title="GALLERY.EXE"
              connected={isConnected}
              address={address}
              onDisconnect={() => disconnect()}
              onSwitchWallet={handleSwitchWallet}
            />
            <div className="vista-window__body" style={{ overflowY: "auto", flex: 1, minHeight: 0 }}>
              <div className="p-3 md:p-4 flex flex-col gap-4">
                {/* Header */}
                <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <h1
                      className="text-xl sm:text-2xl font-black uppercase tracking-[0.2em] text-transparent bg-clip-text"
                      style={{
                        backgroundImage: "linear-gradient(135deg, rgba(168,130,255,1) 0%, rgba(255,255,255,0.95) 50%, rgba(200,160,255,0.9) 100%)",
                      }}
                    >
                      Gallery
                    </h1>
                    <p className="mt-1 text-[10px] text-white/45 tracking-wide">
                      the internet&apos;s hottest pop-up gallery
                    </p>
                  </div>
                  <Link href="/swipe" className="foid-cta-btn text-xs px-3 py-1.5" style={{ background: "linear-gradient(135deg, #e040fb, #f06292)" }}>
                    PROPOSE A MEME
                  </Link>
                </div>

                {/* Filter bar */}
                <div className="flex gap-2">
                  {(["all", "canonized"] as FilterMode[]).map((mode) => (
                    <button
                      key={mode}
                      onClick={() => setFilter(mode)}
                      className={`rounded-lg px-3 py-1 text-[10px] font-medium uppercase tracking-wider transition ${
                        filter === mode
                          ? "bg-purple-600/30 text-purple-300 ring-1 ring-purple-500/40"
                          : "text-white/40 hover:bg-white/5 hover:text-white/70"
                      }`}
                    >
                      {mode === "all" ? `All (${entries.filter(e => e.visible).length})` : "Canonized"}
                    </button>
                  ))}
                </div>

                {/* Gallery grid */}
                {loading ? (
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                    {Array.from({ length: 8 }).map((_, i) => (
                      <div key={i} className="aspect-square animate-pulse rounded-xl bg-neutral-800/50" />
                    ))}
                  </div>
                ) : filtered.length > 0 ? (
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                    {filtered.map((entry) => (
                      <TrestCard key={entry.id} entry={entry} />
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-10 text-center">
                    <div className="mb-3 text-4xl opacity-30">&#x2727;</div>
                    <h2 className="text-base font-medium text-white/70">The gallery awaits</h2>
                    <p className="mt-1 max-w-sm text-xs text-white/40">
                      No entries yet. Win a swipe to earn your place in the Gallery.
                    </p>
                    <Link href="/swipe/submit" className="foid-cta-btn mt-4" style={{ background: "linear-gradient(135deg, #e040fb, #f06292)" }}>
                      Propose a Meme
                    </Link>
                  </div>
                )}

                {/* Bottom CTA */}
                <div className="flex justify-center pt-2 pb-1">
                  <Link href="/swipe" className="foid-cta-btn" style={{ background: "linear-gradient(135deg, #e040fb, #f06292)" }}>
                    PROPOSE A MEME &rarr;
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
      <style jsx>{`
        :global(.vista-window__body) {
          scrollbar-width: thin;
          scrollbar-color: rgba(255,255,255,0.15) transparent;
        }
        :global(.vista-window__body)::-webkit-scrollbar { width: 8px; }
        :global(.vista-window__body)::-webkit-scrollbar-thumb {
          border-radius: 999px;
          background: rgba(255,255,255,0.2);
          border: 2px solid transparent;
          background-clip: padding-box;
        }
        :global(.vista-window__body)::-webkit-scrollbar-track { background: transparent; }
      `}</style>
    </main>
  );
}
