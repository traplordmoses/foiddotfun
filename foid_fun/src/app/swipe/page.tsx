"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAccount, useReadContract } from "wagmi";
import { useSwitchWallet } from "@/hooks/useSwitchWallet";
import Link from "next/link";
import { CONTRACTS } from "@/lib/contracts/addresses";
import { SWIPE_ABI } from "@/lib/contracts/abis/swipe";
import { getWalletClient } from "@/lib/viem";
import AppTitlebar from "@/app/(components)/AppTitlebar";
import { useSwipeVote } from "@/hooks/useSwipeVote";
import toast from "react-hot-toast";
import { cidToHttpUrl, ipfsToHttp } from "@/lib/ipfsUrl";

function tryNextGateway(el: HTMLImageElement, cid?: string) {
  if (!cid) return;
  const urls = ipfsToHttp(cid);
  const idx = Number(el.dataset.gatewayIndex ?? "-1") + 1;
  if (idx < urls.length) { el.src = urls[idx]; el.dataset.gatewayIndex = String(idx); }
}

function truncateAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

/** Read voted proposal IDs from localStorage for a given wallet */
function getVotedIds(wallet?: string): Set<number> {
  if (!wallet) return new Set();
  try {
    const raw = localStorage.getItem(`foid-swipe-voted-${wallet.toLowerCase()}`);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as number[]);
  } catch { return new Set(); }
}

/** Save voted proposal IDs to localStorage */
function saveVotedIds(wallet: string, ids: Set<number>) {
  localStorage.setItem(
    `foid-swipe-voted-${wallet.toLowerCase()}`,
    JSON.stringify([...ids])
  );
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

/* ─── Swipeable card ─── */
function SwipeCard({
  proposal,
  onVote,
  nextProposal,
}: {
  proposal: SwipeProposal;
  onVote: (approve: boolean) => void;
  nextProposal?: SwipeProposal | null;
}) {
  const visual = CARD_VISUALS[proposal.id % CARD_VISUALS.length];
  const nextVisual = nextProposal ? CARD_VISUALS[nextProposal.id % CARD_VISUALS.length] : null;

  const { direction, progress, handlers, style, phase } = useSwipeVote({
    threshold: 80,
    onSwipeRight: () => onVote(true),
    onSwipeLeft: () => onVote(false),
  });

  const yesOpacity = direction === "right" ? 0.15 + progress * 0.25 : 0;
  const noOpacity = direction === "left" ? 0.15 + progress * 0.25 : 0;
  const stampScale = progress > 0.3 ? 0.6 + progress * 0.5 : 0;

  return (
    <div className="relative mx-auto w-full max-w-md">
      {/* Next card peek */}
      {nextProposal && (
        <div
          className="absolute inset-0 rounded-2xl border border-neutral-800 bg-neutral-900/60 overflow-hidden"
          style={{
            transform: `scale(${0.92 + progress * 0.04}) translateY(${12 - progress * 8}px)`,
            transition: phase === "exiting" ? "transform 0.28s ease" : "none",
            zIndex: 0,
          }}
        >
          <div className="w-full aspect-square">
            {nextProposal.ipfsCid ? (
              <img src={cidToHttpUrl(nextProposal.ipfsCid)} alt="Next" className="h-full w-full object-cover opacity-50" draggable={false} />
            ) : nextVisual ? (
              <div className="flex h-full w-full items-center justify-center opacity-50" style={{ background: nextVisual.gradient }}>
                <span className="text-5xl">{nextVisual.symbol}</span>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* Active card */}
      <div
        {...handlers}
        style={{ ...style, touchAction: "pan-y", zIndex: 1, position: "relative" }}
        className="relative rounded-2xl border border-neutral-700 bg-neutral-900/95 overflow-hidden select-none shadow-2xl"
      >
        {/* Color tint overlays */}
        <div className="absolute inset-0 z-10 pointer-events-none rounded-2xl" style={{ background: `linear-gradient(135deg, rgba(34,197,94,${yesOpacity}) 0%, transparent 60%)` }} />
        <div className="absolute inset-0 z-10 pointer-events-none rounded-2xl" style={{ background: `linear-gradient(225deg, rgba(239,68,68,${noOpacity}) 0%, transparent 60%)` }} />

        {/* YES stamp */}
        <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none" style={{ opacity: direction === "right" ? 1 : 0, transition: "opacity 0.15s ease" }}>
          <span className="rounded-xl border-[3px] border-green-400 px-8 py-3 text-4xl font-black uppercase text-green-400 -rotate-12 drop-shadow-[0_0_20px_rgba(34,197,94,0.5)]" style={{ transform: `scale(${stampScale}) rotate(-12deg)`, transition: "transform 0.15s cubic-bezier(0.34, 1.56, 0.64, 1)", textShadow: "0 0 30px rgba(34,197,94,0.4)" }}>YES</span>
        </div>
        {/* NO stamp */}
        <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none" style={{ opacity: direction === "left" ? 1 : 0, transition: "opacity 0.15s ease" }}>
          <span className="rounded-xl border-[3px] border-red-400 px-8 py-3 text-4xl font-black uppercase text-red-400 rotate-12 drop-shadow-[0_0_20px_rgba(239,68,68,0.5)]" style={{ transform: `scale(${stampScale}) rotate(12deg)`, transition: "transform 0.15s cubic-bezier(0.34, 1.56, 0.64, 1)", textShadow: "0 0 30px rgba(239,68,68,0.4)" }}>NO</span>
        </div>

        <div className="w-full aspect-square">
          {proposal.ipfsCid ? (
            <img src={cidToHttpUrl(proposal.ipfsCid)} alt={`Proposal #${proposal.id}`} className="h-full w-full object-cover" draggable={false} onError={(e) => tryNextGateway(e.currentTarget, proposal.ipfsCid)} />
          ) : (
            <div className="flex h-full w-full items-center justify-center relative" style={{ background: visual.gradient }}>
              <span className="text-7xl drop-shadow-[0_0_24px_rgba(255,255,255,0.2)]">{visual.symbol}</span>
            </div>
          )}
        </div>

        <div className="border-t border-neutral-800 bg-neutral-900/90 px-3 py-2 flex items-center justify-between">
          <div>
            <span className="text-[10px] uppercase tracking-wider text-neutral-500">Prop #{proposal.id}</span>
            <div className="mt-0.5 font-mono text-xs text-neutral-300">{truncateAddress(proposal.proposer)}</div>
          </div>
          <span className="text-[10px] text-neutral-500 animate-pulse">Swipe to vote</span>
        </div>

        {/* Bottom glow */}
        <div className="absolute bottom-0 left-0 right-0 h-1 z-20" style={{ background: direction === "right" ? `linear-gradient(90deg, transparent, rgba(34,197,94,${progress}))` : direction === "left" ? `linear-gradient(270deg, transparent, rgba(239,68,68,${progress}))` : "transparent" }} />
      </div>

      {/* Button row */}
      <div className="mt-3 flex items-center justify-center gap-6">
        <button onClick={() => onVote(false)} className="flex items-center justify-center w-14 h-14 rounded-full border-2 border-red-500/30 bg-red-500/5 text-red-400 transition hover:bg-red-500/15 hover:border-red-500/50 active:scale-90">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-6 h-6"><path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" /></svg>
        </button>
        <button onClick={() => onVote(true)} className="flex items-center justify-center w-14 h-14 rounded-full border-2 border-green-500/30 bg-green-500/5 text-green-400 transition hover:bg-green-500/15 hover:border-green-500/50 active:scale-90">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-6 h-6"><path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" /></svg>
        </button>
      </div>
    </div>
  );
}

/* ─── Confirm modal ─── */
function ConfirmModal({ count, onConfirm, onCancel, submitting }: { count: number; onConfirm: () => void; onCancel: () => void; submitting: boolean }) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="mx-4 w-full max-w-sm rounded-2xl border border-white/10 bg-neutral-900/95 p-6 shadow-2xl">
        <h3 className="text-base font-bold text-white/90 mb-2">Sign {count} vote{count !== 1 ? "s" : ""}?</h3>
        <p className="text-xs text-white/50 mb-6">Each vote will be signed with your wallet and submitted on-chain.</p>
        <div className="flex gap-3">
          <button onClick={onCancel} disabled={submitting} className="flex-1 rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium text-white/70 transition hover:bg-white/10 disabled:opacity-50">Cancel</button>
          <button onClick={onConfirm} disabled={submitting} className="flex-1 rounded-lg px-4 py-2.5 text-sm font-bold text-white transition hover:opacity-85 disabled:opacity-50" style={{ background: "linear-gradient(135deg, #e040fb, #f06292)" }}>{submitting ? "Signing..." : "Confirm & Sign"}</button>
        </div>
      </div>
    </div>
  );
}

/* ─── Page ─── */
export default function SwipePage() {
  const { address, isConnected } = useAccount();
  const { disconnect, switchWallet } = useSwitchWallet();
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [tab, setTab] = useState<"active" | "completed">("active");
  const [proposals, setProposals] = useState<SwipeProposal[]>([]);
  const [stagedVotes, setStagedVotes] = useState<StagedVote[]>([]);
  const [showConfirm, setShowConfirm] = useState(false);
  const [submittingBatch, setSubmittingBatch] = useState(false);
  const [batchSuccess, setBatchSuccess] = useState(false);
  const [votedIds, setVotedIds] = useState<Set<number>>(new Set());
  const votedIdsRef = useRef(votedIds);
  votedIdsRef.current = votedIds;

  // Load voted IDs from localStorage when wallet changes
  useEffect(() => {
    setVotedIds(getVotedIds(address));
    setCurrentIndex(0);
  }, [address]);

  // Auto-clear batch success
  useEffect(() => {
    if (!batchSuccess) return;
    const t = setTimeout(() => setBatchSuccess(false), 3000);
    return () => clearTimeout(t);
  }, [batchSuccess]);

  const contractAddr = (CONTRACTS.SWIPE ?? "") as `0x${string}`;
  const hasContract = !!CONTRACTS.SWIPE;

  const { data: proposalCount } = useReadContract({
    address: contractAddr,
    abi: SWIPE_ABI,
    functionName: "proposalCount",
    query: { enabled: hasContract },
  });

  // Load proposals
  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const res = await fetch("/api/swipe/proposals");
        if (!res.ok) throw new Error("fetch failed");
        const data = await res.json();
        if (!alive) return;
        setProposals(data.proposals ?? []);
      } catch {
        if (!alive) return;
        setProposals([]);
      } finally {
        if (alive) setLoading(false);
      }
    };
    load();
    const interval = setInterval(load, 15_000);
    const onVis = () => { if (document.visibilityState === "visible") load(); };
    document.addEventListener("visibilitychange", onVis);
    return () => { alive = false; clearInterval(interval); document.removeEventListener("visibilitychange", onVis); };
  }, []);

  // Also check server for user's existing votes
  useEffect(() => {
    if (!address || proposals.length === 0) return;
    let alive = true;
    const checkVotes = async () => {
      const local = getVotedIds(address);
      for (const p of proposals) {
        if (local.has(p.id)) continue;
        try {
          const res = await fetch(`/api/swipe/vote?proposalId=${p.id}`);
          if (!res.ok) continue;
          const data = await res.json();
          const userVoted = (data.votes ?? []).some(
            (v: { voter: string }) => v.voter.toLowerCase() === address.toLowerCase()
          );
          if (userVoted) local.add(p.id);
        } catch { /* ignore */ }
      }
      if (!alive) return;
      if (local.size > votedIdsRef.current.size) {
        saveVotedIds(address, local);
        setVotedIds(new Set(local));
      }
    };
    checkVotes();
    return () => { alive = false; };
  }, [address, proposals]);

  const now = Math.floor(Date.now() / 1000);
  const activeProposals = proposals.filter(
    (p) => !p.finalized && now < p.votingEndsAt && !votedIds.has(p.id)
  );
  const closedProposals = proposals.filter((p) => p.finalized || now >= p.votingEndsAt);
  const currentProposal = activeProposals[currentIndex] ?? null;

  const handleVote = useCallback(
    (approve: boolean) => {
      if (!currentProposal) return;
      setStagedVotes((prev) => [...prev, { proposalId: currentProposal.id, approve }]);
      setBatchSuccess(false);
      // Mark as voted locally immediately
      if (address) {
        setVotedIds((prev) => {
          const next = new Set(prev);
          next.add(currentProposal.id);
          saveVotedIds(address, next);
          return next;
        });
      }
      setCurrentIndex((i) => i + 1);
    },
    [currentProposal, address]
  );

  const handleSubmitBatch = useCallback(async () => {
    if (stagedVotes.length === 0) return;
    setSubmittingBatch(true);

    try {
      if (isConnected && address && hasContract) {
        const walletClient = await getWalletClient();
        let submitted = 0;
        for (const v of stagedVotes) {
          const proposal = proposals.find((p) => p.id === v.proposalId);
          if (!proposal) continue;

          const signature = await walletClient.signTypedData({
            account: walletClient.account ?? address,
            domain: EIP712_DOMAIN,
            types: EIP712_TYPES,
            primaryType: "SwipeVote",
            message: {
              proposalId: BigInt(v.proposalId),
              approve: v.approve,
              deadline: BigInt(proposal.votingEndsAt),
            },
          });

          const res = await fetch("/api/swipe/vote", {
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

          if (res.ok || res.status === 409) submitted++;
        }
        toast.success(`${submitted} vote${submitted !== 1 ? "s" : ""} signed & submitted!`);
      } else {
        toast.success(`${stagedVotes.length} votes submitted (demo)`);
      }
      setStagedVotes([]);
      setBatchSuccess(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Vote failed");
    } finally {
      setSubmittingBatch(false);
      setShowConfirm(false);
    }
  }, [stagedVotes, isConnected, address, hasContract, proposals]);

  const handleSwitchWallet = switchWallet;
  const totalOnChain = proposalCount !== undefined ? Number(proposalCount) : 0;

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
                {/* Compact header */}
                <div className="flex-shrink-0 flex items-center justify-between gap-3 mb-2">
                  <div className="flex items-center gap-3">
                    <h1
                      className="text-lg font-black uppercase tracking-[0.15em] text-transparent bg-clip-text"
                      style={{ backgroundImage: "linear-gradient(135deg, rgba(168,130,255,1) 0%, rgba(255,255,255,0.95) 50%, rgba(200,160,255,0.9) 100%)" }}
                    >
                      Swipe
                    </h1>
                    {/* Inline tabs */}
                    <div className="flex gap-1">
                      {(["active", "completed"] as const).map((t) => (
                        <button
                          key={t}
                          onClick={() => { setTab(t); setCurrentIndex(0); }}
                          className={`rounded-full px-3 py-0.5 text-[10px] font-semibold uppercase tracking-wider transition ${
                            tab === t
                              ? "bg-purple-600/30 text-purple-300 ring-1 ring-purple-500/40"
                              : "text-white/35 hover:text-white/60"
                          }`}
                        >
                          {t === "active" ? `Live (${activeProposals.length})` : `Closed (${closedProposals.length})`}
                        </button>
                      ))}
                    </div>
                    {totalOnChain > 0 && (
                      <span className="text-[10px] text-white/25">{totalOnChain} on-chain</span>
                    )}
                  </div>
                  <Link
                    href="/swipe/submit"
                    className="foid-cta-btn text-[10px] px-3 py-1.5 flex-shrink-0"
                    style={{ background: "linear-gradient(135deg, #e040fb, #f06292)" }}
                  >
                    PROPOSE MEME
                  </Link>
                </div>

                {/* Main content area */}
                {loading ? (
                  <div className="flex flex-1 items-center justify-center" style={{ minHeight: 0 }}>
                    <div className="h-8 w-8 animate-spin rounded-full border-2 border-purple-500 border-t-transparent" />
                  </div>
                ) : tab === "active" ? (
                  currentProposal ? (
                    <div className="flex flex-col flex-1 min-h-0 items-center justify-center gap-2">
                      <SwipeCard
                        proposal={currentProposal}
                        onVote={handleVote}
                        nextProposal={activeProposals[currentIndex + 1] ?? null}
                      />

                      <div className="flex-shrink-0 text-center text-[10px] text-white/25 mt-1">
                        {currentIndex + 1} / {activeProposals.length}
                      </div>

                      {stagedVotes.length > 0 && (
                        <button
                          onClick={() => setShowConfirm(true)}
                          className="flex-shrink-0 rounded-full px-5 py-2 text-xs font-bold text-white transition hover:opacity-85 active:scale-95"
                          style={{ background: "linear-gradient(135deg, #e040fb, #f06292)" }}
                        >
                          Submit {stagedVotes.length} Vote{stagedVotes.length !== 1 ? "s" : ""}
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="flex flex-col flex-1 min-h-0 items-center justify-center text-center">
                      {stagedVotes.length > 0 ? (
                        <>
                          <div className="mb-3 text-4xl opacity-40">&#x2713;</div>
                          <h2 className="text-base font-medium text-white/70">All caught up!</h2>
                          <p className="mt-1 max-w-sm text-xs text-white/40">
                            You&apos;ve voted on all live proposals.
                          </p>
                          <button
                            onClick={() => setShowConfirm(true)}
                            className="mt-4 rounded-full px-6 py-2.5 text-sm font-bold text-white transition hover:opacity-85 active:scale-95"
                            style={{ background: "linear-gradient(135deg, #e040fb, #f06292)" }}
                          >
                            Submit {stagedVotes.length} Vote{stagedVotes.length !== 1 ? "s" : ""}
                          </button>
                        </>
                      ) : (
                        <>
                          <div className="mb-3 text-4xl opacity-30">&#x2694;</div>
                          <h2 className="text-base font-medium text-white/70">
                            {proposals.some((p) => !p.finalized && now < p.votingEndsAt)
                              ? "You've voted on everything!"
                              : "No live proposals"}
                          </h2>
                          <p className="mt-1 max-w-sm text-xs text-white/40">
                            Propose a meme to get the community voting.
                          </p>
                          <Link
                            href="/swipe/submit"
                            className="foid-cta-btn mt-4"
                            style={{ background: "linear-gradient(135deg, #e040fb, #f06292)" }}
                          >
                            Propose a Meme
                          </Link>
                        </>
                      )}
                    </div>
                  )
                ) : closedProposals.length > 0 ? (
                  <div className="flex-1 min-h-0 overflow-auto mt-1 grid gap-3 sm:grid-cols-2 auto-rows-min">
                    {closedProposals.map((proposal) => (
                      <Link
                        key={proposal.id}
                        href={`/swipe/${proposal.id}`}
                        className="group block rounded-xl border border-neutral-800 bg-neutral-900/40 p-2 transition hover:border-purple-500/30"
                      >
                        <div className="mb-1.5 flex items-center justify-between">
                          <span className="text-[10px] text-white/40">Prop #{proposal.id}</span>
                          <span className={`rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase ${
                            proposal.canonized ? "bg-green-600/20 text-green-400" : "bg-red-600/20 text-red-400"
                          }`}>
                            {proposal.canonized ? "Canonized" : "Rejected"}
                          </span>
                        </div>
                        <div className="overflow-hidden rounded-lg bg-neutral-800/50">
                          <div className="aspect-square max-h-[160px]">
                            {proposal.ipfsCid ? (
                              <img src={cidToHttpUrl(proposal.ipfsCid)} alt={`Proposal #${proposal.id}`} className="h-full w-full object-cover" loading="lazy" onError={(e) => tryNextGateway(e.currentTarget, proposal.ipfsCid)} />
                            ) : (
                              <div className="flex h-full items-center justify-center" style={{ background: CARD_VISUALS[proposal.id % CARD_VISUALS.length].gradient }}>
                                <span className="text-xl">{CARD_VISUALS[proposal.id % CARD_VISUALS.length].symbol}</span>
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="mt-1.5 flex items-center justify-between text-[10px] text-neutral-400">
                          <span className="font-mono">{truncateAddress(proposal.proposer)}</span>
                          {proposal.canonized && <span className="text-green-400">Gallery &rarr;</span>}
                        </div>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col flex-1 min-h-0 items-center justify-center text-center">
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
          className="fixed z-50 left-1/2 -translate-x-1/2 flex items-center gap-3 rounded-full px-5 py-2.5 text-xs font-bold text-white shadow-lg"
          style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 84px)", background: "linear-gradient(135deg, #e040fb, #f06292)", animation: "pill-in 0.3s ease-out" }}
        >
          <span>{stagedVotes.length} vote{stagedVotes.length !== 1 ? "s" : ""} staged</span>
          <button onClick={() => setShowConfirm(true)} className="underline underline-offset-2 transition hover:opacity-80">Submit &rarr;</button>
        </div>
      )}

      {batchSuccess && (
        <div className="fixed z-50 left-1/2 -translate-x-1/2 flex items-center gap-2 rounded-full bg-emerald-600/90 px-5 py-2.5 text-sm font-bold text-white shadow-lg" style={{ bottom: "20px", animation: "pill-in 0.3s ease-out" }}>
          Votes submitted &#x2713;
        </div>
      )}

      {showConfirm && (
        <ConfirmModal count={stagedVotes.length} onConfirm={handleSubmitBatch} onCancel={() => setShowConfirm(false)} submitting={submittingBatch} />
      )}

      <style jsx>{`
        @keyframes pill-in {
          from { opacity: 0; transform: translateX(-50%) translateY(10px); }
          to { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
      `}</style>
    </main>
  );
}
