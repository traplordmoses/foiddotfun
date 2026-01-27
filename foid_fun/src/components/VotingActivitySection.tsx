"use client";

import { memo } from "react";
import { VoteRecord } from "@/hooks/useUserVotingActivity";

interface Props {
  votesThisEpoch: number;
  currentEpoch: number;
  totalVotes: number;
  recentVotes: VoteRecord[];
  isLoading?: boolean;
}

export const VotingActivitySection = memo(function VotingActivitySection({
  votesThisEpoch,
  currentEpoch,
  totalVotes,
  recentVotes,
  isLoading = false,
}: Props) {
  if (isLoading) {
    return null;
  }

  const recent = recentVotes.slice(0, 3);

  const shortId = (value: string) =>
    value.length > 12 ? `${value.slice(0, 6)}…${value.slice(-4)}` : value;

  const shortHash = (value?: string | null) =>
    value ? `${value.slice(0, 6)}…${value.slice(-4)}` : "no tx";

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold uppercase tracking-wider text-white/70">
        Voting Activity
      </h3>

        <div className="glass-panel-darker p-4 space-y-3">
          <div className="text-sm text-white/80">
            you&apos;ve cast <span className="stat-value text-base">{votesThisEpoch}</span>{" "}
            {votesThisEpoch === 1 ? "vote" : "votes"} in epoch #{currentEpoch}
          </div>
          <div className="text-sm text-white/80">
            total votes: <span className="stat-value text-base">{totalVotes}</span>
          </div>

          {recent.length ? (
            <div className="space-y-2 text-[11px] text-white/60">
              <div className="text-[10px] uppercase tracking-[0.3em] text-white/40">recent votes</div>
              {recent.map((vote) => (
                <div
                  key={`${vote.id}-${vote.placementId}-${vote.epochId}-${vote.txHash ?? "recent"}`}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-white/10 px-2 py-1 text-[11px]"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-base">{vote.support ? "✅" : "🗳️"}</span>
                    <span>Epoch #{vote.epochId}</span>
                    <span className="font-mono text-[10px] text-white/40">{shortId(vote.placementId)}</span>
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-white/40">
                    <span
                      className={`rounded-full border px-2 py-0.5 text-[10px] ${
                        vote.support ? "border-emerald-400 text-emerald-200" : "border-rose-400 text-rose-200"
                      }`}
                    >
                      {vote.support ? "YES" : "NO"}
                    </span>
                    <span>{vote.weight} wei</span>
                    <span>#{vote.blockNumber ?? "?"}</span>
                    <span>{shortHash(vote.txHash)}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-white/50">no votes found yet</p>
          )}
        </div>
      </div>
  );
});
