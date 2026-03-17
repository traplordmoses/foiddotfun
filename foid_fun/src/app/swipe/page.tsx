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
import { CHAIN_ID } from "@/config/canonical";
import { playSwipeYes, playSwipeNo } from "@/lib/sfx";

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
  } catch (err) { console.warn('[swipe] getVotedIds parse error:', err); return new Set(); }
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
  forCount: number;
  againstCount: number;
};

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
  chainId: CHAIN_ID,
  verifyingContract: CONTRACTS.SWIPE as `0x${string}`,
};

const EIP712_TYPES = {
  SwipeVote: [
    { name: "proposalId", type: "uint256" },
    { name: "approve", type: "bool" },
    { name: "deadline", type: "uint256" },
  ],
} as const;

/* ─── CSS keyframes injected once ─── */
const KEYFRAMES_ID = "swipe-polish-keyframes";
function injectKeyframes() {
  if (typeof document === "undefined") return;
  if (document.getElementById(KEYFRAMES_ID)) return;
  const style = document.createElement("style");
  style.id = KEYFRAMES_ID;
  style.textContent = `
    @keyframes swipe-particle {
      0% { transform: translate(0,0) scale(1); opacity: 1; }
      100% { transform: translate(var(--px), var(--py)) scale(0.3); opacity: 0; }
    }
    @keyframes stamp-slam {
      0% { transform: scale(1.5) rotate(var(--stamp-rot)); opacity: 0.5; filter: drop-shadow(0 0 30px var(--stamp-glow)); }
      50% { transform: scale(0.92) rotate(var(--stamp-rot)); opacity: 1; filter: drop-shadow(0 0 40px var(--stamp-glow)); }
      70% { transform: scale(1.06) rotate(var(--stamp-rot)); opacity: 1; filter: drop-shadow(0 0 20px var(--stamp-glow)); }
      100% { transform: scale(1) rotate(var(--stamp-rot)); opacity: 1; filter: drop-shadow(0 0 12px var(--stamp-glow)); }
    }
    @keyframes card-enter {
      0% { transform: scale(0.95); opacity: 0; }
      60% { transform: scale(1.015); opacity: 1; }
      100% { transform: scale(1); opacity: 1; }
    }
    @keyframes streak-pop {
      0% { transform: scale(0.5) translateY(8px); opacity: 0; }
      30% { transform: scale(1.25) translateY(-4px); opacity: 1; }
      60% { transform: scale(1.0) translateY(0); opacity: 1; }
      100% { transform: scale(0.9) translateY(-6px); opacity: 0; }
    }
  `;
  document.head.appendChild(style);
}

/* ─── Particle burst component ─── */
function SwipeParticles({ direction, trigger }: { direction: "left" | "right" | null; trigger: number }) {
  const [particles, setParticles] = useState<{ id: number; angle: number; dist: number; color: string; size: number }[]>([]);
  const lastTrigger = useRef(0);

  useEffect(() => {
    if (trigger <= 0 || trigger === lastTrigger.current || !direction) return;
    lastTrigger.current = trigger;

    const colors = direction === "right"
      ? ["#22c55e", "#06b6d4", "#34d399", "#10b981", "#6ee7b7", "#2dd4bf"]
      : ["#ef4444", "#f87171", "#dc2626", "#fb923c", "#f43f5e", "#e11d48"];

    const count = 12 + Math.floor(Math.random() * 4);
    const newParticles = Array.from({ length: count }, (_, i) => ({
      id: i,
      angle: (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.5,
      dist: 60 + Math.random() * 80,
      color: colors[Math.floor(Math.random() * colors.length)],
      size: 4 + Math.random() * 5,
    }));
    setParticles(newParticles);

    const timer = setTimeout(() => setParticles([]), 550);
    return () => clearTimeout(timer);
  }, [trigger, direction]);

  if (particles.length === 0) return null;

  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 50, overflow: "hidden" }}>
      <div style={{ position: "absolute", top: "50%", left: "50%", width: 0, height: 0 }}>
        {particles.map((p) => {
          const px = Math.cos(p.angle) * p.dist;
          const py = Math.sin(p.angle) * p.dist;
          return (
            <div
              key={p.id}
              style={{
                position: "absolute",
                width: p.size,
                height: p.size,
                borderRadius: "50%",
                backgroundColor: p.color,
                boxShadow: `0 0 6px ${p.color}`,
                ["--px" as string]: `${px}px`,
                ["--py" as string]: `${py}px`,
                animation: "swipe-particle 500ms cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards",
              }}
            />
          );
        })}
      </div>
    </div>
  );
}

/* ─── Streak badge component ─── */
function StreakBadge({ count, trigger }: { count: number; trigger: number }) {
  const [visible, setVisible] = useState(false);
  const lastTrigger = useRef(0);

  useEffect(() => {
    if (trigger <= 0 || trigger === lastTrigger.current || count < 2) return;
    lastTrigger.current = trigger;
    setVisible(true);
    const timer = setTimeout(() => setVisible(false), 850);
    return () => clearTimeout(timer);
  }, [trigger, count]);

  if (!visible || count < 2) return null;

  return (
    <div style={{
      position: "absolute",
      top: 8,
      left: "50%",
      transform: "translateX(-50%)",
      zIndex: 60,
      pointerEvents: "none",
    }}>
      <div style={{
        fontSize: count >= 5 ? 28 : 22,
        fontWeight: 900,
        color: "#fbbf24",
        textShadow: "0 0 16px rgba(251,191,36,0.7), 0 0 32px rgba(251,191,36,0.4), 0 2px 4px rgba(0,0,0,0.5)",
        animation: "streak-pop 800ms cubic-bezier(0.34, 1.56, 0.64, 1) forwards",
        letterSpacing: "0.05em",
      }}>
        x{count}
      </div>
    </div>
  );
}

/* ─── Vote count mini-bar ─── */
function VoteBar({ forCount, againstCount }: { forCount: number; againstCount: number }) {
  const total = forCount + againstCount;
  if (total === 0) return null;
  return (
    <div className="flex items-center gap-1.5 text-[9px]">
      <span className="text-green-400">{forCount}Y</span>
      <div className="flex h-1 flex-1 overflow-hidden rounded-full bg-neutral-800">
        <div className="bg-green-500" style={{ width: `${(forCount / total) * 100}%` }} />
        <div className="bg-red-500" style={{ width: `${(againstCount / total) * 100}%` }} />
      </div>
      <span className="text-red-400">{againstCount}N</span>
    </div>
  );
}

/* ─── Swipeable card ─── */
function SwipeCard({
  proposal,
  onVote,
  nextProposal,
  onSwipeComplete,
  cardKey,
}: {
  proposal: SwipeProposal;
  onVote: (proposalId: number, approve: boolean) => void;
  nextProposal?: SwipeProposal | null;
  onSwipeComplete?: (dir: "left" | "right") => void;
  cardKey: number;
}) {
  const visual = CARD_VISUALS[proposal.id % CARD_VISUALS.length];
  const nextVisual = nextProposal ? CARD_VISUALS[nextProposal.id % CARD_VISUALS.length] : null;

  const { direction, progress, handlers, style, phase } = useSwipeVote({
    threshold: 80,
    onSwipeRight: () => { onVote(proposal.id, true); onSwipeComplete?.("right"); },
    onSwipeLeft: () => { onVote(proposal.id, false); onSwipeComplete?.("left"); },
  });

  const yesOpacity = direction === "right" ? 0.15 + progress * 0.25 : 0;
  const noOpacity = direction === "left" ? 0.15 + progress * 0.25 : 0;

  // Enhanced stamp: use CSS slam animation when progress > threshold
  const showYesStamp = direction === "right" && progress > 0.3;
  const showNoStamp = direction === "left" && progress > 0.3;

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
              <img src={cidToHttpUrl(nextProposal.ipfsCid)} alt="Next" className="h-full w-full object-cover opacity-50" draggable={false} loading="lazy" />
            ) : nextVisual ? (
              <div className="flex h-full w-full items-center justify-center opacity-50" style={{ background: nextVisual.gradient }}>
                <span className="text-5xl">{nextVisual.symbol}</span>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* Active card with entrance animation */}
      <div
        key={cardKey}
        {...handlers}
        style={{
          ...style,
          touchAction: "pan-y",
          zIndex: 1,
          position: "relative",
          animation: phase !== "exiting" && phase !== "dragging" ? "card-enter 300ms cubic-bezier(0.34, 1.56, 0.64, 1) both" : undefined,
        }}
        className="relative rounded-2xl border border-neutral-700 bg-neutral-900/95 overflow-hidden select-none shadow-2xl"
      >
        {/* Color tint overlays */}
        <div className="absolute inset-0 z-10 pointer-events-none rounded-2xl" style={{ background: `linear-gradient(135deg, rgba(34,197,94,${yesOpacity}) 0%, transparent 60%)` }} />
        <div className="absolute inset-0 z-10 pointer-events-none rounded-2xl" style={{ background: `linear-gradient(225deg, rgba(239,68,68,${noOpacity}) 0%, transparent 60%)` }} />

        {/* YES stamp — enhanced slam */}
        <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none" style={{ opacity: direction === "right" ? 1 : 0, transition: "opacity 0.1s ease" }}>
          <span
            className="rounded-xl border-[3px] border-green-400 px-8 py-3 text-4xl font-black uppercase text-green-400"
            style={{
              ["--stamp-rot" as string]: "-12deg",
              ["--stamp-glow" as string]: "rgba(34,197,94,0.5)",
              animation: showYesStamp ? "stamp-slam 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) both" : "none",
              transform: showYesStamp ? undefined : `scale(${0.6 + progress * 0.5}) rotate(-12deg)`,
              textShadow: "0 0 30px rgba(34,197,94,0.4)",
            }}
          >YES</span>
        </div>
        {/* NO stamp — enhanced slam */}
        <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none" style={{ opacity: direction === "left" ? 1 : 0, transition: "opacity 0.1s ease" }}>
          <span
            className="rounded-xl border-[3px] border-red-400 px-8 py-3 text-4xl font-black uppercase text-red-400"
            style={{
              ["--stamp-rot" as string]: "12deg",
              ["--stamp-glow" as string]: "rgba(239,68,68,0.5)",
              animation: showNoStamp ? "stamp-slam 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) both" : "none",
              transform: showNoStamp ? undefined : `scale(${0.6 + progress * 0.5}) rotate(12deg)`,
              textShadow: "0 0 30px rgba(239,68,68,0.4)",
            }}
          >NO</span>
        </div>

        <div className="w-full aspect-square">
          {proposal.ipfsCid ? (
            <img src={cidToHttpUrl(proposal.ipfsCid)} alt={`Proposal #${proposal.id}`} className="h-full w-full object-cover" draggable={false} loading="lazy" onError={(e) => tryNextGateway(e.currentTarget, proposal.ipfsCid)} />
          ) : (
            <div className="flex h-full w-full items-center justify-center relative" style={{ background: visual.gradient }}>
              <span className="text-7xl drop-shadow-[0_0_24px_rgba(255,255,255,0.2)]">{visual.symbol}</span>
            </div>
          )}
        </div>

        <div className="border-t border-neutral-800 bg-neutral-900/90 px-3 py-2">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[10px] uppercase tracking-wider text-neutral-500">Prop #{proposal.id}</span>
              <div className="mt-0.5 font-mono text-xs text-neutral-300">{truncateAddress(proposal.proposer)}</div>
            </div>
            <span className="text-[10px] text-neutral-500 animate-pulse">Swipe to vote</span>
          </div>
          {(proposal.forCount > 0 || proposal.againstCount > 0) && (
            <div className="mt-1.5">
              <VoteBar forCount={proposal.forCount} againstCount={proposal.againstCount} />
            </div>
          )}
        </div>

        {/* Bottom glow */}
        <div className="absolute bottom-0 left-0 right-0 h-1 z-20" style={{ background: direction === "right" ? `linear-gradient(90deg, transparent, rgba(34,197,94,${progress}))` : direction === "left" ? `linear-gradient(270deg, transparent, rgba(239,68,68,${progress}))` : "transparent" }} />
      </div>

      {/* Button row */}
      <div className="mt-3 flex items-center justify-center gap-6">
        <button onClick={() => { onVote(proposal.id, false); onSwipeComplete?.("left"); }} className="flex items-center justify-center w-14 h-14 rounded-full border-2 border-red-500/30 bg-red-500/5 text-red-400 transition hover:bg-red-500/15 hover:border-red-500/50 active:scale-90">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-6 h-6"><path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" /></svg>
        </button>
        <button onClick={() => { onVote(proposal.id, true); onSwipeComplete?.("right"); }} className="flex items-center justify-center w-14 h-14 rounded-full border-2 border-green-500/30 bg-green-500/5 text-green-400 transition hover:bg-green-500/15 hover:border-green-500/50 active:scale-90">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-6 h-6"><path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" /></svg>
        </button>
      </div>
    </div>
  );
}

/* ─── Page ─── */
export default function SwipePage() {
  const { address, isConnected } = useAccount();
  const { disconnect, switchWallet } = useSwitchWallet();
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"active" | "completed">("active");
  const [proposals, setProposals] = useState<SwipeProposal[]>([]);
  const [votedIds, setVotedIds] = useState<Set<number>>(new Set());
  const votedIdsRef = useRef(votedIds);
  votedIdsRef.current = votedIds;

  // Streak + particle state
  const [sessionVoteCount, setSessionVoteCount] = useState(0);
  const [particleDir, setParticleDir] = useState<"left" | "right" | null>(null);
  const [particleTrigger, setParticleTrigger] = useState(0);
  const [streakTrigger, setStreakTrigger] = useState(0);
  const [cardKey, setCardKey] = useState(0);

  // Inject keyframes on mount
  useEffect(() => { injectKeyframes(); }, []);

  // Handle swipe complete: sound + particles + streak
  const handleSwipeComplete = useCallback((dir: "left" | "right") => {
    // Sound
    if (dir === "right") playSwipeYes();
    else playSwipeNo();

    // Particles
    setParticleDir(dir);
    setParticleTrigger((n) => n + 1);

    // Streak
    setSessionVoteCount((n) => n + 1);
    setStreakTrigger((n) => n + 1);

    // Bump card key for entrance animation
    setCardKey((n) => n + 1);
  }, []);

  // Load voted IDs from localStorage when wallet changes
  useEffect(() => {
    setVotedIds(getVotedIds(address));
  }, [address]);

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
      } catch (err) {
        console.warn('[swipe] loadProposals non-fatal error:', err);
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
        } catch (err) { console.warn('[swipe] checkVotes non-fatal error for proposal:', p.id, err); }
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
  const currentProposal = activeProposals[0] ?? null;

  // Sign EIP-712 and submit vote inline on each swipe
  const handleVote = useCallback(
    async (proposalId: number, approve: boolean) => {
      const proposal = proposals.find((p) => p.id === proposalId);
      if (!proposal) return;

      if (!isConnected || !address) {
        toast.error("Connect wallet to vote");
        return;
      }

      // Optimistically mark as voted — card disappears immediately
      setVotedIds((prev) => {
        const next = new Set(prev);
        next.add(proposalId);
        saveVotedIds(address, next);
        return next;
      });

      // Sign EIP-712 and submit in background
      try {
        const walletClient = await getWalletClient();
        const signature = await walletClient.signTypedData({
          account: walletClient.account ?? address,
          domain: EIP712_DOMAIN,
          types: EIP712_TYPES,
          primaryType: "SwipeVote",
          message: {
            proposalId: BigInt(proposalId),
            approve,
            deadline: BigInt(proposal.votingEndsAt),
          },
        });

        const res = await fetch("/api/swipe/vote", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            proposalId,
            approve,
            deadline: proposal.votingEndsAt,
            signature,
            voter: address,
          }),
        });

        if (res.ok) {
          toast.success(approve ? "Signed YES" : "Signed NO", { duration: 1500 });
        } else if (res.status !== 409) {
          throw new Error("Vote submission failed");
        }
      } catch (err) {
        // Undo optimistic vote on failure
        setVotedIds((prev) => {
          const next = new Set(prev);
          next.delete(proposalId);
          saveVotedIds(address, next);
          return next;
        });
        toast.error(err instanceof Error ? err.message : "Signing failed");
      }
    },
    [address, isConnected, proposals]
  );

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
                <div className="flex-shrink-0 flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <h1
                      className="text-base sm:text-lg font-black uppercase tracking-[0.15em] text-transparent bg-clip-text flex-shrink-0"
                      style={{ backgroundImage: "linear-gradient(135deg, rgba(168,130,255,1) 0%, rgba(255,255,255,0.95) 50%, rgba(200,160,255,0.9) 100%)" }}
                    >
                      Swipe
                    </h1>
                    {/* Inline tabs */}
                    <div className="flex gap-1">
                      {(["active", "completed"] as const).map((t) => (
                        <button
                          key={t}
                          onClick={() => setTab(t)}
                          className={`rounded-full px-2 sm:px-3 py-0.5 text-[9px] sm:text-[10px] font-semibold uppercase tracking-wider transition ${
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
                      <span className="hidden sm:inline text-[10px] text-white/25">{totalOnChain} on-chain</span>
                    )}
                  </div>
                  <Link
                    href="/swipe/submit"
                    className="foid-cta-btn text-[9px] sm:text-[10px] px-2 sm:px-3 py-1 sm:py-1.5 flex-shrink-0 rounded-md"
                    style={{ background: "linear-gradient(135deg, #e040fb, #f06292)" }}
                  >
                    + PROPOSE
                  </Link>
                </div>

                {/* Main content area */}
                {loading ? (
                  <div className="flex flex-1 items-center justify-center" style={{ minHeight: 0 }}>
                    <div className="h-8 w-8 animate-spin rounded-full border-2 border-purple-500 border-t-transparent" />
                  </div>
                ) : tab === "active" ? (
                  currentProposal ? (
                    <div className="flex flex-col flex-1 min-h-0 items-center justify-center gap-2 relative">
                      {/* Particle overlay */}
                      <SwipeParticles direction={particleDir} trigger={particleTrigger} />
                      {/* Streak badge */}
                      <StreakBadge count={sessionVoteCount} trigger={streakTrigger} />
                      <SwipeCard
                        proposal={currentProposal}
                        onVote={handleVote}
                        nextProposal={activeProposals[1] ?? null}
                        onSwipeComplete={handleSwipeComplete}
                        cardKey={cardKey}
                      />
                      <div className="flex-shrink-0 text-center text-[10px] text-white/25 mt-1">
                        {activeProposals.length} remaining
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col flex-1 min-h-0 items-center justify-center text-center">
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
                    </div>
                  )
                ) : closedProposals.length > 0 ? (
                  <div className="flex-1 min-h-0 overflow-auto mt-1 grid gap-3 sm:grid-cols-2 auto-rows-min">
                    {closedProposals.map((proposal) => {
                      const total = proposal.forCount + proposal.againstCount;
                      return (
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
                          {total > 0 && (
                            <div className="mt-1.5">
                              <VoteBar forCount={proposal.forCount} againstCount={proposal.againstCount} />
                            </div>
                          )}
                        </Link>
                      );
                    })}
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
    </main>
  );
}
