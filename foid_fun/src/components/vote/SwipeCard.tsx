"use client";

import type { SwipeProposal } from "@/types/vote";
import { cidToHttpUrl } from "@/lib/ipfsUrl";
import { tryNextGateway, truncateAddress, CARD_VISUALS } from "@/lib/swipeConstants";
import { useSwipeVote } from "@/hooks/useSwipeVote";
import { useCountdown } from "@/hooks/useCountdown";
import { VoteBar } from "./VoteBar";

export function SwipeCard({
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
      <div aria-hidden="true" className="absolute inset-0 rounded-2xl bg-neutral-900/30" style={{
        transform: `scale(${0.88 + progress * 0.02}) translateY(${20 - progress * 6}px)`,
        transition: isDragging ? "none" : "transform 0.4s ease", zIndex: -2,
      }} />
      <div aria-hidden="true" className="absolute inset-0 rounded-2xl bg-neutral-900/50" style={{
        transform: `scale(${0.92 + progress * 0.03}) translateY(${14 - progress * 5}px)`,
        transition: isDragging ? "none" : "transform 0.35s ease", zIndex: -1,
      }} />

      {/* Next card peek */}
      {nextProposal && (
        <div aria-hidden="true" className="absolute inset-0 rounded-2xl border border-neutral-800 bg-neutral-900/70 overflow-hidden" style={{
          transform: `scale(${0.95 + progress * 0.03}) translateY(${8 - progress * 6}px)`,
          transition: isDragging ? "none" : "transform 0.3s ease", zIndex: 0,
        }}>
          <div className="w-full aspect-square">
            {nextProposal.ipfsCid ? (
              <img src={cidToHttpUrl(nextProposal.ipfsCid)} alt="" className="h-full w-full object-cover opacity-40" draggable={false} loading="lazy" />
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
          ...style, touchAction: "none", zIndex: 1, position: "relative",
          animation: phase !== "exiting" && !isDragging ? "card-enter 400ms cubic-bezier(0.34,1.56,0.64,1) both" : undefined,
          border: `2px solid ${sentimentColor}20`,
        }}
        className="relative rounded-2xl bg-neutral-900/95 overflow-hidden select-none"
        role="article"
        aria-roledescription="swipeable card"
        aria-label={`Proposal ${proposal.id} by ${truncateAddress(proposal.proposer)}`}
      >
        {/* Sentiment glow ring */}
        <div aria-hidden="true" className="absolute inset-0 rounded-2xl pointer-events-none z-0" style={{
          boxShadow: `inset 0 0 20px ${sentimentColor}15, 0 0 15px ${sentimentColor}10`,
        }} />

        {/* Direction glows */}
        <div aria-hidden="true" className="absolute inset-0 z-10 pointer-events-none rounded-2xl" style={{
          background: `linear-gradient(135deg,rgba(34,197,94,${yesOpacity}) 0%,transparent 50%)`,
          boxShadow: edgeGlowYes > 0.3 ? `inset 0 0 ${edgeGlowYes * 60}px rgba(34,197,94,${edgeGlowYes * 0.3})` : "none",
        }} />
        <div aria-hidden="true" className="absolute inset-0 z-10 pointer-events-none rounded-2xl" style={{
          background: `linear-gradient(225deg,rgba(239,68,68,${noOpacity}) 0%,transparent 50%)`,
          boxShadow: edgeGlowNo > 0.3 ? `inset 0 0 ${edgeGlowNo * 60}px rgba(239,68,68,${edgeGlowNo * 0.3})` : "none",
        }} />
        <div aria-hidden="true" className="absolute inset-0 z-10 pointer-events-none rounded-2xl" style={{
          background: `linear-gradient(to top,transparent 50%,rgba(139,92,246,${skipOpacity}) 100%)`,
        }} />

        {/* Stamps */}
        <div aria-hidden="true" className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none" style={{ opacity: direction === "right" ? 1 : 0 }}>
          <span className="rounded-xl border-[4px] border-green-400 px-10 py-4 text-5xl font-black uppercase text-green-400"
            style={{ "--stamp-rot": "-15deg", "--stamp-glow": "rgba(34,197,94,.6)",
              animation: showYesStamp ? "stamp-slam .3s cubic-bezier(.34,1.56,.64,1) both" : "none",
              transform: showYesStamp ? undefined : `scale(${0.5 + progress * 0.6}) rotate(-15deg)`,
              textShadow: "0 0 40px rgba(34,197,94,.5)", letterSpacing: ".15em",
            } as React.CSSProperties}>YES</span>
        </div>
        <div aria-hidden="true" className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none" style={{ opacity: direction === "left" ? 1 : 0 }}>
          <span className="rounded-xl border-[4px] border-red-400 px-10 py-4 text-5xl font-black uppercase text-red-400"
            style={{ "--stamp-rot": "15deg", "--stamp-glow": "rgba(239,68,68,.6)",
              animation: showNoStamp ? "stamp-slam .3s cubic-bezier(.34,1.56,.64,1) both" : "none",
              transform: showNoStamp ? undefined : `scale(${0.5 + progress * 0.6}) rotate(15deg)`,
              textShadow: "0 0 40px rgba(239,68,68,.5)", letterSpacing: ".15em",
            } as React.CSSProperties}>NOPE</span>
        </div>
        <div aria-hidden="true" className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none" style={{ opacity: direction === "up" ? 1 : 0 }}>
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
              <span className="text-7xl drop-shadow-[0_0_24px_rgba(255,255,255,.2)]" aria-hidden="true">{visual.symbol}</span>
            </div>
          )}
          {isHot && (
            <div className="absolute top-3 right-3 rounded-full bg-orange-500/20 border border-orange-500/30 px-2 py-0.5 text-[10px] font-bold text-orange-400 backdrop-blur-sm">
              <span aria-hidden="true">{"\u{1F525}"}</span> HOT
            </div>
          )}
          {isFirst && (
            <div aria-hidden="true" className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-1.5 text-white/50 text-xs pointer-events-none"
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
              <div className="mt-0.5 font-mono text-xs text-neutral-300">{truncateAddress(proposal.proposer)}</div>
            </div>
            <div className="flex flex-col items-end gap-1">
              <span className="text-[10px] text-neutral-400">Tap for details</span>
              {timeLeft && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-purple-500/15 px-2.5 py-1 text-[10px] font-semibold text-purple-300 ring-1 ring-purple-500/25">
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-purple-400 animate-pulse" aria-hidden="true" />
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
        <div aria-hidden="true" className="absolute bottom-0 left-0 right-0 h-1.5 z-20" style={{
          background: direction === "right" ? `linear-gradient(90deg,transparent 20%,rgba(34,197,94,${progress * .9}))`
            : direction === "left" ? `linear-gradient(270deg,transparent 20%,rgba(239,68,68,${progress * .9}))`
            : direction === "up" ? `linear-gradient(to top,transparent 20%,rgba(139,92,246,${progress * .9}))`
            : "transparent",
        }} />
      </div>

      {/* Button row: Reject / Skip / Approve */}
      <div className="mt-4 flex items-center justify-center gap-5">
        <button onClick={() => { onVote(proposal.id, false); onSwipeComplete?.("left"); }}
          aria-label="Reject proposal"
          aria-keyshortcuts="ArrowLeft"
          className="group flex items-center justify-center w-14 h-14 rounded-full border-2 border-red-500/30 bg-red-500/5 text-red-400 transition-all hover:bg-red-500/20 hover:border-red-500/60 hover:scale-110 active:scale-90"
          title="Reject (ArrowLeft)">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-6 h-6" aria-hidden="true"><path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z"/></svg>
        </button>
        <button onClick={() => { onSkip(proposal.id); onSwipeComplete?.("up"); }}
          aria-label="Skip proposal"
          aria-keyshortcuts="Space"
          className="group flex items-center justify-center w-11 h-11 rounded-full border-2 border-purple-500/30 bg-purple-500/5 text-purple-400 transition-all hover:bg-purple-500/20 hover:border-purple-500/60 hover:scale-110 active:scale-90"
          title="Skip (Space)">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4" aria-hidden="true"><path fillRule="evenodd" d="M10 17a.75.75 0 01-.75-.75V5.612L5.29 9.77a.75.75 0 01-1.08-1.04l5.25-5.5a.75.75 0 011.08 0l5.25 5.5a.75.75 0 11-1.08 1.04l-3.96-4.158V16.25A.75.75 0 0110 17z" clipRule="evenodd"/></svg>
        </button>
        <button onClick={() => { onVote(proposal.id, true); onSwipeComplete?.("right"); }}
          aria-label="Approve proposal"
          aria-keyshortcuts="ArrowRight"
          className="group flex items-center justify-center w-14 h-14 rounded-full border-2 border-green-500/30 bg-green-500/5 text-green-400 transition-all hover:bg-green-500/20 hover:border-green-500/60 hover:scale-110 active:scale-90"
          title="Approve (ArrowRight)">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-6 h-6" aria-hidden="true"><path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd"/></svg>
        </button>
      </div>
    </div>
  );
}
