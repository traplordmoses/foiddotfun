"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ChevronIcon,
  CloseIcon,
  MuteIcon,
  NextIcon,
  PauseIcon,
  PlayIcon,
  PrevIcon,
  ShuffleIcon,
  SwapIcon,
  VolumeIcon,
  type VolumeLevel,
} from "@/components/icons/AeroIcons";
import { musicPanelController } from "@/components/musicPanelController";
import { getAudioSettings, setMusicEnabled } from "@/lib/audioSettings";
import { usePathname } from "next/navigation";
import { FOID_DESKTOP_ENABLED } from "@/config/desktop";
import { useAmpStore } from "@/stores/ampStore";
import { floatZ, useFloatStore } from "@/stores/floatStore";
import { surfaceZ, useWindowStoreV2 } from "@/stores/windowStore";

const MusicPanelLogic = dynamic(() => import("./MusicPanel"), { ssr: false });

// Deck height: LCD strip + seek lane stacked. PaintEditor clears the bar via
// html.cmp-active with a fixed 64+48px pad, so anything ≤ ~100px is safe
// (deck total = titlebar 20 + body 46 = 66px).
const PLAYER_HEIGHT = 46;

// Titlebar strip height — also the reachability unit for the drag clamps:
// the strip may touch the viewport edges but never leave them vertically.
const TITLEBAR_HEIGHT = 20;

// Drag reachability: at least this much of the titlebar's WIDTH must stay
// on-screen when the deck is shoved past a horizontal edge, so there is
// always a grabbable strip to pull it back with.
const DRAG_KEEP_X = 100;

// Easter-egg skin persistence. "deck" (default) is the Winamp bar; "pebble"
// is the Frutiger Aero portable-CD-player shell reached by double-clicking
// the deck body.
type MusicSkin = "deck" | "pebble";
const SKIN_STORAGE_KEY = "foid-music-skin";

// Spectrum analyzer: 14 bars with pseudo-random stagger. Negative delays
// start each bar mid-cycle so the strip never "launches" in unison.
const PEBBLE_EQ_DELAYS = Array.from({ length: 14 }, (_, i) => (i * 137) % 860);

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

  // Layering. On the desktop shell ("/") the deck is a surface in
  // windowStore v2's single z-order (same stack as the OS windows and
  // CHAT.EXE); on standalone routes the legacy floatStore ladder applies.
  const pathname = usePathname();
  const onDesktop = FOID_DESKTOP_ENABLED && pathname === "/";
  const floatFocus = useFloatStore((s) => s.focus);
  const zOrder = useWindowStoreV2((s) => s.zOrder);
  const raise = useCallback(() => {
    useFloatStore.getState().setFocus("music");
    useWindowStoreV2.getState().raiseSurface("music");
  }, []);
  useEffect(() => {
    if (isVisible) raise();
    else useWindowStoreV2.getState().removeSurface("music");
  }, [isVisible, raise]);

  useEffect(() => {
    const unsubscribe = musicPanelController.subscribe(() =>
      setState(musicPanelController.getState()),
    );
    return unsubscribe;
  }, []);

  const { currentTrackName, isPlaying, progress, volume, shuffle, elapsed, duration } = state;
  const progressPercent = Number.isFinite(progress) ? Math.min(1, Math.max(0, progress)) : 0;
  const timeLabel = duration > 0 || elapsed > 0 ? formatTime(elapsed) : "--:--";

  // ── Easter egg: the Frutiger Aero "pebble" skin. Double-click the deck
  // BODY (not the titlebar — that stays windowshade) and MUSIC.EXE morphs
  // into a glossy white portable-CD-player blob; double-click the pebble's
  // shell to morph back. Sticky across reloads via localStorage.
  const [skin, setSkin] = useState<MusicSkin>("deck");
  useEffect(() => {
    // Hydration-safe: read the stored skin after mount only.
    try {
      if (localStorage.getItem(SKIN_STORAGE_KEY) === "pebble") setSkin("pebble");
    } catch {
      /* storage unavailable — session-only skin */
    }
  }, []);
  const switchSkin = useCallback((next: MusicSkin) => {
    setSkin(next);
    try {
      localStorage.setItem(SKIN_STORAGE_KEY, next);
    } catch {
      /* storage unavailable — session-only skin */
    }
  }, []);
  const handleBodyDoubleClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (target.closest("button, input, a, select, .cmp-resize")) return;
    switchSkin("pebble");
  }, [switchSkin]);
  const handlePebbleDoubleClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (target.closest("button, input, a, select")) return;
    switchSkin("deck");
  }, [switchSkin]);

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
    // `skin` dep: the LCD refs are null in pebble mode (effect no-ops), and
    // the deck needs a fresh measure when it remounts on the way back.
  }, [currentTrackName, skin]);

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
    if (!bar) return;

    // Full-screen freedom with reachability. Measure the chassis once at
    // grab time (the live rect already includes the current offset, so
    // home = rect − base) and clamp the offset so:
    //  - vertically, the TITLEBAR strip never leaves the viewport — the
    //    deck can sit in the top corners, or sink until only the strip
    //    shows above the bottom edge;
    //  - horizontally, ≥ DRAG_KEEP_X px of the strip stays visible, so
    //    the deck can hang off either side but stays grabbable.
    // (Pebble skin shares the handler: its whole shell is the drag
    // surface, so "top strip stays reachable" holds there too.)
    const rect = bar.getBoundingClientRect();
    const homeLeft = rect.left - base.x;
    const homeTop = rect.top - base.y;
    const barWidth = rect.width;

    const onMove = (ev: PointerEvent) => {
      const minX = DRAG_KEEP_X - barWidth - homeLeft;
      const maxX = window.innerWidth - DRAG_KEEP_X - homeLeft;
      const minY = -homeTop;
      const maxY = window.innerHeight - TITLEBAR_HEIGHT - homeTop;
      live = {
        x: Math.max(minX, Math.min(maxX, base.x + (ev.clientX - startX))),
        y: Math.max(minY, Math.min(maxY, base.y + (ev.clientY - startY))),
      };
      if (!raf) {
        raf = requestAnimationFrame(() => {
          raf = 0;
          bar.style.transform = `translate(${live.x}px, ${live.y}px)`;
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

  // Adjustable deck width — drag the right edge (360–700px). The LCD lane
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
      live = Math.max(360, Math.min(700, baseW + (ev.clientX - startX)));
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

  // Pebble-only mute: 0 ↔ last non-zero level. setVolume (absolute) rather
  // than adjustVolume (delta): a restore is an absolute op, and value-sets
  // are idempotent under dev StrictMode double-invocation.
  const preMuteVolumeRef = useRef(0.5);
  const handleMute = () => {
    const current = musicPanelController.getState().volume ?? 0;
    if (current > 0) {
      preMuteVolumeRef.current = current;
      musicPanelController.setVolume(0);
    } else {
      musicPanelController.setVolume(preMuteVolumeRef.current || 0.5);
    }
  };

  const handleVolumeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newVol = parseFloat(e.target.value);
    const delta = newVol - (volume ?? 0);
    musicPanelController.adjustVolume(delta);
  }, [volume]);

  const volVal = volume ?? 0;
  const volumeLevel: VolumeLevel = volVal === 0 ? "mute" : volVal < 0.5 ? "low" : "high";

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

      {/* MUSIC.EXE deck — opened from the dock's Music tile. z comes from
          floatStore (48 focused / 46 unfocused / 1 behind the main window);
          the wrapper itself is pointer-events:none, so the capture handler
          only fires for real hits on the deck/pebble chassis. */}
      <div
        className={`cmp-bar-outer ${isVisible ? "cmp-bar-outer--visible" : "cmp-bar-outer--hidden"}`}
        style={{ zIndex: onDesktop ? surfaceZ(zOrder, "music") : floatZ("music", floatFocus) }}
        onPointerDownCapture={raise}
      >
        {skin === "pebble" ? (
          /* ── Pebble skin: Frutiger Aero portable CD player. Same wrapper
             (open/close animation + drag offset), no titlebar, no width
             grip, no windowshade. Double-click the shell to morph back. */
          <div
            ref={barRef}
            className="cmp-pebble"
            onPointerDown={handleBarPointerDown}
            onDoubleClick={handlePebbleDoubleClick}
            title="drag to move · double-click the shell to return to the deck"
            style={{
              transform: barOffset ? `translate(${barOffset.x}px, ${barOffset.y}px)` : undefined,
            }}
          >
            {/* Blue glass display blob */}
            <div className="cmp-pebble__display">
              <div className="cmp-pebble__chrome">
                <button
                  type="button"
                  className="cmp-pebble__chip"
                  onClick={() => switchSkin("deck")}
                  title="Switch to deck skin"
                  aria-label="Switch to deck skin"
                >
                  <SwapIcon size={11} />
                </button>
                <button
                  type="button"
                  className="cmp-pebble__chip"
                  onClick={closeAmp}
                  title="Close"
                  aria-label="Close MUSIC.EXE"
                >
                  <CloseIcon size={10} />
                </button>
              </div>
              {/* Spectrum analyzer — pure decoration */}
              <div
                className={`cmp-pebble__eq ${isPlaying ? "cmp-pebble__eq--live" : ""}`}
                aria-hidden="true"
              >
                {PEBBLE_EQ_DELAYS.map((delay, i) => (
                  <span
                    key={i}
                    className="cmp-pebble__eqbar"
                    style={{ animationDelay: `-${delay}ms` }}
                  />
                ))}
              </div>
              <div className="cmp-pebble__meta">
                <span className="cmp-pebble__label">Title</span>
                <div className="cmp-pebble__track" title={currentTrackName}>
                  {currentTrackName}
                </div>
              </div>
              <div
                className="cmp-pebble__lcd"
                title={duration > 0 ? `${formatTime(elapsed)} / ${formatTime(duration)}` : undefined}
              >
                <span className="cmp-pebble__elapsed">{timeLabel}</span>
                <span className="cmp-pebble__total">
                  Total {duration > 0 ? formatTime(duration) : "--:--"}
                </span>
              </div>
            </div>

            {/* Green-ring gel play button, straddling the display edge */}
            <button
              type="button"
              className={`cmp-pebble__play ${isPlaying ? "cmp-pebble__play--on" : ""}`}
              onClick={handleToggle}
              title={isPlaying ? "Pause" : "Play"}
              aria-label={isPlaying ? "Pause" : "Play"}
            >
              {isPlaying ? <PauseIcon size={17} tone="sea" /> : <PlayIcon size={17} tone="sea" />}
            </button>

            {/* Lower shell: volume lane + gel transport row */}
            <div className="cmp-pebble__volume-row">
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={volVal}
                onChange={handleVolumeChange}
                className="cmp-pebble__volume"
                title={`Volume: ${Math.round(volVal * 100)}%`}
                aria-label="Volume"
              />
            </div>
            <div className="cmp-pebble__row">
              <button
                className="cmp-gel cmp-gel--pebble"
                type="button"
                onClick={handlePrev}
                title="Previous"
                aria-label="Previous"
              >
                <PrevIcon size={13} tone="sea" />
              </button>
              <button
                className="cmp-gel cmp-gel--pebble"
                type="button"
                onClick={handleNext}
                title="Next"
                aria-label="Next"
              >
                <NextIcon size={13} tone="sea" />
              </button>
              <button
                className={`cmp-gel cmp-gel--pebble ${shuffle ? "cmp-gel--lit" : ""}`}
                type="button"
                onClick={handleShuffle}
                title={shuffle ? "Shuffle on" : "Shuffle off"}
                aria-label={shuffle ? "Shuffle on" : "Shuffle off"}
                aria-pressed={shuffle}
              >
                <ShuffleIcon size={13} tone="sea" />
              </button>
              <button
                className="cmp-gel cmp-gel--pebble"
                type="button"
                onClick={handleMute}
                title={volVal === 0 ? "Unmute" : "Mute"}
                aria-label={volVal === 0 ? "Unmute" : "Mute"}
                aria-pressed={volVal === 0}
              >
                {volVal === 0 ? <MuteIcon size={13} tone="sea" /> : <VolumeIcon size={13} tone="sea" level="high" />}
              </button>
            </div>
          </div>
        ) : (
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
          {/* Right-edge width grip — drag to size the deck (360–700px) */}
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
              <ChevronIcon size={9} dir={shaded ? "down" : "up"} />
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
                {isPlaying ? <PauseIcon size={10} /> : <PlayIcon size={10} />}
              </button>
              <div className="cmp-shade__title" title={currentTrackName}>
                {currentTrackName}
              </div>
              <span className="cmp-shade__time">{timeLabel}</span>
            </div>
          )}

          <div className="cmp-body" hidden={shaded} onDoubleClick={handleBodyDoubleClick}>
          {/* Transport cluster \u2014 gel buttons */}
          <div className="cmp-transport">
            <button className="cmp-gel" type="button" onClick={handlePrev} title="Previous" aria-label="Previous">
              <PrevIcon size={13} />
            </button>
            <button
              className="cmp-gel cmp-gel--play"
              type="button"
              onClick={handleToggle}
              title={isPlaying ? "Pause" : "Play"}
              aria-label={isPlaying ? "Pause" : "Play"}
            >
              {isPlaying ? <PauseIcon size={16} /> : <PlayIcon size={16} />}
            </button>
            <button className="cmp-gel" type="button" onClick={handleNext} title="Next" aria-label="Next">
              <NextIcon size={13} />
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
            <ShuffleIcon size={12} />
          </button>
          <div className="cmp-volume">
            <span className="cmp-volume__icon">
              <VolumeIcon size={15} level={volumeLevel} />
            </span>
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
        )}
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

        /* --- Outer wrapper: fixed above the dock, centers the deck ---
           z-index is inline, driven by floatStore (48/46/1) — see
           src/stores/floatStore.ts for the ladder. */
        :global(.cmp-bar-outer) {
          position: fixed;
          bottom: 92px; /* clears the dock (64px pill + 10px gap + breath) */
          left: 0;
          right: 0;
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
          /* The deck can now be parked anywhere (drag clamps), so the exit
             slide may leave it inside the viewport at opacity 0 — and
             opacity alone doesn't stop hit-testing. visibility (delayed
             past the exit animation, CHAT.EXE's pattern) does. */
          visibility: hidden;
          transition:
            transform 0.3s ease-in,
            opacity 0.3s ease-in,
            visibility 0s linear 0.3s;
        }
        @media (max-width: 1023px) {
          :global(.cmp-bar-outer) { display: none !important; }
        }

        /* ===== MUSIC.EXE deck: Winamp layout in aero glass ===== */
        :global(.cmp-bar) {
          width: calc(100% - 32px);
          max-width: 500px;
          display: flex;
          flex-direction: column;
          align-items: stretch;
        }

        /* --- Width grip: right edge of the deck, below the titlebar --- */
        :global(.cmp-resize) {
          position: absolute;
          top: ${TITLEBAR_HEIGHT}px;
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
          height: ${TITLEBAR_HEIGHT}px;
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
          border-top-color: rgba(255, 255, 255, 0.3);
          border-radius: 5px;
          background: linear-gradient(180deg, rgba(255, 255, 255, 0.16), rgba(255, 255, 255, 0.04));
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.2);
          color: var(--foid-text-dim);
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
          gap: 10px;
          height: ${PLAYER_HEIGHT}px;
          padding: 0 12px;
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
          gap: 5px;
          flex-shrink: 0;
          position: relative;
          z-index: 1;
        }
        :global(.cmp-gel) {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 28px; /* ≥24px hit target holds */
          height: 28px;
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
          width: 34px;
          height: 34px;
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
        /* Lit toggle (shuffle on) — cyan ring glow around the gel icon. */
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
          gap: 3px;
          justify-content: center;
          position: relative;
          z-index: 1;
        }

        /* Recessed dark-glass LCD */
        :global(.cmp-lcd) {
          position: relative;
          border-radius: var(--foid-radius-sm);
          padding: 2px 7px 3px;
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
          font-size: 10px;
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
          height: 4px;
          border-radius: 2px;
          background: rgba(2, 8, 18, 0.75);
          box-shadow:
            inset 0 1px 3px rgba(0, 0, 0, 0.6),
            inset 0 -1px 0 rgba(255, 255, 255, 0.08);
          overflow: hidden;
        }
        :global(.cmp-seek__fill) {
          height: 100%;
          border-radius: 2px;
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
          display: flex;
          align-items: center;
          justify-content: center;
          opacity: 0.75;
          cursor: default;
          line-height: 1;
        }
        :global(.cmp-volume__slider) {
          width: 68px;
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

        /* ═══════════════════════════════════════════════════════════════
           PEBBLE — hidden Frutiger Aero skin. A glossy white organic
           portable-CD-player blob with a blue glass display. Reached by
           double-clicking the deck body; double-click the shell to leave.
           Blue family is hardcoded (#4a9eff/#1d5fa8 range): this skin IS
           the themed artifact. Text + focus colors come from tokens.
           ═══════════════════════════════════════════════════════════════ */
        :global(.cmp-pebble) {
          position: relative;
          width: 285px;
          height: 260px;
          flex-shrink: 0;
          padding: 19px 35px 0;
          pointer-events: auto;
          cursor: grab;
          user-select: none;
          -webkit-user-select: none;
          /* Organic asymmetric blob */
          border-radius: 53% 47% 46% 54% / 52% 55% 45% 48%;
          /* White glossy plastic */
          background:
            radial-gradient(120% 90% at 30% 10%, rgba(255, 255, 255, 0.95), rgba(255, 255, 255, 0) 55%),
            linear-gradient(165deg, #ffffff 0%, #f2f7fb 38%, #dfe9f2 68%, #c7d8e8 100%);
          /* Drop shadow + white lip + blue border band + lower shading */
          box-shadow:
            0 24px 48px rgba(0, 20, 50, 0.45),
            0 8px 18px rgba(0, 20, 50, 0.28),
            inset 0 0 0 2px rgba(255, 255, 255, 0.85),
            inset 0 0 0 8px rgba(74, 158, 255, 0.5),
            inset 0 0 0 10px rgba(29, 95, 168, 0.22),
            inset 0 -16px 26px rgba(120, 160, 205, 0.35);
        }
        /* Top-left specular highlight — the wet-plastic sheen */
        :global(.cmp-pebble::before) {
          content: "";
          position: absolute;
          top: 7px;
          left: 29px;
          width: 137px;
          height: 54px;
          border-radius: 50%;
          background: radial-gradient(ellipse at 45% 40%, rgba(255, 255, 255, 0.85), rgba(255, 255, 255, 0) 72%);
          transform: rotate(-10deg);
          pointer-events: none;
          z-index: 2;
        }

        /* --- Display: inner blue glass blob --- */
        :global(.cmp-pebble__display) {
          position: relative;
          height: 137px;
          padding: 10px 29px 12px 24px;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          z-index: 1;
          border-radius: 47px 64px 59px 67px / 40px 47px 59px 42px;
          background: linear-gradient(178deg, #9fd0f5 0%, #4b8ed0 34%, #1d5fa8 62%, #0b3a78 100%);
          box-shadow:
            inset 0 2px 8px rgba(255, 255, 255, 0.5),
            inset 0 -10px 22px rgba(2, 18, 52, 0.55),
            0 2px 0 rgba(255, 255, 255, 0.75),
            0 6px 14px rgba(10, 45, 100, 0.35);
        }
        /* Glossy sweep across the top of the glass */
        :global(.cmp-pebble__display::before) {
          content: "";
          position: absolute;
          top: 0;
          left: 6%;
          right: 8%;
          height: 46%;
          border-radius: 50% 50% 46% 44% / 100% 100% 30% 26%;
          background: linear-gradient(180deg, rgba(255, 255, 255, 0.45), rgba(255, 255, 255, 0.04));
          pointer-events: none;
        }

        /* Display chrome: return-to-deck + close, tiny aero-icon chips */
        :global(.cmp-pebble__chrome) {
          display: flex;
          justify-content: flex-end;
          gap: 6px;
          position: relative;
          z-index: 1;
        }
        :global(.cmp-pebble__chip) {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 20px;
          height: 20px;
          padding: 0;
          border-radius: 50%;
          border: 1px solid rgba(255, 255, 255, 0.4);
          background: rgba(255, 255, 255, 0.14);
          color: rgba(255, 255, 255, 0.9);
          font-size: 11px;
          line-height: 1;
          cursor: pointer;
          flex-shrink: 0;
          transition: background var(--foid-motion-fast) ease, color var(--foid-motion-fast) ease;
        }
        :global(.cmp-pebble__chip:hover) {
          background: rgba(255, 255, 255, 0.3);
          color: #ffffff;
        }

        /* Spectrum analyzer — decorative bars, dance only while playing */
        :global(.cmp-pebble__eq) {
          display: flex;
          align-items: flex-end;
          gap: 3px;
          height: 16px;
          margin-top: 3px;
          position: relative;
          z-index: 1;
        }
        :global(.cmp-pebble__eqbar) {
          flex: 1;
          height: 100%;
          border-radius: 1.5px;
          background: linear-gradient(180deg, #f2ffff 0%, #8fd3ff 55%, #3fa2ff 100%);
          opacity: 0.85;
          transform: scaleY(0.18);
          transform-origin: bottom;
        }
        /* Static (paused) skyline — vary resting heights */
        :global(.cmp-pebble__eqbar:nth-child(2n)) { transform: scaleY(0.3); }
        :global(.cmp-pebble__eqbar:nth-child(3n)) { transform: scaleY(0.42); }
        :global(.cmp-pebble__eqbar:nth-child(5n)) { transform: scaleY(0.24); }
        :global(.cmp-pebble__eq--live .cmp-pebble__eqbar) {
          animation: cmp-eq-dance 860ms ease-in-out infinite alternate;
        }
        :global(.cmp-pebble__eq--live .cmp-pebble__eqbar:nth-child(3n)) {
          animation-duration: 700ms;
        }
        :global(.cmp-pebble__eq--live .cmp-pebble__eqbar:nth-child(4n)) {
          animation-duration: 1020ms;
        }
        @keyframes cmp-eq-dance {
          from { transform: scaleY(0.14); }
          to { transform: scaleY(1); }
        }

        /* Track meta: TITLE micro-label + name */
        :global(.cmp-pebble__meta) {
          margin-top: 5px;
          min-width: 0;
          position: relative;
          z-index: 1;
        }
        :global(.cmp-pebble__label) {
          display: block;
          font-family: var(--font-terminal);
          font-size: 8px;
          letter-spacing: 0.3em;
          text-transform: uppercase;
          color: rgba(214, 236, 255, 0.7);
        }
        :global(.cmp-pebble__track) {
          font-family: var(--font-terminal);
          font-size: 10px;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: var(--foid-text);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        /* LCD: big segmented elapsed + small total */
        :global(.cmp-pebble__lcd) {
          margin-top: auto;
          margin-left: 7px;
          display: flex;
          align-items: baseline;
          gap: 9px;
          position: relative;
          z-index: 1;
        }
        :global(.cmp-pebble__elapsed) {
          display: inline-block;
          font-family: var(--font-terminal);
          font-size: 24px;
          line-height: 1;
          letter-spacing: 0.04em;
          font-variant-numeric: tabular-nums;
          color: #eafcff;
          transform: skewX(-5deg);
          text-shadow:
            0 0 10px color-mix(in srgb, var(--foid-cyan-electric) 55%, transparent),
            0 0 26px color-mix(in srgb, var(--foid-cyan-electric) 30%, transparent);
        }
        :global(.cmp-pebble__total) {
          font-family: var(--font-terminal);
          font-size: 10px;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          font-variant-numeric: tabular-nums;
          color: rgba(214, 236, 255, 0.8);
        }

        /* --- Green ring play button, straddling the display edge --- */
        :global(.cmp-pebble__play) {
          position: absolute;
          right: 29px;
          top: 135px;
          width: 47px; /* still comfortably ≥24px hit target */
          height: 47px;
          padding: 0;
          z-index: 3;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
          font-size: 16px;
          line-height: 1;
          color: #17456f;
          cursor: pointer;
          border: 4px solid #b9c6d2;
          background: radial-gradient(circle at 34% 28%, #ffffff 0%, #eef6fc 42%, #c6d9e9 100%);
          box-shadow:
            inset 0 2px 3px rgba(255, 255, 255, 0.95),
            inset 0 -4px 8px rgba(90, 130, 170, 0.4),
            0 6px 12px rgba(5, 35, 80, 0.35);
          transition:
            border-color var(--foid-motion-fast),
            box-shadow var(--foid-motion-fast),
            color var(--foid-motion-fast);
        }
        :global(.cmp-pebble__play:hover) {
          color: #0b2f52;
          border-color: #a7bacb;
        }
        :global(.cmp-pebble__play:active) {
          box-shadow:
            inset 0 3px 7px rgba(40, 80, 130, 0.55),
            0 3px 8px rgba(5, 35, 80, 0.3);
        }
        :global(.cmp-pebble__play--on) {
          border-color: #4ade80;
          box-shadow:
            inset 0 2px 3px rgba(255, 255, 255, 0.95),
            inset 0 -4px 8px rgba(74, 160, 110, 0.35),
            0 6px 12px rgba(5, 35, 80, 0.35),
            0 0 16px rgba(74, 222, 128, 0.55);
          animation: cmp-ring-pulse 2.4s ease-in-out infinite;
        }
        :global(.cmp-pebble__play--on:hover) {
          border-color: #5ee892;
        }
        @keyframes cmp-ring-pulse {
          0%, 100% {
            box-shadow:
              inset 0 2px 3px rgba(255, 255, 255, 0.95),
              inset 0 -4px 8px rgba(74, 160, 110, 0.35),
              0 6px 12px rgba(5, 35, 80, 0.35),
              0 0 12px rgba(74, 222, 128, 0.45);
          }
          50% {
            box-shadow:
              inset 0 2px 3px rgba(255, 255, 255, 0.95),
              inset 0 -4px 8px rgba(74, 160, 110, 0.35),
              0 6px 12px rgba(5, 35, 80, 0.35),
              0 0 26px rgba(74, 222, 128, 0.85);
          }
        }

        /* --- Lower shell: volume lane (clears the play button) + row --- */
        :global(.cmp-pebble__volume-row) {
          margin: 12px 50px 0 0;
        }
        :global(.cmp-pebble__volume) {
          -webkit-appearance: none;
          appearance: none;
          display: block;
          width: 100%;
          height: 9px;
          padding: 0;
          margin: 0;
          box-sizing: border-box;
          border-radius: 6px;
          background: linear-gradient(180deg, #b6cddf 0%, #e4f0f9 70%, #f6fbff 100%);
          box-shadow:
            inset 0 2px 4px rgba(40, 80, 130, 0.45),
            inset 0 -1px 0 rgba(255, 255, 255, 0.9);
          outline: none;
          cursor: pointer;
        }
        :global(.cmp-pebble__volume::-webkit-slider-thumb) {
          -webkit-appearance: none;
          width: 23px;
          height: 12px;
          margin-top: -1.5px;
          border-radius: 999px;
          background: linear-gradient(180deg, #ffffff 0%, #dceaf6 55%, #b4cde4 100%);
          border: 1px solid rgba(110, 150, 190, 0.85);
          box-shadow:
            0 2px 4px rgba(20, 60, 110, 0.35),
            inset 0 1px 0 #ffffff;
          cursor: pointer;
        }
        :global(.cmp-pebble__volume::-moz-range-thumb) {
          width: 23px;
          height: 12px;
          border-radius: 999px;
          background: linear-gradient(180deg, #ffffff 0%, #dceaf6 55%, #b4cde4 100%);
          border: 1px solid rgba(110, 150, 190, 0.85);
          box-shadow:
            0 2px 4px rgba(20, 60, 110, 0.35),
            inset 0 1px 0 #ffffff;
          cursor: pointer;
        }
        :global(.cmp-pebble__volume::-moz-range-track) {
          height: 9px;
          border-radius: 6px;
          background: linear-gradient(180deg, #b6cddf 0%, #e4f0f9 70%, #f6fbff 100%);
        }
        :global(.cmp-pebble__volume::-moz-range-progress) {
          height: 9px;
          border-radius: 6px;
          background: linear-gradient(180deg, #7cc0f2, #3f8fd8);
        }

        :global(.cmp-pebble__row) {
          margin-top: 15px;
          display: flex;
          justify-content: center;
          gap: 12px;
        }
        /* Light-shell gel variant — same chassis as .cmp-gel, milk-glass
           palette. Declared after the base rules so the overrides win. */
        :global(.cmp-gel--pebble) {
          width: 26px; /* ≥24px hit target holds */
          height: 26px;
          font-size: 10px;
          color: #2b5d8c;
          border-color: rgba(120, 160, 200, 0.75);
          border-top-color: rgba(255, 255, 255, 0.95);
          background: linear-gradient(180deg, #ffffff 0%, #e9f2fa 46%, #bfd6e9 100%);
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.95),
            inset 0 -2px 4px rgba(90, 130, 170, 0.4),
            0 2px 5px rgba(15, 55, 105, 0.28);
        }
        :global(.cmp-gel--pebble:hover) {
          color: #123c66;
          border-color: rgba(90, 140, 190, 0.9);
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.95),
            inset 0 -2px 4px rgba(90, 130, 170, 0.4),
            0 2px 6px rgba(15, 55, 105, 0.32),
            0 0 10px rgba(120, 190, 255, 0.5);
        }
        :global(.cmp-gel--pebble:active) {
          color: #123c66;
          box-shadow:
            inset 0 2px 6px rgba(40, 80, 130, 0.5),
            inset 0 -1px 0 rgba(255, 255, 255, 0.4);
        }
        :global(.cmp-gel--pebble.cmp-gel--lit) {
          border-color: color-mix(in srgb, var(--foid-cyan-electric) 55%, #7aa8cc);
          background: linear-gradient(
            180deg,
            #ffffff 0%,
            color-mix(in srgb, var(--foid-cyan-electric) 18%, #e9f2fa) 46%,
            #bfd6e9 100%
          );
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.95),
            inset 0 -2px 4px rgba(90, 130, 170, 0.4),
            0 0 10px var(--foid-glow),
            0 0 16px color-mix(in srgb, var(--foid-cyan-electric) 35%, transparent);
        }

        /* Focus — token ring plus a dark halo so it reads on white shell */
        :global(.cmp-pebble button:focus-visible),
        :global(.cmp-pebble input:focus-visible) {
          outline: 2px solid var(--foid-focus-ring);
          outline-offset: 2px;
          box-shadow: 0 0 0 5px rgba(11, 58, 120, 0.5);
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
          /* Pebble: spectrum bars hold their static skyline, no ring pulse */
          :global(.cmp-pebble__eq--live .cmp-pebble__eqbar) {
            animation: none;
          }
          :global(.cmp-pebble__play--on) {
            animation: none;
          }
        }
      `}</style>
    </>
  );
}
