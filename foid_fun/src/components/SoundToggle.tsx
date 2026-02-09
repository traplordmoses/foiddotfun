"use client";

import { useEffect, useState } from "react";
import { getAudioSettings, subscribe, toggleSfx } from "@/lib/audioSettings";

export default function SoundToggle() {
  const [enabled, setEnabled] = useState(() => getAudioSettings().sfxEnabled);

  useEffect(() => {
    const unsubscribe = subscribe(() => {
      setEnabled(getAudioSettings().sfxEnabled);
    });
    return unsubscribe;
  }, []);

  return (
    <>
      <button
        type="button"
        className="sound-toggle-btn"
        onClick={toggleSfx}
        aria-label={enabled ? "Mute sound effects" : "Unmute sound effects"}
        title={enabled ? "Mute SFX" : "Unmute SFX"}
      >
        {enabled ? (
          <svg viewBox="0 0 24 24" className="sound-toggle-icon" aria-hidden="true">
            <path
              fill="currentColor"
              d="M11 5.5a1 1 0 0 1 1.58-.81l3.92 2.9a1 1 0 0 1 .4.8v6.22a1 1 0 0 1-.4.8l-3.92 2.9A1 1 0 0 1 11 18.5V5.5zM9 9H6.5A1.5 1.5 0 0 0 5 10.5v3A1.5 1.5 0 0 0 6.5 15H9V9z"
            />
            <path
              fill="currentColor"
              d="M18.5 8.6a.9.9 0 0 1 1.27-.1c1.1.95 1.73 2.32 1.73 3.5s-.63 2.55-1.73 3.5a.9.9 0 1 1-1.17-1.36c.7-.6 1.1-1.5 1.1-2.14s-.4-1.54-1.1-2.14a.9.9 0 0 1-.1-1.26z"
            />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" className="sound-toggle-icon" aria-hidden="true">
            <path
              fill="currentColor"
              d="M11 5.5a1 1 0 0 1 1.58-.81l3.92 2.9a1 1 0 0 1 .4.8v6.22a1 1 0 0 1-.4.8l-3.92 2.9A1 1 0 0 1 11 18.5V5.5zM9 9H6.5A1.5 1.5 0 0 0 5 10.5v3A1.5 1.5 0 0 0 6.5 15H9V9z"
            />
            <path
              fill="currentColor"
              d="M18.3 9.3a1 1 0 0 1 1.4 0L21 10.6l1.3-1.3a1 1 0 1 1 1.4 1.4L22.4 12l1.3 1.3a1 1 0 0 1-1.4 1.4L21 13.4l-1.3 1.3a1 1 0 0 1-1.4-1.4l1.3-1.3-1.3-1.3a1 1 0 0 1 0-1.4z"
            />
          </svg>
        )}
      </button>

      <style jsx>{`
        .sound-toggle-btn {
          position: fixed;
          bottom: 20px;
          left: 20px;
          z-index: 50;
          width: 40px;
          height: 40px;
          border-radius: 50%;
          border: 1px solid rgba(0, 255, 200, 0.18);
          background: rgba(14, 26, 48, 0.92);
          backdrop-filter: blur(12px);
          display: grid;
          place-items: center;
          cursor: pointer;
          padding: 0;
          transition: border-color 0.2s ease, box-shadow 0.2s ease;
          box-shadow: 0 0 12px rgba(0, 200, 180, 0.08);
        }
        .sound-toggle-btn:hover {
          border-color: rgba(0, 255, 200, 0.35);
          box-shadow: 0 0 18px rgba(0, 200, 180, 0.18);
        }
        .sound-toggle-btn:focus-visible {
          outline: 2px solid rgba(0, 255, 200, 0.5);
          outline-offset: 2px;
        }
        .sound-toggle-icon {
          width: 18px;
          height: 18px;
          color: rgba(190, 255, 235, 0.9);
        }
      `}</style>
    </>
  );
}
