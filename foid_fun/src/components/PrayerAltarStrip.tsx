"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import type { TierProgress } from "@/hooks/usePrayerTiers";

type Props = {
  streak: number;
  tier: TierProgress;
  nowSeconds: number | null;
  nextAllowedAt: bigint | undefined;
  loading: boolean;
  connected: boolean;
  afterglow: boolean;
  /** True if the user has anchored at least one prayer onchain ever. */
  hasEverPrayed: boolean;
  /** Seconds remaining before the streak resets (lastCheckIn + 48h).
      Null until the user has prayed at least once. */
  streakSecondsLeft?: number | null;
  /** Whether the streak countdown is in its "pray today or lose it" phase
      (cooldown elapsed, < 24h remaining). */
  streakUrgent?: boolean;
};

function formatCountdown(seconds: number): string {
  if (seconds <= 0) return "ready";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m.toString().padStart(2, "0")}m`;
  if (m > 0) return `${m}m ${s.toString().padStart(2, "0")}s`;
  return `${s}s`;
}

// CountUp hook — animates 0 → target the FIRST time target becomes non-zero,
// then snaps to subsequent updates (e.g. optimistic +1 after submit).
function useCountUp(target: number, durationMs = 500): number {
  const [value, setValue] = useState(0);
  const hasAnimated = useRef(false);

  useEffect(() => {
    if (hasAnimated.current) {
      setValue(target);
      return;
    }
    if (target <= 0) {
      setValue(0);
      return;
    }
    // First real value lands → animate from 0 up to it
    hasAnimated.current = true;
    let raf = 0;
    const start = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / durationMs);
      // ease-out-expo
      const eased = p === 1 ? 1 : 1 - Math.pow(2, -10 * p);
      setValue(Math.round(target * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, durationMs]);

  return value;
}

function formatStreakDeadlineShort(seconds: number): string {
  if (seconds <= 0) return "lost";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h >= 1) return `${h}h ${m.toString().padStart(2, "0")}m`;
  const s = seconds % 60;
  return `${m}m ${s.toString().padStart(2, "0")}s`;
}

export default function PrayerAltarStrip({
  streak,
  tier,
  nowSeconds,
  nextAllowedAt,
  loading,
  connected,
  afterglow,
  hasEverPrayed,
  streakSecondsLeft = null,
  streakUrgent = false,
}: Props) {
  const displayStreak = useCountUp(streak);

  // Completion sweep — fires once when hasEverPrayed transitions false → true.
  // Drives the dashed-to-solid stroke-dashoffset sweep + a short teal bloom.
  // Skipped under prefers-reduced-motion so the ring just snaps to solid.
  // Two-phase: "snap" holds the ring at full offset for one frame, then
  // "draw" transitions down to the real offset over 600ms.
  const hasEverPrayedPrev = useRef(hasEverPrayed);
  const [sweepPhase, setSweepPhase] = useState<"idle" | "snap" | "draw">("idle");
  useEffect(() => {
    if (!hasEverPrayedPrev.current && hasEverPrayed) {
      hasEverPrayedPrev.current = hasEverPrayed;
      const reduceMotion =
        typeof window !== "undefined" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (reduceMotion) return;
      setSweepPhase("snap");
      const raf = requestAnimationFrame(() => setSweepPhase("draw"));
      const timer = setTimeout(() => setSweepPhase("idle"), 900);
      return () => {
        cancelAnimationFrame(raf);
        clearTimeout(timer);
      };
    }
    hasEverPrayedPrev.current = hasEverPrayed;
  }, [hasEverPrayed]);
  const sweepActive = sweepPhase !== "idle";

  const cooldownSeconds =
    nowSeconds !== null && nextAllowedAt
      ? Math.max(0, Number(nextAllowedAt) - nowSeconds)
      : 0;
  const cooldownActive = cooldownSeconds > 0;
  const cooldownProgress = cooldownActive
    ? Math.max(0, Math.min(1, 1 - cooldownSeconds / 86400))
    : 1;

  // Arc geometry — 84px viewBox, ~36px radius stroke
  const R = 36;
  const CIRC = 2 * Math.PI * R;
  const dashOffset = CIRC * (1 - cooldownProgress);

  const tierPct = tier.next ? Math.max(6, tier.progressPercent) : 100;

  return (
    <div
      className={`altar-strip ${afterglow ? "altar-strip--afterglow" : ""} ${sweepActive ? "altar-strip--bloom" : ""}`}
      role="region"
      aria-label="Prayer altar"
    >
      {/* Mommy Portal: GIF wrapped in cooldown arc + breathing aura */}
      <div className="altar-portal" aria-hidden="true">
        <div className="altar-portal__aura" />
        <svg
          className="altar-portal__arc"
          width="84"
          height="84"
          viewBox="0 0 84 84"
        >
          {/* Ring state indicates TODAY's prayer status:
              - cooldownActive (prayed today) → solid ring, progresses as 24h window elapses
              - !cooldownActive (haven't prayed today yet, or never prayed) → dashed ring */}
          {!cooldownActive ? (
            <circle
              cx="42"
              cy="42"
              r={R}
              fill="none"
              stroke="var(--pray-accent, #6eead8)"
              strokeWidth="1.25"
              strokeLinecap="round"
              strokeDasharray="2 5"
              opacity="0.4"
            />
          ) : (
            <>
              <circle
                cx="42"
                cy="42"
                r={R}
                fill="none"
                stroke="rgba(255,255,255,0.06)"
                strokeWidth="1.5"
                vectorEffect="non-scaling-stroke"
              />
              <circle
                cx="42"
                cy="42"
                r={R}
                fill="none"
                stroke="var(--pray-accent, #6eead8)"
                strokeWidth="1.75"
                strokeLinecap="round"
                strokeDasharray={CIRC}
                strokeDashoffset={sweepPhase === "snap" ? CIRC : dashOffset}
                transform="rotate(-90 42 42)"
                className={sweepActive ? "altar-portal__arc-sweep" : undefined}
                style={{
                  transition:
                    sweepPhase === "snap"
                      ? "none"
                      : sweepPhase === "draw"
                        ? "stroke-dashoffset 600ms ease-out"
                        : "stroke-dashoffset 0.8s ease-out",
                }}
                opacity={0.9}
                vectorEffect="non-scaling-stroke"
              />
            </>
          )}
          {hasEverPrayed && !cooldownActive && connected && (
            <circle
              cx="42"
              cy="42"
              r={R + 3}
              fill="none"
              stroke="var(--pray-accent, #6eead8)"
              strokeWidth="1"
              opacity="0.4"
              className="altar-portal__ready-ring"
            />
          )}
        </svg>
        <div className="altar-portal__gif">
          <Image
            src="/foidmommy-96.webp"
            alt="Foid Mommy"
            width={56}
            height={56}
            unoptimized
            priority
          />
        </div>
      </div>

      {/* Right side: streak + tier filament + countdown */}
      <div className="altar-data">
        <div className="altar-streak">
          <span
            className={`altar-sparkle ${hasEverPrayed && !cooldownActive ? "altar-sparkle--ready" : ""}`}
            aria-hidden="true"
          >
            ✦
          </span>
          <span className="altar-streak__value">
            {!connected ? "–" : loading ? "·" : displayStreak}
          </span>
          <span className="altar-streak__label">
            {displayStreak === 1 ? "day" : "days"}
          </span>
        </div>

        <div className="altar-tier">
          <span className="altar-tier__name">
            {!connected ? "—" : tier.current.name.toLowerCase()}
          </span>
          <div className="altar-tier__bar" aria-hidden="true">
            <div
              className="altar-tier__fill"
              style={{ width: `${tierPct}%` }}
            />
          </div>
          <span className="altar-tier__meta">
            {tier.next ? `${tier.daysToNextTier}d` : "max"}
            <span className="altar-countdown__compact">
              {connected && nowSeconds !== null
                ? ` · ${formatCountdown(cooldownSeconds)}`
                : ""}
            </span>
          </span>
        </div>

        <div className="altar-countdown">
          <span className="altar-countdown__label">next</span>
          <span
            className={`altar-countdown__value ${!cooldownActive && connected ? "altar-countdown__value--ready" : ""}`}
          >
            {!connected
              ? "—"
              : nowSeconds === null
                ? "—"
                : formatCountdown(cooldownSeconds)}
          </span>
        </div>

        {/* Streak-loss deadline. Only shows for users who've prayed at
            least once — otherwise there's no streak to lose. The urgent
            state kicks in once cooldown is over and the streak window is
            ticking toward reset. */}
        {connected && hasEverPrayed && streakSecondsLeft !== null && (
          <div
            className={`altar-streak-deadline ${streakUrgent ? "altar-streak-deadline--urgent" : ""}`}
            role="timer"
            aria-live="polite"
            aria-label={
              streakSecondsLeft <= 0
                ? "Streak lost"
                : `Streak resets in ${formatStreakDeadlineShort(streakSecondsLeft)}`
            }
          >
            <span className="altar-streak-deadline__label">
              {streakSecondsLeft <= 0 ? "streak lost" : "streak resets in"}
            </span>
            {streakSecondsLeft > 0 && (
              <span className="altar-streak-deadline__value">
                {formatStreakDeadlineShort(streakSecondsLeft)}
              </span>
            )}
          </div>
        )}
      </div>

      <style jsx>{`
        .altar-strip {
          position: relative;
          display: grid;
          grid-template-columns: 84px 1fr;
          align-items: center;
          gap: 14px;
          padding: 12px 14px;
          border-radius: 12px;
          /* Solid fallback first (pre-color-mix browsers) */
          background: linear-gradient(
            180deg,
            rgba(8, 14, 22, 0.82) 0%,
            rgba(4, 8, 14, 0.9) 100%
          );
          border: 1px solid rgba(255, 255, 255, 0.06);
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.04),
            inset 0 -1px 0 rgba(0, 0, 0, 0.35),
            0 4px 20px rgba(0, 0, 0, 0.35);
          transition: box-shadow 0.6s ease, border-color 0.6s ease;
          overflow: hidden;
          flex-shrink: 0;
        }
        @supports (background: color-mix(in oklab, red, blue)) {
          .altar-strip {
            background:
              radial-gradient(
                circle at 18% 50%,
                color-mix(in oklab, var(--pray-accent, #6eead8) 8%, transparent) 0%,
                transparent 45%
              ),
              linear-gradient(
                180deg,
                rgba(8, 14, 22, 0.82) 0%,
                rgba(4, 8, 14, 0.9) 100%
              );
          }
        }
        .altar-strip::before {
          content: "";
          position: absolute;
          inset: 0;
          border-radius: 12px;
          padding: 1px;
          background: linear-gradient(
            135deg,
            color-mix(in oklab, var(--pray-accent, #6eead8) 18%, transparent),
            transparent 40%,
            transparent 60%,
            color-mix(in oklab, var(--pray-accent, #6eead8) 10%, transparent)
          );
          -webkit-mask: linear-gradient(#fff 0 0) content-box,
            linear-gradient(#fff 0 0);
          -webkit-mask-composite: xor;
          mask-composite: exclude;
          pointer-events: none;
          opacity: 0.8;
        }
        .altar-strip--afterglow {
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.06),
            inset 0 -1px 0 rgba(0, 0, 0, 0.35),
            0 0 32px
              color-mix(in oklab, var(--pray-accent, #6eead8) 40%, transparent),
            0 4px 20px rgba(0, 0, 0, 0.35);
          border-color: color-mix(
            in oklab,
            var(--pray-accent, #6eead8) 35%,
            transparent
          );
        }

        /* Portal */
        .altar-portal {
          position: relative;
          width: 84px;
          height: 84px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .altar-portal__aura {
          position: absolute;
          inset: -4px;
          border-radius: 50%;
          background: radial-gradient(
            circle,
            color-mix(in oklab, var(--pray-accent, #6eead8) 22%, transparent) 0%,
            transparent 65%
          );
          filter: blur(6px);
          animation: altar-breathe 4s ease-in-out infinite;
          pointer-events: none;
        }
        .altar-portal__arc {
          position: absolute;
          inset: 0;
        }
        .altar-portal__gif {
          position: relative;
          width: 56px;
          height: 56px;
          border-radius: 50%;
          overflow: hidden;
          box-shadow:
            0 0 0 1px color-mix(in oklab, var(--pray-accent, #6eead8) 25%, transparent),
            0 0 20px
              color-mix(in oklab, var(--pray-accent, #6eead8) 15%, transparent);
          background: rgba(0, 0, 0, 0.4);
          animation: altar-avatar-breath 4s ease-in-out infinite;
          transform-origin: center center;
          will-change: transform;
        }
        @keyframes altar-avatar-breath {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.02); }
        }
        .altar-portal__gif :global(img) {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }
        .altar-portal__ready-ring {
          animation: altar-ready-pulse 2.4s ease-in-out infinite;
          transform-origin: 42px 42px;
          transform-box: fill-box;
        }
        /* Completion sweep — the actual 600ms stroke-dashoffset draw-in is
           driven by an inline style transition on the circle (the offset is
           a dynamic value and styled-jsx interpolation can't reliably
           propagate into a @keyframes block). This class just tags the
           element so devtools can pinpoint it. */
        .altar-portal__arc-sweep {
          /* no-op: inline style drives the transition */
        }
        .altar-strip--bloom {
          animation: altar-bloom 900ms ease-out;
        }
        @keyframes altar-bloom {
          0% {
            box-shadow:
              inset 0 1px 0 rgba(255, 255, 255, 0.04),
              inset 0 -1px 0 rgba(0, 0, 0, 0.35),
              0 4px 20px rgba(0, 0, 0, 0.35);
          }
          40% {
            box-shadow:
              inset 0 1px 0 rgba(255, 255, 255, 0.06),
              inset 0 -1px 0 rgba(0, 0, 0, 0.35),
              0 0 44px
                color-mix(in oklab, var(--pray-accent, #6eead8) 55%, transparent),
              0 4px 20px rgba(0, 0, 0, 0.35);
          }
          100% {
            box-shadow:
              inset 0 1px 0 rgba(255, 255, 255, 0.04),
              inset 0 -1px 0 rgba(0, 0, 0, 0.35),
              0 4px 20px rgba(0, 0, 0, 0.35);
          }
        }
        @keyframes altar-breathe {
          0%,
          100% {
            transform: scale(1);
            opacity: 0.9;
          }
          50% {
            transform: scale(1.06);
            opacity: 1;
          }
        }
        @keyframes altar-ready-pulse {
          0%,
          100% {
            opacity: 0.15;
            transform: scale(1);
          }
          50% {
            opacity: 0.55;
            transform: scale(1.04);
          }
        }

        /* Data side */
        .altar-data {
          display: flex;
          flex-direction: column;
          gap: 6px;
          min-width: 0;
        }

        .altar-streak {
          display: flex;
          align-items: baseline;
          gap: 6px;
          line-height: 1;
        }
        /* Sparkle glyph — cult-tech twinkle, not Duolingo fire.
           Subtle scale + glow on ready states only. */
        .altar-sparkle {
          font-size: 14px;
          color: var(--pray-accent, #6eead8);
          text-shadow: 0 0 10px rgba(110, 234, 216, 0.55);
          transform: translateY(-1px);
          display: inline-block;
          line-height: 1;
        }
        @supports (color: color-mix(in oklab, red, blue)) {
          .altar-sparkle {
            text-shadow: 0 0 10px
              color-mix(in oklab, var(--pray-accent, #6eead8) 60%, transparent);
          }
        }
        .altar-sparkle--ready {
          animation: altar-twinkle 3.4s ease-in-out infinite;
        }
        @keyframes altar-twinkle {
          0%, 100% {
            opacity: 0.75;
            transform: translateY(-1px) scale(1);
          }
          50% {
            opacity: 1;
            transform: translateY(-1px) scale(1.08);
          }
        }
        .altar-streak__value {
          font-family: var(--font-terminal, "JetBrains Mono", monospace);
          font-size: 32px;
          font-weight: 700;
          color: var(--pray-accent, #6eead8);
          letter-spacing: -0.02em;
          text-shadow: 0 0 18px
            color-mix(in oklab, var(--pray-accent, #6eead8) 45%, transparent);
          font-variant-numeric: tabular-nums;
        }
        .altar-streak__label {
          font-size: 10px;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          color: rgba(255, 255, 255, 0.4);
          margin-left: 2px;
        }

        .altar-tier {
          display: grid;
          grid-template-columns: auto 1fr auto;
          align-items: center;
          gap: 8px;
        }
        .altar-tier__name {
          font-size: 10px;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: var(--pray-accent, #6eead8);
          font-weight: 600;
          white-space: nowrap;
          opacity: 0.9;
        }
        .altar-tier__bar {
          height: 3px;
          background: rgba(255, 255, 255, 0.08);
          border-radius: 2px;
          overflow: hidden;
          position: relative;
        }
        .altar-tier__fill {
          height: 100%;
          background: var(--pray-accent, #6eead8);
          box-shadow: 0 0 8px rgba(110, 234, 216, 0.55);
          transition: width 0.6s ease;
        }
        @supports (background: color-mix(in oklab, red, blue)) {
          .altar-tier__fill {
            background: linear-gradient(
              90deg,
              color-mix(in oklab, var(--pray-accent, #6eead8) 60%, transparent),
              var(--pray-accent, #6eead8)
            );
            box-shadow: 0 0 8px
              color-mix(in oklab, var(--pray-accent, #6eead8) 55%, transparent);
          }
        }
        .altar-tier__meta {
          font-size: 9px;
          letter-spacing: 0.1em;
          color: rgba(255, 255, 255, 0.4);
          font-family: var(--font-terminal, monospace);
          font-variant-numeric: tabular-nums;
        }

        .altar-countdown {
          display: flex;
          align-items: baseline;
          gap: 6px;
        }
        .altar-countdown__label {
          font-size: 9px;
          letter-spacing: 0.2em;
          text-transform: uppercase;
          color: rgba(255, 255, 255, 0.35);
        }
        .altar-countdown__value {
          font-family: var(--font-terminal, monospace);
          font-size: 12px;
          color: rgba(255, 255, 255, 0.7);
          font-variant-numeric: tabular-nums;
        }
        .altar-countdown__value--ready {
          color: #00ff9c;
          text-shadow: 0 0 8px rgba(0, 255, 156, 0.5);
          text-transform: uppercase;
          letter-spacing: 0.15em;
          font-size: 10px;
        }

        /* Streak-loss deadline — sits below the cooldown row. Calm dim
           tone when streak is safe (in cooldown), warm amber pulse when
           the user can pray and the 24h window is ticking. */
        .altar-streak-deadline {
          display: flex;
          align-items: baseline;
          gap: 6px;
          margin-top: 2px;
        }
        .altar-streak-deadline__label {
          font-size: 9px;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          color: rgba(255, 255, 255, 0.35);
        }
        .altar-streak-deadline__value {
          font-family: var(--font-terminal, monospace);
          font-size: 11px;
          color: rgba(255, 255, 255, 0.65);
          font-variant-numeric: tabular-nums;
        }
        .altar-streak-deadline--urgent .altar-streak-deadline__label {
          color: rgba(255, 184, 77, 0.85);
        }
        .altar-streak-deadline--urgent .altar-streak-deadline__value {
          color: #ffb84d;
          text-shadow: 0 0 8px rgba(255, 184, 77, 0.55);
          font-weight: 600;
          animation: altar-streak-pulse 2.2s ease-in-out infinite;
        }
        @keyframes altar-streak-pulse {
          0%, 100% { opacity: 0.9; }
          50% { opacity: 1; }
        }
        @media (max-width: 374px) {
          .altar-streak-deadline {
            margin-top: 0;
          }
          .altar-streak-deadline__label {
            font-size: 8.5px;
            letter-spacing: 0.12em;
          }
          .altar-streak-deadline__value {
            font-size: 10px;
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .altar-streak-deadline--urgent .altar-streak-deadline__value {
            animation: none;
          }
        }

        /* Narrow phones (iPhone SE, small Androids): fold the cooldown value
           into the tier meta to save a row. Keeps both pieces of info — just
           collapsed into one line. */
        .altar-countdown__compact { display: none; }
        @media (max-width: 374px) {
          .altar-strip {
            padding: 10px 12px;
            gap: 12px;
            grid-template-columns: 76px 1fr;
          }
          .altar-portal,
          .altar-portal__arc {
            width: 76px;
            height: 76px;
          }
          .altar-streak__value { font-size: 28px; }
          .altar-countdown { display: none; }
          .altar-countdown__compact {
            display: inline;
            font-size: 9px;
            letter-spacing: 0.08em;
            color: rgba(255, 255, 255, 0.4);
            font-family: var(--font-terminal, monospace);
            font-variant-numeric: tabular-nums;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .altar-portal__aura,
          .altar-portal__ready-ring,
          .altar-portal__gif,
          .altar-portal__arc-sweep,
          .altar-strip--bloom,
          .altar-sparkle--ready {
            animation: none;
          }
        }
      `}</style>
    </div>
  );
}
