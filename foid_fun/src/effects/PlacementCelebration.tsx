// src/effects/PlacementCelebration.tsx
// "Olympus meets FOID Terminal" — cinematic multi-beat celebration for loreboard placements
"use client";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { spawn } from "@/lib/spawn";
import { getAudioSettings } from "@/lib/audioSettings";

type PlacementCelebrationProps = {
  itemName: string;
  txHash: string;
  proposalId: number | null;
  previewUrl: string;
};

const DURATION = 9600;

export function showPlacementCelebration(opts: PlacementCelebrationProps) {
  spawn(<PlacementCelebration {...opts} />, DURATION);
}

/* ── FOID brand palette ─────────────────────────────────────────────── */

const FOID_COLORS = [
  "#74ffeb", // cyan (primary)
  "#a78bfa", // purple
  "#fbbf24", // gold
  "#f472b6", // pink
  "#22c55e", // green
  "#06b6d4", // teal
  "#e879f9", // magenta
  "#ffffff", // white
];

function pickColor(i: number) {
  return FOID_COLORS[i % FOID_COLORS.length];
}

/* ── Slot counter hook ──────────────────────────────────────────────── */

function useSlotCounter(target: number | null, startDelay = 1600, spinDuration = 700) {
  const [display, setDisplay] = useState<string>("---");
  const [landed, setLanded] = useState(false);
  useEffect(() => {
    if (target == null) { setDisplay("---"); return; }
    const startTimer = setTimeout(() => {
      let frame = 0;
      const totalFrames = Math.floor(spinDuration / 40);
      const interval = setInterval(() => {
        frame++;
        if (frame >= totalFrames) {
          clearInterval(interval);
          setDisplay(`#${target}`);
          setLanded(true);
        } else {
          setDisplay(`#${Math.floor(Math.random() * 9999)}`);
        }
      }, 40);
      return () => clearInterval(interval);
    }, startDelay);
    return () => clearTimeout(startTimer);
  }, [target, startDelay, spinDuration]);
  return { display, landed };
}

/* ── Component ───────────────────────────────────────────────────────── */

export default function PlacementCelebration({
  itemName,
  txHash,
  proposalId,
  previewUrl,
}: PlacementCelebrationProps) {
  const [exiting, setExiting] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const { display: slotDisplay, landed: slotLanded } = useSlotCounter(proposalId);

  // Sound effects
  useEffect(() => {
    const settings = getAudioSettings();
    if (!settings.sfxEnabled) return;
    import("@/lib/sfx").then((sfx) => {
      sfx.default.playVictoryChord();
      setTimeout(() => sfx.default.playReward(), 1200);
    });
  }, []);

  // Auto-exit animation before spawn TTL
  useEffect(() => {
    const exitTimer = setTimeout(() => setExiting(true), DURATION - 700);
    return () => clearTimeout(exitTimer);
  }, []);

  // Click-to-close with exit animation
  const handleClose = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget) setExiting(true);
  }, []);

  // Hide root after exit animation completes
  useEffect(() => {
    if (!exiting) return;
    const t = setTimeout(() => {
      if (rootRef.current) rootRef.current.style.display = "none";
    }, 600);
    return () => clearTimeout(t);
  }, [exiting]);

  // Share to X
  const handleShare = () => {
    const text = encodeURIComponent(
      `just engraved on the @mifoid loreboard${proposalId != null ? ` (Proposal #${proposalId})` : ""}\n\nhttps://foid.fun/board`,
    );
    window.open(`https://x.com/intent/tweet?text=${text}`, "_blank");
  };

  // Precomputed particles — FOID palette
  const sparkles = useMemo(() => Array.from({ length: 200 }, (_, i) => ({
    d: i * 14,
    x: `${(Math.random() * 200 - 100).toFixed(1)}vw`,
    y: `${(Math.random() * 200 - 100).toFixed(1)}vh`,
    color: pickColor(i),
    type: Math.random() > 0.5 ? "sparkle" : "star",
  })), []);

  const crystals = useMemo(() => Array.from({ length: 140 }, (_, i) => ({
    d: i * 20,
    x: `${(Math.random() * 200 - 100).toFixed(1)}vw`,
    y: `${(Math.random() * 200 - 100).toFixed(1)}vh`,
    color: pickColor(i),
  })), []);

  const confetti = useMemo(() => Array.from({ length: 100 }, (_, i) => ({
    d: i * 24,
    x: `${(Math.random() * 200 - 100).toFixed(1)}vw`,
    y: `${(Math.random() * 200 - 100).toFixed(1)}vh`,
    color: FOID_COLORS[Math.floor(Math.random() * FOID_COLORS.length)],
  })), []);

  const rings = useMemo(() => Array.from({ length: 60 }, (_, i) => ({
    d: i * 32,
    x: `${(Math.random() * 200 - 100).toFixed(1)}vw`,
    y: `${(Math.random() * 200 - 100).toFixed(1)}vh`,
    color: pickColor(i),
  })), []);

  return (
    <div
      ref={rootRef}
      aria-live="polite"
      role="status"
      className={`pc-fullscreen ${exiting ? "pc-exiting" : ""}`}
      onClick={handleClose}
    >
      {/* Beat 1: Cyan flash */}
      <div className="pc-flash" aria-hidden />

      {/* Beat 1: Shockwave ring */}
      <div className="pc-shockwave" aria-hidden />

      {/* Beat 1: Camera shake container */}
      <div className="pc-shake-root">
        {/* Beat 2: Dual lightning bolts */}
        <svg className="pc-lightning pc-lightning--a" viewBox="0 0 200 600" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
          <path
            d="M100 0 L85 180 L120 200 L70 380 L110 400 L60 600"
            stroke="url(#lg-a)"
            strokeWidth="5"
            strokeLinecap="round"
            strokeLinejoin="round"
            filter="url(#lglow)"
          />
          <defs>
            <linearGradient id="lg-a" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#fff" />
              <stop offset="35%" stopColor="#74ffeb" />
              <stop offset="100%" stopColor="#a78bfa" />
            </linearGradient>
            <filter id="lglow" x="-50%" y="-10%" width="200%" height="120%">
              <feGaussianBlur stdDeviation="7" result="blur" />
              <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
          </defs>
        </svg>
        <svg className="pc-lightning pc-lightning--b" viewBox="0 0 200 600" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
          <path
            d="M110 0 L130 160 L90 190 L140 360 L95 390 L145 600"
            stroke="url(#lg-b)"
            strokeWidth="4"
            strokeLinecap="round"
            strokeLinejoin="round"
            filter="url(#lglow2)"
          />
          <defs>
            <linearGradient id="lg-b" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#fff" />
              <stop offset="40%" stopColor="#a78bfa" />
              <stop offset="100%" stopColor="#74ffeb" />
            </linearGradient>
            <filter id="lglow2" x="-50%" y="-10%" width="200%" height="120%">
              <feGaussianBlur stdDeviation="5" result="blur" />
              <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
          </defs>
        </svg>

        {/* Beat 3: The Slab */}
        <div className="pc-slab">
          {/* Hero image */}
          {previewUrl && (
            <div className="pc-hero-frame">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={previewUrl}
                alt={itemName}
                className="pc-hero-img"
                referrerPolicy="no-referrer"
              />
              <div className="pc-hero-sheen" aria-hidden />
            </div>
          )}

          {/* ENGRAVED headline */}
          <span className="pc-headline">ENGRAVED</span>

          {/* Slot counter + meta */}
          <div className="pc-meta">
            {proposalId != null && (
              <span className={`pc-slot ${slotLanded ? "pc-slot--landed" : ""}`}>
                {slotDisplay}
              </span>
            )}
            <a
              className="pc-chip"
              href={`https://testnet.fluentscan.xyz/tx/${txHash}`}
              target="_blank"
              rel="noreferrer"
            >
              {txHash.slice(0, 10)}...
            </a>
          </div>

          {/* Share button */}
          <button type="button" className="pc-share" onClick={handleShare}>
            SHARE TO X
          </button>
        </div>
      </div>

      {/* Beat 4: Particle stage */}
      <div className="pc-particles" aria-hidden>
        {sparkles.map((s, i) => (
          <i key={`s${i}`} className="pc-p" style={{ "--d": `${s.d}ms`, "--x": s.x, "--y": s.y, "--color": s.color, "--type": s.type } as React.CSSProperties} />
        ))}
        {crystals.map((c, i) => (
          <i key={`c${i}`} className="pc-crystal" style={{ "--d": `${c.d}ms`, "--x": c.x, "--y": c.y, "--color": c.color } as React.CSSProperties} />
        ))}
        {confetti.map((c, i) => (
          <i key={`f${i}`} className="pc-confetti" style={{ "--d": `${c.d}ms`, "--x": c.x, "--y": c.y, "--color": c.color } as React.CSSProperties} />
        ))}
        {rings.map((r, i) => (
          <i key={`r${i}`} className="pc-ring" style={{ "--d": `${r.d}ms`, "--x": r.x, "--y": r.y, "--color": r.color } as React.CSSProperties} />
        ))}
      </div>

      <style jsx>{`
        /* ══════════════════════════════════════════════════════════════
           STAGE
           ══════════════════════════════════════════════════════════ */
        .pc-fullscreen {
          position: fixed; inset: 0; z-index: 1000;
          display: grid; place-items: center;
          pointer-events: auto; overflow: hidden;
          background: radial-gradient(circle at 50% 40%, rgba(116,255,235,0.06), transparent 65%),
                      rgba(2, 6, 18, 0.55);
          transition: opacity 600ms ease-in, filter 600ms ease-in, transform 600ms ease-in;
        }
        .pc-exiting {
          opacity: 0;
          filter: blur(8px);
          transform: scale(0.96);
        }

        /* ══════════════════════════════════════════════════════════════
           BEAT 1: FLASH + SHAKE + SHOCKWAVE
           ══════════════════════════════════════════════════════════ */
        .pc-flash {
          position: fixed; inset: 0; z-index: 10;
          background: radial-gradient(circle, rgba(116,255,235,0.6), rgba(116,255,235,0.15) 60%, transparent 80%);
          pointer-events: none;
          animation: pc-flash 450ms ease-out forwards;
        }
        @keyframes pc-flash {
          0% { opacity: 0.85; }
          100% { opacity: 0; }
        }

        .pc-shockwave {
          position: fixed; z-index: 9;
          left: 50%; top: 50%;
          width: 40px; height: 40px;
          border-radius: 50%;
          border: 2px solid rgba(116,255,235,0.7);
          box-shadow: 0 0 20px rgba(116,255,235,0.4), inset 0 0 20px rgba(116,255,235,0.2);
          transform: translate(-50%, -50%) scale(0);
          pointer-events: none;
          animation: pc-shockwave 800ms 80ms cubic-bezier(0.16,0.86,0.22,1) forwards;
        }
        @keyframes pc-shockwave {
          0% { opacity: 1; transform: translate(-50%, -50%) scale(0); }
          60% { opacity: 0.6; }
          100% { opacity: 0; transform: translate(-50%, -50%) scale(40); }
        }

        .pc-shake-root {
          display: contents;
          animation: pc-shake 400ms ease-out;
        }
        @keyframes pc-shake {
          0%   { transform: translate(0, 0); }
          12%  { transform: translate(-5px, 3px); }
          25%  { transform: translate(4px, -4px); }
          37%  { transform: translate(-3px, 4px); }
          50%  { transform: translate(3px, -2px); }
          62%  { transform: translate(-2px, 2px); }
          75%  { transform: translate(1px, -1px); }
          100% { transform: translate(0, 0); }
        }

        /* ══════════════════════════════════════════════════════════════
           BEAT 2: DUAL LIGHTNING
           ══════════════════════════════════════════════════════════ */
        .pc-lightning {
          position: fixed; z-index: 8;
          top: -5%; width: 130px; height: 400px;
          pointer-events: none; opacity: 0;
        }
        .pc-lightning--a {
          left: 50%; transform: translateX(-65%);
          animation: pc-bolt 850ms 180ms ease-out forwards;
        }
        .pc-lightning--b {
          left: 50%; transform: translateX(-20%) scaleX(-1);
          animation: pc-bolt 750ms 280ms ease-out forwards;
        }
        .pc-lightning path {
          stroke-dasharray: 1200;
          stroke-dashoffset: 1200;
          animation: pc-bolt-draw 550ms 200ms ease-out forwards;
        }
        .pc-lightning--b path {
          animation-delay: 300ms;
        }
        @keyframes pc-bolt {
          0%   { opacity: 0; }
          12%  { opacity: 1; }
          65%  { opacity: 0.85; }
          100% { opacity: 0; }
        }
        @keyframes pc-bolt-draw {
          to { stroke-dashoffset: 0; }
        }

        /* ══════════════════════════════════════════════════════════════
           BEAT 3: THE SLAB
           ══════════════════════════════════════════════════════════ */
        .pc-slab {
          position: relative; z-index: 5;
          width: clamp(300px, 44vw, 460px);
          border-radius: 20px;
          display: flex; flex-direction: column; align-items: center;
          padding: clamp(24px, 3.5vw, 40px) clamp(20px, 3vw, 32px);
          gap: 16px;
          background: rgba(6, 14, 28, 0.92);
          border: 1px solid rgba(116, 255, 235, 0.25);
          box-shadow:
            inset 0 0 60px rgba(116, 255, 235, 0.06),
            inset 0 1px 0 rgba(255,255,255,0.06),
            0 40px 120px rgba(0, 0, 0, 0.7),
            0 0 80px rgba(116, 255, 235, 0.08);
          backdrop-filter: blur(24px) saturate(160%);
          overflow: hidden;
          opacity: 0;
          animation: pc-slab-enter 700ms 950ms cubic-bezier(0.16, 0.86, 0.22, 1) forwards;
        }
        @keyframes pc-slab-enter {
          0%   { opacity: 0; transform: scale(0.5) translateY(20px); }
          65%  { opacity: 1; transform: scale(1.02) translateY(-4px); }
          100% { opacity: 1; transform: scale(1) translateY(0); }
        }

        /* ── Hero image ── */
        .pc-hero-frame {
          position: relative;
          width: clamp(140px, 32vw, 220px);
          height: clamp(140px, 32vw, 220px);
          border-radius: 16px;
          overflow: hidden;
          border: 2px solid rgba(255,255,255,0.5);
          box-shadow:
            0 0 0 1px rgba(116, 255, 235, 0.2),
            0 0 30px rgba(116, 255, 235, 0.15),
            0 12px 40px rgba(0, 0, 0, 0.5),
            inset 0 0 0 1px rgba(255,255,255,0.08);
          opacity: 0;
          animation: pc-hero-in 600ms 1200ms cubic-bezier(0.16, 0.86, 0.22, 1) forwards;
        }
        @keyframes pc-hero-in {
          0%   { opacity: 0; transform: scale(0.6) rotate(-3deg); }
          60%  { opacity: 1; transform: scale(1.04) rotate(0.5deg); }
          100% { opacity: 1; transform: scale(1) rotate(0deg); }
        }
        .pc-hero-img {
          width: 100%; height: 100%;
          object-fit: cover;
          display: block;
        }
        .pc-hero-sheen {
          position: absolute; inset: -20%;
          background: linear-gradient(
            105deg,
            transparent 0%,
            transparent 35%,
            rgba(255,255,255,0.5) 45%,
            rgba(255,255,255,0.7) 50%,
            rgba(255,255,255,0.5) 55%,
            transparent 65%,
            transparent 100%
          );
          transform: translateX(-150%);
          animation: pc-hero-sheen 1.6s 1400ms cubic-bezier(0.16, 0.86, 0.22, 1) forwards;
          pointer-events: none;
        }
        @keyframes pc-hero-sheen {
          to { transform: translateX(150%); }
        }

        /* ── ENGRAVED headline ── */
        .pc-headline {
          position: relative; z-index: 5;
          font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
          font-weight: 900;
          font-size: clamp(28px, 5.5vw, 48px);
          letter-spacing: 0.25em;
          line-height: 1;
          /* Chrome/metallic gradient text */
          background: linear-gradient(
            135deg,
            #fbbf24 0%,
            #fff 25%,
            #fbbf24 40%,
            #fff 60%,
            #fbbf24 80%,
            #fff 100%
          );
          background-size: 200% 200%;
          -webkit-background-clip: text;
          background-clip: text;
          -webkit-text-fill-color: transparent;
          /* Emboss via layered shadows on a pseudo */
          filter: drop-shadow(0 -1px 0 rgba(255,255,255,0.2)) drop-shadow(0 2px 0 rgba(0,0,0,0.8));
          opacity: 0;
          animation:
            pc-text-enter 600ms 1300ms cubic-bezier(0.16, 0.86, 0.22, 1) forwards,
            pc-chrome-shift 3s 2000ms ease-in-out infinite alternate;
        }
        @keyframes pc-text-enter {
          0%   { opacity: 0; transform: translateY(6px) scale(0.92); }
          60%  { opacity: 1; transform: translateY(-3px) scale(1.04); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes pc-chrome-shift {
          0%   { background-position: 0% 50%; }
          100% { background-position: 100% 50%; }
        }

        /* ── Slot counter + meta ── */
        .pc-meta {
          display: flex; gap: 8px; flex-wrap: wrap; justify-content: center;
          align-items: center;
          opacity: 0;
          animation: pc-meta-in 400ms 1700ms ease-out forwards;
        }
        @keyframes pc-meta-in {
          to { opacity: 1; }
        }

        .pc-slot {
          font-family: var(--font-mono, ui-monospace, "SF Mono", monospace);
          font-size: 13px; font-weight: 700;
          letter-spacing: 0.08em;
          color: rgba(116, 255, 235, 0.9);
          padding: 4px 12px;
          border-radius: 8px;
          border: 1px solid rgba(116, 255, 235, 0.2);
          background: rgba(116, 255, 235, 0.06);
          min-width: 72px; text-align: center;
          transition: box-shadow 300ms ease, border-color 300ms ease;
        }
        .pc-slot--landed {
          border-color: rgba(116, 255, 235, 0.5);
          box-shadow: 0 0 18px rgba(116, 255, 235, 0.2);
          animation: pc-slot-land 400ms cubic-bezier(0.34, 1.56, 0.64, 1);
        }
        @keyframes pc-slot-land {
          0%   { transform: scale(1.2); }
          60%  { transform: scale(0.95); }
          100% { transform: scale(1); }
        }

        .pc-chip {
          font-family: var(--font-mono, ui-monospace, "SF Mono", monospace);
          font-size: 10px; letter-spacing: 0.06em;
          padding: 4px 10px; border-radius: 8px;
          border: 1px solid rgba(255,255,255,0.12);
          background: rgba(255,255,255,0.04);
          color: rgba(116, 255, 235, 0.7);
          text-decoration: none;
          cursor: pointer;
          pointer-events: auto;
          transition: border-color 150ms, background 150ms;
        }
        .pc-chip:hover {
          border-color: rgba(116, 255, 235, 0.3);
          background: rgba(116, 255, 235, 0.08);
        }

        /* ── Share button ── */
        .pc-share {
          padding: 12px 32px; border-radius: 14px;
          border: 1.5px solid rgba(116, 255, 235, 0.4);
          background:
            linear-gradient(180deg, rgba(116,255,235,0.15), rgba(116,255,235,0.04) 60%),
            rgba(6, 14, 28, 0.9);
          color: rgba(116, 255, 235, 0.95);
          font-family: var(--font-mono, ui-monospace, "SF Mono", monospace);
          font-size: 13px; font-weight: 700;
          letter-spacing: 0.18em;
          cursor: pointer;
          text-shadow: 0 0 12px rgba(116, 255, 235, 0.25);
          box-shadow: 0 0 24px rgba(116, 255, 235, 0.08);
          pointer-events: auto;
          opacity: 0;
          animation:
            pc-share-in 500ms 2000ms cubic-bezier(0.16, 0.86, 0.22, 1) forwards,
            pc-share-pulse 2.5s 2800ms ease-in-out infinite;
          transition: background 150ms, box-shadow 150ms, transform 150ms;
        }
        .pc-share:hover {
          background:
            linear-gradient(180deg, rgba(116,255,235,0.28), rgba(116,255,235,0.1) 60%),
            rgba(6, 14, 28, 0.95);
          box-shadow: 0 0 32px rgba(116, 255, 235, 0.2);
          transform: translateY(-1px);
        }
        .pc-share:active {
          transform: scale(0.97);
        }
        @keyframes pc-share-in {
          0%   { opacity: 0; transform: translateY(10px) scale(0.92); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes pc-share-pulse {
          0%, 100% { box-shadow: 0 0 24px rgba(116,255,235,0.08); }
          50%      { box-shadow: 0 0 36px rgba(116,255,235,0.18); border-color: rgba(116,255,235,0.55); }
        }

        /* ══════════════════════════════════════════════════════════════
           BEAT 4: PARTICLES
           ══════════════════════════════════════════════════════════ */
        .pc-particles {
          position: fixed; inset: -6% -12%;
          pointer-events: none; z-index: 3;
        }

        .pc-p {
          position: absolute; left: 50%; top: 50%;
          width: 7px; height: 7px; border-radius: 50%;
          background: var(--color);
          box-shadow: 0 0 16px var(--color);
          opacity: 0;
          animation: pc-burst 5.5s steps(12) var(--d) forwards;
        }
        .pc-p[style*="--type:star"] {
          clip-path: polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%);
        }

        .pc-crystal {
          position: absolute; left: 50%; top: 50%;
          width: 9px; height: 13px;
          background: var(--color);
          clip-path: polygon(50% 0%, 100% 35%, 80% 100%, 20% 100%, 0% 35%);
          opacity: 0;
          animation: pc-burst 5s steps(10) var(--d) forwards;
        }

        .pc-confetti {
          position: absolute; left: 50%; top: 50%;
          width: 6px; height: 6px;
          background: var(--color);
          transform: rotate(45deg);
          opacity: 0;
          animation: pc-burst 5s steps(12) var(--d) forwards;
        }

        .pc-ring {
          position: absolute; left: 50%; top: 50%;
          width: 11px; height: 11px; border-radius: 50%;
          border: 2px solid var(--color);
          background: transparent;
          opacity: 0;
          animation: pc-ring-burst 4.5s ease-out var(--d) forwards;
        }

        @keyframes pc-burst {
          0%   { opacity: 0; transform: translate(-50%, -50%) scale(0.4); }
          12%  { opacity: 1; }
          100% { opacity: 0; transform: translate(calc(var(--x) - 50%), calc(var(--y) - 50%)) scale(2.5) rotate(1080deg); }
        }
        @keyframes pc-ring-burst {
          0%   { opacity: 0; transform: translate(-50%, -50%) scale(0.3); }
          18%  { opacity: 0.8; }
          100% { opacity: 0; transform: translate(calc(var(--x) - 50%), calc(var(--y) - 50%)) scale(4); }
        }

        /* ══════════════════════════════════════════════════════════════
           REDUCED MOTION
           ══════════════════════════════════════════════════════════ */
        @media (prefers-reduced-motion: reduce) {
          .pc-flash, .pc-particles, .pc-lightning, .pc-shockwave { display: none; }
          .pc-slab { animation: none; opacity: 1; }
          .pc-headline { animation: none; opacity: 1; -webkit-text-fill-color: #fbbf24; }
          .pc-hero-frame { animation: none; opacity: 1; }
          .pc-hero-sheen { display: none; }
          .pc-meta, .pc-share { animation: none; opacity: 1; }
          .pc-shake-root { animation: none; }
          .pc-fullscreen { transition: none; }
        }
      `}</style>
    </div>
  );
}
