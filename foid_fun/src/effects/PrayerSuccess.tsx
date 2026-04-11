// src/effects/PrayerSuccess.tsx
// Frutiger Aero polished prayer success animation
"use client";
import React, { useEffect, useState } from "react";
import { spawn } from "@/lib/spawn";
import { BLOCK_EXPLORER_URL } from "@/lib/contracts";

type SuccessOptions = {
  position?: "corner" | "center";
  duration?: number;
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
  const duration = options.duration ?? 5500;
  spawn(<PrayerSuccessToast message={message} hash={hash} />, duration);
}

export default function PrayerSuccessToast({
  message,
  hash,
}: {
  message: string;
  hash?: string;
}) {
  const [mounted, setMounted] = useState(false);
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    const mountTimer = setTimeout(() => setMounted(true), 50);
    const exitTimer = setTimeout(() => setExiting(true), 4800);
    // Haptic feedback on mount
    try { navigator.vibrate?.([10, 50, 10]); } catch { /* not supported */ }
    return () => {
      clearTimeout(mountTimer);
      clearTimeout(exitTimer);
    };
  }, []);

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

        {/* Success icon */}
        <div className="prayer-success-icon">
          <svg viewBox="0 0 24 24" fill="none" className="prayer-success-checkmark">
            <circle cx="12" cy="12" r="10" className="checkmark-circle" />
            <path d="M8 12.5L11 15.5L16 9.5" className="checkmark-path" />
          </svg>
        </div>

        {/* Content */}
        <div className="prayer-success-content">
          <h3 className="prayer-success-title">{message}</h3>
          <p className="prayer-success-subtitle">foid mommy thanks you for praying today</p>
          {shortHash && (
            <a
              href={`${BLOCK_EXPLORER_URL}/tx/${hash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="prayer-success-link"
            >
              {shortHash}
            </a>
          )}
        </div>

        {/* Subtle shimmer effect */}
        <div className="prayer-success-shimmer" aria-hidden />
      </div>

      {/* Floating particles (minimal, elegant) */}
      <div className="prayer-success-particles" aria-hidden>
        {Array.from({ length: 8 }).map((_, i) => (
          <span
            key={i}
            className="prayer-particle"
            style={{
              "--delay": `${i * 0.15}s`,
              "--x": `${(i % 4) * 25 - 37.5}%`,
              "--y": `${Math.floor(i / 4) * 40 - 20}%`,
            } as React.CSSProperties}
          />
        ))}
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
          transform: scale(0.96) translateY(8px);
          transition: opacity 0.4s cubic-bezier(0.16, 1, 0.3, 1),
                      transform 0.5s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .prayer-success--mounted {
          opacity: 1;
          transform: scale(1) translateY(0);
        }

        .prayer-success--exiting {
          opacity: 0;
          transform: scale(0.98) translateY(-6px);
          transition: opacity 0.35s ease-out, transform 0.4s ease-out;
        }

        .prayer-success-glow {
          position: absolute;
          width: 380px;
          height: 200px;
          background: radial-gradient(
            ellipse at center,
            rgba(0, 255, 213, 0.18) 0%,
            rgba(0, 255, 213, 0.08) 40%,
            transparent 70%
          );
          filter: blur(40px);
          pointer-events: none;
          animation: glow-pulse 2.5s ease-in-out infinite;
        }

        .prayer-success-card {
          position: relative;
          display: flex;
          align-items: center;
          gap: 18px;
          padding: 20px 28px;
          min-width: 320px;
          max-width: min(480px, 92vw);
          background: linear-gradient(
            135deg,
            rgba(12, 20, 32, 0.92) 0%,
            rgba(8, 14, 24, 0.95) 100%
          );
          border: 1px solid rgba(0, 255, 213, 0.25);
          border-radius: 16px;
          backdrop-filter: blur(20px) saturate(150%);
          box-shadow:
            0 0 0 1px rgba(255, 255, 255, 0.06) inset,
            0 1px 0 rgba(255, 255, 255, 0.08) inset,
            0 20px 50px rgba(0, 0, 0, 0.4),
            0 0 40px rgba(0, 255, 213, 0.12);
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
            rgba(255, 255, 255, 0.08) 0%,
            rgba(255, 255, 255, 0.02) 50%,
            transparent 100%
          );
          border-radius: 16px 16px 0 0;
          pointer-events: none;
        }

        .prayer-success-icon {
          flex-shrink: 0;
          width: 52px;
          height: 52px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(
            135deg,
            rgba(0, 255, 213, 0.2) 0%,
            rgba(0, 200, 170, 0.15) 100%
          );
          border-radius: 14px;
          border: 1px solid rgba(0, 255, 213, 0.3);
        }

        .prayer-success-checkmark {
          width: 28px;
          height: 28px;
        }

        .checkmark-circle {
          stroke: rgba(0, 255, 213, 0.4);
          stroke-width: 1.5;
          fill: none;
        }

        .checkmark-path {
          stroke: #00ffd5;
          stroke-width: 2;
          stroke-linecap: round;
          stroke-linejoin: round;
          stroke-dasharray: 24;
          stroke-dashoffset: 24;
          animation: checkmark-draw 0.6s 0.2s ease-out forwards;
        }

        .prayer-success-content {
          flex: 1;
          min-width: 0;
        }

        .prayer-success-title {
          margin: 0 0 4px;
          font-size: 17px;
          font-weight: 600;
          color: #00ffd5;
          letter-spacing: 0.02em;
          text-shadow: 0 0 20px rgba(0, 255, 213, 0.4);
        }

        .prayer-success-subtitle {
          margin: 0;
          font-size: 13px;
          color: rgba(255, 255, 255, 0.6);
          line-height: 1.4;
        }

        .prayer-success-link {
          display: inline-block;
          margin-top: 8px;
          padding: 4px 10px;
          font-size: 11px;
          font-family: var(--font-mono, monospace);
          color: rgba(0, 255, 213, 0.8);
          background: rgba(0, 255, 213, 0.08);
          border: 1px solid rgba(0, 255, 213, 0.2);
          border-radius: 6px;
          text-decoration: none;
          transition: all 0.2s ease;
          pointer-events: auto;
        }

        .prayer-success-link:hover {
          background: rgba(0, 255, 213, 0.15);
          border-color: rgba(0, 255, 213, 0.35);
          color: #00ffd5;
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
            rgba(255, 255, 255, 0.06) 50%,
            transparent 100%
          );
          animation: shimmer-sweep 2.5s 0.5s ease-in-out;
          pointer-events: none;
        }

        .prayer-success-particles {
          position: absolute;
          inset: 0;
          pointer-events: none;
        }

        .prayer-particle {
          position: absolute;
          top: 50%;
          left: 50%;
          width: 4px;
          height: 4px;
          background: rgba(0, 255, 213, 0.6);
          border-radius: 50%;
          opacity: 0;
          animation: particle-float 2s var(--delay, 0s) ease-out forwards;
          transform: translate(var(--x, 0), var(--y, 0));
        }

        @keyframes checkmark-draw {
          to {
            stroke-dashoffset: 0;
          }
        }

        @keyframes glow-pulse {
          0%, 100% {
            opacity: 0.8;
            transform: scale(1);
          }
          50% {
            opacity: 1;
            transform: scale(1.05);
          }
        }

        @keyframes shimmer-sweep {
          0% {
            left: -100%;
          }
          100% {
            left: 200%;
          }
        }

        @keyframes particle-float {
          0% {
            opacity: 0;
            transform: translate(-50%, -50%) scale(0.5);
          }
          20% {
            opacity: 0.8;
          }
          100% {
            opacity: 0;
            transform: translate(
              calc(var(--x, 0) + -50%),
              calc(var(--y, 0) + -50% - 40px)
            ) scale(1);
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .prayer-success-container {
            transition: opacity 0.2s ease;
            transform: none !important;
          }
          .prayer-success-shimmer,
          .prayer-success-particles,
          .checkmark-path {
            animation: none;
          }
          .checkmark-path {
            stroke-dashoffset: 0;
          }
        }
      `}</style>
    </div>
  );
}
