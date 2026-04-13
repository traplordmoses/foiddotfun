"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import { musicPanelController } from "@/components/musicPanelController";

const MusicPanelLogic = dynamic(() => import("./MusicPanel"), { ssr: false });

const AUTO_HIDE_MS = 6000;

type CompactMusicPlayerProps = { mountLogic?: boolean };

export default function CompactMusicPlayer({ mountLogic = true }: CompactMusicPlayerProps) {
  const [state, setState] = useState(musicPanelController.getState());
  const [isExpanded, setIsExpanded] = useState(false);
  const autoHideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const barRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const unsubscribe = musicPanelController.subscribe(() =>
      setState(musicPanelController.getState()),
    );
    return unsubscribe;
  }, []);

  const { volume } = state;

  const resetAutoHide = useCallback(() => {
    if (autoHideTimer.current) clearTimeout(autoHideTimer.current);
    autoHideTimer.current = setTimeout(() => setIsExpanded(false), AUTO_HIDE_MS);
  }, []);

  const handleBarInteraction = useCallback(() => {
    resetAutoHide();
  }, [resetAutoHide]);

  useEffect(() => {
    return () => {
      if (autoHideTimer.current) clearTimeout(autoHideTimer.current);
    };
  }, []);

  const handleVolumeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newVol = parseFloat(e.target.value);
    const delta = newVol - (volume ?? 0);
    musicPanelController.adjustVolume(delta);
    resetAutoHide();
  }, [volume, resetAutoHide]);

  return (
    <>
      {mountLogic && (
        <div className="cmp-logic" aria-hidden="true">
          <MusicPanelLogic />
        </div>
      )}

      {/* Floating volume trigger — bottom-left */}
      <button
        type="button"
        className="cmp-trigger"
        onClick={() => setIsExpanded((prev) => !prev)}
        aria-label="Volume"
        title="Volume"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M11 5.5a1 1 0 0 1 1.58-.81l3.92 2.9a1 1 0 0 1 .4.8v6.22a1 1 0 0 1-.4.8l-3.92 2.9A1 1 0 0 1 11 18.5V5.5zM9 9H6.5A1.5 1.5 0 0 0 5 10.5v3A1.5 1.5 0 0 0 6.5 15H9V9z" fill="currentColor"/>
          {(volume ?? 0) > 0 && <path d="M18.5 8.6a.9.9 0 0 1 1.27-.1c1.1.95 1.73 2.32 1.73 3.5s-.63 2.55-1.73 3.5a.9.9 0 1 1-1.17-1.36c.7-.6 1.1-1.5 1.1-2.14s-.4-1.54-1.1-2.14a.9.9 0 0 1-.1-1.26z" fill="currentColor"/>}
          {(volume ?? 0) === 0 && <path d="M18.3 9.3a1 1 0 0 1 1.4 0L21 10.6l1.3-1.3a1 1 0 1 1 1.4 1.4L22.4 12l1.3 1.3a1 1 0 0 1-1.4 1.4L21 13.4l-1.3 1.3a1 1 0 0 1-1.4-1.4l1.3-1.3-1.3-1.3a1 1 0 0 1 0-1.4z" fill="currentColor"/>}
        </svg>
      </button>

      {/* Volume popup — controls site-wide volume */}
      {isExpanded && (
        <div
          ref={barRef}
          className="cmp-soundbox"
          onMouseMove={handleBarInteraction}
        >
          <div className="cmp-volume">
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={volume ?? 0}
              onChange={handleVolumeChange}
              className="cmp-volume__slider"
              title={`Volume: ${Math.round((volume ?? 0) * 100)}%`}
              aria-label="Volume"
            />
          </div>
        </div>
      )}

      <style jsx global>{`
        :global(.cmp-logic) {
          position: absolute;
          width: 0;
          height: 0;
          opacity: 0;
          pointer-events: none;
          overflow: hidden;
          clip: rect(0, 0, 0, 0);
          clip-path: inset(50%);
        }

        /* --- Floating volume trigger --- */
        :global(.cmp-trigger) {
          position: fixed;
          bottom: 20px;
          left: 20px;
          z-index: 100000;
          width: 36px;
          height: 36px;
          border-radius: 50%;
          background: rgba(10, 8, 20, 0.7);
          backdrop-filter: blur(12px);
          border: 1px solid rgba(255, 255, 255, 0.06);
          display: grid;
          place-items: center;
          cursor: pointer;
          padding: 0;
          color: rgba(255, 255, 255, 0.35);
          transition: transform 0.2s ease, color 0.2s ease, border-color 0.2s ease;
        }
        :global(.cmp-trigger:hover) {
          transform: scale(1.08);
          color: rgba(255, 255, 255, 0.7);
          border-color: rgba(255, 255, 255, 0.15);
        }

        @media (max-width: 1023px) {
          :global(.cmp-trigger) { bottom: 80px; }
          :global(.cmp-soundbox) { bottom: 80px; }
        }

        /* --- Volume popup --- */
        :global(.cmp-soundbox) {
          position: fixed;
          bottom: 64px;
          left: 20px;
          z-index: 100000;
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 8px 14px;
          background: rgba(10, 8, 20, 0.92);
          backdrop-filter: blur(16px);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 12px;
          color: rgba(255, 255, 255, 0.9);
          animation: cmp-soundbox-enter 0.2s ease-out;
        }
        @keyframes cmp-soundbox-enter {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }

        /* --- Volume slider --- */
        :global(.cmp-volume) {
          display: flex;
          align-items: center;
          gap: 5px;
          flex-shrink: 0;
        }
        :global(.cmp-volume__slider) {
          width: 72px;
          height: 3px;
          -webkit-appearance: none;
          appearance: none;
          background: rgba(255, 255, 255, 0.1);
          border-radius: 2px;
          outline: none;
          cursor: pointer;
        }
        :global(.cmp-volume__slider::-webkit-slider-thumb) {
          -webkit-appearance: none;
          width: 10px;
          height: 10px;
          border-radius: 50%;
          background: rgba(190, 255, 235, 0.8);
          border: 1px solid rgba(116, 255, 235, 0.4);
          box-shadow: 0 0 4px rgba(116, 255, 235, 0.2);
          cursor: pointer;
        }
        :global(.cmp-volume__slider::-moz-range-thumb) {
          width: 10px;
          height: 10px;
          border-radius: 50%;
          background: rgba(190, 255, 235, 0.8);
          border: 1px solid rgba(116, 255, 235, 0.4);
          box-shadow: 0 0 4px rgba(116, 255, 235, 0.2);
          cursor: pointer;
        }

      `}</style>
    </>
  );
}
