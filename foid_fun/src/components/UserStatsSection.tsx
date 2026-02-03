"use client";

import { memo } from "react";
import { Placement } from "@/hooks/useUserPlacements";
import { Skeleton } from "./Skeleton";
import { UserStats } from "@/hooks/useUserStats";

interface UserStatsSectionProps {
  stats: UserStats | null;
  placements: Placement[];
  totalVotes: number;
  isLoading?: boolean;
  error?: unknown;
}

export const UserStatsSection = memo(function UserStatsSection({
  stats,
  placements,
  totalVotes,
  isLoading = false,
  error,
}: UserStatsSectionProps) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-white/70">
          Your Stats
        </h3>
        <div className="space-y-2">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-8 w-full" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="glass-panel-darker p-4 text-center text-sm text-red-400">
        Failed to load stats
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold uppercase tracking-wider text-white/70">
        Your Stats
      </h3>

      <div className="glass-panel-darker space-y-3 p-4 rounded-2xl">
        <StatRow
          icon="🔥"
          label="Prayer Streak"
          value={`${stats.currentStreak} days`}
          highlight
        />
        <StatRow icon="📿" label="Total Prayers" value={stats.totalPrayers} />

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex items-center justify-between p-3 rounded-lg bg-black/20">
            <div className="flex items-center gap-3">
              <span className="text-2xl">📋</span>
              <div>
                <div className="text-sm text-white/60">Proposals</div>
                <div className="text-xl font-semibold text-cyan-400">
                  {placements.length}
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between p-3 rounded-lg bg-black/20">
            <div className="flex items-center gap-3">
              <span className="text-2xl">🗳️</span>
              <div>
                <div className="text-sm text-white/60">Votes Cast</div>
                <div className="text-xl font-semibold text-cyan-400">
                  {totalVotes}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

function StatRow({
  icon,
  label,
  value,
  highlight,
}: {
  icon: string;
  label: string;
  value: string | number;
  highlight?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <span className="text-lg">{icon}</span>
        <span className="text-sm text-white/80">{label}</span>
      </div>
      <span className={`text-lg font-bold ${highlight ? "stat-value--streak" : "stat-value"}`}>
        {value}
      </span>
    </div>
  );
}
