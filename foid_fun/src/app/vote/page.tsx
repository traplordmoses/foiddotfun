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
      0% { transform: translate(0,0) scale(1); opacity: 1; visibility: visible; }
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
    @keyframes swipe-shake {
      0% { transform: translateX(0); }
      15% { transform: translateX(-3px); }
      30% { transform: translateX(4px); }
      45% { transform: translateX(-4px); }
      60% { transform: translateX(3px); }
      75% { transform: translateX(-2px); }
      100% { transform: translateX(0); }
    }
    @keyframes glow-flash {
      0% { opacity: 0.85; }
      100% { opacity: 0; }
    }
    @keyframes vote-result-text {
      0% { transform: scale(0.8); opacity: 1; }
      40% { transform: scale(1.0); opacity: 1; }
      100% { transform: scale(1.0); opacity: 0; }
    }
  `;
  document.head.appendChild(style);
}

/* ─── Particle burst component ─── */
function SwipeParticles({ direction, trigger }: { direction: "left" | "right" | null; trigger: number }) {
  const [particles, setParticles] = useState<{ id: number; angle: number; dist: number; color: string; size: number; square: boolean; delay: number }[]>([]);
  const lastTrigger = useRef(0);

  useEffect(() => {
    if (trigger <= 0 || trigger === lastTrigger.current || !direction) return;
    lastTrigger.current = trigger;

    const colors = direction === "right"
      ? ["#22c55e", "#06b6d4", "#34d399", "#10b981", "#6ee7b7", "#2dd4bf"]
      : ["#ef4444", "#f87171", "#dc2626", "#fb923c", "#f43f5e", "#e11d48"];

    const count = 20 + Math.floor(Math.random() * 6);
    const newParticles = Array.from({ length: count }, (_, i) => ({
      id: i,
      angle: (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.5,
      dist: 80 + Math.random() * 140,
      color: colors[Math.floor(Math.random() * colors.length)],
      size: 4 + Math.random() * 4,
      square: Math.random() > 0.65,
      delay: Math.random() < 0.4 ? Math.random() * 80 : 0,
    }));
    setParticles(newParticles);

    const timer = setTimeout(() => setParticles([]), 700);
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
                borderRadius: p.square ? "2px" : "50%",
                backgroundColor: p.color,
                boxShadow: `0 0 8px ${p.color}`,
                ["--px" as string]: `${px}px`,
                ["--py" as string]: `${py}px`,
                animation: "swipe-particle 550ms cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards",
                animationDelay: `${p.delay}ms`,
                opacity: 0,
                animationFillMode: "forwards",
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

/* ─── Glow flash behind card ─── */
function GlowFlash({ direction, trigger }: { direction: "left" | "right" | null; trigger: number }) {
  const [active, setActive] = useState(false);
  const [dir, setDir] = useState<"left" | "right" | null>(null);
  const lastTrigger = useRef(0);

  useEffect(() => {
    if (trigger <= 0 || trigger === lastTrigger.current || !direction) return;
    lastTrigger.current = trigger;
    setDir(direction);
    setActive(true);
    const timer = setTimeout(() => setActive(false), 300);
    return () => clearTimeout(timer);
  }, [trigger, direction]);

  if (!active || !dir) return null;

  const bg = dir === "right"
    ? "radial-gradient(circle, rgba(34,197,94,0.55) 0%, rgba(6,182,212,0.3) 40%, transparent 70%)"
    : "radial-gradient(circle, rgba(239,68,68,0.55) 0%, rgba(248,113,113,0.3) 40%, transparent 70%)";

  return (
    <div style={{
      position: "absolute",
      inset: "-20%",
      zIndex: 0,
      pointerEvents: "none",
      background: bg,
      animation: "glow-flash 300ms ease-out forwards",
    }} />
  );
}

/* ─── Vote result text flash ─── */
function VoteResultText({ direction, trigger }: { direction: "left" | "right" | null; trigger: number }) {
  const [active, setActive] = useState(false);
  const [dir, setDir] = useState<"left" | "right" | null>(null);
  const lastTrigger = useRef(0);

  useEffect(() => {
    if (trigger <= 0 || trigger === lastTrigger.current || !direction) return;
    lastTrigger.current = trigger;
    setDir(direction);
    setActive(true);
    const timer = setTimeout(() => setActive(false), 600);
    return () => clearTimeout(timer);
  }, [trigger, direction]);

  if (!active || !dir) return null;

  const text = dir === "right" ? "APPROVED" : "REJECTED";
  const color = dir === "right" ? "#22c55e" : "#ef4444";
  const shadow = dir === "right"
    ? "0 0 40px rgba(34,197,94,0.6), 0 0 80px rgba(34,197,94,0.3)"
    : "0 0 40px rgba(239,68,68,0.6), 0 0 80px rgba(239,68,68,0.3)";

  return (
    <div style={{
      position: "absolute",
      inset: 0,
      zIndex: 55,
      pointerEvents: "none",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
    }}>
      <span style={{
        fontSize: "clamp(32px, 8vw, 56px)",
        fontWeight: 900,
        color,
        textShadow: shadow,
        letterSpacing: "0.12em",
        textTransform: "uppercase",
        animation: "vote-result-text 600ms ease-out forwards",
      }}>
        {text}
      </span>
    </div>
  );
}

/* ─── Countdown timer ─── */
function useCountdown(votingEndsAt: number) {
  const [remaining, setRemaining] = useState("");
  useEffect(() => {
    const tick = () => {
      const diff = votingEndsAt - Math.floor(Date.now() / 1000);
      if (diff <= 0) { setRemaining("ended"); return; }
      const h = Math.floor(diff / 3600);
      const m = Math.floor((diff % 3600) / 60);
      setRemaining(h > 0 ? `${h}h ${m}m left` : `${m}m left`);
    };
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, [votingEndsAt]);
  return remaining;
}

/* ─── Vote count mini-bar with approval % ─── */
function VoteBar({ forCount, againstCount, showThreshold }: { forCount: number; againstCount: number; showThreshold?: boolean }) {
  const total = forCount + againstCount;
  if (total === 0 && !showThreshold) return null;
  const pct = total > 0 ? Math.round((forCount / total) * 100) : 0;
  const passing = pct >= 51;
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1.5 text-[9px]">
        <span className="text-green-400">{forCount}Y</span>
        <div className="relative flex h-1.5 flex-1 overflow-hidden rounded-full bg-neutral-800">
          {total > 0 && (
            <>
              <div className="bg-green-500 transition-all duration-300" style={{ width: `${(forCount / total) * 100}%` }} />
              <div className="bg-red-500 transition-all duration-300" style={{ width: `${(againstCount / total) * 100}%` }} />
            </>
          )}
          {/* 51% threshold marker */}
          <div className="absolute top-0 bottom-0 w-px bg-white/40" style={{ left: "51%" }} />
        </div>
        <span className="text-red-400">{againstCount}N</span>
      </div>
      {showThreshold && total > 0 && (
        <div className="flex items-center justify-between text-[9px]">
          <span className={passing ? "text-green-400" : "text-amber-400"}>
            {pct}% YES {passing ? "✓" : ""} <span className="text-white/30">(need 51%)</span>
          </span>
        </div>
      )}
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
  const timeLeft = useCountdown(proposal.votingEndsAt);

  const { direction, progress, handlers, style, phase, isDragging } = useSwipeVote({
    threshold: 100,
    onSwipeRight: () => { onVote(proposal.id, true); onSwipeComplete?.("right"); },
    onSwipeLeft: () => { onVote(proposal.id, false); onSwipeComplete?.("left"); },
  });

  const yesOpacity = direction === "right" ? 0.2 + progress * 0.35 : progress > 0 && progress < 0.4 ? progress * 0.15 : 0;
  const noOpacity = direction === "left" ? 0.2 + progress * 0.35 : progress > 0 && progress < 0.4 ? progress * 0.15 : 0;

  const showYesStamp = direction === "right" && progress > 0.3;
  const showNoStamp = direction === "left" && progress > 0.3;

  // Edge glow intensity based on progress
  const edgeGlowYes = direction === "right" ? progress : 0;
  const edgeGlowNo = direction === "left" ? progress : 0;

  return (
    <div className="relative mx-auto w-full max-w-md" style={{ perspective: "1200px" }}>
      {/* Shadow card 3 (deepest) */}
      <div
        className="absolute inset-0 rounded-2xl bg-neutral-900/30"
        style={{
          transform: `scale(${0.88 + progress * 0.02}) translateY(${20 - progress * 6}px)`,
          transition: isDragging ? "none" : "transform 0.4s ease",
          zIndex: -2,
          boxShadow: "0 4px 20px rgba(0,0,0,0.2)",
        }}
      />

      {/* Shadow card 2 */}
      <div
        className="absolute inset-0 rounded-2xl bg-neutral-900/50"
        style={{
          transform: `scale(${0.92 + progress * 0.03}) translateY(${14 - progress * 5}px)`,
          transition: isDragging ? "none" : "transform 0.35s ease",
          zIndex: -1,
          boxShadow: "0 6px 24px rgba(0,0,0,0.25)",
        }}
      />

      {/* Next card peek */}
      {nextProposal && (
        <div
          className="absolute inset-0 rounded-2xl border border-neutral-800 bg-neutral-900/70 overflow-hidden"
          style={{
            transform: `scale(${0.95 + progress * 0.03}) translateY(${8 - progress * 6}px)`,
            transition: isDragging ? "none" : phase === "exiting" ? "transform 0.35s ease" : "transform 0.3s ease",
            zIndex: 0,
            boxShadow: "0 8px 30px rgba(0,0,0,0.3)",
          }}
        >
          <div className="w-full aspect-square">
            {nextProposal.ipfsCid ? (
              <img src={cidToHttpUrl(nextProposal.ipfsCid)} alt="Next" className="h-full w-full object-cover opacity-40" draggable={false} loading="lazy" />
            ) : nextVisual ? (
              <div className="flex h-full w-full items-center justify-center opacity-40" style={{ background: nextVisual.gradient }}>
                <span className="text-5xl">{nextVisual.symbol}</span>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* Active card */}
      <div
        key={cardKey}
        {...handlers}
        style={{
          ...style,
          touchAction: "pan-y",
          zIndex: 1,
          position: "relative",
          animation: phase !== "exiting" && !isDragging ? "card-enter 400ms cubic-bezier(0.34, 1.56, 0.64, 1) both" : undefined,
        }}
        className="relative rounded-2xl border border-neutral-700 bg-neutral-900/95 overflow-hidden select-none"
      >
        {/* YES edge glow */}
        <div className="absolute inset-0 z-10 pointer-events-none rounded-2xl" style={{
          background: `linear-gradient(135deg, rgba(34,197,94,${yesOpacity}) 0%, transparent 50%)`,
          boxShadow: edgeGlowYes > 0.3 ? `inset 0 0 ${edgeGlowYes * 60}px rgba(34,197,94,${edgeGlowYes * 0.3}), 0 0 ${edgeGlowYes * 40}px rgba(34,197,94,${edgeGlowYes * 0.2})` : "none",
          transition: isDragging ? "none" : "box-shadow 0.3s ease",
        }} />
        {/* NO edge glow */}
        <div className="absolute inset-0 z-10 pointer-events-none rounded-2xl" style={{
          background: `linear-gradient(225deg, rgba(239,68,68,${noOpacity}) 0%, transparent 50%)`,
          boxShadow: edgeGlowNo > 0.3 ? `inset 0 0 ${edgeGlowNo * 60}px rgba(239,68,68,${edgeGlowNo * 0.3}), 0 0 ${edgeGlowNo * 40}px rgba(239,68,68,${edgeGlowNo * 0.2})` : "none",
          transition: isDragging ? "none" : "box-shadow 0.3s ease",
        }} />

        {/* YES stamp */}
        <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none" style={{ opacity: direction === "right" ? 1 : 0, transition: "opacity 0.1s ease" }}>
          <span
            className="rounded-xl border-[4px] border-green-400 px-10 py-4 text-5xl font-black uppercase text-green-400"
            style={{
              ["--stamp-rot" as string]: "-15deg",
              ["--stamp-glow" as string]: "rgba(34,197,94,0.6)",
              animation: showYesStamp ? "stamp-slam 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) both" : "none",
              transform: showYesStamp ? undefined : `scale(${0.5 + progress * 0.6}) rotate(-15deg)`,
              textShadow: "0 0 40px rgba(34,197,94,0.5), 0 0 80px rgba(34,197,94,0.2)",
              letterSpacing: "0.15em",
            }}
          >YES</span>
        </div>
        {/* NO stamp */}
        <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none" style={{ opacity: direction === "left" ? 1 : 0, transition: "opacity 0.1s ease" }}>
          <span
            className="rounded-xl border-[4px] border-red-400 px-10 py-4 text-5xl font-black uppercase text-red-400"
            style={{
              ["--stamp-rot" as string]: "15deg",
              ["--stamp-glow" as string]: "rgba(239,68,68,0.6)",
              animation: showNoStamp ? "stamp-slam 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) both" : "none",
              transform: showNoStamp ? undefined : `scale(${0.5 + progress * 0.6}) rotate(15deg)`,
              textShadow: "0 0 40px rgba(239,68,68,0.5), 0 0 80px rgba(239,68,68,0.2)",
              letterSpacing: "0.15em",
            }}
          >NOPE</span>
        </div>

        {/* Image */}
        <div className="w-full aspect-square">
          {proposal.ipfsCid ? (
            <img src={cidToHttpUrl(proposal.ipfsCid)} alt={`Proposal #${proposal.id}`} className="h-full w-full object-cover" draggable={false} loading="eager" onError={(e) => tryNextGateway(e.currentTarget, proposal.ipfsCid)} />
          ) : (
            <div className="flex h-full w-full items-center justify-center relative" style={{ background: visual.gradient }}>
              <span className="text-7xl drop-shadow-[0_0_24px_rgba(255,255,255,0.2)]">{visual.symbol}</span>
            </div>
          )}
        </div>

        {/* Card info */}
        <div className="border-t border-neutral-800 bg-neutral-900/90 px-4 py-3">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[11px] uppercase tracking-wider text-neutral-500 font-semibold">Prop #{proposal.id}</span>
              <div className="mt-0.5 font-mono text-xs text-neutral-300">{truncateAddress(proposal.proposer)}</div>
            </div>
            <div className="flex flex-col items-end gap-1">
              <span className="text-[10px] text-neutral-400" style={{ animation: "pulse 2s ease-in-out infinite" }}>
                &#x1F449; Swipe to vote
              </span>
              {timeLeft && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-purple-500/15 px-2.5 py-1 text-[10px] font-semibold text-purple-300 ring-1 ring-purple-500/25">
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-purple-400 animate-pulse" />
                  {timeLeft}
                </span>
              )}
            </div>
          </div>
          <div className="mt-2.5">
            <VoteBar forCount={proposal.forCount} againstCount={proposal.againstCount} showThreshold />
          </div>
        </div>

        {/* Bottom glow bar */}
        <div className="absolute bottom-0 left-0 right-0 h-1.5 z-20" style={{
          background: direction === "right"
            ? `linear-gradient(90deg, transparent 20%, rgba(34,197,94,${progress * 0.9}))`
            : direction === "left"
            ? `linear-gradient(270deg, transparent 20%, rgba(239,68,68,${progress * 0.9}))`
            : "transparent",
          boxShadow: direction === "right"
            ? `0 0 ${progress * 20}px rgba(34,197,94,${progress * 0.5})`
            : direction === "left"
            ? `0 0 ${progress * 20}px rgba(239,68,68,${progress * 0.5})`
            : "none",
        }} />
      </div>

      {/* Button row */}
      <div className="mt-4 flex items-center justify-center gap-8">
        <button
          onClick={() => { onVote(proposal.id, false); onSwipeComplete?.("left"); }}
          className="group flex items-center justify-center w-16 h-16 rounded-full border-2 border-red-500/30 bg-red-500/5 text-red-400 transition-all duration-200 hover:bg-red-500/20 hover:border-red-500/60 hover:scale-110 active:scale-90"
          style={{ boxShadow: "0 4px 20px rgba(239,68,68,0.1)" }}
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-7 h-7 transition-transform group-hover:rotate-12"><path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" /></svg>
        </button>
        <button
          onClick={() => { onVote(proposal.id, true); onSwipeComplete?.("right"); }}
          className="group flex items-center justify-center w-16 h-16 rounded-full border-2 border-green-500/30 bg-green-500/5 text-green-400 transition-all duration-200 hover:bg-green-500/20 hover:border-green-500/60 hover:scale-110 active:scale-90"
          style={{ boxShadow: "0 4px 20px rgba(34,197,94,0.1)" }}
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-7 h-7 transition-transform group-hover:scale-110"><path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" /></svg>
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

  // Screen shake state
  const [shaking, setShaking] = useState(false);
  // Glow flash state
  const [glowDir, setGlowDir] = useState<"left" | "right" | null>(null);
  const [glowTrigger, setGlowTrigger] = useState(0);
  // Vote result text state
  const [voteResultDir, setVoteResultDir] = useState<"left" | "right" | null>(null);
  const [voteResultTrigger, setVoteResultTrigger] = useState(0);

  // Inject keyframes on mount
  useEffect(() => { injectKeyframes(); }, []);

  // Handle swipe complete: sound + particles + streak + shake + glow + vote text
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

    // Screen shake
    setShaking(true);
    setTimeout(() => setShaking(false), 150);

    // Glow flash behind card
    setGlowDir(dir);
    setGlowTrigger((n) => n + 1);

    // Vote result text flash
    setVoteResultDir(dir);
    setVoteResultTrigger((n) => n + 1);
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
              title="VOTE.EXE"
              connected={isConnected}
              address={address}
              onDisconnect={() => disconnect()}
              onSwitchWallet={handleSwitchWallet}
            />
            <div className="vista-window__body foid-iridescent" style={{ overflow: "hidden", flex: 1, minHeight: 0, position: "relative" }}>
              <div className="p-3 md:p-4 flex flex-col h-full" style={{ minHeight: 0 }}>
                {/* Ambient focal glow */}
                <div className="foid-focal-glow" />
                {/* Compact header */}
                <div className="flex-shrink-0 flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <h1
                      className="text-base sm:text-lg font-black uppercase tracking-[0.15em] text-transparent bg-clip-text flex-shrink-0"
                      style={{ backgroundImage: "linear-gradient(135deg, rgba(168,130,255,1) 0%, rgba(255,255,255,0.95) 50%, rgba(200,160,255,0.9) 100%)" }}
                    >
                      Vote
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
                </div>

                {/* Main content area */}
                {loading ? (
                  <div className="flex flex-1 items-center justify-center" style={{ minHeight: 0 }}>
                    <div className="h-8 w-8 animate-spin rounded-full border-2 border-purple-500 border-t-transparent" />
                  </div>
                ) : tab === "active" ? (
                  currentProposal ? (
                    <div
                      className="flex flex-col flex-1 min-h-0 items-center justify-center gap-2 relative"
                      style={shaking ? { animation: "swipe-shake 150ms ease-in-out" } : undefined}
                    >
                      {/* Glow flash behind card */}
                      <GlowFlash direction={glowDir} trigger={glowTrigger} />
                      {/* Particle overlay */}
                      <SwipeParticles direction={particleDir} trigger={particleTrigger} />
                      {/* Streak badge */}
                      <StreakBadge count={sessionVoteCount} trigger={streakTrigger} />
                      {/* Vote result text */}
                      <VoteResultText direction={voteResultDir} trigger={voteResultTrigger} />
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
                    <div className="flex flex-col flex-1 min-h-0 items-center justify-center text-center px-4">
                      <div className="relative mb-6">
                        <div className="text-6xl" style={{ filter: "drop-shadow(0 0 20px rgba(168,130,255,0.4))" }}>&#x2694;&#xFE0F;</div>
                        <div className="absolute inset-0 rounded-full" style={{ background: "radial-gradient(circle, rgba(168,130,255,0.15) 0%, transparent 70%)", filter: "blur(20px)" }} />
                      </div>
                      <h2 className="text-lg font-bold tracking-wide text-white/85">
                        {proposals.some((p) => !p.finalized && now < p.votingEndsAt)
                          ? "All caught up!"
                          : "No active proposals"}
                      </h2>
                      <p className="mt-2 max-w-xs text-sm leading-relaxed text-white/45">
                        {proposals.some((p) => !p.finalized && now < p.votingEndsAt)
                          ? "You've voted on every proposal. Check back soon — new proposals appear when the community submits images to the Loreboard."
                          : "The voting queue is empty right now. Head to the Loreboard to propose an image — once submitted, the community can swipe to approve or reject it."}
                      </p>
                      <Link
                        href="/board"
                        className="mt-5 inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold tracking-wide transition hover:scale-[1.03]"
                        style={{
                          background: "linear-gradient(135deg, rgba(168,130,255,0.2), rgba(255,107,213,0.2))",
                          border: "1px solid rgba(168,130,255,0.3)",
                          color: "rgba(200,170,255,0.95)",
                          boxShadow: "0 0 20px rgba(168,130,255,0.15)",
                        }}
                      >
                        Go to Loreboard <span aria-hidden>&rarr;</span>
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
                            {proposal.canonized && <span className="text-green-400">On Board &rarr;</span>}
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
