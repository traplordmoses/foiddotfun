"use client";

import { memo, useEffect, useMemo, useRef, useState } from "react";
import { Placement } from "@/hooks/useUserPlacements";
import { Skeleton } from "./Skeleton";
import { getIpfsGatewayCandidates } from "@/lib/ipfsUrl";

interface Props {
  placements: Placement[];
  isLoading: boolean;
}

export const UserPlacementsSection = memo(function UserPlacementsSection({ placements, isLoading }: Props) {
  const [showAll, setShowAll] = useState(false);

  const sortedPlacements = useMemo(
    () => [...placements].sort((a, b) => b.epoch - a.epoch),
    [placements]
  );
  const displayedPlacements = showAll
    ? sortedPlacements
    : sortedPlacements.slice(0, 3);

  if (isLoading) {
    return (
      <div className="space-y-3">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-white/70">
          Your Placements
        </h3>
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
        <h3 className="text-sm font-semibold uppercase tracking-wider text-white/70">
          Your Placements
        </h3>
        <div className="glass-panel-darker p-6 text-center text-sm text-white/50">
          No placements yet. Visit the board to propose your first image!
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold uppercase tracking-wider text-white/70">
        Your Placements
      </h3>

      <div className="space-y-2">
        {displayedPlacements.map((placement) => (
          <PlacementCard key={placement.id} placement={placement} />
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
  const statusConfig = {
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
  }[placement.status];

  const candidates = useMemo(() => {
    const rawInput = placement.imageUrl ?? placement.cid ?? placement.cidHash ?? "";
    const gatewayCandidates = getIpfsGatewayCandidates(rawInput);
    if (gatewayCandidates.length) {
      return gatewayCandidates;
    }
    if (placement.imageUrl && /^https?:\/\//i.test(placement.imageUrl)) {
      return [placement.imageUrl];
    }
    return [];
  }, [placement.cid, placement.cidHash, placement.imageUrl]);

  const [urlIndex, setUrlIndex] = useState(0);

  useEffect(() => {
    setUrlIndex(0);
  }, [candidates.length]);

  const currentSrc = candidates.length ? candidates[urlIndex % candidates.length] : null;
  const loggedRef = useRef(false);

  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;
    if (loggedRef.current) return;
    if (!currentSrc) return;
    console.debug("[thumb]", {
      cid: placement.cid,
      imageUrl: placement.imageUrl,
      src: currentSrc,
    });
    loggedRef.current = true;
  }, [currentSrc, placement.cid, placement.imageUrl]);

  const handleImageError = () => {
    if (!candidates.length) return;
    setUrlIndex((prev) => (prev + 1) % candidates.length);
  };

  return (
    <div className="placement-card p-2">
      <div className="flex gap-3">
        <div className="relative h-16 w-16 flex-shrink-0 overflow-hidden rounded-xl bg-white/5">
          {currentSrc ? (
            <img
              src={currentSrc}
              alt={placement.title || "Placement"}
              className="absolute inset-0 h-full w-full object-cover pointer-events-none"
              onError={handleImageError}
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-2xl">🖼️</div>
          )}

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
