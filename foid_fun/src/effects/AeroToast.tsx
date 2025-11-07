// src/effects/AeroToast.tsx
"use client";
import React from "react";
import { spawn } from "@/lib/spawn";

type ToastOptions = {
  position?: "corner" | "center";
  duration?: number;
};

type ShowAeroToastOptions = ToastOptions & {
  message?: string;
};

export function showAeroToast(hash?: string, options: ShowAeroToastOptions = {}) {
  const { message, ...rest } = options;
  const fallback =
    message ??
    (hash ? `prayer minted ✧ ${hash.slice(0, 6)}…${hash.slice(-4)}` : "prayer ascended ✧");
  showOverTheTopAeroToast(fallback, hash, rest);
}

export function showOverTheTopAeroToast(text: string, hash?: string, options: ToastOptions = {}) {
  const centered = options.position !== "corner";
  const duration = options.duration ?? 4200;
  spawn(<OverTheTopAeroToast text={text} hash={hash} centered={centered} />, duration);
}

export default function OverTheTopAeroToast({
  text,
  hash,
  centered = true,
}: {
  text: string;
  hash?: string;
  centered?: boolean;
}) {
  const containerClass = centered ? "fx-center animate-[toast-enter_.5s_ease]" : "fx-corner animate-[toast-enter_.5s_ease]";

  return (
    <div role="status" aria-live="polite" className={containerClass}>
      <div className="fx-halo" />
      <div className="fx-card aero-outer">
        <div className="aero-card">
          <div className="aero-row">
            <span className="aero-check">✓</span>
            <div>
              <p className="aero-title clip-text">{text}</p>
              {hash && (
                <a
                  className="aero-link"
                  href={`https://explorer.fluent.xyz/tx/${hash}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  view on chain →
                </a>
              )}
            </div>
          </div>

          {Array.from({ length: 18 }).map((_, i) => (
            <i
              key={`bubble-${i}`}
              className="bubble"
              style={{ left: `${12 + i * 4}%`, animationDelay: `${i * 0.07}s` } as React.CSSProperties}
            />
          ))}
          {Array.from({ length: 14 }).map((_, i) => (
            <i key={`sparkle-${i}`} className="sparkle" style={{ "--i": i } as React.CSSProperties} />
          ))}
          {Array.from({ length: 10 }).map((_, i) => (
            <i key={`star-${i}`} className="star" style={{ "--i": i } as React.CSSProperties} />
          ))}
          <div className="caustic" />
          <div className="caustic extra-caustic" style={{ animationDelay: "0.28s" } as React.CSSProperties} />
        </div>
      </div>

      <style jsx>{`
        .fx-center,
        .fx-corner {
          position: fixed;
          z-index: 1000;
        }
        .fx-center {
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          pointer-events: none;
        }
        .fx-center .fx-card {
          pointer-events: auto;
        }
        .fx-corner {
          bottom: 24px;
          right: 24px;
          pointer-events: none;
          display: flex;
          justify-content: flex-end;
        }
        .fx-corner .fx-card {
          pointer-events: auto;
        }
        .fx-halo {
          position: absolute;
          width: 320px;
          height: 320px;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(255, 182, 193, 0.28), rgba(0, 191, 255, 0.22), transparent 70%);
          filter: blur(28px);
          opacity: 0.85;
          transform: translateZ(0);
          pointer-events: none;
          animation: halo-pulse 3s ease-in-out infinite;
        }
        .aero-outer {
          padding: 3px;
          border-radius: 26px;
          background: linear-gradient(135deg, rgba(255, 255, 255, 0.6), rgba(255, 105, 180, 0.45), rgba(0, 191, 255, 0.45));
          box-shadow:
            0 28px 90px rgba(2, 10, 30, 0.55),
            inset 0 0 2px rgba(255, 255, 255, 0.6);
          max-width: min(92vw, 460px);
        }
        .aero-card {
          position: relative;
          overflow: hidden;
          border-radius: 24px;
          background: rgba(12, 24, 48, 0.45);
          backdrop-filter: blur(18px) saturate(150%);
          padding: 18px 22px;
        }
        .aero-row {
          display: flex;
          align-items: center;
          gap: 16px;
        }
        .aero-check {
          width: 46px;
          height: 46px;
          border-radius: 9999px;
          display: grid;
          place-items: center;
          background: radial-gradient(circle at 30% 30%, #ff69b4, #00bfff 55%, #ffd700 100%);
          color: white;
          font-weight: 900;
          text-shadow: 0 3px 10px rgba(0, 0, 0, 0.4);
          transform: translateZ(0);
          animation: check-bounce 1.5s ease-in-out infinite;
        }
        .clip-text {
          margin: 0;
          font-family: "Comic Sans MS", cursive;
          font-weight: 900;
          letter-spacing: 0.02em;
          font-size: 24px;
          animation: dance-sparkle 3s ease-in-out infinite, color-shift 1.2s linear infinite;
          text-shadow:
            0 0 12px rgba(255, 255, 255, 0.9),
            0 0 24px rgba(0, 255, 255, 0.7);
        }
        .aero-link {
          color: #ffd700;
          text-decoration: underline wavy;
          font-size: 14px;
        }
        .bubble {
          position: absolute;
          bottom: -10px;
          width: 8px;
          height: 8px;
          border-radius: 9999px;
          background: rgba(255, 255, 255, 0.95);
          animation: spiral-rise 2.4s ease-out forwards;
        }
        .sparkle {
          position: absolute;
          top: 50%;
          left: 50%;
          width: 6px;
          height: 6px;
          background: white;
          border-radius: 50%;
          box-shadow: 0 0 18px rgba(255, 215, 0, 0.95);
          animation: explode-sparkle 2.6s ease-out calc(var(--i) * 0.1s) forwards;
        }
        .star {
          position: absolute;
          top: 50%;
          left: 50%;
          width: 9px;
          height: 9px;
          clip-path: polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%);
          background: #ffd700;
          animation: spin-star 2.8s ease-in-out calc(var(--i) * 0.15s) forwards;
        }
        .caustic,
        .extra-caustic {
          position: absolute;
          inset: -35%;
          background:
            radial-gradient(70% 90% at 15% 5%, rgba(255, 255, 255, 0.26), transparent 55%),
            radial-gradient(50% 70% at 85% 95%, rgba(255, 105, 180, 0.2), transparent 65%);
          mix-blend-mode: screen;
          filter: blur(26px);
          opacity: 0.7;
          animation: caustic-swirl 2.2s ease-out forwards;
        }
        .extra-caustic {
          background:
            radial-gradient(60% 80% at 30% 20%, rgba(0, 191, 255, 0.25), transparent 60%),
            radial-gradient(45% 65% at 70% 80%, rgba(255, 215, 0, 0.19), transparent 70%);
          animation-direction: reverse;
        }
        @keyframes toast-enter {
          0% {
            transform: scale(0.75) rotate(6deg);
            opacity: 0;
          }
          60% {
            transform: scale(1.06) rotate(-2deg);
            opacity: 1;
          }
          100% {
            transform: scale(1) rotate(0);
          }
        }
        @keyframes halo-pulse {
          0%,
          100% {
            transform: scale(1);
            opacity: 0.85;
          }
          50% {
            transform: scale(1.08);
            opacity: 1;
          }
        }
        @keyframes check-bounce {
          0%,
          100% {
            transform: scale(1);
          }
          50% {
            transform: scale(1.12);
          }
        }
        @keyframes dance-sparkle {
          0%,
          100% {
            transform: translateY(0) rotate(0);
          }
          25% {
            transform: translateY(-4px) rotate(3deg);
          }
          50% {
            transform: translateY(3px) rotate(-3deg);
          }
          75% {
            transform: translateY(-3px) rotate(2deg);
          }
        }
        @keyframes color-shift {
          0% {
            color: #ff69b4;
          }
          33% {
            color: #ffd700;
          }
          66% {
            color: #00bfff;
          }
          100% {
            color: #ff69b4;
          }
        }
        @keyframes spiral-rise {
          0% {
            transform: translateY(0) rotate(0) scale(0.8);
            opacity: 0;
          }
          20% {
            opacity: 0.9;
          }
          100% {
            transform: translateY(-48px) rotate(640deg) scale(1.25);
            opacity: 0;
          }
        }
        @keyframes explode-sparkle {
          0% {
            opacity: 0;
            transform: translate(0, 0) scale(0.5);
          }
          30% {
            opacity: 1;
          }
          100% {
            opacity: 0;
            transform: translate(calc((var(--i) % 5 - 2.5) * 60px), calc((var(--i) % 5 - 2.5) * -60px)) scale(1.4);
          }
        }
        @keyframes spin-star {
          0% {
            opacity: 0;
            transform: translate(0, 0) scale(0.6) rotate(0);
          }
          40% {
            opacity: 1;
          }
          100% {
            opacity: 0;
            transform: translate(calc((var(--i) % 4 - 2) * 50px), calc((var(--i) % 4 - 2) * 50px)) scale(1.3) rotate(960deg);
          }
        }
        @keyframes caustic-swirl {
          0% {
            transform: translate(-8%, 10%) rotate(0);
          }
          50% {
            transform: translate(10%, -8%) rotate(180deg);
          }
          100% {
            transform: translate(-4%, 4%) rotate(360deg);
          }
        }
      `}</style>
    </div>
  );
}
