// /src/hooks/board/usePresence.ts
// Figma-style ambient presence for /board. Broadcasts the local cursor (in
// world coordinates) to all /board viewers via Supabase Realtime and exposes
// a live Map<sessionId, PresenceState> for rendering.
//
// - Channel: `board-presence` (broadcast + join/leave tracking)
// - Outbound rate cap: 8 Hz (see MIN_SEND_INTERVAL)
// - Idle removal: remote ghosts are dropped after 10s of no update
// - Graceful disable: returns an empty map + no-op send when SUPABASE_ENABLED is false
//
// The caller is responsible for passing the cursor in **world coordinates**
// (use `usePanZoom().screenToWorld(clientX, clientY)` before calling
// `sendCursor`). PresenceLayer then renders the ghosts as absolute children
// of `.board-stage`, which inherits the pan/zoom transform — no additional
// math needed on the render side.

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase, SUPABASE_ENABLED } from "@/lib/supabase";

export type PresenceCursor = { x: number; y: number };

export type PresenceState = {
  sessionId: string;
  displayName: string;
  cursor: PresenceCursor | null;
  lastSeen: number; // ms epoch
};

type PresenceBroadcastPayload = {
  sessionId: string;
  displayName: string;
  cursor: PresenceCursor | null;
};

const CHANNEL_NAME = "board-presence";
const MIN_SEND_INTERVAL = 125; // ms — ~8 Hz cap
const STALE_MS = 10_000; // remove ghosts after 10s silence
const CLEANUP_INTERVAL = 2_000;

function getOrCreateSessionId(): string {
  if (typeof window === "undefined") return "ssr";
  try {
    const existing = window.sessionStorage.getItem("foid-presence-session");
    if (existing) return existing;
    const id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `s-${Math.random().toString(36).slice(2, 10)}`;
    window.sessionStorage.setItem("foid-presence-session", id);
    return id;
  } catch {
    return `s-${Math.random().toString(36).slice(2, 10)}`;
  }
}

function shorten(address?: string | null): string {
  if (!address) return `anon-${Math.random().toString(36).slice(2, 6)}`;
  if (address.length < 8) return address;
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export type UsePresenceOpts = {
  /** Wallet address of the local user, if connected. Used to derive display name. */
  address?: string | null;
  /** Opt-out: if false, the hook is fully dormant (no subscribe, no send). */
  enabled?: boolean;
};

export type UsePresenceReturn = {
  /** Session id for the local client (stable across the tab). */
  sessionId: string;
  /** Live map of remote peers, keyed by sessionId (excludes self). */
  peers: Map<string, PresenceState>;
  /** Broadcast the local cursor, in world coordinates. Pass null to clear. */
  sendCursor: (cursor: PresenceCursor | null) => void;
  /** Whether the underlying realtime transport is available. */
  enabled: boolean;
};

/**
 * Ambient cursor presence. Safe to call unconditionally — degrades to a no-op
 * when Supabase is not configured.
 */
export function usePresence(opts: UsePresenceOpts = {}): UsePresenceReturn {
  const { address, enabled = true } = opts;

  const sessionId = useMemo(() => getOrCreateSessionId(), []);
  const displayName = useMemo(() => shorten(address), [address]);
  const displayNameRef = useRef(displayName);
  displayNameRef.current = displayName;

  const [peers, setPeers] = useState<Map<string, PresenceState>>(() => new Map());

  // Refs for the send side — keep the throttle stable across renders.
  const channelRef = useRef<ReturnType<NonNullable<typeof supabase>["channel"]> | null>(null);
  const lastSentAtRef = useRef(0);
  const pendingCursorRef = useRef<PresenceCursor | null>(null);
  const sendTimerRef = useRef<number | null>(null);

  const active = enabled && SUPABASE_ENABLED && !!supabase;

  // --- Subscribe ---------------------------------------------------------
  useEffect(() => {
    if (!active || !supabase) return;

    // Everything here is wrapped in try/catch because Supabase Realtime's
    // `.subscribe()` can throw SYNCHRONOUSLY on iOS Safari and in-app
    // browsers when the WebSocket constructor fails (CSP refusal, mixed
    // content, private-browsing restrictions). An uncaught throw from a
    // useEffect propagates to the nearest error boundary — in our case
    // that's BoardPage's ErrorBoundary, which used to show "Board Error:
    // WebSocket not available: The operation is insecure." instead of
    // just quietly disabling the cursor ghosts. Presence is an ambient
    // nice-to-have; it must never crash the board.
    let channel: ReturnType<NonNullable<typeof supabase>["channel"]> | null = null;
    let cleanupTimer: number | null = null;

    try {
      channel = supabase.channel(CHANNEL_NAME, {
        config: { broadcast: { self: false } },
      });

      channel.on(
        "broadcast",
        { event: "cursor" },
        (msg: { payload: PresenceBroadcastPayload }) => {
          const payload = msg.payload;
          if (!payload || !payload.sessionId) return;
          if (payload.sessionId === sessionId) return; // ignore self
          setPeers((prev) => {
            const next = new Map(prev);
            next.set(payload.sessionId, {
              sessionId: payload.sessionId,
              displayName: payload.displayName || "anon",
              cursor: payload.cursor,
              lastSeen: Date.now(),
            });
            return next;
          });
        },
      );

      channel.subscribe((status) => {
        if (status === "SUBSCRIBED") {
          channelRef.current = channel;
        }
      });

      // Idle cleanup — drop peers that haven't broadcast in STALE_MS.
      cleanupTimer = window.setInterval(() => {
        const cutoff = Date.now() - STALE_MS;
        setPeers((prev) => {
          let changed = false;
          const next = new Map(prev);
          for (const [id, state] of prev) {
            if (state.lastSeen < cutoff) {
              next.delete(id);
              changed = true;
            }
          }
          return changed ? next : prev;
        });
      }, CLEANUP_INTERVAL);
    } catch (err) {
      // Degrade to no-op. `peers` stays empty; sendCursor already guards
      // on `active`, and the channelRef never being populated means any
      // later send attempts silently bail.
      console.warn("[usePresence] realtime unavailable, degrading:", err);
    }

    return () => {
      if (cleanupTimer != null) window.clearInterval(cleanupTimer);
      if (sendTimerRef.current) {
        window.clearTimeout(sendTimerRef.current);
        sendTimerRef.current = null;
      }
      try {
        if (channel) supabase?.removeChannel(channel);
      } catch {
        /* noop */
      }
      channelRef.current = null;
    };
  }, [active, sessionId]);

  // --- Send (throttled to 8 Hz) -----------------------------------------
  const flushSend = useCallback(() => {
    sendTimerRef.current = null;
    const ch = channelRef.current;
    if (!ch) return;
    lastSentAtRef.current = Date.now();
    const payload: PresenceBroadcastPayload = {
      sessionId,
      displayName: displayNameRef.current,
      cursor: pendingCursorRef.current,
    };
    try {
      void ch.send({ type: "broadcast", event: "cursor", payload });
    } catch {
      /* ignore transient send errors */
    }
  }, [sessionId]);

  const sendCursor = useCallback(
    (cursor: PresenceCursor | null) => {
      if (!active) return;
      pendingCursorRef.current = cursor;
      const now = Date.now();
      const elapsed = now - lastSentAtRef.current;
      if (elapsed >= MIN_SEND_INTERVAL) {
        flushSend();
        return;
      }
      if (sendTimerRef.current != null) return; // already queued
      sendTimerRef.current = window.setTimeout(flushSend, MIN_SEND_INTERVAL - elapsed);
    },
    [active, flushSend]
  );

  // On unmount / tab hide, tell others we're gone.
  useEffect(() => {
    if (!active) return;
    const bye = () => {
      pendingCursorRef.current = null;
      flushSend();
    };
    window.addEventListener("beforeunload", bye);
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) bye();
    });
    return () => {
      window.removeEventListener("beforeunload", bye);
    };
  }, [active, flushSend]);

  return { sessionId, peers, sendCursor, enabled: active };
}
