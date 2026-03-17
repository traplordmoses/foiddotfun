"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import { musicPanelController } from "@/components/musicPanelController";
import { getAudioSettings, subscribe as subscribeAudio, toggleSfx, setMusicEnabled } from "@/lib/audioSettings";

const MusicPanelLogic = dynamic(() => import("./MusicPanel"), { ssr: false });

const formatTrackTime = (seconds: number) => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
};

const AUTO_HIDE_MS = 6000;

type CompactMusicPlayerProps = { mountLogic?: boolean };

export default function CompactMusicPlayer({ mountLogic = true }: CompactMusicPlayerProps) {
  const [state, setState] = useState(musicPanelController.getState());
  const [sfxEnabled, setSfxEnabled] = useState(() => getAudioSettings().sfxEnabled);
  const [musicSettingEnabled, setMusicSettingEnabled] = useState(() => getAudioSettings().musicEnabled);
  const [isExpanded, setIsExpanded] = useState(false);
  const autoHideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const barRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const unsubscribe = musicPanelController.subscribe(() =>
      setState(musicPanelController.getState()),
    );
    return unsubscribe;
  }, []);

  useEffect(() => {
    const unsubscribe = subscribeAudio(() => {
      const s = getAudioSettings();
      setSfxEnabled(s.sfxEnabled);
      setMusicSettingEnabled(s.musicEnabled);
    });
    return unsubscribe;
  }, []);

  const {
    currentTrackName,
    isPlaying,
    progress,
    elapsed,
    duration,
    volume,
  } = state;

  const progressPercent = Number.isFinite(progress) ? Math.min(1, Math.max(0, progress)) : 0;

  const resetAutoHide = useCallback(() => {
    if (autoHideTimer.current) clearTimeout(autoHideTimer.current);
    autoHideTimer.current = setTimeout(() => setIsExpanded(false), AUTO_HIDE_MS);
  }, []);

  const expand = useCallback(() => {
    setIsExpanded(true);
    resetAutoHide();
  }, [resetAutoHide]);

  const collapse = useCallback(() => {
    setIsExpanded(false);
    if (autoHideTimer.current) clearTimeout(autoHideTimer.current);
  }, []);

  const handleBarInteraction = useCallback(() => {
    resetAutoHide();
  }, [resetAutoHide]);

  useEffect(() => {
    return () => {
      if (autoHideTimer.current) clearTimeout(autoHideTimer.current);
    };
  }, []);

  const handleToggle = () => { musicPanelController.toggle(); resetAutoHide(); };
  const handleNext = () => { musicPanelController.next(); resetAutoHide(); };
  const handlePrev = () => { musicPanelController.prev(); resetAutoHide(); };
  const handleMusicToggle = () => { setMusicEnabled(!musicSettingEnabled); resetAutoHide(); };

  const handleVolumeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newVol = parseFloat(e.target.value);
    const delta = newVol - (volume ?? 0);
    musicPanelController.adjustVolume(delta);
    resetAutoHide();
  }, [volume, resetAutoHide]);

  const volumeIcon = (volume ?? 0) === 0 ? "\u{1F507}" : (volume ?? 0) < 0.5 ? "\u{1F509}" : "\u{1F50A}";

  return (
    <>
      {mountLogic && (
        <div className="cmp-logic" aria-hidden="true">
          <MusicPanelLogic />
        </div>
      )}

      {/* Hover zone — invisible strip at bottom edge */}
      {!isExpanded && (
        <div className="cmp-hover-zone" onMouseEnter={expand} />
      )}

      {/* Floating trigger icon */}
      {!isExpanded && (
        <button
          type="button"
          className="cmp-trigger"
          onClick={expand}
          aria-label="Show music player"
          title="Show music player"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M9 18V5l12-2v13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <circle cx="6" cy="18" r="3" stroke="currentColor" strokeWidth="2"/>
            <circle cx="18" cy="16" r="3" stroke="currentColor" strokeWidth="2"/>
          </svg>
        </button>
      )}

      {/* Music bar */}
      <div
        ref={barRef}
        className={`cmp-bar ${isExpanded ? "cmp-bar--visible" : "cmp-bar--hidden"}`}
        onMouseMove={handleBarInteraction}
        onClick={handleBarInteraction}
      >
        {/* SFX toggle (speaker icon) */}
        <button
          type="button"
          className="cmp-sfx-btn"
          onClick={toggleSfx}
          aria-label={sfxEnabled ? "Mute SFX" : "Unmute SFX"}
          title={sfxEnabled ? "Mute SFX" : "Unmute SFX"}
        >
          {sfxEnabled ? (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M11 5.5a1 1 0 0 1 1.58-.81l3.92 2.9a1 1 0 0 1 .4.8v6.22a1 1 0 0 1-.4.8l-3.92 2.9A1 1 0 0 1 11 18.5V5.5zM9 9H6.5A1.5 1.5 0 0 0 5 10.5v3A1.5 1.5 0 0 0 6.5 15H9V9z"/>
              <path d="M18.5 8.6a.9.9 0 0 1 1.27-.1c1.1.95 1.73 2.32 1.73 3.5s-.63 2.55-1.73 3.5a.9.9 0 1 1-1.17-1.36c.7-.6 1.1-1.5 1.1-2.14s-.4-1.54-1.1-2.14a.9.9 0 0 1-.1-1.26z"/>
            </svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M11 5.5a1 1 0 0 1 1.58-.81l3.92 2.9a1 1 0 0 1 .4.8v6.22a1 1 0 0 1-.4.8l-3.92 2.9A1 1 0 0 1 11 18.5V5.5zM9 9H6.5A1.5 1.5 0 0 0 5 10.5v3A1.5 1.5 0 0 0 6.5 15H9V9z"/>
              <path d="M18.3 9.3a1 1 0 0 1 1.4 0L21 10.6l1.3-1.3a1 1 0 1 1 1.4 1.4L22.4 12l1.3 1.3a1 1 0 0 1-1.4 1.4L21 13.4l-1.3 1.3a1 1 0 0 1-1.4-1.4l1.3-1.3-1.3-1.3a1 1 0 0 1 0-1.4z"/>
            </svg>
          )}
        </button>

        {/* Track name */}
        <div className="cmp-track" title={currentTrackName}>
          {currentTrackName}
        </div>

        {/* Playback controls */}
        <div className="cmp-controls">
          <button className="cmp-ctrl-btn" type="button" onClick={handlePrev} title="Previous" aria-label="Previous">
            {"\u23EE"}
          </button>
          <button className="cmp-ctrl-btn cmp-ctrl-btn--play" type="button" onClick={handleToggle} title={isPlaying ? "Pause" : "Play"} aria-label={isPlaying ? "Pause" : "Play"}>
            {isPlaying ? "\u23F8" : "\u25B6"}
          </button>
          <button className="cmp-ctrl-btn" type="button" onClick={handleNext} title="Next" aria-label="Next">
            {"\u23ED"}
          </button>
        </div>

        {/* Progress bar + time */}
        <div className="cmp-progress-wrap">
          <span className="cmp-time">{formatTrackTime(elapsed)}</span>
          <div className="cmp-progress">
            <div className="cmp-progress__fill" style={{ width: `${progressPercent * 100}%` }}>
              <div className="cmp-progress__shimmer" />
            </div>
          </div>
          <span className="cmp-time">{formatTrackTime(duration)}</span>
        </div>

        {/* Volume */}
        <div className="cmp-volume">
          <span className="cmp-volume__icon">{volumeIcon}</span>
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

        {/* Music on/off green dot */}
        <button
          type="button"
          className="cmp-music-toggle"
          onClick={handleMusicToggle}
          aria-label={musicSettingEnabled ? "Disable music" : "Enable music"}
          title={musicSettingEnabled ? "Music on" : "Music off"}
        >
          <span className={`cmp-music-dot ${musicSettingEnabled ? "cmp-music-dot--on" : ""}`} />
        </button>

        {/* Close button */}
        <button
          type="button"
          className="cmp-close-btn"
          onClick={collapse}
          aria-label="Hide music player"
          title="Hide"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
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

        /* --- Hover zone --- */
        :global(.cmp-hover-zone) {
          position: fixed;
          bottom: 0;
          left: 0;
          right: 0;
          height: 8px;
          z-index: 49;
          background: transparent;
        }

        /* --- Floating trigger icon --- */
        :global(.cmp-trigger) {
          position: fixed;
          bottom: 20px;
          left: 20px;
          z-index: 50;
          width: 40px;
          height: 40px;
          border-radius: 50%;
          background: rgba(10, 8, 20, 0.85);
          backdrop-filter: blur(12px);
          border: 1px solid rgba(255, 255, 255, 0.1);
          display: grid;
          place-items: center;
          cursor: pointer;
          padding: 0;
          color: rgba(255, 255, 255, 0.6);
          transition: transform 0.2s ease, color 0.2s ease, border-color 0.2s ease;
          animation: foid-icon-pulse 3s ease-in-out infinite;
        }
        :global(.cmp-trigger:hover) {
          transform: scale(1.08);
          color: rgba(255, 255, 255, 0.9);
          border-color: rgba(255, 255, 255, 0.2);
        }

        @keyframes foid-icon-pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(6, 182, 212, 0.3); }
          50% { box-shadow: 0 0 12px 4px rgba(6, 182, 212, 0.15); }
        }

        /* --- Music bar --- */
        :global(.cmp-bar) {
          position: fixed;
          bottom: 0;
          left: 0;
          right: 0;
          z-index: 50;
          display: flex;
          align-items: center;
          gap: 12px;
          height: 48px;
          padding: 0 16px;
          background: rgba(10, 8, 20, 0.92);
          backdrop-filter: blur(16px);
          border-top: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 12px 12px 0 0;
          color: rgba(255, 255, 255, 0.9);
          transition: transform 0.3s ease-out, border-top-color 0.4s ease;
        }
        :global(.cmp-bar--visible) {
          transform: translateY(0);
          animation: foid-bar-glow 0.4s ease-out;
        }
        :global(.cmp-bar--hidden) {
          transform: translateY(100%);
          pointer-events: none;
          transition-duration: 0.25s;
          transition-timing-function: ease-in;
        }

        @keyframes foid-bar-glow {
          0% { border-top-color: rgba(6, 182, 212, 0.5); }
          100% { border-top-color: rgba(255, 255, 255, 0.08); }
        }

        /* --- SFX toggle --- */
        :global(.cmp-sfx-btn) {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 28px;
          height: 28px;
          padding: 0;
          background: none;
          border: none;
          color: rgba(255, 255, 255, 0.5);
          cursor: pointer;
          flex-shrink: 0;
          transition: color 0.15s;
        }
        :global(.cmp-sfx-btn:hover) {
          color: rgba(255, 255, 255, 0.8);
        }

        /* --- Track name --- */
        :global(.cmp-track) {
          flex-shrink: 0;
          max-width: 180px;
          font-size: 13px;
          font-weight: 600;
          letter-spacing: 0.04em;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          color: rgba(190, 255, 235, 0.9);
          text-shadow: 0 0 8px rgba(140, 255, 220, 0.3);
        }

        /* --- Playback controls --- */
        :global(.cmp-controls) {
          display: flex;
          align-items: center;
          gap: 4px;
          flex-shrink: 0;
        }
        :global(.cmp-ctrl-btn) {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 28px;
          height: 28px;
          padding: 0;
          font-size: 15px;
          background: none;
          border: none;
          color: rgba(255, 255, 255, 0.6);
          cursor: pointer;
          transition: color 0.15s, transform 0.15s;
          border-radius: 50%;
        }
        :global(.cmp-ctrl-btn:hover) {
          color: rgba(255, 255, 255, 0.9);
          transform: scale(1.1);
        }
        :global(.cmp-ctrl-btn--play) {
          width: 32px;
          height: 32px;
          font-size: 17px;
          color: rgba(255, 255, 255, 0.8);
          background: rgba(255, 255, 255, 0.06);
          border: 1px solid rgba(255, 255, 255, 0.12);
        }
        :global(.cmp-ctrl-btn--play:hover) {
          color: rgba(255, 255, 255, 1);
        }

        /* --- Progress --- */
        :global(.cmp-progress-wrap) {
          flex: 1;
          display: flex;
          align-items: center;
          gap: 8px;
          min-width: 0;
        }
        :global(.cmp-time) {
          font-family: var(--font-mono, monospace);
          font-size: 11px;
          color: rgba(255, 255, 255, 0.4);
          flex-shrink: 0;
          min-width: 32px;
          text-align: center;
        }
        :global(.cmp-progress) {
          flex: 1;
          height: 4px;
          background: rgba(255, 255, 255, 0.1);
          border-radius: 2px;
          overflow: hidden;
          cursor: pointer;
        }
        :global(.cmp-progress__fill) {
          height: 100%;
          background: linear-gradient(90deg, #06b6d4, #8b5cf6);
          border-radius: 2px;
          transition: width 0.3s linear;
          position: relative;
          overflow: hidden;
        }
        :global(.cmp-progress__shimmer) {
          position: absolute;
          inset: 0;
          background-image: linear-gradient(90deg, transparent, rgba(255,255,255,0.15), transparent);
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
          gap: 5px;
          flex-shrink: 0;
        }
        :global(.cmp-volume__icon) {
          font-size: 16px;
          opacity: 0.5;
          cursor: default;
          transition: opacity 0.15s;
        }
        :global(.cmp-volume__icon:hover) {
          opacity: 0.8;
        }
        :global(.cmp-volume__slider) {
          width: 64px;
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
          background: rgba(190, 255, 235, 0.85);
          border: 1px solid rgba(116, 255, 235, 0.5);
          box-shadow: 0 0 4px rgba(116, 255, 235, 0.3);
          cursor: pointer;
        }
        :global(.cmp-volume__slider::-moz-range-thumb) {
          width: 10px;
          height: 10px;
          border-radius: 50%;
          background: rgba(190, 255, 235, 0.85);
          border: 1px solid rgba(116, 255, 235, 0.5);
          box-shadow: 0 0 4px rgba(116, 255, 235, 0.3);
          cursor: pointer;
        }

        /* --- Music on/off green dot toggle --- */
        :global(.cmp-music-toggle) {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 20px;
          height: 20px;
          padding: 0;
          background: none;
          border: none;
          cursor: pointer;
          flex-shrink: 0;
        }
        :global(.cmp-music-dot) {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.2);
          transition: background 0.2s ease, box-shadow 0.2s ease;
        }
        :global(.cmp-music-dot--on) {
          background: #22c55e;
          box-shadow: 0 0 6px rgba(34, 197, 94, 0.5);
        }

        /* --- Close button --- */
        :global(.cmp-close-btn) {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 24px;
          height: 24px;
          padding: 0;
          background: none;
          border: none;
          color: rgba(255, 255, 255, 0.4);
          cursor: pointer;
          flex-shrink: 0;
          transition: color 0.15s;
        }
        :global(.cmp-close-btn:hover) {
          color: rgba(255, 255, 255, 0.8);
        }
      `}</style>
    </>
  );
}
