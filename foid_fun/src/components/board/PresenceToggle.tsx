// /src/components/board/PresenceToggle.tsx
// Compact presence on/off toggle for the /board sidebar. Controls whether
// the local client broadcasts + receives ambient cursor ghosts via Supabase
// Realtime. Mirrors SoundToggle's visual + a11y shape.
"use client";

import { useSyncExternalStore } from "react";
import {
  getPresenceSettings,
  subscribe,
  togglePresence,
} from "@/lib/presenceSettings";

function snapshot() {
  return getPresenceSettings().enabled;
}

// SSR fallback — default to enabled so server + first client paint match.
function serverSnapshot() {
  return true;
}

export function PresenceToggle() {
  const enabled = useSyncExternalStore(subscribe, snapshot, serverSnapshot);
  return (
    <button
      type="button"
      onClick={() => togglePresence()}
      aria-pressed={enabled}
      aria-label={
        enabled
          ? "Hide ambient cursor presence"
          : "Show ambient cursor presence"
      }
      title={
        enabled
          ? "Presence on — you see and are seen. Click to hide."
          : "Presence off — click to rejoin ambient cursors."
      }
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "4px 10px",
        fontSize: 11,
        fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
        letterSpacing: 0.2,
        color: enabled ? "#a78bfa" : "rgba(255,255,255,0.45)",
        background: enabled ? "rgba(167,139,250,0.08)" : "rgba(255,255,255,0.03)",
        border: `1px solid ${enabled ? "rgba(167,139,250,0.3)" : "rgba(255,255,255,0.12)"}`,
        borderRadius: 6,
        cursor: "pointer",
        textTransform: "uppercase",
        transition: "color 150ms, background 150ms, border-color 150ms",
      }}
    >
      <span aria-hidden>{enabled ? "◉" : "○"}</span>
      <span>{enabled ? "presence on" : "presence off"}</span>
    </button>
  );
}
