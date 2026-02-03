"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAccount } from "wagmi";
import { ConnectWalletPrompt } from "./ConnectWalletPrompt";
import { UserStatsSection } from "./UserStatsSection";
import { UserPlacementsSection } from "./UserPlacementsSection";
import { VotingActivitySection } from "./VotingActivitySection";
import { ClaimableRefundsSection } from "./ClaimableRefundsSection";
import { useUserStats } from "@/hooks/useUserStats";
import { useUserPlacements, type Placement } from "@/hooks/useUserPlacements";
import { useUserVotingActivity } from "@/hooks/useUserVotingActivity";
import { shouldFetchOnce } from "@/lib/requestGuard";

type ManifestLatestResponse = {
  cid: string | null;
  placementsIndex: Record<string, true>;
  fetchedAt: number;
  epoch: number | null;
  sourceUsed: string | null;
  resolverDebug: unknown | null;
  error: string | null;
  manifest: { placements?: Array<{ id?: string | null }> } | null;
};


function buildIndexFromManifest(manifest: ManifestLatestResponse["manifest"]) {
  const out: Record<string, true> = {};
  const placements = manifest?.placements;
  if (!Array.isArray(placements)) return out;
  for (const placement of placements) {
    const id = placement?.id;
    if (typeof id === "string" && id) {
      out[id] = true;
    }
  }
  return out;
}

function basePlacementId(id?: string | null): string | null {
  if (!id || !id.includes("-")) return null;
  const [head] = id.split("-");
  if (!head) return null;
  return head.startsWith("0x") ? head : null;
}

function isCanonized(placement: Placement, manifestIndex: Record<string, true>) {
  const raw = placement.placementId ?? placement.id ?? null;
  const base = basePlacementId(raw);
  return Boolean((raw && manifestIndex[raw]) || (base && manifestIndex[base]));
}


function derivePlacementStatus(
  placement: Placement,
  manifestIndex: Record<string, true>
) {
  // Override status if placement is canonized
  if (isCanonized(placement, manifestIndex)) {
    return "canonized" as const;
  }

  // Map API status "proposed" to "canonized" for display
  if (placement.status === "proposed") {
    return "canonized" as const;
  }

  // Otherwise use the API's status field
  return placement.status;
}

export const UserDashboard = memo(function UserDashboard() {
  const { address, isConnected } = useAccount();
  const { stats, isLoading: statsLoading, error: statsError } = useUserStats(address);
  const { placements, isLoading: placementsLoading, hasFetched: placementsHasFetched, refresh: refreshPlacements } =
    useUserPlacements(address);
  const {
    votesThisEpoch,
    currentEpoch,
    isLoading: votesLoading,
    totalVotes,
    recentVotes,
    error: votesError,
    refresh: refreshVotes,
    hasFetched: votesLoaded,
  } = useUserVotingActivity(address, { enabled: true }); // Auto-load votes

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefreshAt, setLastRefreshAt] = useState<number | null>(null);
  const [manifestIndex, setManifestIndex] = useState<Record<string, true>>({});
  const [manifestLoading, setManifestLoading] = useState(false);
  const [manifestError, setManifestError] = useState<string | null>(null);

  const manifestControllerRef = useRef<AbortController | null>(null);

  const loadManifest = useCallback(async () => {
    manifestControllerRef.current?.abort();
    const controller = new AbortController();
    manifestControllerRef.current = controller;

    setManifestLoading(true);
    setManifestError(null);

    try {
      const res = await fetch("/api/manifest/latest", {
        cache: "no-store",
        signal: controller.signal,
      });
      if (!res.ok) {
        throw new Error(`manifest ${res.status}`);
      }

      const data = (await res.json()) as ManifestLatestResponse;
      if (controller.signal.aborted) return;

      const indexFromPayload =
        data?.placementsIndex && typeof data.placementsIndex === "object"
          ? data.placementsIndex
          : {};
      const fallbackIndex = buildIndexFromManifest(data?.manifest ?? null);
      const resolvedIndex =
        Object.keys(indexFromPayload).length > 0 ? indexFromPayload : fallbackIndex;

      setManifestIndex(resolvedIndex);
      setManifestError(data?.error ?? null);
    } catch (error) {
      if (controller.signal.aborted) return;
      const message = error instanceof Error ? error.message : String(error);
      setManifestError(message);
      setManifestIndex({});
    } finally {
      if (!controller.signal.aborted) {
        setManifestLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    return () => {
      manifestControllerRef.current?.abort();
    };
  }, []);

  const loadDashboardData = useCallback(async () => {
    if (!address) return;
    setIsRefreshing(true);
    try {
      await Promise.allSettled([
        refreshPlacements(),
        loadManifest(),
        refreshVotes() // Auto-load votes in parallel
      ]);
      setLastRefreshAt(Date.now());
    } finally {
      setIsRefreshing(false);
    }
  }, [address, refreshPlacements, loadManifest, refreshVotes]);

  useEffect(() => {
    if (!address) {
      setManifestIndex({});
      setManifestError(null);
      return;
    }

    // Check guard only after initial fetch (prevents spam)
    const guardKey = `dashboard:init:${address}`;
    if (placementsHasFetched && votesLoaded && !shouldFetchOnce(guardKey, 2_000)) {
      return;
    }

    void loadDashboardData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address]);

  const placementsWithStatus = useMemo(() => {
    if (!placements.length) return [];
    // Filter out proposals with null CID
    const validPlacements = placements.filter(p => p.cid !== null);
    return validPlacements.map((placement) => ({
      ...placement,
      status: derivePlacementStatus(placement, manifestIndex),
    }));
  }, [placements, manifestIndex]);

  const sortedPlacements = useMemo(
    () => [...placementsWithStatus].sort((a, b) => b.epoch - a.epoch),
    [placementsWithStatus]
  );

  // Don't block entire dashboard - each section handles its own loading
  if (!isConnected || !address) {
    return <ConnectWalletPrompt />;
  }

  // Debug logging
  if (typeof window !== 'undefined') {
    console.log('Dashboard render:', {
      isConnected,
      address: address?.slice(0, 6) + '...',
      statsLoading,
      placementsLoading,
      manifestLoading,
      placementsCount: placements?.length || 0,
      totalVotes,
    });
  }

  return (
    <div className="flex flex-col">
      <div className="space-y-6 px-4 py-6">
        <UserStatsSection
          stats={stats}
          placements={sortedPlacements}
          totalVotes={totalVotes}
          isLoading={statsLoading}
          error={statsError}
        />
        <ClaimableRefundsSection />
        {manifestError && (
          <div className="text-xs text-amber-300/80">manifest: {manifestError}</div>
        )}
        <UserPlacementsSection
          placements={sortedPlacements}
          isLoading={placementsLoading}
          hasFetched={placementsHasFetched}
          onRefresh={loadDashboardData}
          isRefreshing={isRefreshing}
          lastRefreshAt={lastRefreshAt}
        />
        <VotingActivitySection
          votesThisEpoch={votesThisEpoch}
          currentEpoch={currentEpoch}
          totalVotes={totalVotes}
          recentVotes={recentVotes}
          isLoading={votesLoading}
          hasLoaded={votesLoaded}
          error={votesError}
          onLoadVotes={refreshVotes}
        />
      </div>
    </div>
  );
});
