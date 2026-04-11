"use client";

import type { SwipeProposal } from "@/types/vote";
import { cidToHttpUrl } from "@/lib/ipfsUrl";

type BatchReviewProps = {
  pendingDecisions: Map<number, boolean>;
  proposals: SwipeProposal[];
  multiplier: number;
  tierName: string | null;
  powerLoading: boolean;
  batchSigning: boolean;
  batchProgress: { signed: number; total: number };
  onToggleVote: (pid: number) => void;
  onRemoveVote: (pid: number) => void;
  onBatchSign: () => void;
};

export function BatchReview({
  pendingDecisions, proposals, multiplier, tierName, powerLoading,
  batchSigning, batchProgress, onToggleVote, onRemoveVote, onBatchSign,
}: BatchReviewProps) {
  const yesCount = Array.from(pendingDecisions.values()).filter(Boolean).length;
  const noCount = pendingDecisions.size - yesCount;
  const total = pendingDecisions.size;

  return (
    <div className="flex flex-col flex-1 min-h-0 items-center justify-center text-center px-4">
      <div className="w-full max-w-sm">
        <h2 className="text-lg font-bold text-white/80 mb-3">Review your votes</h2>

        {/* Summary tally bar */}
        <div className="mb-3 rounded-lg bg-white/5 p-2" role="group" aria-label="Vote summary">
          <div className="flex items-center gap-2 text-[10px]">
            <span className="text-green-400 font-bold">{yesCount} YES</span>
            <div
              className="flex-1 h-1.5 rounded-full bg-neutral-800 overflow-hidden"
              role="progressbar"
              aria-valuenow={total > 0 ? Math.round((yesCount / total) * 100) : 0}
              aria-valuemax={100}
              aria-label={`${yesCount} yes out of ${total} votes`}
            >
              <div className="h-full bg-green-500 transition-all duration-300 rounded-full" style={{ width: `${total > 0 ? (yesCount / total) * 100 : 0}%` }} />
            </div>
            <span className="text-red-400 font-bold">{noCount} NO</span>
          </div>
        </div>

        <div className="space-y-2 max-h-[32vh] sm:max-h-[40vh] overflow-auto mb-4" role="list" aria-label="Pending votes">
          {Array.from(pendingDecisions.entries()).map(([pid, approve]) => {
            const p = proposals.find((pp) => pp.id === pid);
            return (
              <div key={pid} className="flex items-center gap-3 rounded-lg border border-neutral-800 bg-neutral-900/60 px-3 py-2 group" role="listitem">
                {p?.ipfsCid ? (
                  <img src={cidToHttpUrl(p.ipfsCid)} alt="" className="w-10 h-10 rounded object-cover flex-shrink-0" />
                ) : (
                  <div className="w-10 h-10 rounded bg-neutral-800 flex-shrink-0" />
                )}
                <span className="text-xs text-white/50 flex-shrink-0">#{pid}</span>
                <span className="flex-1" />
                <button
                  onClick={() => onToggleVote(pid)}
                  className={`text-xs font-bold uppercase px-3 py-1 rounded-full transition-colors ${
                    approve ? "bg-green-500/20 text-green-400 hover:bg-green-500/30" : "bg-red-500/20 text-red-400 hover:bg-red-500/30"
                  }`}
                  aria-label={`Toggle vote for proposal ${pid}, currently ${approve ? "yes" : "no"}`}
                  title="Click to toggle"
                >{approve ? "YES" : "NO"}</button>
                <button
                  onClick={() => onRemoveVote(pid)}
                  className="text-white/20 hover:text-white/60 text-xs ml-1 opacity-0 group-hover:opacity-100 transition-opacity"
                  aria-label={`Remove vote for proposal ${pid}`}
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

        <button onClick={onBatchSign} disabled={batchSigning}
          aria-label={batchSigning ? `Submitting vote ${batchProgress.signed + 1} of ${batchProgress.total}` : `Submit all ${pendingDecisions.size} votes`}
          className="w-full rounded-lg py-3 text-sm font-bold uppercase tracking-wider transition touch-manipulation min-h-[48px] relative overflow-hidden"
          style={{
            background: batchSigning ? "linear-gradient(135deg,#555,#444)" : "linear-gradient(135deg,#e040fb,#f06292)",
          }}>
          {!batchSigning && (
            <div aria-hidden="true" className="absolute inset-0 opacity-30" style={{
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
  );
}
