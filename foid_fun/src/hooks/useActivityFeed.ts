"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import {
  subscribeToBoardEvents,
  fetchRecentBoardEvents,
  type BoardEvent,
} from "@/lib/supabase";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ActivityItem = {
  id: string;
  type: "prayer" | "vote" | "proposal" | "finalized";
  message: string;
  accent: string; // tailwind-friendly color
  timestamp: number; // epoch ms
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ACCENT: Record<ActivityItem["type"], string> = {
  prayer: "#00ffff",
  vote: "#a855f7",
  proposal: "#ff6bd5",
  finalized: "#34d399",
};

let _nextId = 0;
function uid(): string {
  return `act-${Date.now()}-${++_nextId}`;
}

function boardEventToActivity(ev: BoardEvent): ActivityItem | null {
  const ts = new Date(ev.created_at).getTime();
  const proposalId = ev.proposal_id;

  switch (ev.event_type) {
    case "vote_cast": {
      const direction =
        (ev.data as Record<string, unknown>)?.approve === true ? "for" : "against";
      return {
        id: uid(),
        type: "vote",
        message: `vote cast ${direction}${proposalId != null ? ` on PROP #${proposalId}` : ""}`,
        accent: ACCENT.vote,
        timestamp: ts,
      };
    }
    case "proposal_created":
      return {
        id: uid(),
        type: "proposal",
        message: `new proposal submitted${proposalId != null ? ` — PROP #${proposalId}` : ""}`,
        accent: ACCENT.proposal,
        timestamp: ts,
      };
    case "proposal_finalized": {
      const passed = (ev.data as Record<string, unknown>)?.passed;
      return {
        id: uid(),
        type: "finalized",
        message: `PROP #${proposalId ?? "?"} ${passed ? "canonized" : "rejected"}`,
        accent: ACCENT.finalized,
        timestamp: ts,
      };
    }
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

const MAX_ITEMS = 20;

export function useActivityFeed() {
  const [items, setItems] = useState<ActivityItem[]>([]);
  const seenIdsRef = useRef(new Set<string>());

  // Push a new item, cap at MAX_ITEMS
  const push = useCallback((item: ActivityItem) => {
    setItems((prev) => {
      const next = [...prev, item];
      if (next.length > MAX_ITEMS) return next.slice(next.length - MAX_ITEMS);
      return next;
    });
  }, []);

  // Remove by id (called when bubble animation ends)
  const remove = useCallback((id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
  }, []);

  // ------ Supabase real-time ------
  useEffect(() => {
    const unsub = subscribeToBoardEvents((ev) => {
      // Deduplicate by Supabase row id
      if (seenIdsRef.current.has(ev.id)) return;
      seenIdsRef.current.add(ev.id);
      const item = boardEventToActivity(ev);
      if (item) push(item);
    });
    return unsub;
  }, [push]);

  // ------ Seed with recent events, fallback to ambient if empty ------
  useEffect(() => {
    let cancelled = false;
    const timers: ReturnType<typeof setTimeout>[] = [];

    fetchRecentBoardEvents(8).then((events) => {
      if (cancelled) return;

      if (events.length > 0) {
        events.forEach((ev) => {
          if (seenIdsRef.current.has(ev.id)) return;
          seenIdsRef.current.add(ev.id);
          const item = boardEventToActivity(ev);
          if (item) push(item);
        });
      } else {
        // Ambient fallback — show gentle activity so homepage feels alive
        const ambient: Omit<ActivityItem, "id" | "timestamp">[] = [
          { type: "prayer",   message: "prayer anchored onchain",             accent: ACCENT.prayer },
          { type: "vote",     message: "vote cast for on PROP #0",           accent: ACCENT.vote },
          { type: "proposal", message: "new proposal submitted to loreboard", accent: ACCENT.proposal },
          { type: "prayer",   message: "streak extended — day 12",           accent: ACCENT.prayer },
          { type: "finalized",message: "PROP #0 canonized",                  accent: ACCENT.finalized },
          { type: "vote",     message: "vote cast against on PROP #1",       accent: ACCENT.vote },
        ];
        ambient.forEach((a, i) => {
          const t = setTimeout(() => {
            if (cancelled) return;
            push({ ...a, id: uid(), timestamp: Date.now() });
          }, 1500 + i * 3000);
          timers.push(t);
        });
      }
    });

    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { items, remove };
}
