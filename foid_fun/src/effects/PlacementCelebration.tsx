// src/effects/PlacementCelebration.tsx
// Gates of Olympus-style multi-beat celebration for loreboard placements
"use client";
import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { spawn } from "@/lib/spawn";
import { getAudioSettings } from "@/lib/audioSettings";

type PlacementCelebrationProps = {
  itemName: string;
  txHash: string;
  proposalId: number | null;
  previewUrl: string;
};

export function showPlacementCelebration(opts: PlacementCelebrationProps) {
  spawn(
    <PlacementCelebration {...opts} />,
    7000,
  );
}

/* ── Auto-fit text ───────────────────────────────────────────────────── */

function useFitText(deps: React.DependencyList, cfg = { max: 120, min: 28, step: 2 }) {
  const ref = useRef<HTMLSpanElement | null>(null);
  const [size, setSize] = useState(cfg.max);
  useLayoutEffect(() => {
    const el = ref.current;
    const parent = el?.parentElement;
    if (!el || !parent) return;
    const pad = 28;
    const measure = () => {
      let s = cfg.max;
      el.style.fontSize = `${s}px`;
      el.style.lineHeight = "1.02";
      el.style.whiteSpace = "pre-wrap";
      while (s > cfg.min && (el.scrollWidth > parent.clientWidth - pad || el.scrollHeight > parent.clientHeight - pad)) {
        s -= cfg.step;
        el.style.fontSize = `${s}px`;
      }
      setSize(s);
    };
    const ro = new ResizeObserver(measure);
    ro.observe(parent);
    measure();
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return { ref, size };
}

/* ── Gemstone palette ────────────────────────────────────────────────── */

const GEMSTONE_COLORS = [
  "#FFD700", // gold
  "#50C878", // emerald
  "#E0115F", // ruby
  "#0F52BA", // sapphire
  "#9966CC", // amethyst
  "#FF6347", // flame
  "#00CED1", // cyan crystal
  "#FFA500", // amber
];

function pickGem(i: number) {
  return GEMSTONE_COLORS[i % GEMSTONE_COLORS.length];
}

/* ── Component ────────────────────────────────────────────────────────── */

export default function PlacementCelebration({
  itemName,
  txHash,
  proposalId,
  previewUrl,
}: PlacementCelebrationProps) {
  const display = "ENGRAVED";
  const { ref: textRef } = useFitText([display], { max: 110, min: 32, step: 2 });

  // Sound effects
  useEffect(() => {
    const settings = getAudioSettings();
    if (!settings.sfxEnabled) return;
    import("@/lib/sfx").then((sfx) => {
      sfx.default.playVictoryChord();
      setTimeout(() => sfx.default.playReward(), 1200);
    });
  }, []);

  // Share to X
  const handleShare = () => {
    const text = encodeURIComponent(
      `just engraved on the @mifoid loreboard${proposalId != null ? ` (Proposal #${proposalId})` : ""}\n\nhttps://foid.fun/board`,
    );
    window.open(`https://x.com/intent/tweet?text=${text}`, "_blank");
  };

  // Precomputed particles
  const sparkles = useMemo(() => Array.from({ length: 300 }, (_, i) => ({
    d: i * 12,
    x: `${(Math.random() * 200 - 100).toFixed(1)}vw`,
    y: `${(Math.random() * 200 - 100).toFixed(1)}vh`,
    color: pickGem(i),
    type: Math.random() > 0.5 ? "sparkle" : "star",
  })), []);

  const crystals = useMemo(() => Array.from({ length: 200 }, (_, i) => ({
    d: i * 18,
    x: `${(Math.random() * 200 - 100).toFixed(1)}vw`,
    y: `${(Math.random() * 200 - 100).toFixed(1)}vh`,
    color: pickGem(i),
  })), []);

  const confetti = useMemo(() => Array.from({ length: 120 }, (_, i) => ({
    d: i * 22,
    x: `${(Math.random() * 200 - 100).toFixed(1)}vw`,
    y: `${(Math.random() * 200 - 100).toFixed(1)}vh`,
    color: `hsl(${Math.random() * 360}, 100%, 55%)`,
  })), []);

  const rings = useMemo(() => Array.from({ length: 80 }, (_, i) => ({
    d: i * 28,
    x: `${(Math.random() * 200 - 100).toFixed(1)}vw`,
    y: `${(Math.random() * 200 - 100).toFixed(1)}vh`,
    color: pickGem(i),
  })), []);

  return (
    <div aria-live="polite" role="status" className="pc-fullscreen" onClick={(e) => { if (e.target === e.currentTarget) (e.currentTarget as HTMLElement).style.display = "none"; }}>
      {/* Beat 1: Screen flash */}
      <div className="pc-flash" aria-hidden />

      {/* Beat 1: Camera shake container */}
      <div className="pc-shake-root">
        {/* Beat 2: Lightning bolt */}
        <svg className="pc-lightning" viewBox="0 0 200 600" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
          <path
            d="M100 0 L85 180 L120 200 L70 380 L110 400 L60 600"
            stroke="url(#lightning-grad)"
            strokeWidth="6"
            strokeLinecap="round"
            strokeLinejoin="round"
            filter="url(#lightning-glow)"
          />
          <defs>
            <linearGradient id="lightning-grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#fff" />
              <stop offset="40%" stopColor="#00e5ff" />
              <stop offset="100%" stopColor="#9966CC" />
            </linearGradient>
            <filter id="lightning-glow" x="-50%" y="-10%" width="200%" height="120%">
              <feGaussianBlur stdDeviation="8" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
        </svg>

        {/* Beat 3: Glass pill overlay */}
        <div className="pc-pill-guard" aria-hidden />
        <div className="pc-pill">
          <div className="pc-orb pc-orb-a" aria-hidden />
          <div className="pc-orb pc-orb-b" aria-hidden />

          {/* Headline */}
          <span ref={textRef} className="pc-headline" data-text={display}>
            {display}
          </span>

          {/* Thumbnail */}
          {previewUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={previewUrl}
              alt={itemName}
              className="pc-thumb"
              referrerPolicy="no-referrer"
            />
          )}

          {/* Metadata row */}
          <div className="pc-meta">
            {proposalId != null && (
              <span className="pc-chip">Proposal #{proposalId}</span>
            )}
            <a
              className="pc-chip pc-chip--link"
              href={`https://testnet.fluentscan.xyz/tx/${txHash}`}
              target="_blank"
              rel="noreferrer"
            >
              tx: {txHash.slice(0, 10)}...
            </a>
          </div>

          {/* Share button */}
          <button type="button" className="pc-share" onClick={handleShare}>
            SHARE TO X
          </button>

          {/* Scanlines & sheen */}
          <div className="pc-scanlines" aria-hidden />
          <div className="pc-sheen" aria-hidden />
        </div>
      </div>

      {/* Beat 4: Particle stage */}
      <div className="pc-particles" aria-hidden>
        {sparkles.map((s, i) => (
          <i
            key={`s${i}`}
            className="pc-p"
            style={{
              "--d": `${s.d}ms`,
              "--x": s.x,
              "--y": s.y,
              "--color": s.color,
              "--type": s.type,
            } as React.CSSProperties}
          />
        ))}
        {crystals.map((c, i) => (
          <i
            key={`c${i}`}
            className="pc-crystal"
            style={{
              "--d": `${c.d}ms`,
              "--x": c.x,
              "--y": c.y,
              "--color": c.color,
            } as React.CSSProperties}
          />
        ))}
        {confetti.map((c, i) => (
          <i
            key={`f${i}`}
            className="pc-confetti"
            style={{
              "--d": `${c.d}ms`,
              "--x": c.x,
              "--y": c.y,
              "--color": c.color,
            } as React.CSSProperties}
          />
        ))}
        {rings.map((r, i) => (
          <i
            key={`r${i}`}
            className="pc-ring"
            style={{
              "--d": `${r.d}ms`,
              "--x": r.x,
              "--y": r.y,
              "--color": r.color,
            } as React.CSSProperties}
          />
        ))}
      </div>

      <style jsx>{`
        /* ── Stage ── */
        .pc-fullscreen {
          position: fixed; inset: 0; z-index: 1000;
          display: grid; place-items: center;
          pointer-events: auto; overflow: hidden;
          background: radial-gradient(circle, rgba(255,215,0,0.08), transparent 70%);
        }

        /* ── Beat 1: Flash ── */
        .pc-flash {
          position: fixed; inset: 0; z-index: 10;
          background: white; pointer-events: none;
          animation: pc-flash 400ms ease-out forwards;
        }
        @keyframes pc-flash {
          0% { opacity: 0.75; }
          100% { opacity: 0; }
        }

        /* ── Beat 1: Shake ── */
        .pc-shake-root {
          display: contents;
          animation: pc-shake 500ms ease-out;
        }
        @keyframes pc-shake {
          0% { transform: translate(0, 0); }
          10% { transform: translate(-6px, 4px); }
          20% { transform: translate(5px, -3px); }
          30% { transform: translate(-4px, 5px); }
          40% { transform: translate(3px, -2px); }
          50% { transform: translate(-2px, 3px); }
          60% { transform: translate(2px, -1px); }
          80% { transform: translate(-1px, 1px); }
          100% { transform: translate(0, 0); }
        }

        /* ── Beat 2: Lightning ── */
        .pc-lightning {
          position: fixed; z-index: 8;
          top: -5%; left: 50%; transform: translateX(-50%);
          width: 140px; height: 420px;
          opacity: 0; pointer-events: none;
          animation: pc-bolt 900ms 200ms ease-out forwards;
        }
        .pc-lightning path {
          stroke-dasharray: 1200;
          stroke-dashoffset: 1200;
          animation: pc-bolt-draw 600ms 250ms ease-out forwards;
        }
        @keyframes pc-bolt {
          0% { opacity: 0; }
          15% { opacity: 1; }
          70% { opacity: 0.9; }
          100% { opacity: 0; }
        }
        @keyframes pc-bolt-draw {
          to { stroke-dashoffset: 0; }
        }

        /* ── Beat 3: Guard (contrast) ── */
        .pc-pill-guard {
          position: fixed; inset: 0; z-index: 4; pointer-events: none;
          background: radial-gradient(42% 36% at 50% 50%, rgba(2,12,28,.72), rgba(2,12,28,.30) 58%, rgba(2,12,28,0) 74%);
          filter: blur(14px);
          opacity: 0;
          animation: pc-guard-in 500ms 1000ms ease-out forwards;
        }
        @keyframes pc-guard-in {
          to { opacity: 1; }
        }

        /* ── Beat 3: Glass pill ── */
        .pc-pill {
          position: relative; z-index: 5;
          width: clamp(280px, 42vw, 480px);
          min-height: clamp(280px, 45vh, 520px);
          border-radius: 28px;
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          padding: clamp(20px, 3vw, 36px) clamp(16px, 2.5vw, 28px);
          gap: 14px;
          background:
            linear-gradient(135deg, rgba(255,255,255,.35), rgba(255,215,0,.2), rgba(148,103,189,.25)),
            rgba(8,16,36,.65);
          box-shadow:
            inset 0 0 0 2px rgba(255,255,255,.55),
            0 48px 150px rgba(2,10,30,.6),
            0 0 80px rgba(255,215,0,.15);
          backdrop-filter: blur(28px) saturate(180%);
          overflow: hidden;
          opacity: 0;
          animation: pc-pill-enter 800ms 1100ms cubic-bezier(.16,.86,.22,1) forwards;
        }
        @keyframes pc-pill-enter {
          0% { opacity: 0; transform: scale(0.3); }
          60% { opacity: 1; }
          100% { opacity: 1; transform: scale(1); }
        }

        /* ── Orbs inside glass ── */
        .pc-orb {
          position: absolute; border-radius: 9999px; filter: blur(22px);
          mix-blend-mode: screen; opacity: .5;
          animation: pc-orb-float 8s ease-in-out infinite alternate;
        }
        .pc-orb-a { width: 160px; height: 160px; left: 5%; top: 10%;
          background: radial-gradient(40% 40% at 25% 25%, #FFD700, transparent 60%);
        }
        .pc-orb-b { width: 200px; height: 200px; right: 8%; bottom: 8%;
          background: radial-gradient(70% 70% at 75% 75%, #9966CC, transparent 60%);
          animation-delay: .6s;
        }
        @keyframes pc-orb-float {
          0% { transform: translateY(0) translateX(0) scale(1); }
          100% { transform: translateY(-8%) translateX(5%) scale(1.1); }
        }

        /* ── Headline text ── */
        .pc-headline {
          position: relative; z-index: 5; max-width: 92%;
          text-align: center;
          font-family: "Trebuchet MS", "Comic Sans MS", system-ui, sans-serif;
          font-weight: 900; letter-spacing: .06em; color: #fff;
          -webkit-text-stroke: 4px rgba(0,18,36,.95);
          text-shadow:
            0 0 14px rgba(255,255,255,.9),
            0 0 34px rgba(255,215,0,.8),
            0 0 52px rgba(224,17,95,.6);
          image-rendering: pixelated;
          animation: pc-text-pop 700ms 1200ms cubic-bezier(.2,1,.2,1) both, pc-gem-shift 1.5s 1900ms steps(5) infinite;
        }
        .pc-headline::after {
          content: attr(data-text);
          position: absolute; inset: 0;
          -webkit-text-stroke: 10px rgba(0,0,0,.2);
          color: transparent; filter: blur(3px); z-index: -1;
        }
        @keyframes pc-text-pop {
          0% { transform: translateY(8px) scale(.9); opacity: 0; }
          60% { transform: translateY(-6px) scale(1.08); opacity: 1; }
          100% { transform: translateY(0) scale(1); }
        }
        @keyframes pc-gem-shift {
          0% { color: #FFD700; }
          20% { color: #50C878; }
          40% { color: #E0115F; }
          60% { color: #0F52BA; }
          80% { color: #9966CC; }
          100% { color: #FFD700; }
        }

        /* ── Thumbnail ── */
        .pc-thumb {
          width: clamp(100px, 28vw, 160px); height: clamp(100px, 28vw, 160px);
          border-radius: 16px;
          object-fit: cover;
          border: 3px solid rgba(255,255,255,.55);
          box-shadow:
            0 8px 32px rgba(0,0,0,.5),
            0 0 24px rgba(255,215,0,.25),
            inset 0 0 0 1px rgba(255,255,255,.15);
          opacity: 0;
          animation: pc-thumb-in 600ms 1400ms cubic-bezier(.16,.86,.22,1) forwards;
        }
        @keyframes pc-thumb-in {
          0% { opacity: 0; transform: scale(0.4) rotate(-6deg); }
          70% { opacity: 1; transform: scale(1.06) rotate(1deg); }
          100% { opacity: 1; transform: scale(1) rotate(0deg); }
        }

        /* ── Meta chips ── */
        .pc-meta {
          display: flex; gap: 6px; flex-wrap: wrap; justify-content: center;
          opacity: 0;
          animation: pc-meta-in 400ms 1700ms ease-out forwards;
        }
        @keyframes pc-meta-in {
          to { opacity: 1; }
        }
        .pc-chip {
          padding: 3px 10px; border-radius: 8px;
          border: 1px solid rgba(255,255,255,.2);
          background: rgba(255,255,255,.06);
          font-family: var(--font-mono, monospace); font-size: 10px;
          letter-spacing: .06em; color: rgba(255,255,255,.6);
        }
        .pc-chip--link {
          color: rgba(116,255,235,.9);
          text-decoration: underline; cursor: pointer;
          pointer-events: auto;
        }

        /* ── Share button ── */
        .pc-share {
          padding: 10px 28px; border-radius: 14px;
          border: 1.5px solid rgba(255,215,0,.6);
          background: linear-gradient(180deg, rgba(255,215,0,.22), rgba(255,215,0,.08) 50%), rgba(6,14,28,.85);
          color: rgba(255,215,0,.95);
          font-family: var(--font-mono, monospace); font-size: 12px; font-weight: 700;
          letter-spacing: .2em; cursor: pointer;
          text-shadow: 0 0 10px rgba(255,215,0,.3);
          box-shadow: 0 0 20px rgba(255,215,0,.1);
          pointer-events: auto;
          opacity: 0;
          animation: pc-share-in 500ms 1900ms cubic-bezier(.16,.86,.22,1) forwards;
          transition: background 150ms, box-shadow 150ms, transform 150ms;
        }
        .pc-share:hover {
          background: linear-gradient(180deg, rgba(255,215,0,.35), rgba(255,215,0,.15) 50%), rgba(6,14,28,.9);
          box-shadow: 0 0 24px rgba(255,215,0,.3);
          transform: translateY(-1px);
        }
        @keyframes pc-share-in {
          0% { opacity: 0; transform: translateY(8px) scale(0.9); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }

        /* ── Scanlines & sheen ── */
        .pc-scanlines {
          position: absolute; inset: 0; z-index: 6; pointer-events: none;
          mix-blend-mode: soft-light; opacity: .35;
          background: repeating-linear-gradient(
            to bottom,
            rgba(255,255,255,.08) 0px, rgba(255,255,255,.08) 1px,
            rgba(0,0,0,0) 2px, rgba(0,0,0,0) 4px
          );
          animation: pc-scan-fade 6s ease-in-out infinite;
        }
        @keyframes pc-scan-fade { 0%,100% { opacity: .35; } 50% { opacity: .18; } }

        .pc-sheen {
          position: absolute; inset: -10%; z-index: 6; pointer-events: none;
          background: linear-gradient(75deg, rgba(255,255,255,0) 0%, rgba(255,255,255,.65) 40%, rgba(255,255,255,0) 60%);
          transform: translateX(-120%); filter: blur(2px);
          animation: pc-sheen-sweep 2s 1200ms cubic-bezier(.16,.86,.22,1) forwards;
        }
        @keyframes pc-sheen-sweep { to { transform: translateX(120%); opacity: 0; } }

        /* ── Particle stage ── */
        .pc-particles { position: fixed; inset: -6% -12%; pointer-events: none; z-index: 3; }

        .pc-p {
          position: absolute; left: 50%; top: 50%;
          width: 8px; height: 8px; border-radius: 50%;
          background: var(--color); box-shadow: 0 0 20px var(--color);
          opacity: 0;
          animation: pc-burst 5.5s steps(12) var(--d) forwards;
        }
        .pc-p[style*="--type:star"] {
          clip-path: polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%);
        }

        .pc-crystal {
          position: absolute; left: 50%; top: 50%;
          width: 10px; height: 14px;
          background: var(--color);
          clip-path: polygon(50% 0%, 100% 35%, 80% 100%, 20% 100%, 0% 35%);
          opacity: 0;
          animation: pc-burst 5s steps(10) var(--d) forwards;
        }

        .pc-confetti {
          position: absolute; left: 50%; top: 50%;
          width: 7px; height: 7px;
          background: var(--color); transform: rotate(45deg);
          opacity: 0;
          animation: pc-burst 5s steps(12) var(--d) forwards;
        }

        .pc-ring {
          position: absolute; left: 50%; top: 50%;
          width: 12px; height: 12px; border-radius: 50%;
          border: 2px solid var(--color);
          background: transparent;
          opacity: 0;
          animation: pc-ring-burst 4.5s ease-out var(--d) forwards;
        }

        @keyframes pc-burst {
          0% { opacity: 0; transform: translate(-50%, -50%) scale(0.4); }
          15% { opacity: 1; }
          100% { opacity: 0; transform: translate(calc(var(--x) - 50%), calc(var(--y) - 50%)) scale(2.5) rotate(1080deg); }
        }
        @keyframes pc-ring-burst {
          0% { opacity: 0; transform: translate(-50%, -50%) scale(0.3); }
          20% { opacity: 0.8; }
          100% { opacity: 0; transform: translate(calc(var(--x) - 50%), calc(var(--y) - 50%)) scale(4); }
        }

        /* ── Reduced motion ── */
        @media (prefers-reduced-motion: reduce) {
          .pc-flash, .pc-particles, .pc-scanlines, .pc-sheen, .pc-lightning, .pc-orb { display: none; }
          .pc-pill { animation: none; opacity: 1; }
          .pc-headline { animation: none; opacity: 1; }
          .pc-thumb, .pc-meta, .pc-share { animation: none; opacity: 1; }
          .pc-shake-root { animation: none; }
        }
      `}</style>
    </div>
  );
}
