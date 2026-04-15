"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import { musicPanelController } from "@/components/musicPanelController";
import { getAudioSettings, setMusicEnabled } from "@/lib/audioSettings";

const MusicPanelLogic = dynamic(() => import("./MusicPanel"), { ssr: false });

const HIDE_DELAY_HOVER = 2000;
const PLAYER_HEIGHT = 38;

type CompactMusicPlayerProps = { mountLogic?: boolean };

export default function CompactMusicPlayer({ mountLogic = true }: CompactMusicPlayerProps) {
  const [state, setState] = useState(musicPanelController.getState());
  const [isVisible, setIsVisible] = useState(false);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const isMobileRef = useRef(false);

  useEffect(() => {
    const unsubscribe = musicPanelController.subscribe(() =>
      setState(musicPanelController.getState()),
    );
    return unsubscribe;
  }, []);

  const { currentTrackName, isPlaying, progress, volume, shuffle } = state;
  const progressPercent = Number.isFinite(progress) ? Math.min(1, Math.max(0, progress)) : 0;

  const clearHideTimer = useCallback(() => {
    if (hideTimer.current) {
      clearTimeout(hideTimer.current);
      hideTimer.current = null;
    }
  }, []);

  const show = useCallback(() => {
    clearHideTimer();
    setIsVisible(true);
  }, [clearHideTimer]);

  const scheduleHide = useCallback((delay: number) => {
    clearHideTimer();
    hideTimer.current = setTimeout(() => setIsVisible(false), delay);
  }, [clearHideTimer]);

  // Content push: toggle class on <html> to shrink vista-windows
  useEffect(() => {
    document.documentElement.classList.toggle("cmp-active", isVisible);
  }, [isVisible]);

  // Track mobile state (player hidden on mobile via CSS, but ref used elsewhere)
  useEffect(() => {
    const checkMobile = () => {
      isMobileRef.current = window.matchMedia("(max-width: 1023px)").matches;
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Desktop: hover zone
  const handleHoverEnter = useCallback(() => {
    if (isMobileRef.current) return;
    show();
  }, [show]);

  const handleBarMouseEnter = useCallback(() => {
    clearHideTimer();
  }, [clearHideTimer]);

  const handleBarMouseLeave = useCallback(() => {
    if (isMobileRef.current) return;
    scheduleHide(HIDE_DELAY_HOVER);
  }, [scheduleHide]);

  // Controls — auto-enable music on play
  const handlePrev = () => musicPanelController.prev();
  const handleToggle = () => {
    if (!getAudioSettings().musicEnabled) {
      setMusicEnabled(true);
    }
    musicPanelController.toggle();
  };
  const handleNext = () => musicPanelController.next();
  const handleShuffle = () => musicPanelController.toggleShuffle();

  const handleVolumeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newVol = parseFloat(e.target.value);
    const delta = newVol - (volume ?? 0);
    musicPanelController.adjustVolume(delta);
  }, [volume]);

  const volVal = volume ?? 0;
  const volumeIcon = volVal === 0 ? "\u{1F507}" : volVal < 0.5 ? "\u{1F509}" : "\u{1F50A}";

  useEffect(() => {
    return () => clearHideTimer();
  }, [clearHideTimer]);

  return (
    <>
      {mountLogic && (
        <div className="cmp-logic" aria-hidden="true">
          <MusicPanelLogic />
        </div>
      )}

      {/* Desktop hover zone */}
      {!isVisible && (
        <div className="cmp-hover-zone" onMouseEnter={handleHoverEnter} />
      )}

      {/* Music bar */}
      <div className={`cmp-bar-outer ${isVisible ? "cmp-bar-outer--visible" : "cmp-bar-outer--hidden"}`}>
        <div
          ref={barRef}
          className="cmp-bar"
          onMouseEnter={handleBarMouseEnter}
          onMouseLeave={handleBarMouseLeave}
        >
          {/* Previous */}
          <button className="cmp-ctrl-btn" type="button" onClick={handlePrev} title="Previous" aria-label="Previous">
            {"\u23EE"}
          </button>

          {/* Play / Pause */}
          <button
            className="cmp-ctrl-btn cmp-ctrl-btn--play"
            type="button"
            onClick={handleToggle}
            title={isPlaying ? "Pause" : "Play"}
            aria-label={isPlaying ? "Pause" : "Play"}
          >
            {isPlaying ? "\u23F8" : "\u25B6"}
          </button>

          {/* Next */}
          <button className="cmp-ctrl-btn" type="button" onClick={handleNext} title="Next" aria-label="Next">
            {"\u23ED"}
          </button>

          {/* Track title + progress */}
          <div className="cmp-track-area">
            <div className="cmp-track" title={currentTrackName}>
              {currentTrackName}
            </div>
            <div className="cmp-progress">
              <div className="cmp-progress__fill" style={{ width: `${progressPercent * 100}%` }}>
                <div className="cmp-progress__shimmer" />
              </div>
            </div>
          </div>

          {/* Shuffle */}
          <button
            className={`cmp-ctrl-btn ${shuffle ? "cmp-ctrl-btn--active" : ""}`}
            type="button"
            onClick={handleShuffle}
            title={shuffle ? "Shuffle on" : "Shuffle off"}
            aria-label={shuffle ? "Shuffle on" : "Shuffle off"}
          >
            {"\u{1F500}"}
          </button>

          {/* Volume */}
          <div className="cmp-volume">
            <span className="cmp-volume__icon">{volumeIcon}</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={volVal}
              onChange={handleVolumeChange}
              className="cmp-volume__slider"
              title={`Volume: ${Math.round(volVal * 100)}%`}
              aria-label="Volume"
            />
          </div>
        </div>
      </div>

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

        /* --- Hover zone (desktop only) --- */
        :global(.cmp-hover-zone) {
          position: fixed;
          bottom: 0;
          left: 0;
          right: 0;
          height: 18px;
          z-index: 49;
          background: transparent;
        }
        @media (max-width: 1023px) {
          :global(.cmp-hover-zone) { display: none; }
        }

        /* --- Outer wrapper: fixed, centers the bar --- */
        :global(.cmp-bar-outer) {
          position: fixed;
          bottom: 0;
          left: 0;
          right: 0;
          z-index: 50;
          display: flex;
          justify-content: center;
          pointer-events: none;
          transition: transform 0.35s cubic-bezier(0.22, 1, 0.36, 1);
        }
        :global(.cmp-bar-outer--visible) {
          transform: translateY(0);
        }
        :global(.cmp-bar-outer--hidden) {
          transform: translateY(100%);
          transition-duration: 0.3s;
          transition-timing-function: ease-in;
        }
        @media (max-width: 1023px) {
          :global(.cmp-bar-outer) { display: none !important; }
        }

        /* ===== Music bar: liquid glass, consistent width ===== */
        :global(.cmp-bar) {
          width: calc(100% - 32px);
          max-width: 1152px;
          display: flex;
          align-items: center;
          gap: 10px;
          height: ${PLAYER_HEIGHT}px;
          padding: 0 16px;

          /* Liquid glass */
          background: linear-gradient(
            180deg,
            rgba(60, 130, 180, 0.28) 0%,
            rgba(30, 60, 100, 0.42) 100%
          );
          backdrop-filter: blur(24px) saturate(1.3);
          -webkit-backdrop-filter: blur(24px) saturate(1.3);

          /* Borders */
          border-top: 1px solid rgba(255, 255, 255, 0.22);
          border-left: 1px solid rgba(255, 255, 255, 0.15);
          border-right: 1px solid rgba(255, 255, 255, 0.15);
          border-radius: 14px 14px 0 0;

          /* Shadow */
          box-shadow:
            0 -4px 20px rgba(0, 40, 80, 0.25),
            inset 0 1px 0 rgba(255, 255, 255, 0.2);

          color: rgba(255, 255, 255, 0.92);
          pointer-events: auto;
          position: relative;
          overflow: hidden;
        }

        /* Top shine */
        :global(.cmp-bar::before) {
          content: "";
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 50%;
          border-radius: 14px 14px 0 0;
          background: linear-gradient(
            180deg,
            rgba(255, 255, 255, 0.12) 0%,
            transparent 100%
          );
          pointer-events: none;
        }

        /* Entry glow */
        :global(.cmp-bar-outer--visible .cmp-bar) {
          animation: cmp-glow-in 0.5s ease-out;
        }
        @keyframes cmp-glow-in {
          0% {
            border-top-color: rgba(6, 182, 212, 0.6);
            box-shadow: 0 -4px 30px rgba(6, 182, 212, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.3);
          }
          100% {
            border-top-color: rgba(255, 255, 255, 0.22);
            box-shadow: 0 -4px 20px rgba(0, 40, 80, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.2);
          }
        }

        @media (max-width: 1023px) {
          :global(.cmp-bar) {
            border-radius: 12px 12px 0 0;
          }
        }

        /* --- Controls --- */
        :global(.cmp-ctrl-btn) {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 26px;
          height: 26px;
          padding: 0;
          font-size: 13px;
          background: none;
          border: none;
          color: rgba(255, 255, 255, 0.55);
          cursor: pointer;
          transition: color 0.15s, transform 0.15s, text-shadow 0.15s;
          border-radius: 50%;
          flex-shrink: 0;
          position: relative;
          z-index: 1;
        }
        :global(.cmp-ctrl-btn:hover) {
          color: rgba(255, 255, 255, 0.95);
          transform: scale(1.12);
          text-shadow: 0 0 8px rgba(140, 255, 220, 0.4);
        }
        :global(.cmp-ctrl-btn--play) {
          width: 30px;
          height: 30px;
          font-size: 15px;
          color: rgba(255, 255, 255, 0.8);
          background: rgba(255, 255, 255, 0.08);
          border: 1px solid rgba(255, 255, 255, 0.15);
          box-shadow: 0 0 8px rgba(100, 180, 255, 0.1);
        }
        :global(.cmp-ctrl-btn--play:hover) {
          color: rgba(255, 255, 255, 1);
          background: rgba(255, 255, 255, 0.12);
          box-shadow: 0 0 14px rgba(100, 180, 255, 0.2);
        }
        :global(.cmp-ctrl-btn--active) {
          color: rgba(6, 182, 212, 0.9);
          text-shadow: 0 0 6px rgba(6, 182, 212, 0.4);
        }
        :global(.cmp-ctrl-btn--active:hover) {
          color: rgba(6, 182, 212, 1);
          text-shadow: 0 0 10px rgba(6, 182, 212, 0.6);
        }

        /* --- Track area (title + progress stacked) --- */
        :global(.cmp-track-area) {
          flex: 1;
          min-width: 0;
          display: flex;
          flex-direction: column;
          gap: 3px;
          justify-content: center;
          position: relative;
          z-index: 1;
        }
        :global(.cmp-track) {
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.04em;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          color: rgba(190, 255, 235, 0.85);
          text-shadow: 0 0 8px rgba(140, 255, 220, 0.25);
          line-height: 1;
        }

        /* --- Progress bar --- */
        :global(.cmp-progress) {
          width: 100%;
          height: 3px;
          background: rgba(255, 255, 255, 0.1);
          border-radius: 1.5px;
          overflow: hidden;
        }
        :global(.cmp-progress__fill) {
          height: 100%;
          background: linear-gradient(90deg, #06b6d4, #8b5cf6, #d946ef);
          border-radius: 1.5px;
          transition: width 0.3s linear;
          position: relative;
          overflow: hidden;
        }
        :global(.cmp-progress__shimmer) {
          position: absolute;
          inset: 0;
          background-image: linear-gradient(90deg, transparent, rgba(255,255,255,0.18), transparent);
          background-size: 200% 100%;
          animation: foid-shimmer 3s ease-in-out infinite;
        }
        @keyframes foid-shimmer {
          0% { background-position: -200% center; }
          100% { background-position: 200% center; }
        }

        /* --- Volume --- */
        :global(.cmp-volume) {
          display: flex;
          align-items: center;
          gap: 4px;
          flex-shrink: 0;
          position: relative;
          z-index: 1;
        }
        :global(.cmp-volume__icon) {
          font-size: 14px;
          opacity: 0.5;
          cursor: default;
          line-height: 1;
        }
        :global(.cmp-volume__slider) {
          width: 50px;
          height: 3px;
          -webkit-appearance: none;
          appearance: none;
          background: rgba(255, 255, 255, 0.1);
          border-radius: 1.5px;
          outline: none;
          cursor: pointer;
        }
        :global(.cmp-volume__slider::-webkit-slider-thumb) {
          -webkit-appearance: none;
          width: 10px;
          height: 10px;
          border-radius: 50%;
          background: rgba(190, 255, 235, 0.85);
          border: 1px solid rgba(116, 255, 235, 0.5);
          box-shadow: 0 0 6px rgba(116, 255, 235, 0.3);
          cursor: pointer;
        }
        :global(.cmp-volume__slider::-moz-range-thumb) {
          width: 10px;
          height: 10px;
          border-radius: 50%;
          background: rgba(190, 255, 235, 0.85);
          border: 1px solid rgba(116, 255, 235, 0.5);
          box-shadow: 0 0 6px rgba(116, 255, 235, 0.3);
          cursor: pointer;
        }
      `}</style>
    </>
  );
}
