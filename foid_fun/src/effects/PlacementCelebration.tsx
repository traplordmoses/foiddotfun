// src/effects/PlacementCelebration.tsx
// "Olympus meets FOID Terminal" — cinematic multi-beat celebration for loreboard placements
"use client";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { spawn } from "@/lib/spawn";
import { getAudioSettings } from "@/lib/audioSettings";
import { BLOCK_EXPLORER_URL } from "@/lib/contracts";
import { cidToHttpUrl } from "@/lib/ipfsUrl";
import {
  pickPersonalization,
  type Personalization,
} from "@/effects/placementPersonalization";
import { startParticles } from "@/effects/particleCanvas";

type PlacementCelebrationProps = {
  itemName: string;
  txHash: string;
  proposalId: number | null;
  previewUrl: string;
  ipfsCid?: string;
  /**
   * Optional pre-computed personalization. If omitted, the component falls
   * back to `pickPersonalization(proposalId)` with no user-milestone info.
   */
  personalization?: Personalization;
};

const DURATION = 9600;

export function showPlacementCelebration(opts: PlacementCelebrationProps) {
  spawn(<PlacementCelebration {...opts} />, DURATION);
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
  ipfsCid,
  personalization,
}: PlacementCelebrationProps) {
  const [exiting, setExiting] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  // Ref on the SHARE TO X button so we can move focus to it once the slab
  // has settled. Keyboard users land on the logical next action, and screen
  // readers announce the button label.
  const shareBtnRef = useRef<HTMLButtonElement>(null);
  const { display: slotDisplay, landed: slotLanded } = useSlotCounter(proposalId);

  // Personalization — milestone number / meme id / prime → headline variant
  const pers =
    personalization ?? pickPersonalization(proposalId);

  // Sound effects
  useEffect(() => {
    const settings = getAudioSettings();
    if (!settings.sfxEnabled) return;
    import("@/lib/sfx").then((sfx) => {
      sfx.default.playVictoryChord();
      setTimeout(() => sfx.default.playReward(), 1200);
    });
  }, []);

  // Haptics — mobile only, respects reduced-motion preference.
  useEffect(() => {
    if (typeof navigator === "undefined" || typeof navigator.vibrate !== "function") return;
    const prefersReduced =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduced) return;
    // Synced to the flash → shockwave → slab-enter beats.
    navigator.vibrate([12, 40, 18, 30, 24]);
  }, []);

  // Auto-exit animation before spawn TTL
  useEffect(() => {
    const exitTimer = setTimeout(() => setExiting(true), DURATION - 700);
    return () => clearTimeout(exitTimer);
  }, []);

  // Move focus to the SHARE button once the slab animation has settled
  // (~2000ms matches pc-share-in animation delay). Screen readers announce
  // "Share to X, button" and keyboard users can hit Enter to tweet without
  // reaching for the mouse. Respects reduced-motion by firing immediately.
  useEffect(() => {
    const prefersReduced =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const delay = prefersReduced ? 0 : 2100;
    const focusTimer = setTimeout(() => {
      shareBtnRef.current?.focus?.({ preventScroll: true });
    }, delay);
    return () => clearTimeout(focusTimer);
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

  // Share to X — randomised tweet templates.
  // The share URL deep-links back into the same celebration for anyone who
  // clicks it: /board?celebrate=<proposalId> → the board page re-runs the
  // celebration component on mount using on-chain data.
  const handleShare = () => {
    const deepLink =
      proposalId != null
        ? `https://foid.fun/board?celebrate=${proposalId}`
        : "https://foid.fun/board";
    const tweets = [
      `do you know what? i just made the ${proposalId != null ? `#${proposalId}` : ""} proposal to the @foidfun loreboard!!\n\ngo check it out and vote.\n\n${deepLink}`,
      `yeowww i proposed a meme to the @foidfun loreboard!!\n\n${deepLink}`,
      `yippppeeee i just proposed an image to the @foidfun loreboard!!\n\n${deepLink}`,
    ];
    const text = encodeURIComponent(tweets[Math.floor(Math.random() * tweets.length)]);
    window.open(`https://x.com/intent/tweet?text=${text}`, "_blank");
  };

  // Particle system moved to <canvas>. Starting the particles here keeps
  // the lifecycle scoped to this component — spawn's TTL unmounts us, and
  // the stop fn runs via the cleanup below. See src/effects/particleCanvas.ts.
  const particleCanvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = particleCanvasRef.current;
    if (!canvas) return;
    // 200 particles on Canvas replaces 500 DOM nodes. The previous
    // implementation drew sparkles+stars (200), crystals (140), confetti (100),
    // rings (60); weights in particleCanvas.ts approximate that mix.
    const stop = startParticles(canvas, { count: 200, durationMs: 5500 });
    return stop;
  }, []);

  // Phase γ — secondary tier-accent particle burst for high tiers
  // (Transcendent lvl 9, Mommy Milker lvl 10). Fires ~1.6s after entry so it
  // feels like an *additional* reward, not part of the main burst.
  const tierCanvasRef = useRef<HTMLCanvasElement>(null);
  const tierLevel = pers.tierLevel ?? 0;
  const tierAccent = pers.tierAccent ?? null;
  useEffect(() => {
    if (tierLevel < 9 || !tierAccent) return;
    const canvas = tierCanvasRef.current;
    if (!canvas) return;
    let stop: (() => void) | null = null;
    const t = window.setTimeout(() => {
      stop = startParticles(canvas, {
        count: 140,
        durationMs: 2500,
        colors: [tierAccent, "#ffffff"],
      });
    }, 1600);
    return () => {
      window.clearTimeout(t);
      stop?.();
    };
  }, [tierLevel, tierAccent]);

  return (
    <div
      ref={rootRef}
      aria-live="polite"
      role="status"
      aria-label={`Placement confirmed: ${itemName}${proposalId != null ? `, proposal number ${proposalId}` : ""}`}
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
        <div
          className="pc-slab"
          style={
            tierAccent
              ? {
                  borderColor: `${tierAccent}66`,
                  boxShadow: `inset 0 0 60px ${tierAccent}14, inset 0 1px 0 rgba(255,255,255,0.06), 0 40px 120px rgba(0, 0, 0, 0.7), 0 0 80px ${tierAccent}22`,
                }
              : undefined
          }
        >
          {/* Hero image — prefer the local data/blob URL (instant, always works
               for the uploader) and fall back to the IPFS gateway only if the
               local URL is unavailable. A freshly pinned CID can take 10s–several
               minutes to propagate across public gateways, so relying on IPFS
               first made the hero image appear broken for the entire ~9.6s
               celebration. */}
          {(previewUrl || ipfsCid) && (
            <div className="pc-hero-frame">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={previewUrl || (ipfsCid ? cidToHttpUrl(ipfsCid) : "")}
                alt={itemName}
                className="pc-hero-img"
                referrerPolicy="no-referrer"
                decoding="async"
                // @ts-expect-error — fetchpriority is a standard HTML attr.
                // This is the LCP element of the celebration; promote it so
                // the browser fetches it ahead of anything else on the page.
                fetchpriority="high"
                onError={(e) => {
                  // If the local preview ever fails (e.g. blob URL already
                  // revoked), fall forward to the IPFS gateway as a last resort.
                  const img = e.target as HTMLImageElement;
                  if (ipfsCid) {
                    const gatewayUrl = cidToHttpUrl(ipfsCid);
                    if (gatewayUrl && img.src !== gatewayUrl) {
                      img.src = gatewayUrl;
                    }
                  }
                }}
              />
              <div className="pc-hero-sheen" aria-hidden />
            </div>
          )}

          {/* Headline — adapts to milestone / meme / prime variants */}
          <span className="pc-headline">{pers.headline}</span>
          {pers.subhead && <span className="pc-subhead">{pers.subhead}</span>}
          {pers.tierSubhead && (
            <span
              className="pc-tier-subhead"
              style={tierAccent ? { color: tierAccent, borderColor: `${tierAccent}55` } : undefined}
            >
              {pers.tierSubhead}
            </span>
          )}

          {/* Slot counter + meta */}
          <div className="pc-meta">
            {proposalId != null && (
              <span className={`pc-slot ${slotLanded ? "pc-slot--landed" : ""}`}>
                {slotDisplay}
              </span>
            )}
            {/* B3: deep-link celebrations (?celebrate=<id>) don't have a
                 local txHash, so the chip would render an empty "/tx/" link.
                 Only show the chip when we have a real hash to link to. */}
            {txHash && txHash.length > 0 && (
              <a
                className="pc-chip"
                href={`${BLOCK_EXPLORER_URL}/tx/${txHash}`}
                target="_blank"
                rel="noreferrer"
              >
                {txHash.slice(0, 10)}...
              </a>
            )}
          </div>

          {/* Share button */}
          <button
            ref={shareBtnRef}
            type="button"
            className="pc-share"
            onClick={handleShare}
            aria-label="Share placement announcement on X"
          >
            SHARE TO X
          </button>
        </div>
      </div>

      {/* Beat 4: Particle stage — single <canvas> backed by particleCanvas.ts.
           Previously 500 DOM nodes (sparkles/crystals/confetti/rings) each
           with a CSS animation; that spiked INP past 400ms on lower-end
           devices. Canvas consolidates the whole burst into one rAF loop. */}
      <canvas
        ref={particleCanvasRef}
        className="pc-particles-canvas"
        aria-hidden="true"
      />

      {/* Phase γ — secondary burst for Transcendent / Mommy Milker tiers */}
      {tierLevel >= 9 && tierAccent && (
        <canvas
          ref={tierCanvasRef}
          className="pc-particles-canvas pc-particles-canvas--tier"
          aria-hidden="true"
        />
      )}

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
          font-family: "SF Pro Display", "Inter", system-ui, -apple-system, sans-serif;
          font-weight: 900;
          font-size: clamp(30px, 6vw, 52px);
          letter-spacing: 0.32em;
          line-height: 1;
          text-transform: uppercase;
          /* FOID palette gradient — cyan → purple → pink with white highlights */
          background: linear-gradient(
            135deg,
            #74ffeb 0%,
            #a78bfa 20%,
            #f472b6 40%,
            #fff 50%,
            #74ffeb 60%,
            #a78bfa 80%,
            #f472b6 100%
          );
          background-size: 300% 300%;
          -webkit-background-clip: text;
          background-clip: text;
          -webkit-text-fill-color: transparent;
          /* Ethereal glow shadows */
          filter: drop-shadow(0 0 8px rgba(116, 255, 235, 0.4)) drop-shadow(0 0 24px rgba(167, 139, 250, 0.3));
          opacity: 0;
          animation:
            pc-text-enter 700ms 1300ms cubic-bezier(0.16, 0.86, 0.22, 1) forwards,
            pc-chrome-shift 4s 2000ms ease-in-out infinite alternate;
        }
        @keyframes pc-text-enter {
          0%   { opacity: 0; transform: translateY(8px) scale(0.88); filter: drop-shadow(0 0 0px transparent); }
          50%  { opacity: 1; transform: translateY(-4px) scale(1.06); filter: drop-shadow(0 0 20px rgba(116, 255, 235, 0.6)) drop-shadow(0 0 40px rgba(167, 139, 250, 0.4)); }
          100% { opacity: 1; transform: translateY(0) scale(1); filter: drop-shadow(0 0 8px rgba(116, 255, 235, 0.4)) drop-shadow(0 0 24px rgba(167, 139, 250, 0.3)); }
        }
        @keyframes pc-chrome-shift {
          0%   { background-position: 0% 50%; }
          100% { background-position: 100% 50%; }
        }

        /* ── Personalization subhead (milestone / meme id / prime) ── */
        .pc-subhead {
          font-family: var(--font-terminal, ui-monospace, "SF Mono", monospace);
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.24em;
          text-transform: uppercase;
          color: rgba(255, 255, 255, 0.55);
          text-align: center;
          opacity: 0;
          animation: pc-subhead-in 500ms 1500ms ease-out forwards;
        }
        @keyframes pc-subhead-in {
          from { opacity: 0; transform: translateY(4px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        /* ── Tier subhead (phase γ — streak/tier flex) ── */
        .pc-tier-subhead {
          font-family: var(--font-terminal, ui-monospace, "SF Mono", monospace);
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.28em;
          text-transform: uppercase;
          color: rgba(167, 139, 250, 0.9);
          border: 1px solid rgba(167, 139, 250, 0.25);
          padding: 3px 10px;
          border-radius: 999px;
          background: rgba(167, 139, 250, 0.05);
          opacity: 0;
          animation: pc-subhead-in 500ms 1650ms ease-out forwards;
        }

        /* Secondary tier-accent particle canvas stacks above the main one */
        .pc-particles-canvas--tier {
          z-index: 4;
          mix-blend-mode: screen;
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
          font-family: var(--font-terminal, ui-monospace, "SF Mono", monospace);
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
          font-family: var(--font-terminal, ui-monospace, "SF Mono", monospace);
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
          font-family: var(--font-terminal, ui-monospace, "SF Mono", monospace);
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
           BEAT 4: PARTICLES (canvas)
           ══════════════════════════════════════════════════════════
           Single <canvas> covering the viewport; particleCanvas.ts drives
           the render loop. The old .pc-p / .pc-crystal / .pc-confetti /
           .pc-ring classes are gone — all their visuals live in the
           canvas 2D draw calls. */
        .pc-particles-canvas {
          position: fixed;
          inset: 0;
          width: 100%;
          height: 100%;
          pointer-events: none;
          z-index: 3;
        }

        /* ══════════════════════════════════════════════════════════════
           REDUCED MOTION
           ══════════════════════════════════════════════════════════ */
        @media (prefers-reduced-motion: reduce) {
          .pc-flash, .pc-particles-canvas, .pc-lightning, .pc-shockwave { display: none; }
          .pc-slab { animation: none; opacity: 1; }
          .pc-headline { animation: none; opacity: 1; -webkit-text-fill-color: #74ffeb; }
          .pc-subhead { animation: none; opacity: 1; }
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
