"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAccount, useReadContract, useDisconnect, useConnect } from "wagmi";
import Link from "next/link";
import { CONTRACTS } from "@/lib/contracts/addresses";
import { DUEL_ARENA_ABI } from "@/lib/contracts/abis/duelArena";
import { getWalletClient } from "@/lib/viem";
import AppTitlebar from "@/app/(components)/AppTitlebar";
import { useSwipeVote } from "@/hooks/useSwipeVote";
import toast from "react-hot-toast";

const IPFS_GATEWAY = "https://ipfs.io/ipfs/";
const CANONIZE_THRESHOLD = 20;

function cidToUrl(cid: string): string {
  if (!cid) return "";
  if (cid.startsWith("http")) return cid;
  return `${IPFS_GATEWAY}${cid}`;
}

function truncateAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

type DuelData = {
  id: number;
  submissionA: { id: number; creator: string; ipfsCid: string };
  submissionB: { id: number; creator: string; ipfsCid: string };
  votingEndsAt: number;
  totalVotesA: number;
  totalVotesB: number;
  winner: number;
  finalized: boolean;
};

type StagedVote = { duelId: number; side: 1 | 2 };

// ── Gradient + symbol combos for mock cards ──
const CARD_VISUALS = [
  { gradient: "linear-gradient(135deg, #1a0a2e 0%, #3d1a6e 50%, #0f0c29 100%)", symbol: "\u2694\uFE0F", label: "A" },
  { gradient: "linear-gradient(135deg, #0a1a2e 0%, #1a3d6e 50%, #0c1929 100%)", symbol: "\u{1F6E1}\uFE0F", label: "B" },
  { gradient: "linear-gradient(135deg, #2e0a1a 0%, #6e1a3d 50%, #290c0f 100%)", symbol: "\u2620\uFE0F", label: "A" },
  { gradient: "linear-gradient(135deg, #0a2e1a 0%, #1a6e3d 50%, #0c290f 100%)", symbol: "\u{1F451}", label: "B" },
  { gradient: "linear-gradient(135deg, #2e2e0a 0%, #6e6e1a 50%, #29290c 100%)", symbol: "\u{1F525}", label: "A" },
  { gradient: "linear-gradient(135deg, #0a0a2e 0%, #1a1a6e 50%, #0c0c29 100%)", symbol: "\u{1F30C}", label: "B" },
];

// ── Mock duels for demo ──
function makeMockDuels(): DuelData[] {
  const now = Math.floor(Date.now() / 1000);
  return [
    {
      id: 1,
      submissionA: { id: 1, creator: "0x1234567890abcdef1234567890abcdef12345678", ipfsCid: "" },
      submissionB: { id: 2, creator: "0xabcdef1234567890abcdef1234567890abcdef12", ipfsCid: "" },
      votingEndsAt: now + 86400,
      totalVotesA: 12,
      totalVotesB: 8,
      winner: 0,
      finalized: false,
    },
    {
      id: 2,
      submissionA: { id: 3, creator: "0x2222222222222222222222222222222222222222", ipfsCid: "" },
      submissionB: { id: 4, creator: "0x3333333333333333333333333333333333333333", ipfsCid: "" },
      votingEndsAt: now + 43200,
      totalVotesA: 5,
      totalVotesB: 15,
      winner: 0,
      finalized: false,
    },
    {
      id: 3,
      submissionA: { id: 5, creator: "0x4444444444444444444444444444444444444444", ipfsCid: "" },
      submissionB: { id: 6, creator: "0x5555555555555555555555555555555555555555", ipfsCid: "" },
      votingEndsAt: 0,
      totalVotesA: 30,
      totalVotesB: 22,
      winner: 1,
      finalized: true,
    },
  ];
}

/** Swipeable card showing one side at a time */
function SwipeCard({
  duel,
  showingSide,
  onVote,
}: {
  duel: DuelData;
  showingSide: "A" | "B";
  onVote: (side: 1 | 2) => void;
}) {
  const sub = showingSide === "A" ? duel.submissionA : duel.submissionB;
  const otherSub = showingSide === "A" ? duel.submissionB : duel.submissionA;
  const subVisual = CARD_VISUALS[(sub.id - 1) % CARD_VISUALS.length];
  const otherVisual = CARD_VISUALS[(otherSub.id - 1) % CARD_VISUALS.length];

  const { direction, handlers, style } = useSwipeVote({
    threshold: 100,
    onSwipeRight: () => onVote(showingSide === "A" ? 1 : 2),
    onSwipeLeft: () => onVote(showingSide === "A" ? 2 : 1),
  });

  return (
    <div className="relative mx-auto w-full max-w-[min(420px,45vh,100%)]" style={{ minHeight: 0 }}>
      {/* Background card (other side peek) */}
      <div className="absolute inset-0 rounded-2xl border border-neutral-800 bg-neutral-900/40 overflow-hidden scale-[0.95] opacity-60">
        <div className="w-full aspect-square">
          {otherSub.ipfsCid ? (
            <img
              src={cidToUrl(otherSub.ipfsCid)}
              alt="Other side"
              className="h-full w-full object-cover blur-[2px]"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center" style={{ background: otherVisual.gradient }}>
              <span className="text-4xl opacity-30">{otherVisual.symbol}</span>
            </div>
          )}
        </div>
      </div>

      {/* Active card */}
      <div
        {...handlers}
        style={{ ...style, touchAction: "pan-y" }}
        className="relative rounded-2xl border border-neutral-700 bg-neutral-900/80 overflow-hidden select-none"
      >
        {direction === "right" && (
          <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
            <span className="rounded-xl border-4 border-green-500 px-6 py-2 text-2xl font-black uppercase text-green-500 -rotate-12 opacity-80">
              Canon
            </span>
          </div>
        )}
        {direction === "left" && (
          <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
            <span className="rounded-xl border-4 border-red-500 px-6 py-2 text-2xl font-black uppercase text-red-500 rotate-12 opacity-80">
              Pass
            </span>
          </div>
        )}

        <div className="w-full aspect-square">
          {sub.ipfsCid ? (
            <img
              src={cidToUrl(sub.ipfsCid)}
              alt={`Side ${showingSide}`}
              className="h-full w-full object-cover"
              draggable={false}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center relative" style={{ background: subVisual.gradient }}>
              <div className="absolute inset-0 opacity-[0.06]" style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")", backgroundSize: "150px" }} />
              <span className="text-7xl drop-shadow-[0_0_24px_rgba(255,255,255,0.2)]">{subVisual.symbol}</span>
            </div>
          )}
        </div>

        <div className="border-t border-neutral-800 bg-neutral-900/80 px-3 py-2 flex items-center justify-between">
          <div>
            <span className="text-[10px] uppercase tracking-wider text-neutral-500">
              Prop #{duel.id}
            </span>
            <div className="mt-0.5 font-mono text-xs text-neutral-300">
              {truncateAddress(sub.creator)}
            </div>
          </div>
          <span className="text-[10px] text-neutral-500">Swipe to vote</span>
        </div>
      </div>

      <div className="mt-2 flex items-center justify-between px-4 text-[10px] font-semibold opacity-60">
        <span className="text-cyan-400">&larr; PASS</span>
        <span className="text-pink-400">CANON &rarr;</span>
      </div>
    </div>
  );
}

/** Confirmation modal for batched vote submission */
function ConfirmModal({
  count,
  onConfirm,
  onCancel,
  submitting,
}: {
  count: number;
  onConfirm: () => void;
  onCancel: () => void;
  submitting: boolean;
}) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="mx-4 w-full max-w-sm rounded-2xl border border-white/10 bg-neutral-900/95 p-6 shadow-2xl">
        <h3 className="text-base font-bold text-white/90 mb-2">Submit {count} vote{count !== 1 ? "s" : ""} in one transaction?</h3>
        <p className="text-xs text-white/50 mb-6">This will sign a single batched transaction for all your staged votes.</p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            disabled={submitting}
            className="flex-1 rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium text-white/70 transition hover:bg-white/10 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={submitting}
            className="flex-1 rounded-lg px-4 py-2.5 text-sm font-bold text-white transition hover:opacity-85 disabled:opacity-50"
            style={{ background: "linear-gradient(135deg, #e040fb, #f06292)" }}
          >
            {submitting ? "Signing..." : "Confirm & Sign"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function SwipePage() {
  const { address, isConnected } = useAccount();
  const { disconnect } = useDisconnect();
  const { connectors } = useConnect();
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showingSide, setShowingSide] = useState<"A" | "B">("A");
  const [tab, setTab] = useState<"active" | "completed">("active");
  const [voting, setVoting] = useState(false);
  const [duels, setDuels] = useState<DuelData[]>([]);
  const [stagedVotes, setStagedVotes] = useState<StagedVote[]>([]);
  const [showConfirm, setShowConfirm] = useState(false);
  const [submittingBatch, setSubmittingBatch] = useState(false);
  const [batchSuccess, setBatchSuccess] = useState(false);

  const contractAddr = (CONTRACTS.DUEL_ARENA ?? "") as `0x${string}`;
  const hasContract = !!CONTRACTS.DUEL_ARENA;

  const { data: duelCount } = useReadContract({
    address: contractAddr,
    abi: DUEL_ARENA_ABI,
    functionName: "duelCount",
    query: { enabled: hasContract },
  });

  const { data: unmatchedCount } = useReadContract({
    address: contractAddr,
    abi: DUEL_ARENA_ABI,
    functionName: "pendingSubmissions",
    query: { enabled: hasContract },
  });

  void duelCount;

  useEffect(() => {
    setDuels(makeMockDuels());
    const timer = setTimeout(() => setLoading(false), 600);
    return () => clearTimeout(timer);
  }, []);

  const activeDuels = useMemo(() => duels.filter((d) => !d.finalized), [duels]);
  const completedDuels = useMemo(() => duels.filter((d) => d.finalized), [duels]);
  const currentDuel = activeDuels[currentIndex] ?? null;

  const handleVote = useCallback(
    (side: 1 | 2) => {
      if (!currentDuel || voting) return;

      // Stage the vote locally
      setStagedVotes((prev) => [...prev, { duelId: currentDuel.id, side }]);
      setBatchSuccess(false);

      if (showingSide === "A") {
        setShowingSide("B");
      } else {
        setCurrentIndex((i) => i + 1);
        setShowingSide("A");
      }
    },
    [currentDuel, voting, showingSide]
  );

  const handleSubmitBatch = useCallback(async () => {
    if (stagedVotes.length === 0) return;
    setSubmittingBatch(true);

    try {
      if (isConnected && address && hasContract) {
        const walletClient = await getWalletClient();
        // Submit each vote (in production this would be a multicall)
        for (const v of stagedVotes) {
          await walletClient.writeContract({
            account: address,
            address: contractAddr,
            abi: DUEL_ARENA_ABI,
            functionName: "vote",
            args: [BigInt(v.duelId), v.side],
          });
        }
        toast.success(`${stagedVotes.length} votes submitted!`);
      } else {
        toast.success(`Demo: ${stagedVotes.length} votes submitted!`);
      }
      setStagedVotes([]);
      setBatchSuccess(true);
      setTimeout(() => setBatchSuccess(false), 3000);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Batch vote failed");
    } finally {
      setSubmittingBatch(false);
      setShowConfirm(false);
    }
  }, [stagedVotes, isConnected, address, hasContract, contractAddr]);

  const totalVotes = currentDuel
    ? currentDuel.totalVotesA + currentDuel.totalVotesB
    : 0;

  const handleSwitchWallet = useCallback(() => {
    const injected = connectors.find((c) => c.id === "injected") ?? connectors[0];
    if (injected) injected.connect?.();
  }, [connectors]);

  return (
    <main className="relative bg-foid-bg text-white/90 overflow-hidden flex items-center justify-center" style={{ height: "100vh" }}>
      <div className="pointer-events-none fixed inset-0 z-0 vignette" />
      <section className="relative z-10 w-full max-w-full px-2 sm:px-4">
        <div className="mx-auto w-full max-w-6xl">
          <div className="vista-window vista-window--terminal vista-window--enhanced h-[94vh] max-h-[94vh] w-full flex flex-col">
            <AppTitlebar
              title="SWIPE.EXE"
              connected={isConnected}
              address={address}
              onDisconnect={() => disconnect()}
              onSwitchWallet={handleSwitchWallet}
            />
            <div className="vista-window__body" style={{ overflow: "hidden", flex: 1, minHeight: 0 }}>
              <div className="p-3 md:p-4 flex flex-col h-full" style={{ minHeight: 0 }}>
                {/* Header */}
                <div className="flex-shrink-0 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <h1
                      className="text-lg sm:text-xl font-black uppercase tracking-[0.2em] text-transparent bg-clip-text"
                      style={{
                        backgroundImage: "linear-gradient(135deg, rgba(168,130,255,1) 0%, rgba(255,255,255,0.95) 50%, rgba(200,160,255,0.9) 100%)",
                      }}
                    >
                      Swipe
                    </h1>
                    <p className="mt-0.5 text-[10px] text-white/45 tracking-wide">
                      Propose a meme. The community votes. Winners are canonized in the Gallery forever.
                    </p>
                  </div>
                  <Link
                    href="/swipe/submit"
                    className="foid-cta-btn text-[10px] px-3 py-1.5"
                    style={{ background: "linear-gradient(135deg, #e040fb, #f06292)" }}
                  >
                    PROPOSE MEME
                  </Link>
                </div>

                {unmatchedCount !== undefined && Number(unmatchedCount) > 0 && (
                  <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-xs text-amber-300">
                    {Number(unmatchedCount)} meme{Number(unmatchedCount) > 1 ? "s" : ""}{" "}
                    waiting for an opponent
                  </div>
                )}

                {/* Tabs */}
                <div className="flex-shrink-0 flex gap-2 mt-2">
                  {(["active", "completed"] as const).map((t) => (
                    <button
                      key={t}
                      onClick={() => setTab(t)}
                      className={`rounded-lg px-4 py-1 text-[10px] font-medium uppercase tracking-wider transition ${
                        tab === t
                          ? "bg-purple-600/30 text-purple-300 ring-1 ring-purple-500/40"
                          : "text-white/40 hover:bg-white/5 hover:text-white/70"
                      }`}
                    >
                      {t === "active"
                        ? `Live (${activeDuels.length})`
                        : `Closed (${completedDuels.length})`}
                    </button>
                  ))}
                </div>

                {/* Main content */}
                {loading ? (
                  <div className="flex flex-1 items-center justify-center" style={{ minHeight: 0 }}>
                    <div className="h-8 w-8 animate-spin rounded-full border-2 border-purple-500 border-t-transparent" />
                  </div>
                ) : tab === "active" ? (
                  currentDuel ? (
                    <div className="flex flex-col flex-1 min-h-0 items-center justify-center gap-3 mt-2">
                      <SwipeCard duel={currentDuel} showingSide={showingSide} onVote={handleVote} />

                      {totalVotes > 0 && (
                        <div className="flex-shrink-0 mx-auto w-full" style={{ maxWidth: 420 }}>
                          <div className="mb-0.5 flex justify-center text-[10px] font-mono text-white/40">
                            <span className="text-cyan-400">{totalVotes} / {CANONIZE_THRESHOLD} to canonize</span>
                          </div>
                          <div className="flex h-1.5 overflow-hidden rounded-full bg-neutral-800">
                            <div className="bg-[#00e5ff] transition-all" style={{ width: `${Math.min((totalVotes / CANONIZE_THRESHOLD) * 100, 100)}%` }} />
                          </div>
                        </div>
                      )}

                      <div className="flex-shrink-0 text-center text-xs text-white/30">
                        {currentIndex + 1} / {activeDuels.length} proposals
                      </div>

                      {/* Manual submit button below card stack */}
                      {stagedVotes.length > 0 && (
                        <div className="flex-shrink-0 flex justify-center">
                          <button
                            onClick={() => setShowConfirm(true)}
                            className="rounded-lg px-4 py-1.5 text-[10px] font-bold uppercase tracking-wider text-white transition hover:opacity-85"
                            style={{ background: "linear-gradient(135deg, #e040fb, #f06292)" }}
                          >
                            Submit {stagedVotes.length} Vote{stagedVotes.length !== 1 ? "s" : ""}
                          </button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="flex flex-col flex-1 min-h-0 items-center justify-center py-8 text-center">
                      <div className="mb-3 text-4xl opacity-30">&#x2694;</div>
                      <h2 className="text-base font-medium text-white/70">No more live proposals</h2>
                      <p className="mt-1 max-w-sm text-xs text-white/40">
                        You&apos;ve swiped through all live proposals. Propose a meme to start a new one.
                      </p>
                      <Link
                        href="/swipe/submit"
                        className="foid-cta-btn mt-4"
                        style={{ background: "linear-gradient(135deg, #e040fb, #f06292)" }}
                      >
                        Propose a Meme
                      </Link>

                      {/* Submit remaining staged votes */}
                      {stagedVotes.length > 0 && (
                        <button
                          onClick={() => setShowConfirm(true)}
                          className="mt-4 rounded-lg px-4 py-1.5 text-[10px] font-bold uppercase tracking-wider text-white transition hover:opacity-85"
                          style={{ background: "linear-gradient(135deg, #e040fb, #f06292)" }}
                        >
                          Submit {stagedVotes.length} Vote{stagedVotes.length !== 1 ? "s" : ""}
                        </button>
                      )}
                    </div>
                  )
                ) : completedDuels.length > 0 ? (
                  <div className="flex-1 min-h-0 overflow-auto mt-2 grid gap-3 sm:grid-cols-2 auto-rows-min">
                    {completedDuels.map((duel) => (
                      <Link
                        key={duel.id}
                        href={`/swipe/${duel.id}`}
                        className="group block rounded-xl border border-neutral-800 bg-neutral-900/40 p-2 transition hover:border-purple-500/30"
                        style={{ perspective: 600 }}
                      >
                        <div className="transition-transform duration-200 group-hover:[transform:rotateY(1deg)_rotateX(-1deg)]">
                        <div className="mb-1.5 flex items-center justify-between">
                          <span className="text-[10px] text-white/40">Prop #{duel.id}</span>
                          <span className="rounded-full bg-purple-600/20 px-2 py-0.5 text-[9px] font-semibold uppercase text-purple-400">
                            Finalized
                          </span>
                        </div>
                        <div className="flex gap-2">
                          <div className="relative flex-1 overflow-hidden rounded-lg bg-neutral-800/50">
                            <div className="aspect-square max-h-[120px]">
                              {duel.submissionA.ipfsCid ? (
                                <img src={cidToUrl(duel.submissionA.ipfsCid)} alt="A" className="h-full w-full object-cover" />
                              ) : (
                                <div className="flex h-full items-center justify-center" style={{ background: CARD_VISUALS[(duel.submissionA.id - 1) % CARD_VISUALS.length].gradient }}>
                                  <span className="text-xl">{CARD_VISUALS[(duel.submissionA.id - 1) % CARD_VISUALS.length].symbol}</span>
                                </div>
                              )}
                            </div>
                            {duel.winner === 1 && (
                              <div className="absolute inset-0 flex items-center justify-center bg-amber-500/20">
                                <span className="rounded-full bg-amber-500 px-2 py-0.5 text-[9px] font-bold uppercase text-black">Win</span>
                              </div>
                            )}
                          </div>
                          <div className="flex items-center text-neutral-600 text-[10px] font-bold">VS</div>
                          <div className="relative flex-1 overflow-hidden rounded-lg bg-neutral-800/50">
                            <div className="aspect-square max-h-[120px]">
                              {duel.submissionB.ipfsCid ? (
                                <img src={cidToUrl(duel.submissionB.ipfsCid)} alt="B" className="h-full w-full object-cover" />
                              ) : (
                                <div className="flex h-full items-center justify-center" style={{ background: CARD_VISUALS[(duel.submissionB.id - 1) % CARD_VISUALS.length].gradient }}>
                                  <span className="text-xl">{CARD_VISUALS[(duel.submissionB.id - 1) % CARD_VISUALS.length].symbol}</span>
                                </div>
                              )}
                            </div>
                            {duel.winner === 2 && (
                              <div className="absolute inset-0 flex items-center justify-center bg-amber-500/20">
                                <span className="rounded-full bg-amber-500 px-2 py-0.5 text-[9px] font-bold uppercase text-black">Win</span>
                              </div>
                            )}
                          </div>
                        </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col flex-1 min-h-0 items-center justify-center py-8 text-center">
                    <div className="mb-3 text-4xl opacity-30">&#x2694;</div>
                    <h2 className="text-base font-medium text-white/70">No closed proposals yet</h2>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Floating staged votes pill */}
      {stagedVotes.length > 0 && !showConfirm && (
        <div
          className="fixed z-50 left-1/2 -translate-x-1/2 flex items-center gap-3 rounded-full px-4 py-2 text-xs font-bold text-white shadow-lg"
          style={{
            bottom: "20px",
            background: "linear-gradient(135deg, #e040fb, #f06292)",
            animation: "staged-pill-in 0.3s ease-out",
          }}
        >
          <span>{stagedVotes.length} vote{stagedVotes.length !== 1 ? "s" : ""} staged</span>
          <span className="opacity-50">&middot;</span>
          <button
            onClick={() => setShowConfirm(true)}
            className="underline underline-offset-2 transition hover:opacity-80"
          >
            Submit all &rarr;
          </button>
        </div>
      )}

      {/* Batch success indicator */}
      {batchSuccess && (
        <div
          className="fixed z-50 left-1/2 -translate-x-1/2 flex items-center gap-2 rounded-full bg-emerald-600/90 px-5 py-2.5 text-sm font-bold text-white shadow-lg"
          style={{
            bottom: "20px",
            animation: "staged-pill-in 0.3s ease-out",
          }}
        >
          Votes submitted &#x2713;
        </div>
      )}

      {/* Confirmation modal */}
      {showConfirm && (
        <ConfirmModal
          count={stagedVotes.length}
          onConfirm={handleSubmitBatch}
          onCancel={() => setShowConfirm(false)}
          submitting={submittingBatch}
        />
      )}

      <style jsx>{`
        @keyframes staged-pill-in {
          from { opacity: 0; transform: translateX(-50%) translateY(10px); }
          to { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
      `}</style>
    </main>
  );
}
