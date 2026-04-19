"use client";

import { useEffect, useState } from "react";

/**
 * PrayerBoot — a 700ms arrival sequence for /pray on mobile.
 *
 *   0–200ms: black
 *   200–400ms: Mommy GIF fades in (blur(2px) → blur(0), scale 0.95 → 1)
 *   400–550ms: 2px mint scanline sweeps top → bottom, opacity 0.5
 *   550–700ms: title "foid_mommy_terminal.exe" types character-by-character
 *
 * Runs exactly once per session (sessionStorage key: "foid_pray_booted").
 * Tap anywhere to skip. Respects prefers-reduced-motion (~200ms static, then unmount).
 */

const STORAGE_KEY = "foid_pray_booted";
const TITLE = "foid_mommy_terminal.exe";
const TOTAL_MS = 700;
const REDUCED_MS = 200;

// Phase start times (ms). Keep as constants so styles read cleanly.
const MOMMY_START = 200;
const SCANLINE_START = 400;
const SCANLINE_END = 550;
const TITLE_START = 550;

export default function PrayerBoot() {
  // Start as null — we decide mount client-side after checking sessionStorage +
  // prefers-reduced-motion, so we never SSR anything.
  const [mounted, setMounted] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [typedChars, setTypedChars] = useState(0);

  useEffect(() => {
    if (typeof window === "undefined") return;
    // Mobile-only. The wrapper in pray/page.tsx also hides this via lg:hidden,
    // but we double-check so we don't set sessionStorage or run rAF on desktop.
    if (window.innerWidth >= 1024) return;
    try {
      if (sessionStorage.getItem(STORAGE_KEY) === "1") return;
    } catch {
      // private mode or blocked — play the boot once, no persistence
    }

    const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
    const reduced = mql.matches;
    setReduceMotion(reduced);
    setMounted(true);

    const duration = reduced ? REDUCED_MS : TOTAL_MS;
    const startedAt = performance.now();
    let raf = 0;

    const finish = () => {
      try {
        sessionStorage.setItem(STORAGE_KEY, "1");
      } catch {
        // noop
      }
      setMounted(false);
    };

    const tick = (now: number) => {
      const t = now - startedAt;
      setElapsed(t);

      if (!reduced && t >= TITLE_START) {
        const perChar = (TOTAL_MS - TITLE_START) / TITLE.length;
        const n = Math.min(TITLE.length, Math.floor((t - TITLE_START) / perChar) + 1);
        setTypedChars(n);
      }

      if (t >= duration) {
        finish();
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  if (!mounted) return null;

  const skip = () => {
    try {
      sessionStorage.setItem(STORAGE_KEY, "1");
    } catch {
      // noop
    }
    setMounted(false);
  };

  // Static path for reduced motion — hold 200ms, no animation.
  if (reduceMotion) {
    return (
      <div
        className="prayer-boot prayer-boot--reduced"
        onClick={skip}
        onTouchStart={skip}
        aria-hidden="true"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="prayer-boot__mommy" src="/foidmommy.gif" alt="" />
        <div className="prayer-boot__title">{TITLE}</div>
        <style jsx>{`
          .prayer-boot {
            position: fixed;
            inset: 0;
            z-index: 9999;
            background: #000;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 18px;
          }
          .prayer-boot__mommy {
            width: 160px;
            height: 160px;
            object-fit: contain;
            image-rendering: pixelated;
          }
          .prayer-boot__title {
            font-family: var(--font-terminal, "JetBrains Mono", monospace);
            font-size: 13px;
            letter-spacing: 0.22em;
            color: #6eead8;
            text-shadow: 0 0 12px rgba(110, 234, 216, 0.4);
          }
        `}</style>
      </div>
    );
  }

  const mommyT = Math.min(1, Math.max(0, (elapsed - MOMMY_START) / (SCANLINE_START - MOMMY_START)));
  const mommyOpacity = mommyT;
  const mommyBlur = (1 - mommyT) * 2; // px
  const mommyScale = 0.95 + mommyT * 0.05;

  const scanActive = elapsed >= SCANLINE_START && elapsed < SCANLINE_END;
  const scanT = scanActive ? (elapsed - SCANLINE_START) / (SCANLINE_END - SCANLINE_START) : 0;

  const titleVisible = elapsed >= TITLE_START;

  return (
    <div className="prayer-boot" onClick={skip} onTouchStart={skip} aria-hidden="true">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        className="prayer-boot__mommy"
        src="/foidmommy.gif"
        alt=""
        style={{
          opacity: mommyOpacity,
          filter: `blur(${mommyBlur}px)`,
          transform: `scale(${mommyScale})`,
        }}
      />
      {titleVisible && (
        <div className="prayer-boot__title">
          {TITLE.slice(0, typedChars)}
          <span className="prayer-boot__caret" />
        </div>
      )}
      {scanActive && (
        <div
          className="prayer-boot__scanline"
          style={{ top: `${scanT * 100}%` }}
        />
      )}
      <style jsx>{`
        .prayer-boot {
          position: fixed;
          inset: 0;
          z-index: 9999;
          background: #000;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 20px;
          overflow: hidden;
        }
        .prayer-boot__mommy {
          width: 160px;
          height: 160px;
          object-fit: contain;
          image-rendering: pixelated;
          will-change: opacity, transform, filter;
        }
        .prayer-boot__title {
          font-family: var(--font-terminal, "JetBrains Mono", monospace);
          font-size: 13px;
          letter-spacing: 0.22em;
          color: #6eead8;
          text-shadow: 0 0 12px rgba(110, 234, 216, 0.4);
          min-height: 16px;
        }
        .prayer-boot__caret {
          display: inline-block;
          width: 7px;
          height: 12px;
          margin-left: 2px;
          background: #6eead8;
          vertical-align: middle;
          animation: prayer-boot-caret 0.6s steps(2) infinite;
        }
        @keyframes prayer-boot-caret {
          50% { opacity: 0; }
        }
        .prayer-boot__scanline {
          position: absolute;
          left: 0;
          right: 0;
          height: 2px;
          background: #6eead8;
          opacity: 0.5;
          box-shadow: 0 0 12px rgba(110, 234, 216, 0.6);
          pointer-events: none;
        }
      `}</style>
    </div>
  );
}
