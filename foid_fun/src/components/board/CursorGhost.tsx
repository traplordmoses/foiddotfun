// /src/components/board/CursorGhost.tsx
// Single remote-cursor ghost rendered inside `.board-stage`. Coordinates are
// in world (stage) space — the ghost inherits the stage's pan+zoom transform
// so no extra math is needed here.
"use client";

import { useEffect, useRef, useState } from "react";
import type { PresenceState } from "@/hooks/board/usePresence";

const TWEEN_MS = 180; // short easing between samples; covers the 125ms broadcast gap

const COLORS = [
  "#74ffeb", // cyan
  "#a78bfa", // purple
  "#f472b6", // pink
  "#fbbf24", // gold
  "#22c55e", // green
  "#ffa552", // tangerine
  "#e040fb", // magenta
];

/** Deterministic color per sessionId so the same peer keeps the same hue. */
function colorFor(sessionId: string): string {
  let hash = 0;
  for (let i = 0; i < sessionId.length; i++) {
    hash = (hash * 31 + sessionId.charCodeAt(i)) | 0;
  }
  return COLORS[Math.abs(hash) % COLORS.length];
}

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
}

type Props = {
  state: PresenceState;
  idleAfterMs?: number; // fade after this long with no update
};

export function CursorGhost({ state, idleAfterMs = 3000 }: Props) {
  const reduce = useRef(prefersReducedMotion());
  const [idle, setIdle] = useState(false);
  const color = colorFor(state.sessionId);

  // Fade when stale.
  useEffect(() => {
    const id = window.setInterval(() => {
      setIdle(Date.now() - state.lastSeen > idleAfterMs);
    }, 500);
    return () => window.clearInterval(id);
  }, [state.lastSeen, idleAfterMs]);

  if (!state.cursor) return null;

  const style: React.CSSProperties = {
    position: "absolute",
    left: state.cursor.x,
    top: state.cursor.y,
    transform: "translate(-50%, -50%)",
    pointerEvents: "none",
    opacity: idle ? 0 : 1,
    transition: reduce.current
      ? "opacity 300ms linear"
      : `left ${TWEEN_MS}ms cubic-bezier(0.22,1,0.36,1), top ${TWEEN_MS}ms cubic-bezier(0.22,1,0.36,1), opacity 300ms linear`,
    zIndex: 120,
  };

  return (
    <div style={style} aria-hidden="true">
      <div
        style={{
          width: 14,
          height: 14,
          borderRadius: "50%",
          background: color,
          boxShadow: `0 0 10px ${color}, 0 0 24px ${color}80`,
        }}
      />
      <span
        style={{
          position: "absolute",
          left: 16,
          top: 12,
          padding: "2px 6px",
          borderRadius: 4,
          background: `${color}22`,
          border: `1px solid ${color}88`,
          color: "#fff",
          fontSize: 11,
          fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
          whiteSpace: "nowrap",
          letterSpacing: 0.2,
          textShadow: "0 1px 2px rgba(0,0,0,0.6)",
        }}
      >
        {state.displayName}
      </span>
    </div>
  );
}
