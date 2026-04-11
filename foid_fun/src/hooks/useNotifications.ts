"use client";

import { useMemo, useCallback, useState, useEffect, useRef } from "react";
import { useUserPlacements, type Placement } from "@/hooks/useUserPlacements";
import { useBoardEvents } from "@/hooks/useBoardEvents";
import toast from "react-hot-toast";

export type NotificationType = "proposed" | "voting" | "canonized" | "rejected" | "expired";

export interface Notification {
  id: string;
  type: NotificationType;
  message: string;
  accent: string;
  placement: Placement;
  isRead: boolean;
  isNew: boolean;           // true if newer than last-seen timestamp
  timestamp: number | null;
}

/* ── Constants ────────────────────────────────────────────────────── */

const ACCENT_MAP: Record<NotificationType, string> = {
  proposed: "rgba(56,189,248,0.9)",
  voting: "rgba(245,158,11,0.9)",
  canonized: "rgba(255,215,0,0.95)",
  rejected: "rgba(156,163,175,0.7)",
  expired: "rgba(107,114,128,0.6)",
};

const TYPE_ICONS: Record<NotificationType, string> = {
  proposed: "\u{1F4DD}",
  voting: "\u{1F5F3}\uFE0F",
  canonized: "\u2728",
  rejected: "\u274C",
  expired: "\u23F0",
};

/* ── Time formatting ──────────────────────────────────────────────── */

function formatTimeLeft(endsAtSec: number): string {
  const left = endsAtSec - Math.floor(Date.now() / 1000);
  if (left <= 0) return "ended";
  if (left < 3600) return `${Math.floor(left / 60)}m left`;
  if (left < 86400) return `${Math.floor(left / 3600)}h ${Math.floor((left % 3600) / 60)}m left`;
  return `${Math.floor(left / 86400)}d left`;
}

/* ── Message templates ────────────────────────────────────────────── */

const MESSAGE_MAP: Record<NotificationType, (p: Placement) => string> = {
  proposed: (p) => `Your placement was proposed at (${p.x}, ${p.y})`,
  voting: (p) => {
    const parts: string[] = ["Voting in progress"];
    if (p.votes && p.votes.total > 0) {
      const against = p.votes.total - p.votes.yes;
      parts.push(`${p.votes.yes} for / ${against} against`);
    }
    if (p.voteEndsAt) {
      parts.push(formatTimeLeft(p.voteEndsAt));
    }
    return parts.join(" \u00B7 "); // separated by " · "
  },
  canonized: () => "YOUR PLACEMENT HAS BEEN CANONIZED",
  rejected: () => "Your placement was not canonized",
  expired: () => "Voting period has expired",
};

/* ── localStorage helpers ─────────────────────────────────────────── */

const STORAGE_PREFIX = "foid_notif_read_";
const LAST_SEEN_PREFIX = "foid_notif_last_seen_";

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
    const pruned = [...ids].filter((id) => validIds.has(id));
    localStorage.setItem(`${STORAGE_PREFIX}${address.toLowerCase()}`, JSON.stringify(pruned));
  } catch { /* quota errors */ }
}

function getLastSeen(address: string): number {
  if (typeof window === "undefined") return 0;
  try {
    return Number(localStorage.getItem(`${LAST_SEEN_PREFIX}${address.toLowerCase()}`)) || 0;
  } catch {
    return 0;
  }
}

function setLastSeen(address: string) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(
      `${LAST_SEEN_PREFIX}${address.toLowerCase()}`,
      String(Math.floor(Date.now() / 1000)),
    );
  } catch { /* quota */ }
}

/* ── Hook ─────────────────────────────────────────────────────────── */

export function useNotifications(
  address: `0x${string}` | undefined,
  isOpen = false,
) {
  const { placements, isLoading, refresh } = useUserPlacements(address);

  // Bumped after every markRead/markSeen call to force useMemo to re-derive
  const [readVersion, setReadVersion] = useState(0);

  // Track previous notification count for toast alerts
  const prevCountRef = useRef(0);
  const initializedRef = useRef(false);

  /* ── Supabase real-time: refresh on board events ──────────────── */
  useBoardEvents(() => {
    refresh();
  });

  /* ── Smart polling: every 30s when panel is open + tab visible ── */
  useEffect(() => {
    if (!isOpen || !address) return;

    // Refresh immediately on open
    refresh();

    const tick = () => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
      refresh();
    };

    const interval = setInterval(tick, 30_000);

    const handleVisibility = () => {
      if (typeof document !== "undefined" && document.visibilityState === "visible") {
        refresh();
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [isOpen, address, refresh]);

  /* ── Derive notifications ───────────────────────────────────────── */

  const notifications = useMemo((): Notification[] => {
    if (!address || !placements.length) return [];

    const readIds = getReadIds(address);
    const lastSeen = getLastSeen(address);

    return placements
      .map((p): Notification => ({
        id: p.id,
        type: p.status as NotificationType,
        message: (MESSAGE_MAP[p.status as NotificationType] ?? MESSAGE_MAP.proposed)(p),
        accent: ACCENT_MAP[p.status as NotificationType] ?? ACCENT_MAP.proposed,
        placement: p,
        isRead: readIds.has(p.id),
        isNew: (p.registeredAt ?? 0) > lastSeen,
        timestamp: p.registeredAt,
      }))
      .sort((a, b) => {
        // Unread first, then by timestamp descending
        if (a.isRead !== b.isRead) return a.isRead ? 1 : -1;
        return (b.timestamp ?? 0) - (a.timestamp ?? 0);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address, placements, readVersion]);

  /* ── Derived counts ─────────────────────────────────────────────── */

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.isRead).length,
    [notifications],
  );

  /** Count of notifications newer than last time user opened the panel */
  const newCount = useMemo(
    () => notifications.filter((n) => n.isNew).length,
    [notifications],
  );

  const hasCanonization = useMemo(
    () => notifications.some((n) => n.type === "canonized" && !n.isRead),
    [notifications],
  );

  /* ── Toast alerts for new notifications ─────────────────────────── */

  useEffect(() => {
    // Skip the very first render (don't toast on page load)
    if (!initializedRef.current) {
      initializedRef.current = true;
      prevCountRef.current = notifications.length;
      return;
    }

    if (notifications.length > prevCountRef.current && !isOpen) {
      const newest = notifications.find((n) => !n.isRead);
      if (newest) {
        const icon = TYPE_ICONS[newest.type] ?? "";
        toast(`${icon} ${newest.message}`, {
          duration: 4000,
          style: {
            fontFamily: "var(--font-mono, monospace)",
            fontSize: "11px",
            letterSpacing: "0.04em",
          },
        });
      }
    }
    prevCountRef.current = notifications.length;
  }, [notifications.length, isOpen, notifications]);

  /* ── Actions ────────────────────────────────────────────────────── */

  const markRead = useCallback(
    (ids: string[]) => {
      if (!address) return;
      const readIds = getReadIds(address);
      ids.forEach((id) => readIds.add(id));
      const validIds = new Set(placements.map((p) => p.id));
      saveReadIds(address, readIds, validIds);
      setReadVersion((v) => v + 1);
    },
    [address, placements],
  );

  const markAllRead = useCallback(() => {
    markRead(notifications.map((n) => n.id));
  }, [markRead, notifications]);

  /** Called when notification panel opens — updates last-seen timestamp */
  const markSeen = useCallback(() => {
    if (!address) return;
    setLastSeen(address);
    setReadVersion((v) => v + 1);
  }, [address]);

  return {
    notifications,
    unreadCount,
    newCount,
    hasCanonization,
    isLoading,
    markRead,
    markAllRead,
    markSeen,
    refresh,
  };
}
