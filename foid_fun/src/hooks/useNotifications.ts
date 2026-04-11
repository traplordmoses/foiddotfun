"use client";

import { useMemo, useCallback, useState } from "react";
import { useUserPlacements, type Placement } from "@/hooks/useUserPlacements";

export type NotificationType = "proposed" | "voting" | "canonized" | "rejected" | "expired";

export interface Notification {
  id: string;
  type: NotificationType;
  message: string;
  accent: string;
  placement: Placement;
  isRead: boolean;
  timestamp: number | null;
}

const ACCENT_MAP: Record<NotificationType, string> = {
  proposed: "rgba(56,189,248,0.9)",
  voting: "rgba(245,158,11,0.9)",
  canonized: "rgba(255,215,0,0.95)",
  rejected: "rgba(156,163,175,0.7)",
  expired: "rgba(107,114,128,0.6)",
};

const MESSAGE_MAP: Record<NotificationType, (p: Placement) => string> = {
  proposed: (p) => `Your placement was engraved at (${p.x}, ${p.y})`,
  voting: (p) => `Your placement is up for vote!${p.votes ? ` (${p.votes.yes}/${p.votes.total} votes)` : ""}`,
  canonized: () => "YOUR PLACEMENT HAS BEEN CANONIZED",
  rejected: () => "Your placement was not canonized this round",
  expired: () => "Your placement voting period has expired",
};

const STORAGE_PREFIX = "foid_notif_read_";

function getReadIds(address: string): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${address.toLowerCase()}`);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

function saveReadIds(address: string, ids: Set<string>, validIds: Set<string>) {
  if (typeof window === "undefined") return;
  try {
    // Prune IDs that no longer exist in placements
    const pruned = [...ids].filter((id) => validIds.has(id));
    localStorage.setItem(`${STORAGE_PREFIX}${address.toLowerCase()}`, JSON.stringify(pruned));
  } catch { /* quota errors */ }
}

export function useNotifications(address: `0x${string}` | undefined) {
  const { placements, isLoading, refresh } = useUserPlacements(address);

  // Bumped after every markRead call so the notifications useMemo re-derives
  // isRead flags from the freshly-written localStorage state.
  const [readVersion, setReadVersion] = useState(0);

  const notifications = useMemo((): Notification[] => {
    if (!address || !placements.length) return [];

    const readIds = getReadIds(address);

    return placements
      .map((p): Notification => ({
        id: p.id,
        type: p.status as NotificationType,
        message: (MESSAGE_MAP[p.status as NotificationType] ?? MESSAGE_MAP.proposed)(p),
        accent: ACCENT_MAP[p.status as NotificationType] ?? ACCENT_MAP.proposed,
        placement: p,
        isRead: readIds.has(p.id),
        timestamp: p.registeredAt,
      }))
      .sort((a, b) => {
        // Unread first, then by timestamp descending
        if (a.isRead !== b.isRead) return a.isRead ? 1 : -1;
        return (b.timestamp ?? 0) - (a.timestamp ?? 0);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address, placements, readVersion]);

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.isRead).length,
    [notifications],
  );

  const hasCanonization = useMemo(
    () => notifications.some((n) => n.type === "canonized" && !n.isRead),
    [notifications],
  );

  const markRead = useCallback(
    (ids: string[]) => {
      if (!address) return;
      const readIds = getReadIds(address);
      ids.forEach((id) => readIds.add(id));
      const validIds = new Set(placements.map((p) => p.id));
      saveReadIds(address, readIds, validIds);
      setReadVersion((v) => v + 1); // trigger re-memoization
    },
    [address, placements],
  );

  const markAllRead = useCallback(() => {
    markRead(notifications.map((n) => n.id));
  }, [markRead, notifications]);

  return {
    notifications,
    unreadCount,
    hasCanonization,
    isLoading,
    markRead,
    markAllRead,
    refresh,
  };
}
