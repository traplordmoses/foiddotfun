"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAccount, useReadContract, useDisconnect } from "wagmi";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import Link from "next/link";
import { CONTRACTS } from "@/lib/contracts/addresses";
import { SWIPE_ABI } from "@/lib/contracts/abis/swipe";
import { getWalletClient } from "@/lib/viem";
import AppTitlebar from "@/app/(components)/AppTitlebar";
import { useSwipeVote } from "@/hooks/useSwipeVote";
import toast from "react-hot-toast";

const IPFS_GATEWAY = "https://ipfs.io/ipfs/";

function cidToUrl(cid: string): string {
  if (!cid) return "";
  if (cid.startsWith("http")) return cid;
  return `${IPFS_GATEWAY}${cid}`;
}

function truncateAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

type SwipeProposal = {
  id: number;
  proposer: string;
  ipfsCid: string;
  createdAt: number;
  votingEndsAt: number;
  finalized: boolean;
  canonized: boolean;
  trestEntryId: number;
};

type StagedVote = { proposalId: number; approve: boolean };

// ── Gradient + symbol combos for cards ──
const CARD_VISUALS = [
  { gradient: "linear-gradient(135deg, #1a0a2e 0%, #3d1a6e 50%, #0f0c29 100%)", symbol: "\u2694\uFE0F" },
  { gradient: "linear-gradient(135deg, #0a1a2e 0%, #1a3d6e 50%, #0c1929 100%)", symbol: "\u{1F6E1}\uFE0F" },
  { gradient: "linear-gradient(135deg, #2e0a1a 0%, #6e1a3d 50%, #290c0f 100%)", symbol: "\u2620\uFE0F" },
  { gradient: "linear-gradient(135deg, #0a2e1a 0%, #1a6e3d 50%, #0c290f 100%)", symbol: "\u{1F451}" },
  { gradient: "linear-gradient(135deg, #2e2e0a 0%, #6e6e1a 50%, #29290c 100%)", symbol: "\u{1F525}" },
  { gradient: "linear-gradient(135deg, #0a0a2e 0%, #1a1a6e 50%, #0c0c29 100%)", symbol: "\u{1F30C}" },
];

const EIP712_DOMAIN = {
  name: "FoidSwipe",
  version: "1",
  chainId: 20994,
  verifyingContract: CONTRACTS.SWIPE as `0x${string}`,
};

const EIP712_TYPES = {
  SwipeVote: [
    { name: "proposalId", type: "uint256" },
    { name: "approve", type: "bool" },
    { name: "deadline", type: "uint256" },
  ],
} as const;

/** Swipeable card showing a single proposal */
function SwipeCard({
  proposal,
  onVote,
}: {
  proposal: SwipeProposal;
  onVote: (approve: boolean) => void;
}) {
  const visual = CARD_VISUALS[(proposal.id - 1) % CARD_VISUALS.length];

  const { direction, handlers, style } = useSwipeVote({
    threshold: 100,
    onSwipeRight: () => onVote(true),
    onSwipeLeft: () => onVote(false),
  });

  return (
    <div className="relative mx-auto w-full max-w-[min(420px,45vh,100%)]" style={{ minHeight: 0 }}>
      {/* Active card */}
      <div
        {...handlers}
        style={{ ...style, touchAction: "pan-y" }}
        className="relative rounded-2xl border border-neutral-700 bg-neutral-900/80 overflow-hidden select-none"
      >
        {direction === "right" && (
          <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
            <span className="rounded-xl border-4 border-green-500 px-6 py-2 text-2xl font-black uppercase text-green-500 -rotate-12 opacity-80">
              Approve
            </span>
          </div>
        )}
        {direction === "left" && (
          <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
            <span className="rounded-xl border-4 border-red-500 px-6 py-2 text-2xl font-black uppercase text-red-500 rotate-12 opacity-80">
              Reject
            </span>
          </div>
        )}

        <div className="w-full aspect-square">
          {proposal.ipfsCid ? (
            <img
              src={cidToUrl(proposal.ipfsCid)}
              alt={`Proposal #${proposal.id}`}
              className="h-full w-full object-cover"
              draggable={false}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center relative" style={{ background: visual.gradient }}>
              <div className="absolute inset-0 opacity-[0.06]" style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")", backgroundSize: "150px" }} />
              <span className="text-7xl drop-shadow-[0_0_24px_rgba(255,255,255,0.2)]">{visual.symbol}</span>
            </div>
          )}
        </div>

        <div className="border-t border-neutral-800 bg-neutral-900/80 px-3 py-2 flex items-center justify-between">
          <div>
            <span className="text-[10px] uppercase tracking-wider text-neutral-500">
              Prop #{proposal.id}
            </span>
            <div className="mt-0.5 font-mono text-xs text-neutral-300">
              {truncateAddress(proposal.proposer)}
            </div>
          </div>
          <span className="text-[10px] text-neutral-500">Swipe to vote</span>
        </div>
      </div>

      <div className="mt-2 flex items-center justify-between px-4 text-[10px] font-semibold opacity-60">
        <span className="text-red-400">&larr; REJECT</span>
        <span className="text-green-400">APPROVE &rarr;</span>
      </div>
    </div>
  );
}

/** Confirmation modal for batched EIP-712 vote signing */
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
        <h3 className="text-base font-bold text-white/90 mb-2">Sign {count} vote{count !== 1 ? "s" : ""}?</h3>
        <p className="text-xs text-white/50 mb-6">This will sign each vote with EIP-712 and submit them to the vote collector.</p>
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
  const { openConnectModal } = useConnectModal();
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [tab, setTab] = useState<"active" | "completed">("active");
  const [proposals, setProposals] = useState<SwipeProposal[]>([]);
  const [stagedVotes, setStagedVotes] = useState<StagedVote[]>([]);
  const [showConfirm, setShowConfirm] = useState(false);
  const [submittingBatch, setSubmittingBatch] = useState(false);
  const [batchSuccess, setBatchSuccess] = useState(false);
  const [voteCounts, setVoteCounts] = useState<Record<number, { forCount: number; againstCount: number }>>({});

  const contractAddr = (CONTRACTS.SWIPE ?? "") as `0x${string}`;
  const hasContract = !!CONTRACTS.SWIPE;

  const { data: proposalCount } = useReadContract({
    address: contractAddr,
    abi: SWIPE_ABI,
    functionName: "proposalCount",
    query: { enabled: hasContract },
  });

  // Load proposals from API
  useEffect(() => {
    let alive = true;
    const loadProposals = async () => {
      try {
        const res = await fetch("/api/swipe/proposals");
        if (!res.ok) throw new Error("Failed to fetch proposals");
        const data = await res.json();
        if (!alive) return;
        setProposals(data.proposals ?? []);
        // Store vote counts
        const counts: Record<number, { forCount: number; againstCount: number }> = {};
        for (const p of data.proposals ?? []) {
          if (p.forCount !== undefined || p.againstCount !== undefined) {
            counts[p.id] = { forCount: p.forCount ?? 0, againstCount: p.againstCount ?? 0 };
          }
        }
        setVoteCounts(counts);
      } catch {
        if (!alive) return;
        setProposals([]);
      } finally {
        if (alive) setLoading(false);
      }
    };
    loadProposals();
    const interval = setInterval(loadProposals, 10_000);
    return () => { alive = false; clearInterval(interval); };
  }, []);

  const now = useMemo(() => Math.floor(Date.now() / 1000), []);
  const activeProposals = useMemo(
    () => proposals.filter((p) => !p.finalized && now < p.votingEndsAt),
    [proposals, now]
  );
  const closedProposals = useMemo(
    () => proposals.filter((p) => p.finalized || now >= p.votingEndsAt),
    [proposals, now]
  );
  const currentProposal = activeProposals[currentIndex] ?? null;

  const handleVote = useCallback(
    (approve: boolean) => {
      if (!currentProposal) return;
      setStagedVotes((prev) => [...prev, { proposalId: currentProposal.id, approve }]);
      setBatchSuccess(false);
      setCurrentIndex((i) => i + 1);
    },
    [currentProposal]
  );

  const handleSubmitBatch = useCallback(async () => {
    if (stagedVotes.length === 0) return;
    setSubmittingBatch(true);

    try {
      if (isConnected && address && hasContract) {
        const walletClient = await getWalletClient();
        for (const v of stagedVotes) {
          const proposal = proposals.find((p) => p.id === v.proposalId);
          if (!proposal) continue;

          const signature = await walletClient.signTypedData({
            account: address,
            domain: EIP712_DOMAIN,
            types: EIP712_TYPES,
            primaryType: "SwipeVote",
            message: {
              proposalId: BigInt(v.proposalId),
              approve: v.approve,
              deadline: BigInt(proposal.votingEndsAt),
            },
          });

          await fetch("/api/swipe/vote", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              proposalId: v.proposalId,
              approve: v.approve,
              deadline: proposal.votingEndsAt,
              signature,
              voter: address,
            }),
          });
        }
        toast.success(`${stagedVotes.length} votes signed and submitted!`);
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
  }, [stagedVotes, isConnected, address, hasContract, proposals]);

  const handleSwitchWallet = useCallback(() => {
    disconnect();
    setTimeout(() => openConnectModal?.(), 100);
  }, [disconnect, openConnectModal]);

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

                {proposalCount !== undefined && Number(proposalCount) > 0 && (
                  <div className="rounded-lg border border-purple-500/20 bg-purple-500/5 px-3 py-2 text-xs text-purple-300 mt-2">
                    {Number(proposalCount)} total proposal{Number(proposalCount) > 1 ? "s" : ""} on-chain
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
                        ? `Live (${activeProposals.length})`
                        : `Closed (${closedProposals.length})`}
                    </button>
                  ))}
                </div>

                {/* Main content */}
                {loading ? (
                  <div className="flex flex-1 items-center justify-center" style={{ minHeight: 0 }}>
                    <div className="h-8 w-8 animate-spin rounded-full border-2 border-purple-500 border-t-transparent" />
                  </div>
                ) : tab === "active" ? (
                  currentProposal ? (
                    <div className="flex flex-col flex-1 min-h-0 items-center justify-center gap-3 mt-2">
                      <SwipeCard proposal={currentProposal} onVote={handleVote} />

                      {voteCounts[currentProposal.id] && (
                        <div className="flex-shrink-0 mx-auto w-full" style={{ maxWidth: 420 }}>
                          <div className="mb-0.5 flex justify-between text-[10px] font-mono text-white/40">
                            <span className="text-green-400">{voteCounts[currentProposal.id].forCount} approve</span>
                            <span className="text-red-400">{voteCounts[currentProposal.id].againstCount} reject</span>
                          </div>
                          <div className="flex h-1.5 overflow-hidden rounded-full bg-neutral-800">
                            {(() => {
                              const total = voteCounts[currentProposal.id].forCount + voteCounts[currentProposal.id].againstCount;
                              if (total === 0) return null;
                              return (
                                <>
                                  <div className="bg-green-500 transition-all" style={{ width: `${(voteCounts[currentProposal.id].forCount / total) * 100}%` }} />
                                  <div className="bg-red-500 transition-all" style={{ width: `${(voteCounts[currentProposal.id].againstCount / total) * 100}%` }} />
                                </>
                              );
                            })()}
                          </div>
                        </div>
                      )}

                      <div className="flex-shrink-0 text-center text-xs text-white/30">
                        {currentIndex + 1} / {activeProposals.length} proposals
                      </div>

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
                ) : closedProposals.length > 0 ? (
                  <div className="flex-1 min-h-0 overflow-auto mt-2 grid gap-3 sm:grid-cols-2 auto-rows-min">
                    {closedProposals.map((proposal) => (
                      <Link
                        key={proposal.id}
                        href={`/swipe/${proposal.id}`}
                        className="group block rounded-xl border border-neutral-800 bg-neutral-900/40 p-2 transition hover:border-purple-500/30"
                        style={{ perspective: 600 }}
                      >
                        <div className="transition-transform duration-200 group-hover:[transform:rotateY(1deg)_rotateX(-1deg)]">
                        <div className="mb-1.5 flex items-center justify-between">
                          <span className="text-[10px] text-white/40">Prop #{proposal.id}</span>
                          <span className={`rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase ${
                            proposal.canonized
                              ? "bg-green-600/20 text-green-400"
                              : "bg-red-600/20 text-red-400"
                          }`}>
                            {proposal.canonized ? "Canonized" : "Rejected"}
                          </span>
                        </div>
                        <div className="overflow-hidden rounded-lg bg-neutral-800/50">
                          <div className="aspect-square max-h-[160px]">
                            {proposal.ipfsCid ? (
                              <img src={cidToUrl(proposal.ipfsCid)} alt={`Proposal #${proposal.id}`} className="h-full w-full object-cover" />
                            ) : (
                              <div className="flex h-full items-center justify-center" style={{ background: CARD_VISUALS[(proposal.id - 1) % CARD_VISUALS.length].gradient }}>
                                <span className="text-xl">{CARD_VISUALS[(proposal.id - 1) % CARD_VISUALS.length].symbol}</span>
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="mt-1.5 flex items-center justify-between text-[10px] text-neutral-400">
                          <span className="font-mono">{truncateAddress(proposal.proposer)}</span>
                          {proposal.canonized && (
                            <span className="text-green-400">Gallery &rarr;</span>
                          )}
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
            bottom: "calc(env(safe-area-inset-bottom, 0px) + 84px)",
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
