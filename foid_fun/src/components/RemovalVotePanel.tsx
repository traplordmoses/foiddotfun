"use client";

import { useCallback, useState } from "react";
import { useAccount } from "wagmi";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import {
  useSwipeLoreboardGovernance,
  useActivePlacementVote,
  usePlacementRemovalVote,
  useHasVotedOnPlacementRemoval,
  type RemovalVote,
} from "@/hooks/useSwipeLoreboardGovernance";
import { parseWeb3Error, isUserRejection } from "@/lib/errors";

type Props = {
  /** Placement IDs (numeric strings) to check for active removal votes */
  placementIds: string[];
};

/* ── Single removal vote card ─────────────────────────────────────── */

function VoteCard({
  placementId,
  voteId,
}: {
  placementId: string;
  voteId: number;
}) {
  const { address, isConnected } = useAccount();
  const { openConnectModal } = useConnectModal();
  const { vote, isLoading } = usePlacementRemovalVote(voteId);
  const hasVoted = useHasVotedOnPlacementRemoval(voteId);
  const { voteOnRemoval, resolveRemovalVote } = useSwipeLoreboardGovernance();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleVote = useCallback(async (support: boolean) => {
    if (!isConnected) { openConnectModal?.(); return; }
    setBusy(true);
    setError(null);
    try {
      await voteOnRemoval(voteId, support);
    } catch (err) {
      if (!isUserRejection(err)) setError(parseWeb3Error(err).message);
    } finally {
      setBusy(false);
    }
  }, [isConnected, openConnectModal, voteOnRemoval, voteId]);

  const handleResolve = useCallback(async () => {
    if (!isConnected) { openConnectModal?.(); return; }
    setBusy(true);
    setError(null);
    try {
      await resolveRemovalVote(voteId);
    } catch (err) {
      if (!isUserRejection(err)) setError(parseWeb3Error(err).message);
    } finally {
      setBusy(false);
    }
  }, [isConnected, openConnectModal, resolveRemovalVote, voteId]);

  if (isLoading || !vote) return null;

  const v = vote as RemovalVote;
  const votesFor = Number(v.votesFor);
  const votesAgainst = Number(v.votesAgainst);
  const total = votesFor + votesAgainst;
  const pct = total > 0 ? (votesFor / total) * 100 : 50;
  const endsAt = Number(v.endsAt);
  const now = Math.floor(Date.now() / 1000);
  const isEnded = now >= endsAt;
  const isResolved = v.resolved;

  // Time remaining
  let timeLabel = "";
  if (isResolved) {
    timeLabel = v.removalPassed ? "REMOVED" : "KEPT";
  } else if (isEnded) {
    timeLabel = "VOTE ENDED";
  } else {
    const left = endsAt - now;
    if (left < 3600) timeLabel = `${Math.floor(left / 60)}m left`;
    else if (left < 86400) timeLabel = `${Math.floor(left / 3600)}h left`;
    else timeLabel = `${Math.floor(left / 86400)}d left`;
  }

  return (
    <>
      <div className="rv-card">
        <div className="rv-card__header">
          <span className="rv-card__label">PLACEMENT #{placementId}</span>
          <span className={`rv-card__status ${isResolved ? (v.removalPassed ? "rv-card__status--removed" : "rv-card__status--kept") : "rv-card__status--active"}`}>
            {timeLabel}
          </span>
        </div>

        {/* Progress bar */}
        <div className="rv-card__bar">
          <div className="rv-card__bar-fill" style={{ width: `${pct}%` }} />
        </div>
        <div className="rv-card__bar-labels">
          <span>{votesFor} remove</span>
          <span>{votesAgainst} keep</span>
        </div>

        {/* Actions */}
        {!isResolved && !hasVoted && !isEnded && (
          <div className="rv-card__actions">
            <button
              type="button"
              className="rv-card__btn rv-card__btn--remove"
              onClick={() => void handleVote(true)}
              disabled={busy}
            >
              {busy ? "..." : "VOTE REMOVE"}
            </button>
            <button
              type="button"
              className="rv-card__btn rv-card__btn--keep"
              onClick={() => void handleVote(false)}
              disabled={busy}
            >
              {busy ? "..." : "VOTE KEEP"}
            </button>
          </div>
        )}

        {hasVoted && !isResolved && (
          <div className="rv-card__voted">You voted</div>
        )}

        {isEnded && !isResolved && (
          <button
            type="button"
            className="rv-card__btn rv-card__btn--resolve"
            onClick={() => void handleResolve()}
            disabled={busy}
          >
            {busy ? "RESOLVING..." : "RESOLVE VOTE"}
          </button>
        )}

        {error && <div className="rv-card__error">{error}</div>}
      </div>
      <style jsx>{`
        .rv-card {
          padding: 10px 12px;
          border-radius: 10px;
          background: rgba(239,68,68,0.04);
          border: 1px solid rgba(239,68,68,0.15);
        }
        .rv-card__header {
          display: flex; justify-content: space-between; align-items: center;
          margin-bottom: 8px;
        }
        .rv-card__label {
          font-family: var(--font-terminal, monospace);
          font-size: 11px; font-weight: 700;
          letter-spacing: 0.15em; color: rgba(255,255,255,0.6);
        }
        .rv-card__status {
          font-family: var(--font-terminal, monospace);
          font-size: 10px; font-weight: 700;
          letter-spacing: 0.1em; padding: 3px 8px;
          border-radius: 4px;
        }
        .rv-card__status--active {
          background: rgba(245,158,11,0.15); color: rgba(245,158,11,0.9);
        }
        .rv-card__status--removed {
          background: rgba(239,68,68,0.15); color: rgba(239,68,68,0.9);
        }
        .rv-card__status--kept {
          background: rgba(34,197,94,0.15); color: rgba(34,197,94,0.9);
        }
        .rv-card__bar {
          height: 6px; border-radius: 3px;
          background: rgba(255,255,255,0.08);
          overflow: hidden;
        }
        .rv-card__bar-fill {
          height: 100%; border-radius: 2px;
          background: linear-gradient(90deg, rgba(239,68,68,0.7), rgba(245,158,11,0.7));
          transition: width 300ms ease;
        }
        .rv-card__bar-labels {
          display: flex; justify-content: space-between;
          font-family: var(--font-terminal, monospace);
          font-size: 10px; color: rgba(255,255,255,0.35);
          margin-top: 4px;
        }
        .rv-card__actions {
          display: flex; gap: 6px; margin-top: 8px;
        }
        .rv-card__btn {
          flex: 1; padding: 8px 0; border-radius: 8px;
          font-family: var(--font-terminal, monospace);
          font-size: 11px; font-weight: 700;
          letter-spacing: 0.1em; cursor: pointer;
          transition: all 150ms;
        }
        .rv-card__btn--remove {
          background: rgba(239,68,68,0.12);
          border: 1px solid rgba(239,68,68,0.35);
          color: rgba(239,68,68,0.9);
        }
        .rv-card__btn--remove:hover { background: rgba(239,68,68,0.2); }
        .rv-card__btn--keep {
          background: rgba(34,197,94,0.12);
          border: 1px solid rgba(34,197,94,0.35);
          color: rgba(34,197,94,0.9);
        }
        .rv-card__btn--keep:hover { background: rgba(34,197,94,0.2); }
        .rv-card__btn--resolve {
          width: 100%; margin-top: 8px;
          background: rgba(245,158,11,0.12);
          border: 1px solid rgba(245,158,11,0.35);
          color: rgba(245,158,11,0.9);
        }
        .rv-card__btn--resolve:hover { background: rgba(245,158,11,0.2); }
        .rv-card__btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .rv-card__voted {
          font-family: var(--font-terminal, monospace);
          font-size: 11px; color: rgba(255,255,255,0.3);
          text-align: center; margin-top: 6px;
          letter-spacing: 0.1em;
        }
        .rv-card__error {
          font-family: var(--font-terminal, monospace);
          font-size: 11px; color: rgba(239,68,68,0.8);
          margin-top: 4px;
        }
      `}</style>
    </>
  );
}

/* ── Active Vote Checker ──────────────────────────────────────────── */

function ActiveVoteForPlacement({ placementId }: { placementId: string }) {
  const numericId = Number(BigInt(placementId));
  const voteId = useActivePlacementVote(numericId);
  if (!voteId) return null;
  return <VoteCard placementId={placementId} voteId={voteId} />;
}

/* ── Main Panel ───────────────────────────────────────────────────── */

export function RemovalVotePanel({ placementIds }: Props) {
  // Only render if there are placements to check
  if (!placementIds.length) return null;

  // Check first 20 placements for active votes (avoid too many RPC calls)
  const idsToCheck = placementIds.slice(0, 20);

  // Render vote cards inline — no section header, no empty state.
  // The hint text now lives in the Actions section under pricing.
  return (
    <>
      <div className="rv-panel">
        {idsToCheck.map((id) => (
          <ActiveVoteForPlacement key={id} placementId={id} />
        ))}
      </div>
      <style jsx>{`
        .rv-panel {
          display: flex; flex-direction: column; gap: 8px;
        }
      `}</style>
    </>
  );
}
