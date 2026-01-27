"use client";

import { useAccount } from "wagmi";
import { ConnectWalletPrompt } from "./ConnectWalletPrompt";
import { UserStatsSection } from "./UserStatsSection";
import { UserPlacementsSection } from "./UserPlacementsSection";
import { VotingActivitySection } from "./VotingActivitySection";
import { useUserStats } from "@/hooks/useUserStats";
import { useUserPlacements } from "@/hooks/useUserPlacements";
import { useUserVotingActivity } from "@/hooks/useUserVotingActivity";

/**
 * UserDashboard - Main dashboard component for displaying user stats and activity
 *
 * Shows different views based on wallet connection state:
 * - Disconnected: ConnectWalletPrompt with CTA
 * - Connected: Full dashboard with stats, placements, and voting activity
 *
 * Layout is optimized to fit in the left vista-window panel with proper scrolling
 */
export function UserDashboard() {
  const { address, isConnected } = useAccount();
  const { stats, isLoading: statsLoading, error: statsError } = useUserStats(address);
  const { placements, isLoading: placementsLoading } = useUserPlacements(address);
  const {
    votesThisEpoch,
    currentEpoch,
    isLoading: votesLoading,
    totalVotes,
    recentVotes,
  } = useUserVotingActivity(address);

  if (!isConnected || !address) {
    return <ConnectWalletPrompt />;
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="custom-scrollbar flex-1 space-y-6 overflow-y-auto px-4 py-6">
        <UserStatsSection
          stats={stats}
          placements={placements}
          totalVotes={totalVotes}
          isLoading={statsLoading}
          error={statsError}
        />
        <UserPlacementsSection placements={placements} isLoading={placementsLoading} />
        <VotingActivitySection
          votesThisEpoch={votesThisEpoch}
          currentEpoch={currentEpoch}
          totalVotes={totalVotes}
          recentVotes={recentVotes}
          isLoading={votesLoading}
        />
      </div>
    </div>
  );
}
