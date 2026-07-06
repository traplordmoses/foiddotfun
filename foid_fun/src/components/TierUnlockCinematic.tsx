"use client";

import { useEffect, useRef, useState } from "react";
import { useHaptic } from "@/hooks/useHaptic";

/**
 * TierUnlockCinematic — 1.2s full-screen tier-unlock moment (tier 10 plays 1.6s).
 *
 * Plays exactly once per (wallet, tier); gating is handled by the caller (see
 * useTierUnlockWatcher). This component only renders the animation and calls
 * onComplete when finished or skipped.
 *
 * Tap anywhere to skip. Respects prefers-reduced-motion (shows a 400ms static
 * "TIER UNLOCKED: …" label instead of the animation).
 */

const TIER_NAMES: Record<number, string> = {
  3: "TAPPED IN",
  4: "LOCKED IN",
  5: "CERTIFIED",
  6: "UNDENIABLE",
  7: "BUILT DIFFERENT",
  8: "INEVITABLE",
  9: "TRANSCENDENT",
  10: "MOMMY MILKER",
};

const TIER_MULT: Record<number, string> = {
  3: "1.5x",
  4: "1.75x",
  5: "2x",
  6: "2.5x",
  7: "3x",
  8: "3.5x",
  9: "4x",
  10: "5x",
};

interface Props {
  tierLevel: number;
  onComplete: () => void;
}

export default function TierUnlockCinematic({ tierLevel, onComplete }: Props) {
  const { trigger: triggerHaptic } = useHaptic();
  const [reduceMotion, setReduceMotion] = useState(false);
  const [ready, setReady] = useState(false);
  const completedRef = useRef(false);

  const name = TIER_NAMES[tierLevel] ?? "UNKNOWN";
  const mult = TIER_MULT[tierLevel] ?? "";
  const fullDuration = tierLevel === 10 ? 1600 : 1200;

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
    const reduced = mql.matches;
    setReduceMotion(reduced);
    setReady(true);

    const duration = reduced ? 400 : fullDuration;
    // Peak beat at ~35% through the animation — mid-stamp / mid-bloom.
    const peakDelay = reduced ? 40 : Math.floor(fullDuration * 0.35);

    const peakTimer = window.setTimeout(() => {
      triggerHaptic("success");
    }, peakDelay);

    const endTimer = window.setTimeout(() => {
      if (completedRef.current) return;
      completedRef.current = true;
      onComplete();
    }, duration);

    return () => {
      window.clearTimeout(peakTimer);
      window.clearTimeout(endTimer);
    };
  }, [fullDuration, onComplete, triggerHaptic]);

  const skip = () => {
    if (completedRef.current) return;
    completedRef.current = true;
    onComplete();
  };

  if (!ready) return null;

  if (reduceMotion) {
    return (
      <div
        className="tier-unlock tier-unlock--static"
        onClick={skip}
        onTouchStart={skip}
        role="status"
        aria-live="polite"
      >
        <div className="tier-unlock__static-label">
          TIER UNLOCKED: {name}
          {mult ? ` · ${mult}` : ""}
        </div>
        <style jsx>{`
          .tier-unlock--static {
            position: fixed;
            inset: 0;
            z-index: 9500;
            background: rgba(0, 0, 0, 0.75);
            display: flex;
            align-items: center;
            justify-content: center;
            pointer-events: auto;
          }
          .tier-unlock__static-label {
            font-family: var(--font-terminal, "JetBrains Mono", monospace);
            font-size: 14px;
            letter-spacing: 0.22em;
            color: var(--foid-mint);
            text-shadow: 0 0 12px rgba(110, 234, 216, 0.5);
            padding: 10px 18px;
            border: 1px solid rgba(110, 234, 216, 0.4);
            border-radius: 6px;
            background: rgba(0, 0, 0, 0.6);
            text-align: center;
          }
        `}</style>
      </div>
    );
  }

  // Animated cinematic content per tier.
  return (
    <div
      className={`tier-unlock tier-unlock--t${tierLevel}`}
      onClick={skip}
      onTouchStart={skip}
      aria-hidden="true"
    >
      {tierLevel === 3 && (
        <>
          <div className="tier-unlock__flash tier-unlock__flash--t3" />
          <div className="tier-unlock__titlebar">
            &gt; TIER UNLOCKED: {name} · {mult}
          </div>
        </>
      )}

      {tierLevel === 4 && <div className="tier-unlock__frame" />}

      {tierLevel === 5 && (
        <div className="tier-unlock__stamp">
          <span>{name}</span>
        </div>
      )}

      {tierLevel === 6 && (
        <>
          <div className="tier-unlock__vignette-invert" />
          <div className="tier-unlock__titlebar tier-unlock__titlebar--glow">
            FOID_MOMMY · {name}
          </div>
        </>
      )}

      {tierLevel === 7 && (
        <div className="tier-unlock__chroma">
          <span className="tier-unlock__chroma-layer tier-unlock__chroma-layer--r">
            {name}
          </span>
          <span className="tier-unlock__chroma-layer tier-unlock__chroma-layer--b">
            {name}
          </span>
          <span className="tier-unlock__chroma-layer tier-unlock__chroma-layer--w">
            {name}
          </span>
        </div>
      )}

      {tierLevel === 8 && (
        <div className="tier-unlock__typewriter">
          <span className="tier-unlock__typewriter-text">{name}</span>
        </div>
      )}

      {tierLevel === 9 && <div className="tier-unlock__bloom" />}

      {tierLevel === 10 && (
        <>
          <div className="tier-unlock__iridescent" />
          <div className="tier-unlock__stamp tier-unlock__stamp--t10">
            <span>{name}</span>
          </div>
        </>
      )}

      <style jsx>{`
        .tier-unlock {
          position: fixed;
          inset: 0;
          z-index: 9500;
          pointer-events: auto;
          overflow: hidden;
        }

        /* Shared titlebar label (tier 3, tier 6). */
        .tier-unlock__titlebar {
          position: absolute;
          top: max(env(safe-area-inset-top, 0px), 12px);
          left: 0;
          right: 0;
          text-align: center;
          font-family: var(--font-terminal, "JetBrains Mono", monospace);
          font-size: 12px;
          letter-spacing: 0.22em;
          color: var(--foid-mint);
          text-shadow: 0 0 10px rgba(110, 234, 216, 0.6);
          padding: 8px 12px;
          opacity: 0;
          animation: tu-label 1200ms ease-out both;
        }
        .tier-unlock__titlebar--glow {
          color: #fff;
          text-shadow:
            0 0 12px rgba(255, 250, 230, 0.85),
            0 0 24px rgba(255, 250, 230, 0.45);
        }
        @keyframes tu-label {
          0% { opacity: 0; }
          15%, 75% { opacity: 1; }
          100% { opacity: 0; }
        }

        /* === Tier 3 — cyan flash + rattle === */
        .tier-unlock--t3 {
          animation: tu-rattle 200ms steps(8) both;
        }
        .tier-unlock__flash--t3 {
          position: absolute;
          inset: 0;
          background: var(--foid-mint);
          opacity: 0;
          animation: tu-t3-flash 150ms 40ms ease-out both;
        }
        @keyframes tu-t3-flash {
          0% { opacity: 0; }
          50% { opacity: 0.3; }
          100% { opacity: 0; }
        }
        @keyframes tu-rattle {
          0%, 100% { transform: translate(0, 0); }
          20% { transform: translate(2px, -1px); }
          40% { transform: translate(-2px, 1px); }
          60% { transform: translate(1px, 2px); }
          80% { transform: translate(-1px, -2px); }
        }

        /* === Tier 4 — rectangular frame drawn inside-out === */
        .tier-unlock__frame {
          position: absolute;
          border: 2px solid var(--foid-mint);
          box-shadow:
            0 0 18px rgba(110, 234, 216, 0.5),
            inset 0 0 18px rgba(110, 234, 216, 0.25);
          top: 50%;
          left: 50%;
          right: 50%;
          bottom: 50%;
          animation:
            tu-t4-grow 800ms cubic-bezier(0.22, 1, 0.36, 1) forwards,
            tu-t4-fade 400ms 800ms ease-in forwards;
        }
        @keyframes tu-t4-grow {
          0% { top: 50%; left: 50%; right: 50%; bottom: 50%; }
          100% { top: 8px; left: 8px; right: 8px; bottom: 8px; }
        }
        @keyframes tu-t4-fade {
          from { opacity: 1; }
          to { opacity: 0; }
        }

        /* === Tier 5 — "CERTIFIED" stamp === */
        .tier-unlock__stamp {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%) scale(1.2) rotate(-4deg);
          font-family: var(--font-terminal, "JetBrains Mono", monospace);
          font-size: clamp(44px, 14vw, 96px);
          font-weight: 900;
          letter-spacing: 0.08em;
          color: #ffe680;
          text-shadow:
            0 0 30px rgba(255, 230, 128, 0.85),
            0 2px 0 rgba(120, 80, 0, 0.5);
          animation:
            tu-t5-stamp 450ms 80ms cubic-bezier(0.2, 1.4, 0.4, 1) forwards,
            tu-t5-fade 500ms 700ms ease-out forwards;
          white-space: nowrap;
        }
        @keyframes tu-t5-stamp {
          0% { transform: translate(-50%, -50%) scale(1.2) rotate(-4deg); opacity: 0; }
          30% { opacity: 1; }
          60% { transform: translate(-50%, -50%) scale(0.94) rotate(-4deg); opacity: 1; }
          80% { transform: translate(-50%, -50%) scale(1.04) rotate(-4deg); }
          100% { transform: translate(-50%, -50%) scale(1.0) rotate(-4deg); opacity: 1; }
        }
        @keyframes tu-t5-fade {
          from { opacity: 1; }
          to { opacity: 0; }
        }

        /* === Tier 6 — vignette inversion (dark → cream → dark) === */
        .tier-unlock__vignette-invert {
          position: absolute;
          inset: 0;
          background: rgba(0, 0, 0, 0);
          animation: tu-t6-invert 900ms ease-in-out both;
        }
        @keyframes tu-t6-invert {
          0%, 100% { background: rgba(0, 0, 0, 0); }
          30% { background: rgba(255, 250, 230, 0.1); }
          50% { background: rgba(255, 250, 230, 0.55); }
          70% { background: rgba(255, 250, 230, 0.1); }
        }

        /* === Tier 7 — chromatic split === */
        .tier-unlock__chroma {
          position: absolute;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .tier-unlock__chroma-layer {
          position: absolute;
          font-family: var(--font-terminal, "JetBrains Mono", monospace);
          font-size: clamp(32px, 9vw, 64px);
          font-weight: 900;
          letter-spacing: 0.12em;
          white-space: nowrap;
          mix-blend-mode: screen;
        }
        .tier-unlock__chroma-layer--r {
          color: #ff2e55;
          animation: tu-t7-split-r 1200ms ease-in-out both;
        }
        .tier-unlock__chroma-layer--b {
          color: #2e8bff;
          animation: tu-t7-split-b 1200ms ease-in-out both;
        }
        .tier-unlock__chroma-layer--w {
          color: #fff;
        }
        @keyframes tu-t7-split-r {
          0% { transform: translate(0, 0); opacity: 0; }
          15% { transform: translate(-12px, 0); opacity: 1; }
          40% { transform: translate(-12px, 0); opacity: 1; }
          65% { transform: translate(0, 0); opacity: 1; }
          100% { transform: translate(0, 0); opacity: 0; }
        }
        @keyframes tu-t7-split-b {
          0% { transform: translate(0, 0); opacity: 0; }
          15% { transform: translate(12px, 0); opacity: 1; }
          40% { transform: translate(12px, 0); opacity: 1; }
          65% { transform: translate(0, 0); opacity: 1; }
          100% { transform: translate(0, 0); opacity: 0; }
        }

        /* === Tier 8 — typewriter wave === */
        .tier-unlock__typewriter {
          position: absolute;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .tier-unlock__typewriter-text {
          font-family: var(--font-terminal, "JetBrains Mono", monospace);
          font-size: clamp(32px, 9vw, 64px);
          font-weight: 800;
          letter-spacing: 0.18em;
          color: var(--foid-mint);
          text-shadow: 0 0 20px rgba(110, 234, 216, 0.7);
          white-space: nowrap;
          overflow: hidden;
          border-right: 2px solid var(--foid-mint);
          width: 0;
          animation:
            tu-t8-type 700ms 80ms steps(10, end) forwards,
            tu-t8-dissolve 400ms 800ms ease-out forwards;
        }
        @keyframes tu-t8-type {
          from { width: 0; }
          to { width: 8em; }
        }
        @keyframes tu-t8-dissolve {
          from { opacity: 1; filter: blur(0); }
          to { opacity: 0; filter: blur(6px); }
        }

        /* === Tier 9 — radial mint bloom === */
        .tier-unlock__bloom {
          position: absolute;
          top: 50%;
          left: 50%;
          width: 40vmax;
          height: 40vmax;
          transform: translate(-50%, -50%) scale(0);
          background: radial-gradient(
            circle at center,
            rgba(110, 234, 216, 0.9) 0%,
            rgba(110, 234, 216, 0.35) 40%,
            rgba(110, 234, 216, 0) 70%
          );
          animation:
            tu-t9-bloom 900ms ease-out forwards,
            tu-t9-fade 300ms 900ms ease-in forwards;
        }
        @keyframes tu-t9-bloom {
          0% { transform: translate(-50%, -50%) scale(0); opacity: 0.95; }
          100% { transform: translate(-50%, -50%) scale(1); opacity: 0.9; }
        }
        @keyframes tu-t9-fade {
          from { opacity: 0.9; }
          to { opacity: 0; }
        }

        /* === Tier 10 — iridescent wash (1.6s) === */
        .tier-unlock--t10 .tier-unlock__iridescent {
          position: absolute;
          inset: 0;
          background: rgba(0, 0, 0, 0);
          animation: tu-t10-wash 1600ms ease-in-out both;
        }
        @keyframes tu-t10-wash {
          0%, 100% { background: rgba(0, 0, 0, 0); }
          20% { background: rgba(139, 92, 246, 0.5); }
          45% { background: rgba(255, 204, 92, 0.5); }
          70% { background: rgba(110, 234, 216, 0.45); }
          90% { background: rgba(20, 20, 30, 0.2); }
        }
        .tier-unlock__stamp--t10 {
          color: #fff;
          text-shadow:
            0 0 24px rgba(139, 92, 246, 0.8),
            0 0 40px rgba(255, 204, 92, 0.5),
            0 0 60px rgba(110, 234, 216, 0.4);
          animation:
            tu-t10-stamp 500ms 300ms cubic-bezier(0.2, 1.4, 0.4, 1) forwards,
            tu-t5-fade 500ms 1100ms ease-out forwards;
        }
        @keyframes tu-t10-stamp {
          0% { transform: translate(-50%, -50%) scale(0.6) rotate(0deg); opacity: 0; }
          60% { transform: translate(-50%, -50%) scale(1.05) rotate(0deg); opacity: 1; }
          100% { transform: translate(-50%, -50%) scale(1) rotate(0deg); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
