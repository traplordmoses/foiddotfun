"use client";

import { useEffect, useRef } from "react";
import type { SwipeProposal } from "@/types/vote";
import { cidToHttpUrl } from "@/lib/ipfsUrl";
import { tryNextGateway, truncateAddress, CARD_VISUALS } from "@/lib/swipeConstants";
import { useCountdown } from "@/hooks/useCountdown";

export function DetailDrawer({ proposal, onClose, onVote }: { proposal: SwipeProposal; onClose: () => void; onVote: (approve: boolean) => void }) {
  const timeLeft = useCountdown(proposal.votingEndsAt);
  const total = proposal.forCount + proposal.againstCount;
  const pct = total > 0 ? Math.round((proposal.forCount / total) * 100) : 0;
  const now = Math.floor(Date.now() / 1000);
  const totalDuration = proposal.votingEndsAt - proposal.createdAt;
  const elapsed = now - proposal.createdAt;
  const ringProgress = totalDuration > 0 ? Math.min(1, elapsed / totalDuration) : 1;
  const circumference = 2 * Math.PI * 38;
  const titleId = `drawer-title-${proposal.id}`;
  const firstFocusRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  // Focus trap: focus first button on mount
  useEffect(() => {
    firstFocusRef.current?.focus();
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby={titleId}>
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
                <span className="text-6xl" aria-hidden="true">{CARD_VISUALS[proposal.id % CARD_VISUALS.length].symbol}</span>
              </div>
            )}
          </div>
        </div>

        {/* Info */}
        <div className="px-4 py-4 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 id={titleId} className="text-base font-bold text-white/90">
                {proposal.name || `Proposal #${proposal.id}`}
              </h3>
              <p className="mt-0.5 font-mono text-xs text-white/40">{truncateAddress(proposal.proposer)}</p>
            </div>
            {/* Countdown ring */}
            <div className="relative w-16 h-16 flex items-center justify-center flex-shrink-0" aria-label={`Time remaining: ${timeLeft}`}>
              <svg width="80" height="80" viewBox="0 0 80 80" className="absolute inset-0 -rotate-90" aria-hidden="true">
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
          <div className="rounded-xl bg-white/5 border border-white/8 p-3" role="group" aria-label="Current vote tally">
            <div className="flex items-center justify-between mb-2 text-xs">
              <span className="text-green-400 font-bold">{proposal.forCount} for</span>
              <span className="text-white/40">{total > 0 ? `${pct}%` : "No votes yet"}</span>
              <span className="text-red-400 font-bold">{proposal.againstCount} against</span>
            </div>
            <div
              className="relative flex h-2 overflow-hidden rounded-full bg-neutral-800"
              role="progressbar"
              aria-valuenow={pct}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`${pct}% approval`}
            >
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
              ref={firstFocusRef}
              onClick={() => { onVote(false); onClose(); }}
              aria-label="Reject this proposal"
              className="flex-1 rounded-xl py-3 text-sm font-bold uppercase tracking-wider border-2 border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20 transition active:scale-95"
            >Reject</button>
            <button
              onClick={() => { onVote(true); onClose(); }}
              aria-label="Approve this proposal"
              className="flex-1 rounded-xl py-3 text-sm font-bold uppercase tracking-wider border-2 border-green-500/30 bg-green-500/10 text-green-400 hover:bg-green-500/20 transition active:scale-95"
            >Approve</button>
          </div>
        </div>
      </div>
    </div>
  );
}
