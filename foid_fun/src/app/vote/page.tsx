"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAccount, useReadContract } from "wagmi";
import { useSwitchWallet } from "@/hooks/useSwitchWallet";
import Link from "next/link";
import { CONTRACTS } from "@/lib/contracts/addresses";
import { LOREBOARD_ABI } from "@/lib/contracts/abis/loreboard";
import { getWalletClient } from "@/lib/viem";
import AppTitlebar from "@/app/(components)/AppTitlebar";
import { useSwipeVote } from "@/hooks/useSwipeVote";
import toast from "react-hot-toast";
import { cidToHttpUrl, ipfsToHttp } from "@/lib/ipfsUrl";
import { CHAIN_ID } from "@/config/canonical";
import { useSwipeVotingPower } from "@/hooks/useSwipeVotingPower";
import { useBoardEvents } from "@/hooks/useBoardEvents";
import {
  playSwipeYes,
  playSwipeNo,
  playSkipWhoosh,
  playCardEnter,
  playUndoWhoosh,
  playVictoryChord,
  playReward,
} from "@/lib/sfx";
import { CHAIN_CONFIG } from "@/lib/contracts/addresses";

/* ─── Helpers ─── */
function tryNextGateway(el: HTMLImageElement, cid?: string) {
  if (!cid) return;
  const urls = ipfsToHttp(cid);
  const idx = Number(el.dataset.gatewayIndex ?? "-1") + 1;
  if (idx < urls.length) { el.src = urls[idx]; el.dataset.gatewayIndex = String(idx); }
}

function truncAddr(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

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
  localStorage.setItem(votedIdsKey(wallet), JSON.stringify([...ids]));
}

/* ─── Types ─── */
type SwipeProposal = {
  id: number;
  proposer: string;
  ipfsCid: string;
  createdAt: number;
  votingEndsAt: number;
  finalized: boolean;
  approved: boolean;
  trestEntryId: number;
  forCount: number;
  againstCount: number;
  name?: string;
};

const CARD_VISUALS = [
  { gradient: "linear-gradient(135deg, #1a0a2e 0%, #3d1a6e 50%, #0f0c29 100%)", symbol: "\u2694\uFE0F" },
  { gradient: "linear-gradient(135deg, #0a1a2e 0%, #1a3d6e 50%, #0c1929 100%)", symbol: "\u{1F6E1}\uFE0F" },
  { gradient: "linear-gradient(135deg, #2e0a1a 0%, #6e1a3d 50%, #290c0f 100%)", symbol: "\u2620\uFE0F" },
  { gradient: "linear-gradient(135deg, #0a2e1a 0%, #1a6e3d 50%, #0c290f 100%)", symbol: "\u{1F451}" },
  { gradient: "linear-gradient(135deg, #2e2e0a 0%, #6e6e1a 50%, #29290c 100%)", symbol: "\u{1F525}" },
  { gradient: "linear-gradient(135deg, #0a0a2e 0%, #1a1a6e 50%, #0c0c29 100%)", symbol: "\u{1F30C}" },
];

/* ─── CSS Keyframes ─── */
const KEYFRAMES_ID = "vote-keyframes-v2";
function injectKeyframes() {
  if (typeof document === "undefined") return;
  if (document.getElementById(KEYFRAMES_ID)) return;
  const style = document.createElement("style");
  style.id = KEYFRAMES_ID;
  style.textContent = `
    @keyframes swipe-particle{0%{transform:translate(0,0) scale(1);opacity:1}100%{transform:translate(var(--px),var(--py)) scale(0.3);opacity:0}}
    @keyframes stamp-slam{0%{transform:scale(1.5) rotate(var(--stamp-rot));opacity:.5;filter:drop-shadow(0 0 30px var(--stamp-glow))}50%{transform:scale(.92) rotate(var(--stamp-rot));opacity:1}70%{transform:scale(1.06) rotate(var(--stamp-rot));opacity:1}100%{transform:scale(1) rotate(var(--stamp-rot));opacity:1;filter:drop-shadow(0 0 12px var(--stamp-glow))}}
    @keyframes card-enter{0%{transform:scale(.95);opacity:0}60%{transform:scale(1.015);opacity:1}100%{transform:scale(1);opacity:1}}
    @keyframes streak-pop{0%{transform:scale(.5) translateY(8px);opacity:0}30%{transform:scale(1.25) translateY(-4px);opacity:1}60%{transform:scale(1) translateY(0);opacity:1}100%{transform:scale(.9) translateY(-6px);opacity:0}}
    @keyframes swipe-shake{0%{transform:translateX(0)}15%{transform:translateX(-3px)}30%{transform:translateX(4px)}45%{transform:translateX(-4px)}60%{transform:translateX(3px)}75%{transform:translateX(-2px)}100%{transform:translateX(0)}}
    @keyframes glow-flash{0%{opacity:.85}100%{opacity:0}}
    @keyframes vote-result-text{0%{transform:scale(.8);opacity:1}40%{transform:scale(1);opacity:1}100%{transform:scale(1);opacity:0}}
    @keyframes undo-enter{0%{transform:translateY(20px) scale(.9);opacity:0}100%{transform:translateY(0) scale(1);opacity:1}}
    @keyframes undo-exit{0%{transform:translateY(0) scale(1);opacity:1}100%{transform:translateY(20px) scale(.9);opacity:0}}
    @keyframes float-sword{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}
    @keyframes shimmer{0%{background-position:-200% 0}100%{background-position:200% 0}}
    @keyframes victory-particle{0%{transform:translate(0,0) scale(1);opacity:1}100%{transform:translate(var(--vx),var(--vy)) scale(0);opacity:0}}
    @keyframes count-up{0%{transform:scale(1.4);opacity:0}40%{transform:scale(1);opacity:1}100%{transform:scale(1);opacity:1}}
    @keyframes drawer-enter{0%{transform:translateY(100%)}100%{transform:translateY(0)}}
    @keyframes drawer-exit{0%{transform:translateY(0)}100%{transform:translateY(100%)}}
    @keyframes ring-progress{0%{stroke-dashoffset:var(--ring-total)}100%{stroke-dashoffset:var(--ring-remaining)}}
    @keyframes step-pulse{0%,100%{box-shadow:0 0 0 0 rgba(168,130,255,.4)}50%{box-shadow:0 0 0 8px rgba(168,130,255,0)}}
    @keyframes confetti-fall{0%{transform:translateY(-10px) rotate(0deg);opacity:1}100%{transform:translateY(60vh) rotate(720deg);opacity:0}}
    @keyframes hint-swipe{0%{transform:translateX(0);opacity:.7}50%{transform:translateX(40px);opacity:.9}100%{transform:translateX(0);opacity:0}}
    @keyframes kbd-fade{0%{opacity:.8}100%{opacity:0}}
  `;
  document.head.appendChild(style);
}

/* ─── Particle burst ─── */
function SwipeParticles({ direction, trigger }: { direction: "left" | "right" | "up" | null; trigger: number }) {
  const [particles, setParticles] = useState<{ id: number; angle: number; dist: number; color: string; size: number; square: boolean; delay: number }[]>([]);
  const lastTrigger = useRef(0);

  useEffect(() => {
    if (trigger <= 0 || trigger === lastTrigger.current || !direction) return;
    lastTrigger.current = trigger;
    const colors = direction === "right"
      ? ["#22c55e","#06b6d4","#34d399","#10b981","#6ee7b7","#2dd4bf"]
      : direction === "left"
      ? ["#ef4444","#f87171","#dc2626","#fb923c","#f43f5e","#e11d48"]
      : ["#a78bfa","#8b5cf6","#c084fc","#7c3aed","#a855f7","#6d28d9"];
    const count = 20 + Math.floor(Math.random() * 6);
    const baseAngle = direction === "up" ? -Math.PI / 2 : 0;
    const spread = direction === "up" ? Math.PI * 0.6 : Math.PI * 2;
    setParticles(Array.from({ length: count }, (_, i) => ({
      id: i,
      angle: baseAngle + (spread * i) / count + (Math.random() - 0.5) * 0.5,
      dist: 80 + Math.random() * 140,
      color: colors[Math.floor(Math.random() * colors.length)],
      size: 4 + Math.random() * 4,
      square: Math.random() > 0.65,
      delay: Math.random() < 0.4 ? Math.random() * 80 : 0,
    })));
    const timer = setTimeout(() => setParticles([]), 700);
    return () => clearTimeout(timer);
  }, [trigger, direction]);

  if (particles.length === 0) return null;
  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 50, overflow: "hidden" }}>
      <div style={{ position: "absolute", top: "50%", left: "50%", width: 0, height: 0 }}>
        {particles.map((p) => (
          <div key={p.id} style={{
            position: "absolute", width: p.size, height: p.size,
            borderRadius: p.square ? "2px" : "50%", backgroundColor: p.color,
            boxShadow: `0 0 8px ${p.color}`,
            ["--px" as string]: `${Math.cos(p.angle) * p.dist}px`,
            ["--py" as string]: `${Math.sin(p.angle) * p.dist}px`,
            animation: "swipe-particle 550ms cubic-bezier(0.25,0.46,0.45,0.94) forwards",
            animationDelay: `${p.delay}ms`, opacity: 0,
          }} />
        ))}
      </div>
    </div>
  );
}

/* ─── Streak badge ─── */
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
    <div style={{ position: "absolute", top: 8, left: "50%", transform: "translateX(-50%)", zIndex: 60, pointerEvents: "none" }}>
      <div style={{
        fontSize: count >= 5 ? 28 : 22, fontWeight: 900, color: "#fbbf24",
        textShadow: "0 0 16px rgba(251,191,36,.7),0 0 32px rgba(251,191,36,.4),0 2px 4px rgba(0,0,0,.5)",
        animation: "streak-pop 800ms cubic-bezier(0.34,1.56,0.64,1) forwards", letterSpacing: "0.05em",
      }}>x{count}</div>
    </div>
  );
}

/* ─── Glow flash ─── */
function GlowFlash({ direction, trigger }: { direction: "left" | "right" | "up" | null; trigger: number }) {
  const [active, setActive] = useState(false);
  const [dir, setDir] = useState<typeof direction>(null);
  const lastTrigger = useRef(0);
  useEffect(() => {
    if (trigger <= 0 || trigger === lastTrigger.current || !direction) return;
    lastTrigger.current = trigger;
    setDir(direction);
    setActive(true);
    const t = setTimeout(() => setActive(false), 300);
    return () => clearTimeout(t);
  }, [trigger, direction]);
  if (!active || !dir) return null;
  const bg = dir === "right"
    ? "radial-gradient(circle,rgba(34,197,94,.55) 0%,transparent 70%)"
    : dir === "left"
    ? "radial-gradient(circle,rgba(239,68,68,.55) 0%,transparent 70%)"
    : "radial-gradient(circle,rgba(139,92,246,.55) 0%,transparent 70%)";
  return <div style={{ position: "absolute", inset: "-20%", zIndex: 0, pointerEvents: "none", background: bg, animation: "glow-flash 300ms ease-out forwards" }} />;
}

/* ─── Vote result text flash ─── */
function VoteResultText({ direction, trigger }: { direction: "left" | "right" | "up" | null; trigger: number }) {
  const [active, setActive] = useState(false);
  const [dir, setDir] = useState<typeof direction>(null);
  const lastTrigger = useRef(0);
  useEffect(() => {
    if (trigger <= 0 || trigger === lastTrigger.current || !direction) return;
    lastTrigger.current = trigger;
    setDir(direction);
    setActive(true);
    const t = setTimeout(() => setActive(false), 600);
    return () => clearTimeout(t);
  }, [trigger, direction]);
  if (!active || !dir) return null;
  const text = dir === "right" ? "APPROVED" : dir === "left" ? "REJECTED" : "SKIPPED";
  const color = dir === "right" ? "#22c55e" : dir === "left" ? "#ef4444" : "#a78bfa";
  return (
    <div style={{ position: "absolute", inset: 0, zIndex: 55, pointerEvents: "none", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <span style={{
        fontSize: "clamp(32px,8vw,56px)", fontWeight: 900, color, letterSpacing: "0.12em", textTransform: "uppercase",
        textShadow: `0 0 40px ${color}80,0 0 80px ${color}40`,
        animation: "vote-result-text 600ms ease-out forwards",
      }}>{text}</span>
    </div>
  );
}

/* ─── Countdown ─── */
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

/* ─── Vote bar ─── */
function VoteBar({ forCount, againstCount, showThreshold }: { forCount: number; againstCount: number; showThreshold?: boolean }) {
  const total = forCount + againstCount;
  if (total === 0 && !showThreshold) return null;
  const pct = total > 0 ? Math.round((forCount / total) * 100) : 0;
  const passing = pct >= 51;
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1.5 text-[9px]">
        <span className="text-green-400 font-semibold">{forCount}</span>
        <div className="relative flex h-1.5 flex-1 overflow-hidden rounded-full bg-neutral-800">
          {total > 0 && (
            <>
              <div className="bg-green-500 transition-all duration-500" style={{ width: `${(forCount / total) * 100}%` }} />
              <div className="bg-red-500 transition-all duration-500" style={{ width: `${(againstCount / total) * 100}%` }} />
            </>
          )}
          <div className="absolute top-0 bottom-0 w-px bg-white/40" style={{ left: "51%" }} />
        </div>
        <span className="text-red-400 font-semibold">{againstCount}</span>
      </div>
      {showThreshold && total > 0 && (
        <div className="flex items-center justify-between text-[9px]">
          <span className={passing ? "text-green-400" : "text-amber-400"}>
            {pct}% for {passing ? "— passing" : ""} <span className="text-white/30">(need 51%)</span>
          </span>
        </div>
      )}
    </div>
  );
}

/* ─── Undo Pill ─── */
function UndoPill({ visible, onUndo }: { visible: boolean; onUndo: () => void }) {
  const [show, setShow] = useState(false);
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    if (visible) {
      setShow(true);
      setExiting(false);
      const t = setTimeout(() => {
        setExiting(true);
        setTimeout(() => setShow(false), 300);
      }, 3000);
      return () => clearTimeout(t);
    } else {
      setExiting(true);
      const t = setTimeout(() => setShow(false), 300);
      return () => clearTimeout(t);
    }
  }, [visible]);

  if (!show) return null;
  return (
    <button
      onClick={() => { onUndo(); setShow(false); }}
      className="fixed bottom-24 left-1/2 z-50 flex items-center gap-2 rounded-full border border-white/15 bg-neutral-900/80 px-4 py-2 text-xs font-semibold text-white/70 backdrop-blur-md hover:bg-neutral-800/90 hover:text-white/90 transition-colors"
      style={{
        transform: "translateX(-50%)",
        animation: exiting ? "undo-exit 300ms ease-in forwards" : "undo-enter 300ms ease-out forwards",
        boxShadow: "0 4px 20px rgba(0,0,0,.4)",
      }}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>
      Undo <span className="text-white/30 ml-0.5">(Z)</span>
    </button>
  );
}

/* ─── Detail Drawer ─── */
function DetailDrawer({ proposal, onClose, onVote }: { proposal: SwipeProposal; onClose: () => void; onVote: (approve: boolean) => void }) {
  const timeLeft = useCountdown(proposal.votingEndsAt);
  const total = proposal.forCount + proposal.againstCount;
  const pct = total > 0 ? Math.round((proposal.forCount / total) * 100) : 0;
  const now = Math.floor(Date.now() / 1000);
  const totalDuration = proposal.votingEndsAt - proposal.createdAt;
  const elapsed = now - proposal.createdAt;
  const ringProgress = totalDuration > 0 ? Math.min(1, elapsed / totalDuration) : 1;
  const circumference = 2 * Math.PI * 38;

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-lg rounded-t-2xl border-t border-white/10 bg-neutral-900/95 backdrop-blur-xl overflow-auto"
        style={{ maxHeight: "75vh", animation: "drawer-enter 350ms cubic-bezier(0.32,0.72,0,1) forwards" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Handle */}
        <div className="flex justify-center py-2">
          <div className="h-1 w-10 rounded-full bg-white/20" />
        </div>

        {/* Image */}
        <div className="px-4">
          <div className="overflow-hidden rounded-xl">
            {proposal.ipfsCid ? (
              <img src={cidToHttpUrl(proposal.ipfsCid)} alt={`Proposal #${proposal.id}`} className="w-full object-contain max-h-[40vh]" onError={(e) => tryNextGateway(e.currentTarget, proposal.ipfsCid)} />
            ) : (
              <div className="flex h-48 items-center justify-center" style={{ background: CARD_VISUALS[proposal.id % CARD_VISUALS.length].gradient }}>
                <span className="text-6xl">{CARD_VISUALS[proposal.id % CARD_VISUALS.length].symbol}</span>
              </div>
            )}
          </div>
        </div>

        {/* Info */}
        <div className="px-4 py-4 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-white/90">
                {proposal.name || `Proposal #${proposal.id}`}
              </h3>
              <p className="mt-0.5 font-mono text-xs text-white/40">{truncAddr(proposal.proposer)}</p>
            </div>
            {/* Countdown ring */}
            <div className="relative w-16 h-16 flex items-center justify-center flex-shrink-0">
              <svg width="80" height="80" viewBox="0 0 80 80" className="absolute inset-0 -rotate-90">
                <circle cx="40" cy="40" r="38" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="3" />
                <circle cx="40" cy="40" r="38" fill="none" stroke="url(#ring-grad)" strokeWidth="3"
                  strokeLinecap="round"
                  strokeDasharray={circumference}
                  strokeDashoffset={circumference * (1 - ringProgress)}
                  style={{ transition: "stroke-dashoffset 1s ease" }}
                />
                <defs>
                  <linearGradient id="ring-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#a78bfa" />
                    <stop offset="100%" stopColor="#22c55e" />
                  </linearGradient>
                </defs>
              </svg>
              <span className="text-[10px] font-semibold text-white/60 text-center leading-tight">{timeLeft}</span>
            </div>
          </div>

          {/* Vote tally */}
          <div className="rounded-xl bg-white/5 border border-white/8 p-3">
            <div className="flex items-center justify-between mb-2 text-xs">
              <span className="text-green-400 font-bold">{proposal.forCount} for</span>
              <span className="text-white/40">{total > 0 ? `${pct}%` : "No votes yet"}</span>
              <span className="text-red-400 font-bold">{proposal.againstCount} against</span>
            </div>
            <div className="relative flex h-2 overflow-hidden rounded-full bg-neutral-800">
              {total > 0 && (
                <>
                  <div className="bg-green-500 transition-all duration-500 rounded-l-full" style={{ width: `${(proposal.forCount / total) * 100}%` }} />
                  <div className="bg-red-500 transition-all duration-500 rounded-r-full" style={{ width: `${(proposal.againstCount / total) * 100}%` }} />
                </>
              )}
              <div className="absolute top-0 bottom-0 w-px bg-white/40" style={{ left: "51%" }} />
            </div>
          </div>

          {/* Vote buttons */}
          <div className="flex gap-3">
            <button
              onClick={() => { onVote(false); onClose(); }}
              className="flex-1 rounded-xl py-3 text-sm font-bold uppercase tracking-wider border-2 border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20 transition active:scale-95"
            >Reject</button>
            <button
              onClick={() => { onVote(true); onClose(); }}
              className="flex-1 rounded-xl py-3 text-sm font-bold uppercase tracking-wider border-2 border-green-500/30 bg-green-500/10 text-green-400 hover:bg-green-500/20 transition active:scale-95"
            >Approve</button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Transaction Overlay ─── */
function TxOverlay({ stage, progress, total }: { stage: "preparing" | "confirm" | "broadcasting" | "done"; progress: number; total: number }) {
  const steps = [
    { key: "preparing", label: "Preparing transaction...", icon: "..." },
    { key: "confirm", label: "Confirm in your wallet", icon: "\u{1F4B3}" },
    { key: "broadcasting", label: `Submitting vote ${progress} of ${total}...`, icon: "\u{1F4E1}" },
    { key: "done", label: "Confirmed!", icon: "\u2713" },
  ];
  const activeIdx = steps.findIndex((s) => s.key === stage);

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center" style={{ background: "rgba(0,0,0,.6)", backdropFilter: "blur(8px)" }}>
      <div className="w-full max-w-xs rounded-2xl border border-white/10 bg-neutral-900/90 backdrop-blur-xl p-6 space-y-4">
        <h3 className="text-center text-sm font-bold text-white/80 mb-4">Processing Votes</h3>
        {steps.map((step, i) => {
          const isActive = i === activeIdx;
          const isDone = i < activeIdx;
          return (
            <div key={step.key} className="flex items-center gap-3">
              <div
                className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold transition-all duration-300 ${
                  isDone ? "bg-green-500/20 text-green-400 border border-green-500/30"
                  : isActive ? "bg-purple-500/20 text-purple-300 border border-purple-500/40"
                  : "bg-white/5 text-white/20 border border-white/10"
                }`}
                style={isActive ? { animation: "step-pulse 1.5s ease-in-out infinite" } : {}}
              >
                {isDone ? "\u2713" : step.icon}
              </div>
              <span className={`text-xs font-medium transition-colors ${
                isDone ? "text-green-400/70" : isActive ? "text-white/80" : "text-white/25"
              }`}>{step.label}</span>
            </div>
          );
        })}
        {total > 1 && (
          <div className="mt-3 h-1.5 rounded-full bg-neutral-800 overflow-hidden">
            <div className="h-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all duration-500 rounded-full"
              style={{ width: `${total > 0 ? (progress / total) * 100 : 0}%` }} />
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Victory Celebration ─── */
function VictoryCelebration({ count, txHashes, onDismiss }: { count: number; txHashes: string[]; onDismiss: () => void }) {
  const [particles] = useState(() =>
    Array.from({ length: 60 }, (_, i) => ({
      id: i,
      x: (Math.random() - 0.5) * 500,
      y: (Math.random() - 0.5) * 500 - 200,
      color: ["#fbbf24","#a78bfa","#22c55e","#06b6d4","#f472b6","#e879f9"][i % 6],
      size: 4 + Math.random() * 6,
      delay: Math.random() * 400,
      duration: 800 + Math.random() * 600,
    }))
  );
  const [shown, setShown] = useState(false);

  useEffect(() => {
    setShown(true);
    playVictoryChord();
    setTimeout(() => playReward(), 400);
    const t = setTimeout(onDismiss, 5000);
    return () => clearTimeout(t);
  }, [onDismiss]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,.5)", backdropFilter: "blur(6px)" }} onClick={onDismiss}>
      {/* Particles */}
      <div style={{ position: "absolute", top: "50%", left: "50%", pointerEvents: "none" }}>
        {particles.map((p) => (
          <div key={p.id} style={{
            position: "absolute", width: p.size, height: p.size, borderRadius: "50%",
            backgroundColor: p.color, boxShadow: `0 0 10px ${p.color}`,
            ["--vx" as string]: `${p.x}px`, ["--vy" as string]: `${p.y}px`,
            animation: `victory-particle ${p.duration}ms cubic-bezier(0.25,0.46,0.45,0.94) forwards`,
            animationDelay: `${p.delay}ms`, opacity: 0,
          }} />
        ))}
      </div>

      <div className="relative z-10 text-center px-6" style={{ opacity: shown ? 1 : 0, transition: "opacity 0.5s ease" }}>
        <div className="text-5xl mb-4" style={{ animation: "count-up 600ms ease-out forwards" }}>
          {count === 1 ? "\u2694\uFE0F" : "\u{1F525}"}
        </div>
        <div className="text-3xl font-black text-white mb-1" style={{ animation: "count-up 600ms ease-out 200ms both" }}>
          {count} {count === 1 ? "VOTE" : "VOTES"} CAST
        </div>
        <p className="text-sm text-white/50 mb-4" style={{ animation: "count-up 600ms ease-out 400ms both" }}>
          Your voice shapes the loreboard
        </p>
        {txHashes.length > 0 && (
          <div className="flex flex-wrap justify-center gap-2 mb-4" style={{ animation: "count-up 600ms ease-out 600ms both" }}>
            {txHashes.map((h, i) => (
              <a key={i} href={`${CHAIN_CONFIG.blockExplorer}/tx/${h}`} target="_blank" rel="noreferrer"
                className="inline-flex items-center gap-1 rounded-full bg-white/5 border border-white/10 px-3 py-1 text-[10px] font-mono text-purple-300 hover:bg-white/10 transition">
                {h.slice(0, 6)}...{h.slice(-4)} <span className="text-white/30">&rarr;</span>
              </a>
            ))}
          </div>
        )}
        <button onClick={onDismiss}
          className="text-xs text-white/30 hover:text-white/60 transition" style={{ animation: "count-up 600ms ease-out 800ms both" }}>
          click anywhere to continue
        </button>
      </div>
    </div>
  );
}

/* ─── Confetti burst for 5+ votes ─── */
function Confetti({ active }: { active: boolean }) {
  if (!active) return null;
  const pieces = Array.from({ length: 40 }, (_, i) => ({
    id: i, left: Math.random() * 100,
    color: ["#fbbf24","#a78bfa","#22c55e","#f472b6","#06b6d4","#e879f9"][i % 6],
    delay: Math.random() * 800, size: 4 + Math.random() * 4, duration: 2000 + Math.random() * 1500,
  }));
  return (
    <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 60 }}>
      {pieces.map((p) => (
        <div key={p.id} style={{
          position: "absolute", top: 0, left: `${p.left}%`,
          width: p.size, height: p.size * 1.5, backgroundColor: p.color, borderRadius: 1,
          animation: `confetti-fall ${p.duration}ms ease-in forwards`,
          animationDelay: `${p.delay}ms`, opacity: 0,
        }} />
      ))}
    </div>
  );
}

/* ─── Keyboard shortcuts hint ─── */
function KeyboardHint() {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const key = "foid-kbd-hint-seen";
    if (typeof window === "undefined") return;
    // Only show on desktop
    if ("ontouchstart" in window) return;
    if (localStorage.getItem(key)) return;
    setVisible(true);
    localStorage.setItem(key, "1");
    const t = setTimeout(() => setVisible(false), 4000);
    return () => clearTimeout(t);
  }, []);
  if (!visible) return null;
  return (
    <div className="fixed bottom-8 right-8 z-40 rounded-xl border border-white/10 bg-neutral-900/80 backdrop-blur-md px-4 py-3 text-[11px] text-white/50 space-y-1"
      style={{ animation: "kbd-fade 4s ease-in forwards" }}>
      <div className="text-white/70 font-semibold mb-1">Keyboard shortcuts</div>
      <div><kbd className="bg-white/10 rounded px-1 font-mono">&larr;</kbd> <kbd className="bg-white/10 rounded px-1 font-mono">&rarr;</kbd> Vote</div>
      <div><kbd className="bg-white/10 rounded px-1 font-mono">Space</kbd> Skip</div>
      <div><kbd className="bg-white/10 rounded px-1 font-mono">Z</kbd> Undo</div>
      <div><kbd className="bg-white/10 rounded px-1 font-mono">Enter</kbd> Details</div>
    </div>
  );
}

/* ─── Swipeable Card ─── */
function SwipeCard({
  proposal, onVote, onSkip, nextProposal, onSwipeComplete, cardKey, onTap, isFirst,
}: {
  proposal: SwipeProposal; onVote: (id: number, approve: boolean) => void;
  onSkip: (id: number) => void; nextProposal?: SwipeProposal | null;
  onSwipeComplete?: (dir: "left" | "right" | "up") => void;
  cardKey: number; onTap: () => void; isFirst: boolean;
}) {
  const visual = CARD_VISUALS[proposal.id % CARD_VISUALS.length];
  const nextVisual = nextProposal ? CARD_VISUALS[nextProposal.id % CARD_VISUALS.length] : null;
  const timeLeft = useCountdown(proposal.votingEndsAt);
  const totalVotes = proposal.forCount + proposal.againstCount;
  const isHot = totalVotes >= 10;

  // Sentiment ring color
  const sentimentPct = totalVotes > 0 ? proposal.forCount / totalVotes : 0.5;
  const sentimentColor = `hsl(${sentimentPct * 120}, 70%, 50%)`;

  const { direction, progress, handlers, style, phase, isDragging } = useSwipeVote({
    threshold: 100,
    onSwipeRight: () => { onVote(proposal.id, true); onSwipeComplete?.("right"); },
    onSwipeLeft: () => { onVote(proposal.id, false); onSwipeComplete?.("left"); },
    onSwipeUp: () => { onSkip(proposal.id); onSwipeComplete?.("up"); },
    onTap,
  });

  const yesOpacity = direction === "right" ? 0.2 + progress * 0.35 : 0;
  const noOpacity = direction === "left" ? 0.2 + progress * 0.35 : 0;
  const skipOpacity = direction === "up" ? 0.2 + progress * 0.35 : 0;
  const showYesStamp = direction === "right" && progress > 0.3;
  const showNoStamp = direction === "left" && progress > 0.3;
  const showSkipStamp = direction === "up" && progress > 0.3;
  const edgeGlowYes = direction === "right" ? progress : 0;
  const edgeGlowNo = direction === "left" ? progress : 0;

  return (
    <div className="relative mx-auto w-full max-w-md" style={{ perspective: "1200px" }}>
      {/* Shadow cards for depth */}
      <div className="absolute inset-0 rounded-2xl bg-neutral-900/30" style={{
        transform: `scale(${0.88 + progress * 0.02}) translateY(${20 - progress * 6}px)`,
        transition: isDragging ? "none" : "transform 0.4s ease", zIndex: -2,
      }} />
      <div className="absolute inset-0 rounded-2xl bg-neutral-900/50" style={{
        transform: `scale(${0.92 + progress * 0.03}) translateY(${14 - progress * 5}px)`,
        transition: isDragging ? "none" : "transform 0.35s ease", zIndex: -1,
      }} />

      {/* Next card peek */}
      {nextProposal && (
        <div className="absolute inset-0 rounded-2xl border border-neutral-800 bg-neutral-900/70 overflow-hidden" style={{
          transform: `scale(${0.95 + progress * 0.03}) translateY(${8 - progress * 6}px)`,
          transition: isDragging ? "none" : "transform 0.3s ease", zIndex: 0,
        }}>
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
      <div key={cardKey} {...handlers} style={{
        ...style, touchAction: "none", zIndex: 1, position: "relative",
        animation: phase !== "exiting" && !isDragging ? "card-enter 400ms cubic-bezier(0.34,1.56,0.64,1) both" : undefined,
        border: `2px solid ${sentimentColor}20`,
      }} className="relative rounded-2xl bg-neutral-900/95 overflow-hidden select-none">
        {/* Sentiment glow ring */}
        <div className="absolute inset-0 rounded-2xl pointer-events-none z-0" style={{
          boxShadow: `inset 0 0 20px ${sentimentColor}15, 0 0 15px ${sentimentColor}10`,
        }} />

        {/* Direction glows */}
        <div className="absolute inset-0 z-10 pointer-events-none rounded-2xl" style={{
          background: `linear-gradient(135deg,rgba(34,197,94,${yesOpacity}) 0%,transparent 50%)`,
          boxShadow: edgeGlowYes > 0.3 ? `inset 0 0 ${edgeGlowYes * 60}px rgba(34,197,94,${edgeGlowYes * 0.3})` : "none",
        }} />
        <div className="absolute inset-0 z-10 pointer-events-none rounded-2xl" style={{
          background: `linear-gradient(225deg,rgba(239,68,68,${noOpacity}) 0%,transparent 50%)`,
          boxShadow: edgeGlowNo > 0.3 ? `inset 0 0 ${edgeGlowNo * 60}px rgba(239,68,68,${edgeGlowNo * 0.3})` : "none",
        }} />
        <div className="absolute inset-0 z-10 pointer-events-none rounded-2xl" style={{
          background: `linear-gradient(to top,transparent 50%,rgba(139,92,246,${skipOpacity}) 100%)`,
        }} />

        {/* Stamps */}
        <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none" style={{ opacity: direction === "right" ? 1 : 0 }}>
          <span className="rounded-xl border-[4px] border-green-400 px-10 py-4 text-5xl font-black uppercase text-green-400"
            style={{ ["--stamp-rot" as string]: "-15deg", ["--stamp-glow" as string]: "rgba(34,197,94,.6)",
              animation: showYesStamp ? "stamp-slam .3s cubic-bezier(.34,1.56,.64,1) both" : "none",
              transform: showYesStamp ? undefined : `scale(${0.5 + progress * 0.6}) rotate(-15deg)`,
              textShadow: "0 0 40px rgba(34,197,94,.5)", letterSpacing: ".15em",
            }}>YES</span>
        </div>
        <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none" style={{ opacity: direction === "left" ? 1 : 0 }}>
          <span className="rounded-xl border-[4px] border-red-400 px-10 py-4 text-5xl font-black uppercase text-red-400"
            style={{ ["--stamp-rot" as string]: "15deg", ["--stamp-glow" as string]: "rgba(239,68,68,.6)",
              animation: showNoStamp ? "stamp-slam .3s cubic-bezier(.34,1.56,.64,1) both" : "none",
              transform: showNoStamp ? undefined : `scale(${0.5 + progress * 0.6}) rotate(15deg)`,
              textShadow: "0 0 40px rgba(239,68,68,.5)", letterSpacing: ".15em",
            }}>NOPE</span>
        </div>
        <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none" style={{ opacity: direction === "up" ? 1 : 0 }}>
          <span className="rounded-xl border-[4px] border-purple-400 px-8 py-3 text-4xl font-black uppercase text-purple-400"
            style={{ animation: showSkipStamp ? "stamp-slam .3s cubic-bezier(.34,1.56,.64,1) both" : "none",
              transform: showSkipStamp ? "rotate(0deg)" : `scale(${0.5 + progress * 0.6})`,
              textShadow: "0 0 40px rgba(139,92,246,.5)", letterSpacing: ".15em",
            }}>SKIP</span>
        </div>

        {/* Image */}
        <div className="w-full aspect-square relative">
          {proposal.ipfsCid ? (
            <img src={cidToHttpUrl(proposal.ipfsCid)} alt={`Proposal #${proposal.id}`}
              className="h-full w-full object-cover" draggable={false} loading="eager"
              onError={(e) => tryNextGateway(e.currentTarget, proposal.ipfsCid)} />
          ) : (
            <div className="flex h-full w-full items-center justify-center relative" style={{ background: visual.gradient }}>
              <span className="text-7xl drop-shadow-[0_0_24px_rgba(255,255,255,.2)]">{visual.symbol}</span>
            </div>
          )}
          {/* Hot badge */}
          {isHot && (
            <div className="absolute top-3 right-3 rounded-full bg-orange-500/20 border border-orange-500/30 px-2 py-0.5 text-[10px] font-bold text-orange-400 backdrop-blur-sm">
              {"\u{1F525}"} HOT
            </div>
          )}
          {/* First card hint */}
          {isFirst && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-1.5 text-white/50 text-xs pointer-events-none"
              style={{ animation: "hint-swipe 2s ease-in-out 1s both" }}>
              <span>Swipe right to approve</span>
              <span className="text-lg">&rarr;</span>
            </div>
          )}
        </div>

        {/* Card info */}
        <div className="border-t border-neutral-800 bg-neutral-900/90 px-4 py-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] uppercase tracking-wider text-neutral-500 font-semibold">Prop #{proposal.id}</span>
                {proposal.name && <span className="text-[11px] text-white/50 truncate max-w-[120px]">{proposal.name}</span>}
              </div>
              <div className="mt-0.5 font-mono text-xs text-neutral-300">{truncAddr(proposal.proposer)}</div>
            </div>
            <div className="flex flex-col items-end gap-1">
              <span className="text-[10px] text-neutral-400">Tap for details</span>
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
          background: direction === "right" ? `linear-gradient(90deg,transparent 20%,rgba(34,197,94,${progress * .9}))`
            : direction === "left" ? `linear-gradient(270deg,transparent 20%,rgba(239,68,68,${progress * .9}))`
            : direction === "up" ? `linear-gradient(to top,transparent 20%,rgba(139,92,246,${progress * .9}))`
            : "transparent",
        }} />
      </div>

      {/* Button row: Reject / Skip / Approve */}
      <div className="mt-4 flex items-center justify-center gap-5">
        <button onClick={() => { onVote(proposal.id, false); onSwipeComplete?.("left"); }}
          className="group flex items-center justify-center w-14 h-14 rounded-full border-2 border-red-500/30 bg-red-500/5 text-red-400 transition-all hover:bg-red-500/20 hover:border-red-500/60 hover:scale-110 active:scale-90"
          title="Reject (ArrowLeft)">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-6 h-6"><path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z"/></svg>
        </button>
        <button onClick={() => { onSkip(proposal.id); onSwipeComplete?.("up"); }}
          className="group flex items-center justify-center w-10 h-10 rounded-full border-2 border-purple-500/30 bg-purple-500/5 text-purple-400 transition-all hover:bg-purple-500/20 hover:border-purple-500/60 hover:scale-110 active:scale-90"
          title="Skip (Space)">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path fillRule="evenodd" d="M10 17a.75.75 0 01-.75-.75V5.612L5.29 9.77a.75.75 0 01-1.08-1.04l5.25-5.5a.75.75 0 011.08 0l5.25 5.5a.75.75 0 11-1.08 1.04l-3.96-4.158V16.25A.75.75 0 0110 17z" clipRule="evenodd"/></svg>
        </button>
        <button onClick={() => { onVote(proposal.id, true); onSwipeComplete?.("right"); }}
          className="group flex items-center justify-center w-14 h-14 rounded-full border-2 border-green-500/30 bg-green-500/5 text-green-400 transition-all hover:bg-green-500/20 hover:border-green-500/60 hover:scale-110 active:scale-90"
          title="Approve (ArrowRight)">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-6 h-6"><path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd"/></svg>
        </button>
      </div>
    </div>
  );
}

/* ═══════════════════════════════ PAGE ═══════════════════════════════ */
export default function VotePage() {
  const { address, isConnected } = useAccount();
  const { disconnect, switchWallet } = useSwitchWallet();
  const { votingPower, multiplier, tierName, isLoading: powerLoading } = useSwipeVotingPower();
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"active" | "completed" | "history">("active");
  const [proposals, setProposals] = useState<SwipeProposal[]>([]);
  const [votedIds, setVotedIds] = useState<Set<number>>(new Set());
  const [voteChoices, setVoteChoices] = useState<Map<number, boolean>>(new Map());
  const [skippedIds, setSkippedIds] = useState<Set<number>>(new Set());
  const votedIdsRef = useRef(votedIds);
  votedIdsRef.current = votedIds;

  // Batch mode
  const [pendingDecisions, setPendingDecisions] = useState<Map<number, boolean>>(new Map());
  const [batchSigning, setBatchSigning] = useState(false);
  const [batchProgress, setBatchProgress] = useState({ signed: 0, total: 0 });
  const [txStage, setTxStage] = useState<"preparing" | "confirm" | "broadcasting" | "done">("preparing");
  const [txHashes, setTxHashes] = useState<string[]>([]);

  // Victory state
  const [showVictory, setShowVictory] = useState(false);
  const [victoryCount, setVictoryCount] = useState(0);

  // Detail drawer
  const [drawerProposal, setDrawerProposal] = useState<SwipeProposal | null>(null);

  // Undo state
  const [lastVotedId, setLastVotedId] = useState<number | null>(null);
  const [showUndo, setShowUndo] = useState(false);

  // Effects state
  const [sessionVoteCount, setSessionVoteCount] = useState(0);
  const [particleDir, setParticleDir] = useState<"left" | "right" | "up" | null>(null);
  const [particleTrigger, setParticleTrigger] = useState(0);
  const [streakTrigger, setStreakTrigger] = useState(0);
  const [cardKey, setCardKey] = useState(0);
  const [shaking, setShaking] = useState(false);
  const [glowDir, setGlowDir] = useState<"left" | "right" | "up" | null>(null);
  const [glowTrigger, setGlowTrigger] = useState(0);
  const [voteResultDir, setVoteResultDir] = useState<"left" | "right" | "up" | null>(null);
  const [voteResultTrigger, setVoteResultTrigger] = useState(0);
  const [isFirstCard, setIsFirstCard] = useState(true);

  useEffect(() => { injectKeyframes(); }, []);

  // Swipe complete handler
  const handleSwipeComplete = useCallback((dir: "left" | "right" | "up") => {
    if (dir === "right") playSwipeYes();
    else if (dir === "left") playSwipeNo();
    else playSkipWhoosh();

    setParticleDir(dir);
    setParticleTrigger((n) => n + 1);
    setSessionVoteCount((n) => n + 1);
    setStreakTrigger((n) => n + 1);
    setCardKey((n) => n + 1);
    setShaking(true);
    setTimeout(() => setShaking(false), 150);
    setGlowDir(dir);
    setGlowTrigger((n) => n + 1);
    setVoteResultDir(dir);
    setVoteResultTrigger((n) => n + 1);
    setIsFirstCard(false);

    // Card enter sound for next card
    setTimeout(() => playCardEnter(), 350);
  }, []);

  // Load voted IDs
  useEffect(() => { setVotedIds(getVotedIds(address)); }, [address]);

  const contractAddr = (CONTRACTS.SWIPE ?? "") as `0x${string}`;
  const hasContract = !!CONTRACTS.SWIPE;

  const { data: proposalCount } = useReadContract({
    address: contractAddr,
    abi: LOREBOARD_ABI,
    functionName: "proposalCount",
    query: { enabled: hasContract },
  });

  const refetchProposals = useCallback(async () => {
    try {
      const res = await fetch("/api/swipe/proposals");
      if (!res.ok) throw new Error("fetch failed");
      const data = await res.json();
      setProposals(data.proposals ?? []);
    } catch (err) {
      console.warn("[vote] loadProposals:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refetchProposals();
    const interval = setInterval(refetchProposals, 15_000);
    const onVis = () => { if (document.visibilityState === "visible") refetchProposals(); };
    document.addEventListener("visibilitychange", onVis);
    return () => { clearInterval(interval); document.removeEventListener("visibilitychange", onVis); };
  }, [refetchProposals]);

  useBoardEvents(useCallback(() => { refetchProposals(); }, [refetchProposals]));

  // Check on-chain hasVoted
  useEffect(() => {
    if (!address || !contractAddr || proposals.length === 0) return;
    let alive = true;
    const check = async () => {
      try {
        const { createPublicClient, http } = await import("viem");
        const client = createPublicClient({
          chain: { id: CHAIN_ID, name: "Fluent", nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 }, rpcUrls: { default: { http: [process.env.NEXT_PUBLIC_RPC_URL ?? "https://rpc.testnet.fluent.xyz"] } } },
          transport: http(),
        });
        const local = getVotedIds(address);
        for (const p of proposals) {
          try {
            const voted = await client.readContract({ address: contractAddr, abi: LOREBOARD_ABI, functionName: "hasVoted", args: [BigInt(p.id), address as `0x${string}`] }) as boolean;
            if (voted) local.add(p.id);
          } catch { /* */ }
        }
        if (!alive) return;
        saveVotedIds(address, local);
        setVotedIds(new Set(local));
      } catch { /* */ }
    };
    check();
    return () => { alive = false; };
  }, [address, contractAddr, proposals]);

  // Undo keyboard shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "z" || e.key === "Z") {
        const tag = (e.target as HTMLElement)?.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA") return;
        if (lastVotedId != null) handleUndo();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [lastVotedId]);

  const now = Math.floor(Date.now() / 1000);
  const activeProposals = proposals
    .filter((p) => !p.finalized && now < p.votingEndsAt && !votedIds.has(p.id) && !skippedIds.has(p.id))
    .concat(proposals.filter((p) => !p.finalized && now < p.votingEndsAt && !votedIds.has(p.id) && skippedIds.has(p.id)));
  const closedProposals = proposals.filter((p) => p.finalized || now >= p.votingEndsAt);
  const currentProposal = activeProposals[0] ?? null;

  const handleVote = useCallback((proposalId: number, approve: boolean) => {
    if (!isConnected || !address) { toast.error("Connect wallet to vote"); return; }
    setPendingDecisions((prev) => { const n = new Map(prev); n.set(proposalId, approve); return n; });
    setVotedIds((prev) => { const n = new Set(prev); n.add(proposalId); return n; });
    setVoteChoices((prev) => { const n = new Map(prev); n.set(proposalId, approve); return n; });
    setLastVotedId(proposalId);
    setShowUndo(true);
  }, [address, isConnected]);

  const handleSkip = useCallback((proposalId: number) => {
    setSkippedIds((prev) => { const n = new Set(prev); n.add(proposalId); return n; });
  }, []);

  const handleUndo = useCallback(() => {
    if (lastVotedId == null) return;
    playUndoWhoosh();
    setPendingDecisions((prev) => { const n = new Map(prev); n.delete(lastVotedId); return n; });
    setVotedIds((prev) => { const n = new Set(prev); n.delete(lastVotedId); return n; });
    setVoteChoices((prev) => { const n = new Map(prev); n.delete(lastVotedId); return n; });
    setLastVotedId(null);
    setShowUndo(false);
    setCardKey((n) => n + 1);
  }, [lastVotedId]);

  // Batch sign
  const handleBatchSign = useCallback(async () => {
    if (!address || !isConnected || pendingDecisions.size === 0) return;
    setBatchSigning(true);
    const entries = Array.from(pendingDecisions.entries());
    setBatchProgress({ signed: 0, total: entries.length });
    setTxStage("preparing");
    setTxHashes([]);

    let submitted = 0;
    const hashes: string[] = [];

    try {
      const walletClient = await getWalletClient();
      const { fluentTestnet } = await import("@/lib/viem");
      setTxStage("confirm");

      for (const [proposalId, approve] of entries) {
        try {
          setTxStage(submitted > 0 ? "broadcasting" : "confirm");
          const hash = await walletClient.writeContract({
            account: (walletClient.account ?? address) as `0x${string}`,
            address: contractAddr,
            abi: LOREBOARD_ABI,
            functionName: "castVote",
            args: [BigInt(proposalId), approve],
            chain: fluentTestnet,
          });
          hashes.push(hash);
          submitted++;
          setBatchProgress((prev) => ({ ...prev, signed: prev.signed + 1 }));
          setTxStage("broadcasting");
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          if (msg.includes("rejected") || msg.includes("denied") || msg.includes("cancelled")) {
            toast.error("Transaction cancelled");
            break;
          }
          toast.error(`Vote on #${proposalId} failed`);
        }
      }

      if (submitted > 0) {
        setTxStage("done");
        setTxHashes(hashes);
        saveVotedIds(address, votedIds);
        setPendingDecisions(new Map());
        refetchProposals();

        // Show victory after brief pause
        setTimeout(() => {
          setBatchSigning(false);
          setVictoryCount(submitted);
          setShowVictory(true);
        }, 600);
      } else {
        for (const [pid] of entries) {
          setVotedIds((prev) => { const n = new Set(prev); n.delete(pid); return n; });
        }
        setPendingDecisions(new Map());
        setBatchSigning(false);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Transaction failed");
      setBatchSigning(false);
    }
  }, [address, isConnected, pendingDecisions, contractAddr, votedIds, refetchProposals]);

  const totalOnChain = proposalCount !== undefined ? Number(proposalCount) : 0;

  return (
    <main className="relative bg-foid-bg text-white/90 overflow-hidden flex items-center justify-center" style={{ height: "100vh" }}>
      <div className="pointer-events-none fixed inset-0 z-0 vignette" />

      {/* Keyboard hint */}
      <KeyboardHint />

      {/* Undo pill */}
      <UndoPill visible={showUndo && lastVotedId != null} onUndo={handleUndo} />

      {/* Detail drawer */}
      {drawerProposal && (
        <DetailDrawer
          proposal={drawerProposal}
          onClose={() => setDrawerProposal(null)}
          onVote={(approve) => {
            handleVote(drawerProposal.id, approve);
            handleSwipeComplete(approve ? "right" : "left");
          }}
        />
      )}

      {/* TX overlay */}
      {batchSigning && (
        <TxOverlay stage={txStage} progress={batchProgress.signed} total={batchProgress.total} />
      )}

      {/* Victory celebration */}
      {showVictory && (
        <VictoryCelebration count={victoryCount} txHashes={txHashes} onDismiss={() => setShowVictory(false)} />
      )}

      <section className="relative z-10 w-full max-w-full px-2 sm:px-4">
        <div className="mx-auto w-full max-w-6xl">
          <div className="vista-window vista-window--terminal vista-window--enhanced h-[94vh] max-h-[94vh] w-full flex flex-col">
            <AppTitlebar title="VOTE.EXE" connected={isConnected} address={address} onDisconnect={() => disconnect()} onSwitchWallet={switchWallet} />
            <div className="vista-window__body foid-iridescent" style={{ overflow: "hidden", flex: 1, minHeight: 0, position: "relative" }}>
              <div className="p-3 md:p-4 flex flex-col h-full" style={{ minHeight: 0 }}>
                <div className="foid-focal-glow" />

                {/* Header with tabs */}
                <div className="flex-shrink-0 flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <h1 className="text-base sm:text-lg font-black uppercase tracking-[.15em] text-transparent bg-clip-text flex-shrink-0"
                      style={{ backgroundImage: "linear-gradient(135deg,rgba(168,130,255,1) 0%,rgba(255,255,255,.95) 50%,rgba(200,160,255,.9) 100%)" }}>
                      Vote
                    </h1>
                    <div className="flex gap-1">
                      {(["active", "completed", "history"] as const).map((t) => (
                        <button key={t} onClick={() => setTab(t)}
                          className={`rounded-full px-2 sm:px-3 py-0.5 text-[9px] sm:text-[10px] font-semibold uppercase tracking-wider transition ${
                            tab === t ? "bg-purple-600/30 text-purple-300 ring-1 ring-purple-500/40" : "text-white/35 hover:text-white/60"
                          }`}>
                          {t === "active" ? `Live (${activeProposals.length})` : t === "completed" ? `Closed (${closedProposals.length})` : `My Votes (${votedIds.size})`}
                        </button>
                      ))}
                    </div>
                    {totalOnChain > 0 && <span className="hidden sm:inline text-[10px] text-white/25">{totalOnChain} on-chain</span>}
                  </div>
                </div>

                {/* Main content */}
                {loading ? (
                  <div className="flex flex-1 items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-2 border-purple-500 border-t-transparent" /></div>
                ) : tab === "active" ? (
                  currentProposal ? (
                    <div className="flex flex-col flex-1 min-h-0 items-center justify-center gap-2 relative"
                      style={shaking ? { animation: "swipe-shake 150ms ease-in-out" } : undefined}>
                      <GlowFlash direction={glowDir} trigger={glowTrigger} />
                      <SwipeParticles direction={particleDir} trigger={particleTrigger} />
                      <StreakBadge count={sessionVoteCount} trigger={streakTrigger} />
                      <VoteResultText direction={voteResultDir} trigger={voteResultTrigger} />
                      <SwipeCard
                        proposal={currentProposal}
                        onVote={handleVote}
                        onSkip={handleSkip}
                        nextProposal={activeProposals[1] ?? null}
                        onSwipeComplete={handleSwipeComplete}
                        cardKey={cardKey}
                        onTap={() => setDrawerProposal(currentProposal)}
                        isFirst={isFirstCard}
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
                    /* ─── Batch review ─── */
                    <div className="flex flex-col flex-1 min-h-0 items-center justify-center text-center px-4">
                      <div className="w-full max-w-sm">
                        <h2 className="text-lg font-bold text-white/80 mb-3">Review your votes</h2>

                        {/* Summary tally bar */}
                        <div className="mb-3 rounded-lg bg-white/5 p-2">
                          {(() => {
                            const yesCount = Array.from(pendingDecisions.values()).filter(Boolean).length;
                            const noCount = pendingDecisions.size - yesCount;
                            const total = pendingDecisions.size;
                            return (
                              <div className="flex items-center gap-2 text-[10px]">
                                <span className="text-green-400 font-bold">{yesCount} YES</span>
                                <div className="flex-1 h-1.5 rounded-full bg-neutral-800 overflow-hidden">
                                  <div className="h-full bg-green-500 transition-all duration-300 rounded-full" style={{ width: `${total > 0 ? (yesCount / total) * 100 : 0}%` }} />
                                </div>
                                <span className="text-red-400 font-bold">{noCount} NO</span>
                              </div>
                            );
                          })()}
                        </div>

                        <div className="space-y-2 max-h-[32vh] sm:max-h-[40vh] overflow-auto mb-4">
                          {Array.from(pendingDecisions.entries()).map(([pid, approve]) => {
                            const p = proposals.find((pp) => pp.id === pid);
                            return (
                              <div key={pid} className="flex items-center gap-3 rounded-lg border border-neutral-800 bg-neutral-900/60 px-3 py-2 group">
                                {p?.ipfsCid ? (
                                  <img src={cidToHttpUrl(p.ipfsCid)} alt="" className="w-10 h-10 rounded object-cover flex-shrink-0" />
                                ) : (
                                  <div className="w-10 h-10 rounded bg-neutral-800 flex-shrink-0" />
                                )}
                                <span className="text-xs text-white/50 flex-shrink-0">#{pid}</span>
                                <span className="flex-1" />
                                {/* Tap to toggle YES/NO */}
                                <button
                                  onClick={() => {
                                    setPendingDecisions((prev) => { const n = new Map(prev); n.set(pid, !approve); return n; });
                                    setVoteChoices((prev) => { const n = new Map(prev); n.set(pid, !approve); return n; });
                                  }}
                                  className={`text-xs font-bold uppercase px-3 py-1 rounded-full transition-colors ${
                                    approve ? "bg-green-500/20 text-green-400 hover:bg-green-500/30" : "bg-red-500/20 text-red-400 hover:bg-red-500/30"
                                  }`}
                                  title="Click to toggle"
                                >{approve ? "YES" : "NO"}</button>
                                <button
                                  onClick={() => {
                                    setPendingDecisions((prev) => { const n = new Map(prev); n.delete(pid); return n; });
                                    setVotedIds((prev) => { const n = new Set(prev); n.delete(pid); return n; });
                                  }}
                                  className="text-white/20 hover:text-white/60 text-xs ml-1 opacity-0 group-hover:opacity-100 transition-opacity"
                                  title="Remove">&#x2715;</button>
                              </div>
                            );
                          })}
                        </div>

                        <div className="text-xs text-white/40 mb-3">
                          {multiplier > 0 && !powerLoading && (
                            <span className="text-purple-400">
                              {multiplier.toFixed(1)}x weight{tierName ? ` (${tierName})` : ""}
                            </span>
                          )}
                        </div>

                        <button onClick={handleBatchSign} disabled={batchSigning}
                          className="w-full rounded-lg py-3 text-sm font-bold uppercase tracking-wider transition touch-manipulation min-h-[48px] relative overflow-hidden"
                          style={{
                            background: batchSigning ? "linear-gradient(135deg,#555,#444)" : "linear-gradient(135deg,#e040fb,#f06292)",
                          }}>
                          {/* Shimmer overlay */}
                          {!batchSigning && (
                            <div className="absolute inset-0 opacity-30" style={{
                              background: "linear-gradient(90deg,transparent 0%,rgba(255,255,255,.4) 50%,transparent 100%)",
                              backgroundSize: "200% 100%",
                              animation: "shimmer 2s linear infinite",
                            }} />
                          )}
                          <span className="relative z-10">
                            {batchSigning
                              ? `Submitting vote ${batchProgress.signed + 1} of ${batchProgress.total}...`
                              : `Vote All (${pendingDecisions.size} vote${pendingDecisions.size !== 1 ? "s" : ""})`}
                          </span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* ─── All caught up ─── */
                    <div className="flex flex-col flex-1 min-h-0 items-center justify-center text-center px-4">
                      <Confetti active={sessionVoteCount >= 5} />
                      <div className="relative mb-6">
                        <div className="text-6xl" style={{
                          filter: "drop-shadow(0 0 20px rgba(168,130,255,.4))",
                          animation: "float-sword 3s ease-in-out infinite",
                        }}>&#x2694;&#xFE0F;</div>
                        <div className="absolute inset-0 rounded-full" style={{ background: "radial-gradient(circle,rgba(168,130,255,.15) 0%,transparent 70%)", filter: "blur(20px)" }} />
                      </div>
                      <h2 className="text-lg font-bold tracking-wide text-white/85">
                        {proposals.some((p) => !p.finalized && now < p.votingEndsAt) ? "All caught up!" : "No active proposals"}
                      </h2>
                      <p className="mt-2 max-w-xs text-sm leading-relaxed text-white/45">
                        {proposals.some((p) => !p.finalized && now < p.votingEndsAt)
                          ? "You've voted on every proposal. Check back soon."
                          : "The voting queue is empty. Head to the Loreboard to propose an image."}
                      </p>
                      {/* Session stats */}
                      {sessionVoteCount > 0 && (
                        <div className="mt-3 rounded-full bg-purple-500/10 border border-purple-500/20 px-4 py-1.5 text-xs text-purple-300">
                          {sessionVoteCount} vote{sessionVoteCount !== 1 ? "s" : ""} this session
                          {sessionVoteCount >= 5 && " \u{1F525}"}
                        </div>
                      )}
                      <div className="mt-5 flex gap-3">
                        <Link href="/board"
                          className="inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold tracking-wide transition hover:scale-[1.03]"
                          style={{ background: "linear-gradient(135deg,rgba(168,130,255,.2),rgba(255,107,213,.2))", border: "1px solid rgba(168,130,255,.3)", color: "rgba(200,170,255,.95)" }}>
                          Go to Loreboard <span>&rarr;</span>
                        </Link>
                        <Link href="/vote/submit"
                          className="inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold tracking-wide transition hover:scale-[1.03] text-white/50 border border-white/10 hover:border-white/20">
                          Propose
                        </Link>
                      </div>
                    </div>
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
                            className="group block rounded-xl border border-neutral-800 bg-neutral-900/40 p-2 transition hover:border-purple-500/30">
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
                                }`}>{proposal.approved ? "Canonized" : "Rejected"}</span>
                              </div>
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
                            <div className="mt-2 rounded-lg bg-neutral-800/60 px-2.5 py-1.5">
                              <div className="flex items-center justify-between mb-1">
                                <div className="flex items-center gap-2">
                                  <span className="text-green-400 text-[10px] font-bold">{forC}Y</span>
                                  <span className="text-white/20 text-[9px]">vs</span>
                                  <span className="text-red-400 text-[10px] font-bold">{againstC}N</span>
                                </div>
                                {total > 0 && <span className={`text-[9px] font-semibold ${passing ? "text-green-400" : "text-red-400"}`}>{pct}%</span>}
                              </div>
                              <div className="relative flex h-1.5 overflow-hidden rounded-full bg-neutral-700/50">
                                {total > 0 ? (
                                  <>
                                    <div className="bg-green-500 transition-all duration-300" style={{ width: `${(forC / total) * 100}%` }} />
                                    <div className="bg-red-500 transition-all duration-300" style={{ width: `${(againstC / total) * 100}%` }} />
                                  </>
                                ) : <div className="flex-1 bg-neutral-600/40" />}
                                <div className="absolute top-0 bottom-0 w-px bg-white/30" style={{ left: "51%" }} />
                              </div>
                            </div>
                            <div className="mt-1.5 flex items-center justify-between text-[10px] text-neutral-400">
                              <span className="font-mono">{truncAddr(proposal.proposer)}</span>
                              {proposal.approved && <span className="text-green-400">On Board &rarr;</span>}
                            </div>
                          </Link>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="flex flex-col flex-1 min-h-0 items-center justify-center text-center">
                      <div className="mb-3 text-4xl opacity-30">&#x2694;</div>
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
                                    <span className="inline-block h-1 w-1 rounded-full bg-purple-400 animate-pulse mr-1 align-middle" />Live
                                  </span>
                                ) : null}
                              </div>
                            </div>
                            <div className="overflow-hidden rounded-lg bg-neutral-800/50">
                              <div className="aspect-square max-h-[160px]">
                                {proposal.ipfsCid ? (
                                  <img src={cidToHttpUrl(proposal.ipfsCid)} alt={`#${proposal.id}`} className="h-full w-full object-cover" loading="lazy" onError={(e) => tryNextGateway(e.currentTarget, proposal.ipfsCid)} />
                                ) : (
                                  <div className="flex h-full items-center justify-center" style={{ background: CARD_VISUALS[proposal.id % CARD_VISUALS.length].gradient }}>
                                    <span className="text-xl">{CARD_VISUALS[proposal.id % CARD_VISUALS.length].symbol}</span>
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
                              <div className="relative flex h-2 overflow-hidden rounded-full bg-neutral-700/50">
                                {total > 0 ? (
                                  <>
                                    <div className="bg-green-500 transition-all duration-300 rounded-l-full" style={{ width: `${(forC / total) * 100}%` }} />
                                    <div className="bg-red-500 transition-all duration-300 rounded-r-full" style={{ width: `${(againstC / total) * 100}%` }} />
                                  </>
                                ) : <div className="flex-1 bg-neutral-600/40 rounded-full" />}
                                <div className="absolute top-0 bottom-0 w-px bg-white/40" style={{ left: "51%" }} />
                              </div>
                            </div>
                            <div className="mt-1.5 flex items-center justify-between text-[10px] text-neutral-400">
                              <span className="font-mono">{truncAddr(proposal.proposer)}</span>
                              {proposal.approved && <span className="text-green-400">On Board</span>}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="flex flex-col flex-1 min-h-0 items-center justify-center text-center px-4">
                      <div className="mb-3 text-4xl opacity-30">&#x1F5F3;</div>
                      <h2 className="text-base font-medium text-white/70">No votes yet</h2>
                      <p className="mt-2 text-sm text-white/40">Swipe on proposals in the Live tab to start voting.</p>
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
