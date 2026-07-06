"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import { musicPanelController } from "@/components/musicPanelController";
import { getAudioSettings, setMusicEnabled } from "@/lib/audioSettings";
import { useAmpStore } from "@/stores/ampStore";

const MusicPanelLogic = dynamic(() => import("./MusicPanel"), { ssr: false });

// Deck height: LCD strip + seek lane stacked. PaintEditor clears the bar via
// html.cmp-active with a fixed 64+48px pad, so anything ≤ ~100px is safe.
const PLAYER_HEIGHT = 54;

const formatTime = (seconds: number) => {
  const safe = Number.isFinite(seconds) && seconds > 0 ? seconds : 0;
  const m = Math.floor(safe / 60);
  const s = Math.floor(safe % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
};

type CompactMusicPlayerProps = { mountLogic?: boolean };

export default function CompactMusicPlayer({ mountLogic = true }: CompactMusicPlayerProps) {
  const [state, setState] = useState(musicPanelController.getState());
  // MUSIC.EXE is a dock app: the dock's Music tile toggles it, the deck's
  // close orb closes it. No hover-reveal, no auto-hide.
  const isVisible = useAmpStore((s) => s.open);
  const closeAmp = useAmpStore((s) => s.close);
  const barRef = useRef<HTMLDivElement>(null);
  const isMobileRef = useRef(false);

  useEffect(() => {
    const unsubscribe = musicPanelController.subscribe(() =>
      setState(musicPanelController.getState()),
    );
    return unsubscribe;
  }, []);

  const { currentTrackName, isPlaying, progress, volume, shuffle, elapsed, duration } = state;
  const progressPercent = Number.isFinite(progress) ? Math.min(1, Math.max(0, progress)) : 0;
  const timeLabel = duration > 0 || elapsed > 0 ? formatTime(elapsed) : "--:--";

  // LCD marquee: only scroll when the track name actually overflows the LCD.
  // We measure the first (single) copy of the text against the container, so
  // toggling the duplicate copy on/off never skews the measurement.
  const lcdTitleRef = useRef<HTMLDivElement>(null);
  const lcdTextRef = useRef<HTMLSpanElement>(null);
  const [titleOverflows, setTitleOverflows] = useState(false);

  useEffect(() => {
    const container = lcdTitleRef.current;
    const text = lcdTextRef.current;
    if (!container || !text) return;
    const measure = () => {
      setTitleOverflows(text.scrollWidth > container.clientWidth + 1);
    };
    measure();
    // Re-measure once webfonts land (var(--font-terminal) can change widths).
    if (typeof document !== "undefined" && document.fonts?.ready) {
      document.fonts.ready.then(measure).catch(() => {});
    }
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(measure);
    ro.observe(container);
    return () => ro.disconnect();
  }, [currentTrackName]);

  // Visibility signal only: PaintEditor observes this class to pad its
  // toolbar clear of the bar. No stylesheet may attach layout to it — the
  // old "content push" rules shrank every vista-window by 38px on
  // show/hide, a feelable layout jump. The player is a pure overlay.
  useEffect(() => {
    document.documentElement.classList.toggle("cmp-active", isVisible);
    return () => document.documentElement.classList.remove("cmp-active");
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

  // ── Native-player mode: drag the deck anywhere; position is remembered
  // while it stays open. Double-click an empty spot to snap it back to its
  // home position above the dock.
  const [barOffset, setBarOffset] = useState<{ x: number; y: number } | null>(null);
  const pinnedRef = useRef(false);
  pinnedRef.current = barOffset !== null;

  const handleBarPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (isMobileRef.current) return;
    const target = e.target as HTMLElement;
    if (target.closest("button, input, a, select, .cmp-resize")) return;
    e.preventDefault();

    const startX = e.clientX;
    const startY = e.clientY;
    const base = barOffset ?? { x: 0, y: 0 };
    let live = base;
    let raf = 0;
    const bar = barRef.current;

    const onMove = (ev: PointerEvent) => {
      const maxX = window.innerWidth / 2 - 80;
      const minY = -(window.innerHeight - 140);
      live = {
        x: Math.max(-maxX, Math.min(maxX, base.x + (ev.clientX - startX))),
        y: Math.max(minY, Math.min(0, base.y + (ev.clientY - startY))),
      };
      if (!raf) {
        raf = requestAnimationFrame(() => {
          raf = 0;
          if (bar) bar.style.transform = `translate(${live.x}px, ${live.y}px)`;
        });
      }
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      document.body.classList.remove("foid-window-dragging");
      setBarOffset(live);
    };
    document.body.classList.add("foid-window-dragging");
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }, [barOffset]);

  // Adjustable deck width — drag the right edge (400–760px). The LCD lane
  // flexes; transport and the right cluster keep their geometry.
  const [deckWidth, setDeckWidth] = useState<number | null>(null);
  const startDeckResize = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (isMobileRef.current) return;
    e.preventDefault();
    e.stopPropagation();
    const bar = barRef.current;
    if (!bar) return;
    const startX = e.clientX;
    const baseW = deckWidth ?? bar.getBoundingClientRect().width;
    let live = baseW;
    let raf = 0;
    document.body.style.cursor = "ew-resize";
    const onMove = (ev: PointerEvent) => {
      live = Math.max(400, Math.min(760, baseW + (ev.clientX - startX)));
      if (!raf) {
        raf = requestAnimationFrame(() => {
          raf = 0;
          bar.style.width = `${live}px`;
          bar.style.maxWidth = "none";
        });
      }
    };
    const onUp = () => {
      document.body.style.cursor = "";
      document.body.classList.remove("foid-window-dragging");
      setDeckWidth(live);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    document.body.classList.add("foid-window-dragging");
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }, [deckWidth]);

  // Windowshade — the Winamp classic. The titlebar's shade button (or a
  // double-click on the strip) collapses the deck to just the title bar
  // with a mini play control; same gesture expands it back.
  const [shaded, setShaded] = useState(false);
  const toggleShade = useCallback(() => setShaded((s) => !s), []);
  const handleTitlebarDoubleClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (target.closest("button, input, a, select")) return;
    toggleShade();
  }, [toggleShade]);

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

  return (
    <>
      {mountLogic && (
        // The logic panel is rendered off-screen via clip-path so its
        // buttons can be wired to the React tree, but users never see or
        // reach it. We need BOTH aria-hidden (remove from AT) AND `inert`
        // (remove from tab order). Without `inert`, keyboard users can
        // Tab into invisible buttons and get stuck — an axe-core
        // "aria-hidden-focus" violation.
        <div className="cmp-logic" aria-hidden="true" {...({ inert: "" } as Record<string, string>)}>
          <MusicPanelLogic />
        </div>
      )}

      {/* MUSIC.EXE deck — opened from the dock's Music tile */}
      <div className={`cmp-bar-outer ${isVisible ? "cmp-bar-outer--visible" : "cmp-bar-outer--hidden"}`}>
        <div
          ref={barRef}
          className={`cmp-bar ${shaded ? "cmp-bar--shaded" : ""}`}
          onPointerDown={handleBarPointerDown}
          style={{
            transform: barOffset ? `translate(${barOffset.x}px, ${barOffset.y}px)` : undefined,
            width: deckWidth ? `${deckWidth}px` : undefined,
            maxWidth: deckWidth ? "none" : undefined,
          }}
        >
          {/* Right-edge width grip — drag to size the deck (400–760px) */}
          <div
            className="cmp-resize"
            role="presentation"
            aria-hidden="true"
            onPointerDown={startDeckResize}
          />
          {/* Titlebar strip — the visible drag surface + window controls.
              Close on the left (mac convention), shade toggle on the right,
              brand centered. Double-click shades, the Winamp way. */}
          <div
            className="cmp-titlebar"
            onDoubleClick={handleTitlebarDoubleClick}
            title="drag to move · double-click to shade"
          >
            <button
              type="button"
              className="cmp-titlebar__close vista-window__control vista-window__control--close"
              aria-label="Close MUSIC.EXE"
              title="Close"
              onClick={closeAmp}
            />
            <span className="cmp-titlebar__brand">MUSIC.EXE</span>
            <button
              type="button"
              className="cmp-titlebar__shade"
              aria-label={shaded ? "Expand player" : "Collapse to title bar"}
              aria-expanded={!shaded}
              title={shaded ? "Expand" : "Shade"}
              onClick={toggleShade}
            >
              <span aria-hidden="true">{shaded ? "▾" : "▴"}</span>
            </button>
          </div>

          {shaded && (
            /* Windowshade row: mini transport + title + time */
            <div className="cmp-shade">
              <button
                className="cmp-gel cmp-gel--shade"
                type="button"
                onClick={handleToggle}
                title={isPlaying ? "Pause" : "Play"}
                aria-label={isPlaying ? "Pause" : "Play"}
              >
                {isPlaying ? "⏸" : "▶"}
              </button>
              <div className="cmp-shade__title" title={currentTrackName}>
                {currentTrackName}
              </div>
              <span className="cmp-shade__time">{timeLabel}</span>
            </div>
          )}

          <div className="cmp-body" hidden={shaded}>
          {/* Transport cluster \u2014 gel buttons */}
          <div className="cmp-transport">
            <button className="cmp-gel" type="button" onClick={handlePrev} title="Previous" aria-label="Previous">
              {"\u23EE"}
            </button>
            <button
              className="cmp-gel cmp-gel--play"
              type="button"
              onClick={handleToggle}
              title={isPlaying ? "Pause" : "Play"}
              aria-label={isPlaying ? "Pause" : "Play"}
            >
              {isPlaying ? "\u23F8" : "\u25B6"}
            </button>
            <button className="cmp-gel" type="button" onClick={handleNext} title="Next" aria-label="Next">
              {"\u23ED"}
            </button>
          </div>

          {/* Deck center: LCD + seek lane. Brand lives in the titlebar now;
              the LCD is title + time on one clean line. */}
          <div className="cmp-deck">
            <div className="cmp-lcd">
              <div className="cmp-lcd__row">
                <div className="cmp-lcd__title" ref={lcdTitleRef} title={currentTrackName}>
                  <div className={`cmp-lcd__scroll ${titleOverflows ? "cmp-lcd__scroll--marquee" : ""}`}>
                    <span className="cmp-lcd__text" ref={lcdTextRef}>
                      {currentTrackName}
                    </span>
                    {titleOverflows && (
                      <span className="cmp-lcd__text cmp-lcd__text--dupe" aria-hidden="true">
                        {currentTrackName}
                      </span>
                    )}
                  </div>
                </div>
                <span
                  className="cmp-lcd__time"
                  title={duration > 0 ? `${formatTime(elapsed)} / ${formatTime(duration)}` : undefined}
                >
                  {timeLabel}
                </span>
              </div>
            </div>
            {/* Read-only: musicPanelController exposes no seek/setProgress \u2014
                the <audio> element lives inside MusicPanel and only volume /
                transport are bridged. If a seek(fraction) method is ever
                added to the controller, this lane is where the thumb goes. */}
            <div
              className="cmp-seek"
              role="progressbar"
              aria-label="Track progress"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(progressPercent * 100)}
            >
              <div className="cmp-seek__fill" style={{ width: `${progressPercent * 100}%` }} />
            </div>
          </div>

          {/* Right cluster: shuffle + volume */}
          <button
            className={`cmp-gel cmp-gel--sm ${shuffle ? "cmp-gel--lit" : ""}`}
            type="button"
            onClick={handleShuffle}
            title={shuffle ? "Shuffle on" : "Shuffle off"}
            aria-label={shuffle ? "Shuffle on" : "Shuffle off"}
          >
            {"\u{1F500}"}
          </button>
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

        /* --- Outer wrapper: fixed above the dock, centers the deck --- */
        :global(.cmp-bar-outer) {
          position: fixed;
          bottom: 92px; /* clears the dock (64px pill + 10px gap + breath) */
          left: 0;
          right: 0;
          z-index: 50;
          display: flex;
          justify-content: center;
          pointer-events: none;
          transition: transform 0.35s cubic-bezier(0.22, 1, 0.36, 1),
                      opacity 0.3s ease;
        }
        :global(.cmp-bar-outer--visible) {
          transform: translateY(0);
          opacity: 1;
        }
        :global(.cmp-bar-outer--hidden) {
          transform: translateY(calc(100% + 120px));
          opacity: 0;
          transition-duration: 0.3s;
          transition-timing-function: ease-in;
        }
        @media (max-width: 1023px) {
          :global(.cmp-bar-outer) { display: none !important; }
        }

        /* ===== MUSIC.EXE deck: Winamp layout in aero glass ===== */
        :global(.cmp-bar) {
          width: calc(100% - 32px);
          max-width: 560px;
          display: flex;
          flex-direction: column;
          align-items: stretch;
        }

        /* --- Width grip: right edge of the deck, below the titlebar --- */
        :global(.cmp-resize) {
          position: absolute;
          top: 22px;
          right: 0;
          bottom: 0;
          width: 7px;
          cursor: ew-resize;
          z-index: 3;
        }
        @media (max-width: 1023px) {
          :global(.cmp-resize) {
            display: none;
          }
        }

        /* --- Titlebar strip: the visible drag surface + window controls --- */
        :global(.cmp-titlebar) {
          display: flex;
          align-items: center;
          gap: 8px;
          height: 22px;
          padding: 0 8px;
          background: linear-gradient(180deg, rgba(255, 255, 255, 0.10), rgba(0, 0, 0, 0.18));
          border-bottom: 1px solid rgba(255, 255, 255, 0.10);
          cursor: grab;
          user-select: none;
          -webkit-user-select: none;
          position: relative;
          z-index: 2;
        }
        :global(.cmp-titlebar__close) {
          position: static;
          width: 11px !important;
          height: 11px !important;
          flex-shrink: 0;
        }
        :global(.cmp-titlebar__brand) {
          flex: 1;
          text-align: center;
          font-family: var(--font-terminal);
          font-size: 9px;
          letter-spacing: 0.3em;
          text-transform: uppercase;
          color: var(--foid-text-mute);
          pointer-events: none;
        }
        :global(.cmp-titlebar__shade) {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 22px;
          height: 16px;
          padding: 0;
          border: 1px solid rgba(255, 255, 255, 0.18);
          border-radius: 5px;
          background: rgba(255, 255, 255, 0.08);
          color: var(--foid-text-dim);
          font-size: 9px;
          line-height: 1;
          cursor: pointer;
          flex-shrink: 0;
          transition: background var(--foid-motion-fast) ease;
        }
        :global(.cmp-titlebar__shade:hover) {
          background: rgba(255, 255, 255, 0.16);
          color: var(--foid-text);
        }
        :global(.cmp-titlebar__shade:focus-visible),
        :global(.cmp-titlebar__close:focus-visible) {
          outline: 2px solid var(--foid-focus-ring);
          outline-offset: 2px;
        }

        /* --- Windowshade row: mini transport + title + time --- */
        :global(.cmp-shade) {
          display: flex;
          align-items: center;
          gap: 10px;
          height: 30px;
          padding: 0 10px;
        }
        :global(.cmp-shade__title) {
          flex: 1;
          min-width: 0;
          font-family: var(--font-terminal);
          font-size: 11px;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: var(--foid-cyan-electric);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        :global(.cmp-shade__time) {
          font-family: var(--font-terminal);
          font-size: 10px;
          color: var(--foid-text-dim);
          font-variant-numeric: tabular-nums;
          flex-shrink: 0;
        }
        :global(.cmp-gel--shade) {
          width: 22px !important;
          height: 22px !important;
          font-size: 9px !important;
        }

        /* --- Deck body: transport / LCD / shuffle+volume --- */
        :global(.cmp-body) {
          display: flex;
          align-items: center;
          gap: 12px;
          height: ${PLAYER_HEIGHT}px;
          padding: 0 14px;
        }
        :global(.cmp-body[hidden]) {
          display: none;
        }
        :global(.cmp-bar) {

          /* Liquid glass */
          background: linear-gradient(
            180deg,
            rgba(60, 130, 180, 0.28) 0%,
            rgba(30, 60, 100, 0.42) 100%
          );
          backdrop-filter: blur(24px) saturate(1.3);
          -webkit-backdrop-filter: blur(24px) saturate(1.3);

          /* Borders — full ring; the bar floats, it isn't docked */
          border: 1px solid rgba(255, 255, 255, 0.18);
          border-top-color: rgba(255, 255, 255, 0.22);
          border-radius: var(--foid-radius-lg);

          /* Shadow — floating elevation, light from above */
          box-shadow:
            0 12px 32px rgba(0, 10, 30, 0.45),
            0 -4px 20px rgba(0, 40, 80, 0.15),
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
          border-radius: var(--foid-radius-lg) var(--foid-radius-lg) 0 0;
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
            border-radius: var(--foid-radius-md);
          }
        }

        /* --- Transport cluster: beveled glass gel buttons --- */
        :global(.cmp-transport) {
          display: flex;
          align-items: center;
          gap: 6px;
          flex-shrink: 0;
          position: relative;
          z-index: 1;
        }
        :global(.cmp-gel) {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 32px;
          height: 32px;
          padding: 0;
          font-size: 11px;
          line-height: 1;
          border-radius: 50%;
          color: var(--foid-text-dim);
          cursor: pointer;
          flex-shrink: 0;
          position: relative;
          z-index: 1;
          background: linear-gradient(
            180deg,
            rgba(255, 255, 255, 0.3) 0%,
            rgba(255, 255, 255, 0.08) 45%,
            rgba(8, 22, 44, 0.4) 100%
          );
          border: 1px solid var(--foid-border-mute);
          border-top-color: rgba(255, 255, 255, 0.35);
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.35),
            inset 0 -2px 4px rgba(4, 12, 28, 0.35),
            0 2px 5px rgba(0, 10, 30, 0.35);
          transition:
            color var(--foid-motion-fast),
            box-shadow var(--foid-motion-fast),
            border-color var(--foid-motion-fast);
        }
        /* Gel cap highlight — the aqua dome */
        :global(.cmp-gel::before) {
          content: "";
          position: absolute;
          top: 2px;
          left: 18%;
          right: 18%;
          height: 42%;
          border-radius: 50%;
          background: linear-gradient(180deg, rgba(255, 255, 255, 0.5), transparent);
          pointer-events: none;
        }
        :global(.cmp-gel:hover) {
          color: var(--foid-text);
          border-color: var(--foid-border-subtle);
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.4),
            inset 0 -2px 4px rgba(4, 12, 28, 0.35),
            0 2px 6px rgba(0, 10, 30, 0.4),
            0 0 12px var(--foid-glow);
        }
        :global(.cmp-gel:active) {
          color: var(--foid-text);
          box-shadow:
            inset 0 2px 6px rgba(4, 12, 28, 0.6),
            inset 0 -1px 0 rgba(255, 255, 255, 0.12);
        }
        :global(.cmp-gel:active::before) {
          opacity: 0.4;
        }
        :global(.cmp-gel--play) {
          width: 38px;
          height: 38px;
          font-size: 14px;
          color: var(--foid-text);
          border-color: var(--foid-border-subtle);
          background: linear-gradient(
            180deg,
            rgba(255, 255, 255, 0.34) 0%,
            rgba(116, 255, 235, 0.12) 45%,
            rgba(8, 26, 48, 0.45) 100%
          );
        }
        :global(.cmp-gel--play:hover) {
          border-color: var(--foid-border-strong);
        }
        :global(.cmp-gel--sm) {
          width: 26px;
          height: 26px;
          font-size: 10px;
        }
        /* Lit toggle (shuffle on) — cyan ring glow; works even though the
           glyph is a color emoji that ignores 'color'. */
        :global(.cmp-gel--lit) {
          border-color: var(--foid-border-strong);
          background: linear-gradient(
            180deg,
            rgba(255, 255, 255, 0.3) 0%,
            color-mix(in srgb, var(--foid-cyan-electric) 22%, transparent) 45%,
            rgba(8, 26, 48, 0.45) 100%
          );
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.35),
            inset 0 -2px 4px rgba(4, 12, 28, 0.35),
            0 0 10px var(--foid-glow),
            0 0 18px color-mix(in srgb, var(--foid-cyan-electric) 30%, transparent);
        }

        /* --- Deck center: LCD + seek lane --- */
        :global(.cmp-deck) {
          flex: 1;
          min-width: 0;
          display: flex;
          flex-direction: column;
          gap: 4px;
          justify-content: center;
          position: relative;
          z-index: 1;
        }

        /* Recessed dark-glass LCD */
        :global(.cmp-lcd) {
          position: relative;
          border-radius: var(--foid-radius-sm);
          padding: 3px 8px 4px;
          background: linear-gradient(180deg, rgba(2, 8, 16, 0.92), rgba(4, 16, 30, 0.8));
          border: 1px solid rgba(0, 0, 0, 0.55);
          border-bottom-color: rgba(255, 255, 255, 0.14);
          box-shadow:
            inset 0 2px 6px rgba(0, 0, 0, 0.6),
            inset 0 -1px 0 rgba(116, 255, 235, 0.06);
          overflow: hidden;
        }
        /* Faint scanlines */
        :global(.cmp-lcd::after) {
          content: "";
          position: absolute;
          inset: 0;
          background: repeating-linear-gradient(
            0deg,
            transparent 0 2px,
            rgba(255, 255, 255, 0.03) 2px 3px
          );
          pointer-events: none;
        }
        :global(.cmp-lcd__row) {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
        }
        :global(.cmp-lcd__time) {
          font-family: var(--font-terminal);
          font-size: 10px;
          letter-spacing: 0.08em;
          color: color-mix(in srgb, var(--foid-cyan) 70%, transparent);
          line-height: 1.2;
          font-variant-numeric: tabular-nums;
          flex-shrink: 0;
        }
        :global(.cmp-lcd__title) {
          font-family: var(--font-terminal);
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          line-height: 1.3;
          color: var(--foid-cyan);
          text-shadow: 0 0 6px var(--foid-glow);
          white-space: nowrap;
          overflow: hidden;
        }
        :global(.cmp-lcd__scroll) {
          display: inline-flex;
          width: max-content;
        }
        :global(.cmp-lcd__text) {
          padding-right: 2.5em;
        }
        :global(.cmp-lcd__scroll--marquee) {
          animation: cmp-marquee 14s linear infinite;
        }
        /* Marquee pauses while reading the LCD */
        :global(.cmp-lcd:hover .cmp-lcd__scroll--marquee) {
          animation-play-state: paused;
        }
        @keyframes cmp-marquee {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }

        /* --- Seek lane: recessed track, glowing cyan fill (read-only — the
           controller has no seek method) --- */
        :global(.cmp-seek) {
          width: 100%;
          height: 5px;
          border-radius: 3px;
          background: rgba(2, 8, 18, 0.75);
          box-shadow:
            inset 0 1px 3px rgba(0, 0, 0, 0.6),
            inset 0 -1px 0 rgba(255, 255, 255, 0.08);
          overflow: hidden;
        }
        :global(.cmp-seek__fill) {
          height: 100%;
          border-radius: 3px;
          background: linear-gradient(
            90deg,
            color-mix(in srgb, var(--foid-cyan) 70%, var(--foid-cyan-electric)),
            var(--foid-cyan-electric)
          );
          box-shadow:
            0 0 8px color-mix(in srgb, var(--foid-cyan-electric) 60%, transparent),
            0 0 2px var(--foid-cyan-electric);
          transition: width 0.3s linear;
        }

        /* --- Volume --- */
        :global(.cmp-volume) {
          display: flex;
          align-items: center;
          gap: 6px;
          flex-shrink: 0;
          position: relative;
          z-index: 1;
        }
        :global(.cmp-volume__icon) {
          font-size: 13px;
          opacity: 0.55;
          cursor: default;
          line-height: 1;
        }
        :global(.cmp-volume__slider) {
          width: 76px;
          height: 5px;
          /* globals.css pads all inputs (0.65rem 0.9rem) — a range track must
             stay a slim 5px lane, so flatten the box model here. */
          padding: 0;
          margin: 0;
          box-sizing: border-box;
          -webkit-appearance: none;
          appearance: none;
          border-radius: 3px;
          background: rgba(2, 8, 18, 0.75);
          box-shadow:
            inset 0 1px 3px rgba(0, 0, 0, 0.6),
            inset 0 -1px 0 rgba(255, 255, 255, 0.08);
          outline: none;
          cursor: pointer;
        }
        :global(.cmp-volume__slider::-webkit-slider-thumb) {
          -webkit-appearance: none;
          width: 13px;
          height: 13px;
          border-radius: 50%;
          background: radial-gradient(
            circle at 35% 28%,
            rgba(255, 255, 255, 0.95),
            var(--foid-cyan) 55%,
            rgba(16, 110, 100, 0.95)
          );
          border: 1px solid rgba(255, 255, 255, 0.5);
          box-shadow:
            0 1px 3px rgba(0, 10, 30, 0.5),
            0 0 6px var(--foid-glow);
          cursor: pointer;
        }
        :global(.cmp-volume__slider::-moz-range-thumb) {
          width: 13px;
          height: 13px;
          border-radius: 50%;
          background: radial-gradient(
            circle at 35% 28%,
            rgba(255, 255, 255, 0.95),
            var(--foid-cyan) 55%,
            rgba(16, 110, 100, 0.95)
          );
          border: 1px solid rgba(255, 255, 255, 0.5);
          box-shadow:
            0 1px 3px rgba(0, 10, 30, 0.5),
            0 0 6px var(--foid-glow);
          cursor: pointer;
        }
        :global(.cmp-volume__slider::-moz-range-track) {
          height: 5px;
          border-radius: 3px;
          background: rgba(2, 8, 18, 0.75);
        }
        :global(.cmp-volume__slider::-moz-range-progress) {
          height: 5px;
          border-radius: 3px;
          background: var(--foid-cyan-electric);
        }

        /* --- Reduced motion: no marquee, no entry glow, no seek easing.
           The overflowing title falls back to a hard-clipped single copy. --- */
        @media (prefers-reduced-motion: reduce) {
          :global(.cmp-lcd__scroll--marquee) {
            animation: none;
          }
          :global(.cmp-lcd__scroll) {
            width: 100%;
          }
          :global(.cmp-lcd__text) {
            overflow: hidden;
            text-overflow: ellipsis;
            padding-right: 0;
            min-width: 0;
          }
          :global(.cmp-lcd__text--dupe) {
            display: none;
          }
          :global(.cmp-bar-outer--visible .cmp-bar) {
            animation: none;
          }
          :global(.cmp-seek__fill) {
            transition: none;
          }
        }
      `}</style>
    </>
  );
}
