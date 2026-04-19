// /src/components/board/SoundToggle.tsx
// Compact SFX on/off toggle for the /board sidebar. Reads and writes the
// global audioSettings store so the flip is instantly reflected everywhere
// that calls getAudioSettings() before synthesizing audio.
"use client";

import { useSyncExternalStore } from "react";
import {
  getAudioSettings,
  subscribe,
  toggleSfx,
} from "@/lib/audioSettings";

function snapshot() {
  return getAudioSettings().sfxEnabled;
}

// SSR fallback — default to enabled so server + first client paint match.
function serverSnapshot() {
  return true;
}

export function SoundToggle() {
  const enabled = useSyncExternalStore(subscribe, snapshot, serverSnapshot);
  return (
    <button
      type="button"
      onClick={() => toggleSfx()}
      aria-pressed={enabled}
      aria-label={enabled ? "Mute board sound effects" : "Enable board sound effects"}
      title={enabled ? "Sound on — click to mute" : "Sound off — click to enable"}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "4px 10px",
        fontSize: 11,
        fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
        letterSpacing: 0.2,
        color: enabled ? "#74ffeb" : "rgba(255,255,255,0.45)",
        background: enabled ? "rgba(116,255,235,0.08)" : "rgba(255,255,255,0.03)",
        border: `1px solid ${enabled ? "rgba(116,255,235,0.3)" : "rgba(255,255,255,0.12)"}`,
        borderRadius: 6,
        cursor: "pointer",
        textTransform: "uppercase",
        transition: "color 150ms, background 150ms, border-color 150ms",
      }}
    >
      <span aria-hidden>{enabled ? "♪" : "∅"}</span>
      <span>{enabled ? "sound on" : "sound off"}</span>
    </button>
  );
}
