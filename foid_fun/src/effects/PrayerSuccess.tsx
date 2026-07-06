// src/effects/PrayerSuccess.tsx
// Ritual-complete prayer success — feels like the end of a ceremony
"use client";
import React, { useEffect, useState } from "react";
import { spawn } from "@/lib/spawn";
import { BLOCK_EXPLORER_URL } from "@/lib/contracts";

type SuccessOptions = {
  position?: "corner" | "center";
  duration?: number;
  nextAllowedAt?: number; // Unix timestamp (seconds) for next prayer
};

const CONGRATS_MESSAGES = [
  "prayer anchored",
  "blessed and sealed",
  "foid mommy heard you",
  "your words are safe",
  "ritual complete",
];

export function showPrayerSuccess(hash?: string, options: SuccessOptions = {}) {
  const message = CONGRATS_MESSAGES[Math.floor(Math.random() * CONGRATS_MESSAGES.length)];
  const duration = options.duration ?? 6500;
  spawn(
    <PrayerSuccessToast
      message={message}
      hash={hash}
      nextAllowedAt={options.nextAllowedAt}
    />,
    duration,
  );
}

function formatCountdown(seconds: number): string {
  if (seconds <= 0) return "ready now";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

export default function PrayerSuccessToast({
  message,
  hash,
  nextAllowedAt,
}: {
  message: string;
  hash?: string;
  nextAllowedAt?: number;
}) {
  const [mounted, setMounted] = useState(false);
  const [exiting, setExiting] = useState(false);
  const [countdown, setCountdown] = useState("");

  useEffect(() => {
    const mountTimer = setTimeout(() => setMounted(true), 50);
    const exitTimer = setTimeout(() => setExiting(true), 5800);
    try { navigator.vibrate?.([10, 50, 10]); } catch { /* not supported */ }
    return () => {
      clearTimeout(mountTimer);
      clearTimeout(exitTimer);
    };
  }, []);

  // Live countdown to next prayer
  useEffect(() => {
    if (!nextAllowedAt) return;
    const tick = () => {
      const remaining = nextAllowedAt - Math.floor(Date.now() / 1000);
      setCountdown(formatCountdown(Math.max(0, remaining)));
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [nextAllowedAt]);

  const shortHash = hash ? `${hash.slice(0, 6)}...${hash.slice(-4)}` : null;

  return (
    <div
      className={`prayer-success-container ${mounted ? "prayer-success--mounted" : ""} ${exiting ? "prayer-success--exiting" : ""}`}
      role="status"
      aria-live="polite"
    >
      {/* Ambient glow behind the card */}
      <div className="prayer-success-glow" aria-hidden />

      {/* Main glass card */}
      <div className="prayer-success-card">
        {/* Top highlight reflection */}
        <div className="prayer-success-highlight" aria-hidden />

        {/* Animated ring icon */}
        <div className="prayer-success-icon">
          <svg viewBox="0 0 48 48" fill="none" className="prayer-success-ring-svg">
            <circle cx="24" cy="24" r="20" className="ring-track" />
            <circle cx="24" cy="24" r="20" className="ring-fill" />
            <path d="M16 24.5L22 30.5L32 18.5" className="checkmark-path" />
          </svg>
        </div>

        {/* Content */}
        <div className="prayer-success-content">
          <h3 className="prayer-success-title">{message}</h3>
          <p className="prayer-success-subtitle">your prayer is woven into the chain</p>

          {/* Live countdown to next prayer */}
          {countdown && (
            <div className="prayer-success-countdown">
              <span className="prayer-success-countdown__label">next prayer in</span>
              <span className="prayer-success-countdown__time">{countdown}</span>
            </div>
          )}

          {shortHash && (
            <a
              href={`${BLOCK_EXPLORER_URL}/tx/${hash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="prayer-success-link"
            >
              tx: {shortHash}
            </a>
          )}
        </div>

        {/* Subtle shimmer effect */}
        <div className="prayer-success-shimmer" aria-hidden />
      </div>

      <style jsx>{`
        .prayer-success-container {
          position: fixed;
          inset: 0;
          z-index: 1000;
          display: flex;
          align-items: center;
          justify-content: center;
          pointer-events: none;
          opacity: 0;
          transform: scale(0.94) translateY(12px);
          transition: opacity 0.5s cubic-bezier(0.16, 1, 0.3, 1),
                      transform 0.6s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .prayer-success--mounted {
          opacity: 1;
          transform: scale(1) translateY(0);
        }

        .prayer-success--exiting {
          opacity: 0;
          transform: scale(0.98) translateY(-8px);
          transition: opacity 0.4s ease-out, transform 0.5s ease-out;
        }

        .prayer-success-glow {
          position: absolute;
          width: 420px;
          height: 240px;
          background: radial-gradient(
            ellipse at center,
            rgba(0, 255, 213, 0.2) 0%,
            rgba(0, 255, 213, 0.08) 40%,
            transparent 70%
          );
          filter: blur(50px);
          pointer-events: none;
          animation: glow-pulse 3s ease-in-out infinite;
        }

        .prayer-success-card {
          position: relative;
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          gap: 16px;
          padding: 32px 36px 28px;
          min-width: 300px;
          max-width: min(420px, 90vw);
          background: linear-gradient(
            135deg,
            rgba(12, 20, 32, 0.94) 0%,
            rgba(8, 14, 24, 0.96) 100%
          );
          border: 1px solid rgba(0, 255, 213, 0.2);
          border-radius: 20px;
          backdrop-filter: blur(24px) saturate(150%);
          box-shadow:
            0 0 0 1px rgba(255, 255, 255, 0.05) inset,
            0 1px 0 rgba(255, 255, 255, 0.06) inset,
            0 24px 60px rgba(0, 0, 0, 0.5),
            0 0 60px rgba(0, 255, 213, 0.1);
          pointer-events: auto;
          overflow: hidden;
        }

        .prayer-success-highlight {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 50%;
          background: linear-gradient(
            180deg,
            rgba(255, 255, 255, 0.06) 0%,
            rgba(255, 255, 255, 0.01) 50%,
            transparent 100%
          );
          border-radius: 20px 20px 0 0;
          pointer-events: none;
        }

        .prayer-success-icon {
          width: 64px;
          height: 64px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .prayer-success-ring-svg {
          width: 64px;
          height: 64px;
        }

        .ring-track {
          stroke: rgba(0, 255, 213, 0.15);
          stroke-width: 2;
          fill: none;
        }

        .ring-fill {
          stroke: var(--foid-cyan-electric);
          stroke-width: 2.5;
          fill: none;
          stroke-dasharray: 126;
          stroke-dashoffset: 126;
          stroke-linecap: round;
          transform-origin: center;
          transform: rotate(-90deg);
          animation: ring-draw 1s 0.15s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }

        .checkmark-path {
          stroke: var(--foid-cyan-electric);
          stroke-width: 2.5;
          stroke-linecap: round;
          stroke-linejoin: round;
          fill: none;
          stroke-dasharray: 30;
          stroke-dashoffset: 30;
          animation: checkmark-draw 0.5s 0.8s ease-out forwards;
        }

        .prayer-success-content {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
        }

        .prayer-success-title {
          margin: 0;
          font-size: 20px;
          font-weight: 600;
          color: var(--foid-cyan-electric);
          letter-spacing: 0.03em;
          text-shadow: 0 0 24px rgba(0, 255, 213, 0.4);
        }

        .prayer-success-subtitle {
          margin: 0;
          font-size: 13px;
          color: rgba(255, 255, 255, 0.5);
          line-height: 1.4;
        }

        .prayer-success-countdown {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-top: 12px;
          padding: 8px 16px;
          background: rgba(0, 255, 213, 0.06);
          border: 1px solid rgba(0, 255, 213, 0.15);
          border-radius: 10px;
        }

        .prayer-success-countdown__label {
          font-size: 11px;
          color: rgba(255, 255, 255, 0.4);
          text-transform: uppercase;
          letter-spacing: 0.08em;
          font-family: var(--font-terminal, monospace);
        }

        .prayer-success-countdown__time {
          font-size: 14px;
          font-weight: 600;
          color: rgba(0, 255, 213, 0.9);
          font-family: var(--font-terminal, monospace);
          font-variant-numeric: tabular-nums;
        }

        .prayer-success-link {
          display: inline-block;
          margin-top: 8px;
          padding: 4px 10px;
          font-size: 11px;
          font-family: var(--font-terminal, monospace);
          color: rgba(0, 255, 213, 0.6);
          background: rgba(0, 255, 213, 0.06);
          border: 1px solid rgba(0, 255, 213, 0.15);
          border-radius: 6px;
          text-decoration: none;
          transition: all 0.2s ease;
          pointer-events: auto;
        }

        .prayer-success-link:hover {
          background: rgba(0, 255, 213, 0.12);
          border-color: rgba(0, 255, 213, 0.3);
          color: var(--foid-cyan-electric);
        }

        .prayer-success-shimmer {
          position: absolute;
          top: 0;
          left: -100%;
          width: 60%;
          height: 100%;
          background: linear-gradient(
            90deg,
            transparent 0%,
            rgba(255, 255, 255, 0.04) 50%,
            transparent 100%
          );
          animation: shimmer-sweep 3s 0.5s ease-in-out;
          pointer-events: none;
        }

        @keyframes ring-draw {
          to {
            stroke-dashoffset: 0;
          }
        }

        @keyframes checkmark-draw {
          to {
            stroke-dashoffset: 0;
          }
        }

        @keyframes glow-pulse {
          0%, 100% {
            opacity: 0.7;
            transform: scale(1);
          }
          50% {
            opacity: 1;
            transform: scale(1.04);
          }
        }

        @keyframes shimmer-sweep {
          0% { left: -100%; }
          100% { left: 200%; }
        }

        @media (prefers-reduced-motion: reduce) {
          .prayer-success-container {
            transition: opacity 0.2s ease;
            transform: none !important;
          }
          .prayer-success-shimmer,
          .ring-fill,
          .checkmark-path {
            animation: none;
          }
          .ring-fill { stroke-dashoffset: 0; }
          .checkmark-path { stroke-dashoffset: 0; }
        }
      `}</style>
    </div>
  );
}
