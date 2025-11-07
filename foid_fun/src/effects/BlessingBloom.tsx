// src/effects/BlessingBloom.tsx
"use client";
import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { spawn } from "@/lib/spawn";

type BloomOptions = { position?: "corner" | "center"; duration?: number };
type ShowBlessingBloomOptions = BloomOptions & { message?: string };

export function showBlessingBloom(options: ShowBlessingBloomOptions = {}) {
  const { message, ...rest } = options;
  const displayText = message ?? "PRAYER BLESSED ✨🙏🩵";
  showOverTheTopBlessingBloom(displayText, rest);
}

export function showOverTheTopBlessingBloom(text: string, options: BloomOptions = {}) {
  const duration = options.duration ?? 5500;
  spawn(<OverTheTopBlessingBloom text={text} centered />, duration);
}

/** Autoshrink text to fit its container so it never clips */
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
      while (
        s > cfg.min &&
        (el.scrollWidth > parent.clientWidth - pad || el.scrollHeight > parent.clientHeight - pad)
      ) {
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

export default function OverTheTopBlessingBloom({
  text,
  centered = true,
}: {
  text: string;
  centered?: boolean;
}) {
  // Warm AudioContext to avoid first-sound lag on mobile
  useEffect(() => {
    try {
      const A: any = (window as any).AudioContext || (window as any).webkitAudioContext;
      if (A) {
        const ctx = new A();
        ctx.close?.();
      }
    } catch {}
  }, []);

  const display = useMemo(() => text.toUpperCase(), [text]);
  const { ref: textRef } = useFitText([display], { max: 122, min: 30, step: 2 });

  return (
    <div aria-live="polite" role="status" className="fx-fullscreen">
      {/* Ambient vista glow */}
      <div className="bb-halo" aria-hidden />

      {/* Contrast guard so text always pops */}
      <div className="bb-guard" aria-hidden />

      {/* Vista glass pill */}
      <div className="bb-wrap">
        {/* Decorative vista orbs inside the glass */}
        <div className="bb-orb orb-a" aria-hidden />
        <div className="bb-orb orb-b" aria-hidden />

        {/* The headline (auto-fits, stroked, glowing) */}
        <span ref={textRef} className="bb-text" data-text={display}>
          {display}
        </span>

        {/* PS2 scanlines & lens flare */}
        <div className="bb-scanlines" aria-hidden />
        <div className="bb-sheen" aria-hidden />
      </div>

      {/* Particle stage (kept behind text via z-index) */}
      <div className="bb-sparkles" aria-hidden>
        {Array.from({ length: 260 }).map((_, i) => (
          <i
            key={`p${i}`}
            className="particle"
            style={
              {
                "--d": `${i * 14}ms`,
                "--x": `${(Math.random() * 200 - 100).toFixed(1)}vw`,
                "--y": `${(Math.random() * 200 - 100).toFixed(1)}vh`,
                "--type": Math.random() > 0.55 ? "sparkle" : "star",
              } as React.CSSProperties
            }
          />
        ))}
        {Array.from({ length: 240 }).map((_, i) => (
          <i
            key={`b${i}`}
            className="bubble"
            style={
              {
                "--d": `${i * 18}ms`,
                "--x": `${Math.random() * 100}vw`,
                "--wobble": Math.random() * 22 - 11,
              } as React.CSSProperties
            }
          />
        ))}
        {Array.from({ length: 200 }).map((_, i) => (
          <i
            key={`c${i}`}
            className="confetti"
            style={
              {
                "--d": `${i * 22}ms`,
                "--x": `${Math.random() * 200 - 100}vw`,
                "--y": `${Math.random() * 200 - 100}vh`,
                "--color": `hsl(${Math.random() * 360}, 100%, 55%)`,
              } as React.CSSProperties
            }
          />
        ))}
        {Array.from({ length: 140 }).map((_, i) => (
          <i
            key={`h${i}`}
            className="heart"
            style={
              {
                "--d": `${i * 28}ms`,
                "--x": `${Math.random() * 200 - 100}vw`,
                "--y": `${Math.random() * 200 - 100}vh`,
                "--color": `hsl(${Math.random() * 360}, 100%, 55%)`,
              } as React.CSSProperties
            }
          />
        ))}
        {Array.from({ length: 96 }).map((_, i) => (
          <span
            key={`s${i}`}
            className="shooting-star"
            style={
              {
                "--d": `${i * 32}ms`,
                "--start-x": `${Math.random() * 100}vw`,
                "--end-x": `${Math.random() * 100 - 200}vw`,
                "--y": `${Math.random() * 100}vh`,
              } as React.CSSProperties
            }
          >
            🌟
          </span>
        ))}
        {Array.from({ length: 72 }).map((_, i) => (
          <span
            key={`e1${i}`}
            className="blessing-emoji"
            style={
              {
                "--d": `${i * 36}ms`,
                "--x": `${Math.random() * 200 - 100}vw`,
                "--y": `${Math.random() * 200 - 100}vh`,
              } as React.CSSProperties
            }
          >
            🙏
          </span>
        ))}
        {Array.from({ length: 72 }).map((_, i) => (
          <span
            key={`e2${i}`}
            className="blessing-emoji"
            style={
              {
                "--d": `${i * 36}ms`,
                "--x": `${Math.random() * 200 - 100}vw`,
                "--y": `${Math.random() * 200 - 100}vh`,
              } as React.CSSProperties
            }
          >
            🕊️
          </span>
        ))}
      </div>

      <style jsx>{`
        /* Stage */
        .fx-fullscreen {
          position: fixed; inset: 0; z-index: 1000;
          display: grid; place-items: center;
          pointer-events: none; overflow: hidden;
          background: radial-gradient(circle, rgba(0,191,255,0.16), transparent 70%);
        }

        .bb-halo {
          position: fixed; inset: -10%;
          background: radial-gradient(70% 70% at 50% 50%, rgba(255,182,193,.35), rgba(0,191,255,.28), transparent 60%);
          filter: blur(42px); opacity: .9; z-index: 0;
          animation: halo-pulse 5.5s ease-in-out infinite;
        }

        .bb-guard {
          position: fixed; inset: 0; z-index: 1; pointer-events: none;
          background: radial-gradient(42% 36% at 50% 50%, rgba(2,12,28,.68), rgba(2,12,28,.30) 58%, rgba(2,12,28,0) 74%);
          filter: blur(14px);
        }

        /* Vista glass pill */
        .bb-wrap {
          position: relative; z-index: 3;
          width: clamp(320px, 64vw, 1000px);
          min-height: clamp(140px, 18vw, 280px);
          border-radius: 9999px;
          display: grid; place-items: center;
          padding: clamp(10px, 2vw, 22px);
          background:
            linear-gradient(135deg, rgba(255,255,255,.5), rgba(255,105,180,.35), rgba(0,191,255,.35)),
            rgba(12,24,48,.45);
          box-shadow:
            inset 0 0 0 2px rgba(255,255,255,.7),
            0 48px 150px rgba(2,10,30,.55);
          backdrop-filter: blur(28px) saturate(190%);
          overflow: hidden;
          animation: bb-mega-explode 1.6s cubic-bezier(.16,.86,.22,1) both;
        }

        /* Decorative Vista orbs inside glass */
        .bb-orb {
          position: absolute; border-radius: 9999px; filter: blur(18px);
          mix-blend-mode: screen; opacity: .6;
          animation: orb-float 8s ease-in-out infinite alternate;
        }
        .orb-a { width: 180px; height: 180px; left: 8%; top: 18%;
          background: radial-gradient(40% 40% at 25% 25%, #ff69b4, transparent 60%);
          animation-delay: 0s;
        }
        .orb-b { width: 220px; height: 220px; right: 10%; bottom: 12%;
          background: radial-gradient(70% 70% at 75% 75%, #00bfff, transparent 60%);
          animation-delay: .6s;
        }

        /* The message (auto-fit + stroke + glow + echo) */
        .bb-text {
          position: relative; z-index: 5; max-width: 92%;
          text-align: center;
          font-family: "Trebuchet MS","Comic Sans MS", system-ui, -apple-system, Segoe UI, Tahoma, sans-serif;
          font-weight: 900; letter-spacing: .02em; color: #fff;
          -webkit-text-stroke: 4px rgba(0,18,36,.98);
          text-shadow:
            0 0 14px rgba(255,255,255,.95),
            0 0 34px rgba(0,255,255,.85),
            0 0 48px rgba(255,215,0,.75);
          image-rendering: pixelated;
          animation: bb-text-pop 650ms cubic-bezier(.2,1,.2,1) both, color-shift 1.35s steps(6) infinite;
        }
        .bb-text::after {
          content: attr(data-text);
          position: absolute; inset: 0;
          -webkit-text-stroke: 10px rgba(0,0,0,.25);
          color: transparent; filter: blur(3px); z-index: -1;
        }

        /* PS2 scanlines & lens flare */
        .bb-scanlines {
          position: absolute; inset: 0; z-index: 4; pointer-events: none;
          mix-blend-mode: soft-light; opacity: .45;
          background: repeating-linear-gradient(
            to bottom,
            rgba(255,255,255,.085) 0px,
            rgba(255,255,255,.085) 1px,
            rgba(0,0,0,0) 2px,
            rgba(0,0,0,0) 4px
          );
          animation: scan-fade 6s ease-in-out infinite;
        }
        .bb-sheen {
          position: absolute; inset: -10%; z-index: 4; pointer-events: none;
          background: linear-gradient(75deg, rgba(255,255,255,0) 0%, rgba(255,255,255,.78) 40%, rgba(255,255,255,0) 60%);
          transform: translateX(-120%); filter: blur(2px);
          animation: sheen-sweep 2.25s .25s cubic-bezier(.16,.86,.22,1) forwards;
        }

        /* Particle stage behind text */
        .bb-sparkles { position: fixed; inset: -6% -12%; pointer-events: none; z-index: 2; }

        .particle {
          position: absolute; left: 50%; top: 50%;
          width: 9px; height: 9px; border-radius: 50%; background: white;
          box-shadow: 0 0 25px rgba(255,255,200,.98);
          transform: translate(-50%, -50%) scale(0.5); opacity: 0;
          animation: mega-burst 5s steps(12) var(--d) forwards;
        }
        .particle[style*="--type:star"] {
          clip-path: polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%);
          background: gold;
        }
        .bubble {
          position: absolute; bottom: -110vh; left: var(--x);
          width: 12px; height: 12px; border-radius: 50%; background: rgba(0,191,255,.7);
          animation: underwater-bubble 6.2s linear var(--d) forwards;
        }
        .confetti {
          position: absolute; left: 50%; top: 50%;
          width: 8px; height: 8px; background: var(--color); transform: rotate(45deg);
          opacity: 0; animation: confetti-burst 5s steps(12) var(--d) forwards;
        }
        .heart {
          position: absolute; left: 50%; top: 50%;
          width: 14px; height: 14px; background: var(--color);
          clip-path: path('M8 1.314C12.438-3.248 23.534 4.735 8 15-7.534 4.736 3.562-3.248 8 1.314z');
          opacity: 0; animation: heart-burst 5s steps(12) var(--d) forwards;
        }
        .shooting-star {
          position: absolute; top: var(--y); left: var(--start-x);
          font-size: 24px; text-shadow: 0 0 10px yellow;
          animation: shooting-star 4.5s linear var(--d) forwards;
        }
        .shooting-star::after {
          content: ''; position: absolute; left: 0; top: 50%;
          width: 60px; height: 2px; transform: translateY(-50%);
          background: linear-gradient(to left, yellow, transparent);
          animation: trail-fade 4.5s linear forwards;
        }
        .blessing-emoji {
          position: absolute; left: 50%; top: 50%; font-size: 28px;
          opacity: 0; text-shadow: 0 0 10px rgba(0,191,255,.8);
          animation: blessing-burst 6s ease-out var(--d) forwards;
        }

        /* Animations */
        @keyframes bb-mega-explode {
          0% { transform: scale(0.4); opacity: 0; }
          25% { opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes bb-text-pop {
          0% { transform: translateY(6px) scale(.96); opacity: 0; }
          60% { transform: translateY(-8px) scale(1.06); opacity: 1; }
          100% { transform: translateY(0) scale(1.02); }
        }
        @keyframes sheen-sweep { to { transform: translateX(120%); opacity: 0; } }
        @keyframes scan-fade { 0%,100% { opacity: .45; } 50% { opacity: .25; } }
        @keyframes halo-pulse { 0%,100% { transform: scale(1); opacity: .9; } 50% { transform: scale(1.18); opacity: 1; } }
        @keyframes color-shift {
          0% { color: #ff69b4; } 25% { color: #00ff00; }
          50% { color: #ffd700; } 75% { color: #00bfff; } 100% { color: #ff69b4; }
        }
        @keyframes orb-float {
          0% { transform: translateY(0) translateX(0) scale(1); }
          100% { transform: translateY(-10%) translateX(6%) scale(1.08); }
        }

        @keyframes mega-burst {
          0% { opacity: 0; transform: translate(-50%, -50%) scale(0.5); }
          20% { opacity: 1; }
          100% { opacity: 0; transform: translate(calc(var(--x) - 50%), calc(var(--y) - 50%)) scale(2.2) rotate(1080deg); }
        }
        @keyframes underwater-bubble {
          0% { opacity: 0; transform: translateY(0) translateX(0) scale(0.5); }
          20% { opacity: 1; }
          100% { opacity: 0; transform: translateY(-210vh) translateX(var(--wobble)px) scale(3.5) rotate(1800deg); }
        }
        @keyframes confetti-burst {
          0% { opacity: 0; transform: translate(-50%, -50%) scale(0.4) rotate(0); }
          25% { opacity: 1; }
          100% { opacity: 0; transform: translate(var(--x), var(--y)) scale(2) rotate(1800deg); }
        }
        @keyframes heart-burst {
          0% { opacity: 0; transform: translate(-50%, -50%) scale(0.5); }
          20% { opacity: 1; }
          100% { opacity: 0; transform: translate(var(--x), var(--y)) scale(2.5) rotate(1260deg); }
        }
        @keyframes shooting-star {
          0% { transform: translateX(0); opacity: 0; }
          20% { opacity: 1; }
          100% { transform: translateX(var(--end-x)); opacity: 0; }
        }
        @keyframes trail-fade { 0% { opacity: 1; width: 60px; } 100% { opacity: 0; width: 0; } }
        @keyframes blessing-burst {
          0% { opacity: 0; transform: translate(-50%, -50%) scale(0.5); }
          30% { opacity: 1; }
          100% { opacity: 0; transform: translate(var(--x), var(--y)) scale(3) rotate(1440deg); }
        }

        @media (prefers-reduced-motion: reduce) {
          .bb-halo, .bb-guard, .bb-sparkles, .bb-scanlines, .bb-sheen, .bb-orb { display: none; }
          .bb-wrap { animation: none; }
          .bb-text { animation: none; }
        }
      `}</style>
    </div>
  );
}
