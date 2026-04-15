"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import { musicPanelController } from "@/components/musicPanelController";

const MusicPanelLogic = dynamic(() => import("./MusicPanel"), { ssr: false });

const HIDE_DELAY_SCROLL = 1000;
const HIDE_DELAY_HOVER = 2000;
const SCROLL_BOTTOM_THRESHOLD = 120;
const PLAYER_HEIGHT = 32;

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

  const { isPlaying, progress, volume } = state;
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

  // Content push: animate padding on app-viewport via CSS custom property
  useEffect(() => {
    const viewport = document.querySelector<HTMLElement>(".app-viewport");
    if (!viewport) return;
    viewport.style.setProperty("--cmp-extra-pb", isVisible ? `${PLAYER_HEIGHT}px` : "0px");
  }, [isVisible]);

  // Mobile: scroll-based reveal
  useEffect(() => {
    const checkMobile = () => {
      isMobileRef.current = window.matchMedia("(max-width: 1023px)").matches;
    };
    checkMobile();

    const handleScroll = () => {
      if (!isMobileRef.current) return;

      const scrollTop = window.scrollY || document.documentElement.scrollTop;
      const windowHeight = window.innerHeight;
      const docHeight = document.documentElement.scrollHeight;
      const distFromBottom = docHeight - (scrollTop + windowHeight);

      if (distFromBottom <= SCROLL_BOTTOM_THRESHOLD) {
        show();
      } else {
        if (!hideTimer.current) {
          scheduleHide(HIDE_DELAY_SCROLL);
        }
      }
    };

    const handleResize = () => {
      checkMobile();
      if (!isMobileRef.current) {
        // Switched to desktop — let hover handle it
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("resize", handleResize);

    // Check initial position
    handleScroll();

    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", handleResize);
    };
  }, [show, scheduleHide]);

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

  // Controls
  const handleToggle = () => musicPanelController.toggle();
  const handleNext = () => musicPanelController.next();

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

      {/* Desktop hover zone — invisible strip at bottom edge */}
      {!isVisible && (
        <div className="cmp-hover-zone" onMouseEnter={handleHoverEnter} />
      )}

      {/* Minimal music bar */}
      <div
        ref={barRef}
        className={`cmp-bar ${isVisible ? "cmp-bar--visible" : "cmp-bar--hidden"}`}
        onMouseEnter={handleBarMouseEnter}
        onMouseLeave={handleBarMouseLeave}
      >
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
        <button
          className="cmp-ctrl-btn"
          type="button"
          onClick={handleNext}
          title="Next"
          aria-label="Next"
        >
          {"\u23ED"}
        </button>

        {/* Progress bar */}
        <div className="cmp-progress">
          <div className="cmp-progress__fill" style={{ width: `${progressPercent * 100}%` }}>
            <div className="cmp-progress__shimmer" />
          </div>
        </div>

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
          :global(.cmp-hover-zone) {
            display: none;
          }
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
          gap: 8px;
          height: ${PLAYER_HEIGHT}px;
          padding: 0 12px;
          background: rgba(10, 8, 20, 0.88);
          backdrop-filter: blur(14px);
          -webkit-backdrop-filter: blur(14px);
          border-top: 1px solid rgba(255, 255, 255, 0.06);
          color: rgba(255, 255, 255, 0.85);
          transition: transform 0.35s cubic-bezier(0.22, 1, 0.36, 1),
                      border-top-color 0.4s ease;
        }
        :global(.cmp-bar--visible) {
          transform: translateY(0);
          animation: foid-bar-glow 0.4s ease-out;
        }
        :global(.cmp-bar--hidden) {
          transform: translateY(100%);
          pointer-events: none;
          transition-duration: 0.3s;
          transition-timing-function: ease-in;
        }

        @keyframes foid-bar-glow {
          0% { border-top-color: rgba(6, 182, 212, 0.45); }
          100% { border-top-color: rgba(255, 255, 255, 0.06); }
        }

        /* Mobile: sit above MobileNav */
        @media (max-width: 1023px) {
          :global(.cmp-bar) {
            bottom: 56px;
          }
        }

        /* --- Controls --- */
        :global(.cmp-ctrl-btn) {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 22px;
          height: 22px;
          padding: 0;
          font-size: 12px;
          background: none;
          border: none;
          color: rgba(255, 255, 255, 0.55);
          cursor: pointer;
          transition: color 0.15s, transform 0.15s;
          border-radius: 50%;
          flex-shrink: 0;
        }
        :global(.cmp-ctrl-btn:hover) {
          color: rgba(255, 255, 255, 0.9);
          transform: scale(1.1);
        }
        :global(.cmp-ctrl-btn--play) {
          width: 26px;
          height: 26px;
          font-size: 13px;
          color: rgba(255, 255, 255, 0.75);
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
        }
        :global(.cmp-ctrl-btn--play:hover) {
          color: rgba(255, 255, 255, 1);
          background: rgba(255, 255, 255, 0.08);
        }

        /* --- Progress bar --- */
        :global(.cmp-progress) {
          flex: 1;
          height: 3px;
          background: rgba(255, 255, 255, 0.08);
          border-radius: 1.5px;
          overflow: hidden;
          min-width: 0;
        }
        :global(.cmp-progress__fill) {
          height: 100%;
          background: linear-gradient(90deg, #06b6d4, #8b5cf6);
          border-radius: 1.5px;
          transition: width 0.3s linear;
          position: relative;
          overflow: hidden;
        }
        :global(.cmp-progress__shimmer) {
          position: absolute;
          inset: 0;
          background-image: linear-gradient(90deg, transparent, rgba(255,255,255,0.12), transparent);
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
        }
        :global(.cmp-volume__icon) {
          font-size: 13px;
          opacity: 0.45;
          cursor: default;
          line-height: 1;
        }
        :global(.cmp-volume__slider) {
          width: 48px;
          height: 3px;
          -webkit-appearance: none;
          appearance: none;
          background: rgba(255, 255, 255, 0.08);
          border-radius: 1.5px;
          outline: none;
          cursor: pointer;
        }
        :global(.cmp-volume__slider::-webkit-slider-thumb) {
          -webkit-appearance: none;
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: rgba(190, 255, 235, 0.8);
          border: 1px solid rgba(116, 255, 235, 0.4);
          box-shadow: 0 0 3px rgba(116, 255, 235, 0.25);
          cursor: pointer;
        }
        :global(.cmp-volume__slider::-moz-range-thumb) {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: rgba(190, 255, 235, 0.8);
          border: 1px solid rgba(116, 255, 235, 0.4);
          box-shadow: 0 0 3px rgba(116, 255, 235, 0.25);
          cursor: pointer;
        }
      `}</style>
    </>
  );
}
