"use client";

import Image from "next/image";
import { memo, useEffect, useMemo, useState } from "react";
import { Placement } from "@/hooks/useUserPlacements";
import { Skeleton } from "./Skeleton";
import { EmptyState } from "./EmptyState";

interface Props {
  placements: Placement[];
  isLoading: boolean;
  hasFetched?: boolean;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  lastRefreshAt?: number | null;
}

export const UserPlacementsSection = memo(function UserPlacementsSection({
  placements,
  isLoading,
  hasFetched = false,
  onRefresh,
  isRefreshing,
  lastRefreshAt,
}: Props) {
  const [showAll, setShowAll] = useState(false);

  const sortedPlacements = useMemo(
    () => [...placements].sort((a, b) => b.epoch - a.epoch),
    [placements]
  );
  const displayedPlacements = useMemo(
    () => (showAll ? sortedPlacements : sortedPlacements.slice(0, 3)),
    [showAll, sortedPlacements]
  );

  const header = (
    <div className="flex items-center justify-between gap-3">
      <div>
        <h3 className="text-sm font-semibold uppercase tracking-wider text-white/70">
          Your Placements
        </h3>
        {lastRefreshAt && (
          <p className="text-[11px] text-white/40">
            updated {new Date(lastRefreshAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </p>
        )}
      </div>
      {onRefresh && (
        <button
          onClick={onRefresh}
          className="rounded-full border border-white/20 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/60 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:border-white/10 disabled:text-white/30"
          type="button"
          disabled={Boolean(isRefreshing || isLoading)}
        >
          {isRefreshing ? "Refreshing…" : "Refresh"}
        </button>
      )}
    </div>
  );

  // Show skeletons only on initial load (never fetched)
  if (!hasFetched) {
    return (
      <div className="space-y-3">
        {header}
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 w-full rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  if (!placements.length) {
    return (
      <div className="space-y-3">
        {header}
        <div className="glass-panel-darker rounded-2xl overflow-hidden">
          <EmptyState
            icon="🎨"
            title="No Placements Yet"
            description="You haven't proposed any images to the loreboard. Share your first meme and let the community vote!"
            action={{
              label: "Go to Board",
              href: "/board"
            }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {header}

      <div className="space-y-2">
        {displayedPlacements.map((placement) => (
          <PlacementCard key={placement.placementId ?? placement.id} placement={placement} />
        ))}
      </div>

      {placements.length > 3 && (
        <button
          onClick={() => setShowAll((prev) => !prev)}
          className="w-full py-3 text-sm text-cyan-400 hover:text-cyan-300 transition-colors"
        >
          {showAll ? "Hide" : `View all ${placements.length} placements`} →
        </button>
      )}
    </div>
  );
});

function PlacementCard({ placement }: { placement: Placement }) {
  const statusKey = placement.status ?? "voting";
  const statusConfigMap = {
    canonized: {
      badge: "CANONIZED",
      emoji: "✅",
      className: "status-badge--canonized",
    },
    voting: {
      badge: "VOTING",
      emoji: "🗳️",
      className: "status-badge--voting",
    },
    rejected: {
      badge: "REJECTED",
      emoji: "❌",
      className: "status-badge--rejected",
    },
    proposed: {
      badge: "CANONIZED",
      emoji: "✅",
      className: "status-badge--canonized",
    },
    expired: {
      badge: "EXPIRED",
      emoji: "⏰",
      className: "status-badge--rejected",
    },
  };
  const statusConfig = statusConfigMap[statusKey] ?? statusConfigMap.voting;

  const [thumbSrc, setThumbSrc] = useState(() => getThumbSrc(placement.imageUrl));

  useEffect(() => {
    setThumbSrc(getThumbSrc(placement.imageUrl));
  }, [placement.placementId, placement.imageUrl]);

  const handleImageError = () => {
    if (thumbSrc === PLACEHOLDER_SRC) return;
    setThumbSrc(PLACEHOLDER_SRC);
  };

  return (
    <div className="placement-card p-2">
      <div className="flex gap-3">
        <div className="relative h-16 w-16 flex-shrink-0 overflow-hidden rounded-xl bg-white/5">
          <Image
            src={thumbSrc}
            alt={placement.title || "Placement"}
            fill
            sizes="64px"
            className="pointer-events-none object-cover"
            onError={handleImageError}
            referrerPolicy="no-referrer"
            unoptimized
          />

          <div className={`status-badge ${statusConfig.className}`}>{statusConfig.emoji}</div>
        </div>

        <div className="flex min-w-0 flex-1 flex-col justify-center">
          <p className="truncate text-sm font-medium text-white">
            {placement.title || `Placement #${placement.id.slice(0, 8)}`}
          </p>
          <p className="text-xs text-white/50">
            {statusConfig.badge}
            {placement.status === "voting" &&
              placement.votes &&
              ` (${placement.votes.yes}/${placement.votes.total})`}
            <span className="text-white/40"> · Epoch #{placement.epoch}</span>
          </p>
        </div>
      </div>
    </div>
  );
}

const PLACEHOLDER_SRC =
  "data:image/svg+xml,%3Csvg%20xmlns%3D'http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg'%20width%3D'64'%20height%3D'64'%3E%3Crect%20width%3D'64'%20height%3D'64'%20fill%3D'%231F1F1F'/%3E%3Ctext%20x%3D'50%25'%20y%3D'50%25'%20dominant-baseline%3D'middle'%20text-anchor%3D'middle'%20font-size%3D'20'%20fill%3D'%23757575'%3E%F0%9F%96%B4%3C%2Ftext%3E%3C%2Fsvg%3E";

function getThumbSrc(imageUrl?: string | null) {
  const candidate = imageUrl?.trim();
  if (candidate) return candidate;
  return PLACEHOLDER_SRC;
}
