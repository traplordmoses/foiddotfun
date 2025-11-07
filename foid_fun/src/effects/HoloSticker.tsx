// src/effects/HoloSticker.tsx
"use client";
import React from "react";
import { spawn } from "@/lib/spawn";

type StickerOptions = {
  position?: "corner" | "center";
  duration?: number;
};

export function showHoloSticker(text?: string, options: StickerOptions = {}) {
  const t = (text && text.trim()) || "LET GO—LET GOD ✨🙏🩵🕊️";
  showOverTheTopHoloSticker(t, options);
}

export function showOverTheTopHoloSticker(text: string, options: StickerOptions = {}) {
  const duration = options.duration ?? 5500;
  spawn(<OverTheTopHoloSticker text={text} centered />, duration); // Always centered
}

export default function OverTheTopHoloSticker({
  text,
  centered = true,
}: {
  text: string;
  centered?: boolean;
}) {
  const containerClass = "fx-fullscreen";
  return (
    <div className={containerClass} aria-live="polite" role="status">
      <div className="fx-card sticker">
        {/* PS2 scanlines overlay */}
        <div className="scanlines" aria-hidden />
        <svg width="720" height="240" viewBox="0 0 720 240" className="st-svg" aria-hidden>
          <defs>
            <linearGradient id="holo-rainbow" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#ff69b4" />
              <stop offset="20%" stopColor="#ffd700" />
              <stop offset="40%" stopColor="#00ff00" />
              <stop offset="60%" stopColor="#00bfff" />
              <stop offset="80%" stopColor="#9370db" />
              <stop offset="100%" stopColor="#ff4500" />
            </linearGradient>

            <linearGradient id="sheen-glossy" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="rgba(255,255,255,0)" />
              <stop offset="40%" stopColor="rgba(255,255,255,.98)" />
              <stop offset="100%" stopColor="rgba(255,255,255,0)" />
            </linearGradient>

            {/* dark center plate to guarantee contrast behind text */}
            <radialGradient id="text-guard" cx="50%" cy="50%" r="65%">
              <stop offset="0%" stopColor="rgba(2,12,28,.55)" />
              <stop offset="55%" stopColor="rgba(2,12,28,.45)" />
              <stop offset="80%" stopColor="rgba(2,12,28,.2)" />
              <stop offset="100%" stopColor="rgba(2,12,28,0)" />
            </radialGradient>

            <clipPath id="pill-large">
              <rect x="0" y="0" rx="62" ry="62" width="720" height="240" />
            </clipPath>

            <filter id="text-glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur in="SourceGraphic" stdDeviation="2.2" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>

            {/* subtle noise/grain for holo feel */}
            <filter id="grain" x="-20%" y="-20%" width="140%" height="140%">
              <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="1" stitchTiles="stitch" result="noise" />
              <feColorMatrix type="saturate" values="0" />
              <feBlend in="SourceGraphic" in2="noise" mode="overlay" />
            </filter>
          </defs>

          <g clipPath="url(#pill-large)">
            {/* holographic base */}
            <rect width="720" height="240" fill="url(#holo-rainbow)" opacity=".9" />
            {/* glossy sweep */}
            <rect width="220" height="240" fill="url(#sheen-glossy)" className="sheen" />
            {/* vista glass */}
            <rect width="720" height="240" fill="rgba(255,255,255,.14)" />
            {/* readable center plate */}
            <rect width="720" height="240" fill="url(#text-guard)" />
            {/* extra prism flares */}
            <g filter="url(#grain)" opacity=".25">
              <rect x="-60" y="-30" width="240" height="300" fill="url(#sheen-glossy)" transform="rotate(18)" />
              <rect x="540" y="-50" width="260" height="300" fill="url(#sheen-glossy)" transform="rotate(-14 670 100)" />
            </g>

            {/* the slogan (auto-fit via textLength + stroke for readability) */}
            <text
              className="slogan"
              x="50%"
              y="50%"
              dominantBaseline="middle"
              textAnchor="middle"
              filter="url(#text-glow)"
              stroke="rgba(0,15,30,.95)"
              strokeWidth="8"
              paintOrder="stroke fill"
              lengthAdjust="spacingAndGlyphs"
              textLength="640"
            >
              {text}
            </text>
          </g>

          {/* chrome border */}
          <rect
            width="720"
            height="240"
            rx="62"
            ry="62"
            fill="none"
            stroke="rgba(255,255,255,.98)"
            strokeWidth="6"
            className="border-glow"
          />
        </svg>

        {/* particles sit BELOW svg text now */}
        <div className="particle-layer" aria-hidden>
          {Array.from({ length: 240 }).map((_, i) => (
            <i
              key={`sp-${i}`}
              className="sparkle"
              style={
                {
                  "--i": i,
                  "--x": `${Math.random() * 120 - 60}vw`,
                  "--y": `${Math.random() * 120 - 60}vh`,
                } as React.CSSProperties
              }
            />
          ))}
          {Array.from({ length: 300 }).map((_, i) => (
            <i
              key={`bb-${i}`}
              className="bubble"
              style={
                {
                  "--i": i,
                  "--x": `${Math.random() * 100}vw`,
                  "--wobble": Math.random() * 26 - 13,
                } as React.CSSProperties
              }
            />
          ))}
          {Array.from({ length: 120 }).map((_, i) => (
            <i
              key={`st-${i}`}
              className="star"
              style={
                {
                  "--i": i,
                  "--x": `${Math.random() * 200 - 100}vw`,
                  "--y": `${Math.random() * 120 - 60}vh`,
                } as React.CSSProperties
              }
            />
          ))}
          {Array.from({ length: 180 }).map((_, i) => (
            <i
              key={`cf-${i}`}
              className="confetti"
              style={
                {
                  "--i": i,
                  "--x": `${Math.random() * 140 - 70}vw`,
                  "--y": `${Math.random() * 140 - 70}vh`,
                  "--color": `hsl(${Math.random() * 360}, 100%, 50%)`,
                } as React.CSSProperties
              }
            />
          ))}
          {Array.from({ length: 140 }).map((_, i) => (
            <i
              key={`ht-${i}`}
              className="heart"
              style={
                {
                  "--i": i,
                  "--x": `${Math.random() * 160 - 80}vw`,
                  "--y": `${Math.random() * 120 - 60}vh`,
                  "--color": `hsl(${Math.random() * 360}, 100%, 55%)`,
                } as React.CSSProperties
              }
            />
          ))}
          {Array.from({ length: 90 }).map((_, i) => (
            <span
              key={`ss-${i}`}
              className="shooting-star"
              style={
                {
                  "--i": i,
                  "--start-x": `${Math.random() * 100}vw`,
                  "--end-x": `${Math.random() * 100 - 200}vw`,
                  "--y": `${Math.random() * 100}vh`,
                } as React.CSSProperties
              }
            >
              🌟
            </span>
          ))}
          {Array.from({ length: 70 }).map((_, i) => (
            <span
              key={`em1-${i}`}
              className="blessing-emoji"
              style={
                {
                  "--i": i,
                  "--x": `${Math.random() * 120 - 60}vw`,
                  "--y": `${Math.random() * 120 - 60}vh`,
                } as React.CSSProperties
              }
            >
              🙏
            </span>
          ))}
          {Array.from({ length: 70 }).map((_, i) => (
            <span
              key={`em2-${i}`}
              className="blessing-emoji"
              style={
                {
                  "--i": i,
                  "--x": `${Math.random() * 120 - 60}vw`,
                  "--y": `${Math.random() * 120 - 60}vh`,
                } as React.CSSProperties
              }
            >
              🕊️
            </span>
          ))}
        </div>
      </div>

      <style jsx>{`
        .fx-fullscreen {
          position: fixed;
          inset: 0;
          z-index: 1000;
          display: grid;
          place-items: center;
          pointer-events: none;
          overflow: hidden;
          background: radial-gradient(circle, rgba(0,191,255,0.18), transparent 70%);
        }
        .fx-card { pointer-events: auto; position: relative; transform: scale(1.35); }
        .scanlines {
          position: absolute; inset: 0; z-index: 4; pointer-events: none; mix-blend-mode: soft-light; opacity: .45;
          background: repeating-linear-gradient(
            to bottom,
            rgba(255,255,255,.09) 0px,
            rgba(255,255,255,.09) 1px,
            rgba(0,0,0,0) 2px,
            rgba(0,0,0,0) 4px
          );
          animation: scan-fade 6s ease-in-out infinite;
        }
        .sticker { transform-origin: center; animation: extreme-peel 1.4s steps(12) both, wild-settle 1.2s 1.4s steps(10) both; filter: drop-shadow(0 45px 120px rgba(0,0,0,.65)); }
        .st-svg { display: block; position: relative; z-index: 3; mix-blend-mode: screen; backdrop-filter: blur(18px) saturate(180%); image-rendering: pixelated; }
        .sheen { transform: translateX(-250px) rotate(12deg); opacity: .95; animation: chaotic-sweep 3.5s .35s steps(15) both; }
        .slogan {
          font-family: "Trebuchet MS","Comic Sans MS", system-ui, -apple-system, Segoe UI, Tahoma, sans-serif;
          font-weight: 900; letter-spacing: .02em;
          font-size: clamp(36px, 8.5vw, 110px);
          fill: url(#holo-rainbow);
          text-shadow: 0 0 12px rgba(255,255,255,.95), 0 0 28px rgba(0,255,255,.85), 0 0 42px rgba(255,215,0,.75);
        }
        .border-glow { animation: extreme-pulse 2.6s steps(10) infinite; }
        .particle-layer { position: absolute; inset: -5% -10%; pointer-events: none; z-index: 1; } /* BELOW svg text */

        .sparkle { position: absolute; top: 50%; left: 50%; width: 12px; height: 12px; background: white; border-radius: 50%; box-shadow: 0 0 25px rgba(255,255,200,.95); animation: chaos-sparkle 4.6s steps(12) calc(var(--i) * 18ms) forwards; }
        .bubble { position: absolute; bottom: -110vh; left: var(--x); width: 15px; height: 15px; background: rgba(0,191,255,.7); border-radius: 50%; animation: underwater-bubble 6s linear calc(var(--i) * 18ms) forwards; }
        .star { position: absolute; top: 50%; left: 50%; width: 18px; height: 18px; clip-path: polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%); background: #ffd700; animation: explode-star 5.2s steps(14) calc(var(--i) * 24ms) infinite; }
        .confetti { position: absolute; top: 50%; left: 50%; width: 10px; height: 10px; background: var(--color); transform: rotate(45deg); animation: confetti-fall 5s steps(12) calc(var(--i) * 22ms) forwards; }
        .heart { position: absolute; top: 50%; left: 50%; width: 16px; height: 16px; background: var(--color); clip-path: path('M8 1.314C12.438-3.248 23.534 4.735 8 15-7.534 4.736 3.562-3.248 8 1.314z'); animation: heart-float 5s steps(12) calc(var(--i) * 28ms) forwards; }
        .shooting-star { position: absolute; top: var(--y); left: var(--start-x); font-size: 24px; animation: shooting-star 4.2s linear calc(var(--i) * 36ms) forwards; text-shadow: 0 0 10px yellow; }
        .shooting-star::after { content: ''; position: absolute; left: 0; top: 50%; width: 62px; height: 2px; background: linear-gradient(to left, yellow, transparent); transform: translateY(-50%); animation: trail-fade 4.2s linear forwards; }
        .blessing-emoji { position: absolute; top: 50%; left: 50%; font-size: 28px; animation: blessing-rise 6s ease-out calc(var(--i) * 28ms) forwards; text-shadow: 0 0 10px rgba(0,191,255,.8); }

        @keyframes extreme-peel { 0% { transform: perspective(1200px) rotateX(60deg) rotateY(30deg) translateY(-50px) scale(0.7); opacity: 0; } 45% { transform: perspective(1200px) rotateX(-12deg) rotateY(-8deg) translateY(14px) scale(1.32); opacity: 1; } 100% { transform: perspective(1200px) rotateX(0) rotateY(0) translateY(0) scale(1.2); } }
        @keyframes wild-settle { 0% { transform: translateY(-6px) rotate(3deg) scale(1.2); } 100% { transform: translateY(0) rotate(0) scale(1); } }
        @keyframes chaotic-sweep { 0% { transform: translateX(-200px) rotate(12deg); } 40% { transform: translateX(260px) rotate(-12deg); opacity: 1; } 100% { transform: translateX(520px) rotate(12deg); opacity: 0; } }
        @keyframes extreme-pulse { 0%, 100% { stroke-width: 5; } 50% { stroke-width: 9; filter: brightness(1.5); } }
        @keyframes chaos-sparkle { 0% { opacity: 0; transform: translate(0,0) scale(0.4); } 15% { opacity: 1; } 100% { opacity: 0; transform: translate(var(--x), var(--y)) scale(2) rotate(720deg); } }
        @keyframes underwater-bubble { 0% { opacity: 0; transform: translateY(0) translateX(0) scale(0.6) rotate(0); } 20% { opacity: 1; } 100% { opacity: 0; transform: translateY(-210vh) translateX(var(--wobble)px) scale(3) rotate(1440deg); } }
        @keyframes explode-star { 0%, 100% { opacity: .45; transform: scale(1) rotate(0); } 50% { opacity: 1; transform: scale(1.8) rotate(360deg); } }
        @keyframes confetti-fall { 0% { opacity: 0; transform: translate(0,0) rotate(0) scale(0.5); } 20% { opacity: 1; } 100% { opacity: 0; transform: translate(var(--x), var(--y)) rotate(1440deg) scale(1.8); } }
        @keyframes heart-float { 0% { opacity: 0; transform: translate(0,0) scale(0.5); } 25% { opacity: 1; } 100% { opacity: 0; transform: translate(var(--x), var(--y)) scale(2.2) rotate(900deg); } }
        @keyframes shooting-star { 0% { transform: translateX(0); opacity: 0; } 20% { opacity: 1; } 100% { transform: translateX(var(--end-x)); opacity: 0; } }
        @keyframes trail-fade { 0% { opacity: 1; width: 62px; } 100% { opacity: 0; width: 0; } }
        @keyframes blessing-rise { 0% { opacity: 0; transform: translate(0,0) scale(0.5); } 30% { opacity: 1; } 100% { opacity: 0; transform: translate(var(--x), var(--y)) scale(2.5) rotate(1080deg); } }
        @keyframes scan-fade { 0%,100% { opacity: .45; } 50% { opacity: .25; } }

        @media (prefers-reduced-motion: reduce) {
          .particle-layer, .scanlines { display: none; }
          .fx-card { transform: scale(1); }
        }
      `}</style>
    </div>
  );
}
