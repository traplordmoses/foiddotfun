"use client";

import { useCallback, useEffect, useRef, useState, type MouseEvent } from "react";
import { useRouter } from "next/navigation";
import { getAudioSettings } from "@/lib/audioSettings";

const PARTICLE_COUNT = 20;
const BOOT_STEPS = [15, 35, 50, 72, 88, 100];

// Browser timers return numbers; avoid Node timer types leaking in via @types/node.
type TimeoutId = number;
type AudioContextWindow = Window & { webkitAudioContext?: typeof AudioContext };

type EnterGateProps = {
  destination?: string;
  navigationMode?: "push" | "replace";
  onEnter?: () => void;
  enableGlobalEnter?: boolean;
};

function usePrefersReducedMotion() {
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(mediaQuery.matches);
    update();

    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener("change", update);
      return () => mediaQuery.removeEventListener("change", update);
    }

    mediaQuery.addListener(update);
    return () => mediaQuery.removeListener(update);
  }, []);

  return reducedMotion;
}

export default function EnterGate({
  destination = "/",
  navigationMode = "push",
  onEnter,
  enableGlobalEnter = false,
}: EnterGateProps) {
  const router = useRouter();
  const reducedMotion = usePrefersReducedMotion();
  const particlesRef = useRef<HTMLDivElement | null>(null);
  const audioRef = useRef<AudioContext | null>(null);
  const timeoutsRef = useRef<TimeoutId[]>([]);
  const activationLocked = useRef(false);

  const [bootActive, setBootActive] = useState(false);
  const [bootText1, setBootText1] = useState(false);
  const [bootText2, setBootText2] = useState(false);
  const [bootProgressVisible, setBootProgressVisible] = useState(false);
  const [bootProgress, setBootProgress] = useState(0);

  const clearTimeouts = useCallback(() => {
    timeoutsRef.current.forEach((timeoutId) => window.clearTimeout(timeoutId));
    timeoutsRef.current = [];
  }, []);

  const schedule = useCallback(
    (fn: () => void, delay: number) => {
      const timeoutId = window.setTimeout(fn, delay);
      timeoutsRef.current.push(timeoutId);
    },
    []
  );

  useEffect(() => clearTimeouts, [clearTimeouts]);

  const initAudio = useCallback(() => {
    if (audioRef.current) return audioRef.current;
    const AudioContextCtor = window.AudioContext || (window as AudioContextWindow).webkitAudioContext;
    audioRef.current = new AudioContextCtor();
    return audioRef.current;
  }, []);

  useEffect(() => {
    router.prefetch(destination);
  }, [destination, router]);

  const playClickSound = useCallback(() => {
    if (!getAudioSettings().sfxEnabled) return;
    const ctx = initAudio();
    const now = ctx.currentTime;

    const clickOsc = ctx.createOscillator();
    const clickGain = ctx.createGain();
    clickOsc.type = "square";
    clickOsc.frequency.setValueAtTime(2500, now);
    clickOsc.frequency.exponentialRampToValueAtTime(800, now + 0.02);
    clickGain.gain.setValueAtTime(0.3, now);
    clickGain.gain.exponentialRampToValueAtTime(0.01, now + 0.05);
    clickOsc.connect(clickGain);
    clickGain.connect(ctx.destination);
    clickOsc.start(now);
    clickOsc.stop(now + 0.05);

    const thockOsc = ctx.createOscillator();
    const thockGain = ctx.createGain();
    thockOsc.type = "sine";
    thockOsc.frequency.setValueAtTime(150, now);
    thockOsc.frequency.exponentialRampToValueAtTime(80, now + 0.08);
    thockGain.gain.setValueAtTime(0.4, now);
    thockGain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
    thockOsc.connect(thockGain);
    thockGain.connect(ctx.destination);
    thockOsc.start(now);
    thockOsc.stop(now + 0.1);

    const bufferSize = ctx.sampleRate * 0.03;
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i += 1) {
      output[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
    }
    const noise = ctx.createBufferSource();
    const noiseGain = ctx.createGain();
    const noiseFilter = ctx.createBiquadFilter();
    noise.buffer = noiseBuffer;
    noiseFilter.type = "highpass";
    noiseFilter.frequency.value = 3000;
    noiseGain.gain.setValueAtTime(0.15, now);
    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(ctx.destination);
    noise.start(now);
  }, [initAudio]);

  const playBootChime = useCallback(() => {
    if (!getAudioSettings().sfxEnabled) return;
    const ctx = initAudio();
    const now = ctx.currentTime;
    const frequencies = [523.25, 659.25, 783.99, 1046.5];

    frequencies.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const startTime = now + i * 0.1;
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, startTime);
      gain.gain.linearRampToValueAtTime(0.15, startTime + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.8);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(startTime);
      osc.stop(startTime + 0.8);
    });

    const shimmerOsc = ctx.createOscillator();
    const shimmerGain = ctx.createGain();
    shimmerOsc.type = "triangle";
    shimmerOsc.frequency.value = 2093;
    shimmerGain.gain.setValueAtTime(0, now + 0.3);
    shimmerGain.gain.linearRampToValueAtTime(0.05, now + 0.4);
    shimmerGain.gain.exponentialRampToValueAtTime(0.001, now + 1.5);
    shimmerOsc.connect(shimmerGain);
    shimmerGain.connect(ctx.destination);
    shimmerOsc.start(now + 0.3);
    shimmerOsc.stop(now + 1.5);
  }, [initAudio]);

  const createRipple = useCallback((event: MouseEvent<HTMLButtonElement>) => {
    const element = event.currentTarget;
    const rect = element.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    const ripple = document.createElement("span");
    ripple.className = "ripple";

    const hasPointer = event.clientX !== 0 || event.clientY !== 0;
    const x = hasPointer ? event.clientX : rect.left + rect.width / 2;
    const y = hasPointer ? event.clientY : rect.top + rect.height / 2;

    ripple.style.width = `${size}px`;
    ripple.style.height = `${size}px`;
    ripple.style.left = `${x - rect.left - size / 2}px`;
    ripple.style.top = `${y - rect.top - size / 2}px`;

    element.appendChild(ripple);
    window.setTimeout(() => ripple.remove(), 600);
  }, []);

  const navigate = useCallback(() => {
    if (navigationMode === "replace") {
      router.replace(destination);
    } else {
      router.push(destination);
    }
  }, [destination, navigationMode, router]);

  const runBootSequence = useCallback(() => {
    if (bootActive) return;
    setBootActive(true);

    if (reducedMotion) {
      setBootText1(true);
      setBootText2(true);
      schedule(() => navigate(), 260);
      return;
    }

    schedule(() => setBootText1(true), 120);
    schedule(() => {
      playBootChime();
      setBootText2(true);
    }, 320);
    schedule(() => setBootProgressVisible(true), 420);

    let elapsed = 450;
    BOOT_STEPS.forEach((step, index) => {
      elapsed += 55 + index * 6;
      schedule(() => setBootProgress(step), elapsed);
    });

    schedule(() => navigate(), elapsed + 180);
  }, [bootActive, navigate, playBootChime, reducedMotion, schedule]);

  const activateGate = useCallback(
    (event?: MouseEvent<HTMLButtonElement>) => {
      if (bootActive || activationLocked.current) return;
      activationLocked.current = true;
      if (onEnter) onEnter();
      if (event) createRipple(event);
      playClickSound();
      schedule(runBootSequence, 150);
    },
    [bootActive, createRipple, onEnter, playClickSound, runBootSequence, schedule]
  );

  const handleEnter = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      activateGate(event);
    },
    [activateGate]
  );

  useEffect(() => {
    const container = particlesRef.current;
    if (!container) return;
    if (reducedMotion) return;

    const particles: HTMLSpanElement[] = [];

    for (let i = 0; i < PARTICLE_COUNT; i += 1) {
      const particle = document.createElement("span");
      particle.className = "particle";
      particle.style.left = `${Math.random() * 100}%`;
      particle.style.top = `${Math.random() * 100}%`;
      particle.style.animationDelay = `${Math.random() * 8}s`;
      particle.style.animationDuration = `${6 + Math.random() * 4}s`;
      container.appendChild(particle);
      particles.push(particle);
    }

    return () => {
      particles.forEach((particle) => particle.remove());
    };
  }, [reducedMotion]);

  useEffect(() => {
    if (!enableGlobalEnter) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Enter" || event.defaultPrevented) return;
      const target = event.target;
      if (target && target instanceof HTMLElement) {
        const tagName = target.tagName.toLowerCase();
        if (tagName === "input" || tagName === "textarea" || target.isContentEditable) {
          return;
        }
      }
      activateGate();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activateGate, enableGlobalEnter]);

  return (
    <div className="enter-gate" data-reduced-motion={reducedMotion ? "true" : "false"}>
      <div className="caustics" aria-hidden="true" />
      <div className="particles" ref={particlesRef} aria-hidden="true" />

      <div className="enter-container">
        <button
          type="button"
          className="enter-key"
          aria-label="Enter FOID Foundation"
          onClick={handleEnter}
          disabled={bootActive}
        >
          <span className="key-glow" aria-hidden="true" />
          <svg viewBox="0 0 488 202" xmlns="http://www.w3.org/2000/svg" role="img">
            <defs>
              <linearGradient id="glassBody" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#ffffff" stopOpacity="0.08" />
                <stop offset="50%" stopColor="#e0eef5" stopOpacity="0.05" />
                <stop offset="100%" stopColor="#c0dde8" stopOpacity="0.03" />
              </linearGradient>
              <linearGradient id="smokedGlassTop" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#FFF56C" stopOpacity="0.35" />
                <stop offset="40%" stopColor="#FFE044" stopOpacity="0.4" />
                <stop offset="100%" stopColor="#FFD123" stopOpacity="0.5" />
              </linearGradient>
              <linearGradient id="innerShadowBottom" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#000000" stopOpacity="0" />
                <stop offset="70%" stopColor="#000000" stopOpacity="0.08" />
                <stop offset="100%" stopColor="#000000" stopOpacity="0.18" />
              </linearGradient>
              <linearGradient id="innerShadowLeft" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#000000" stopOpacity="0.2" />
                <stop offset="30%" stopColor="#000000" stopOpacity="0.05" />
                <stop offset="100%" stopColor="#000000" stopOpacity="0" />
              </linearGradient>
              <linearGradient id="innerShadowRight" x1="100%" y1="0%" x2="0%" y2="0%">
                <stop offset="0%" stopColor="#000000" stopOpacity="0.15" />
                <stop offset="30%" stopColor="#000000" stopOpacity="0.03" />
                <stop offset="100%" stopColor="#000000" stopOpacity="0" />
              </linearGradient>
              <linearGradient id="leftEdge" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#ffffff" stopOpacity="0.9" />
                <stop offset="20%" stopColor="#f8fbfd" stopOpacity="0.7" />
                <stop offset="50%" stopColor="#e0eef5" stopOpacity="0.35" />
                <stop offset="80%" stopColor="#c0dae5" stopOpacity="0.12" />
                <stop offset="100%" stopColor="#a0c5d5" stopOpacity="0" />
              </linearGradient>
              <linearGradient id="rightEdge" x1="100%" y1="0%" x2="0%" y2="0%">
                <stop offset="0%" stopColor="#ffffff" stopOpacity="0.45" />
                <stop offset="30%" stopColor="#e8f2f8" stopOpacity="0.25" />
                <stop offset="60%" stopColor="#d0e5ee" stopOpacity="0.1" />
                <stop offset="100%" stopColor="#b0d0de" stopOpacity="0" />
              </linearGradient>
              <linearGradient id="topEdge" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#ffffff" stopOpacity="0.6" />
                <stop offset="35%" stopColor="#f0f7fa" stopOpacity="0.35" />
                <stop offset="70%" stopColor="#d8eaf2" stopOpacity="0.12" />
                <stop offset="100%" stopColor="#c0dce8" stopOpacity="0" />
              </linearGradient>
              <linearGradient id="bottomEdge" x1="0%" y1="100%" x2="0%" y2="0%">
                <stop offset="0%" stopColor="#ffffff" stopOpacity="0.4" />
                <stop offset="25%" stopColor="#f0f8fb" stopOpacity="0.25" />
                <stop offset="55%" stopColor="#dceef5" stopOpacity="0.1" />
                <stop offset="100%" stopColor="#c5e0eb" stopOpacity="0" />
              </linearGradient>
              <linearGradient id="innerCurveBottom" x1="50%" y1="100%" x2="50%" y2="0%">
                <stop offset="0%" stopColor="#ffffff" stopOpacity="0.45" />
                <stop offset="40%" stopColor="#f5fafc" stopOpacity="0.2" />
                <stop offset="100%" stopColor="#e5f2f8" stopOpacity="0" />
              </linearGradient>
              <linearGradient id="surfaceInnerHighlight" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#ffffff" stopOpacity="0.04" />
                <stop offset="30%" stopColor="#ffffff" stopOpacity="0.01" />
                <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
              </linearGradient>
              <radialGradient id="highlightSpot" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#ffffff" stopOpacity="1" />
                <stop offset="50%" stopColor="#ffffff" stopOpacity="0.55" />
                <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
              </radialGradient>
              <radialGradient id="highlightSecondary" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#ffffff" stopOpacity="0.65" />
                <stop offset="60%" stopColor="#ffffff" stopOpacity="0.2" />
                <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
              </radialGradient>
              <filter id="textGlow" x="-30%" y="-30%" width="160%" height="160%">
                <feGaussianBlur stdDeviation="1.2" result="glow" />
                <feMerge>
                  <feMergeNode in="glow" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
              <clipPath id="topPlateClip">
                <rect x="42" y="28" width="404" height="142" rx="14" ry="14" />
              </clipPath>
            </defs>

            <g transform="rotate(1, 244, 101)">
              <rect
                x="8"
                y="8"
                width="472"
                height="186"
                rx="22"
                ry="22"
                fill="url(#glassBody)"
                stroke="rgba(255,255,255,0.18)"
                strokeWidth="1"
              />

              <rect x="8" y="35" width="18" height="132" rx="9" fill="url(#leftEdge)" />
              <rect x="10" y="50" width="8" height="102" rx="4" fill="#ffffff" fillOpacity="0.85" />
              <rect x="20" y="60" width="5" height="82" rx="2.5" fill="#ffffff" fillOpacity="0.45" />

              <rect x="35" y="8" width="418" height="16" rx="8" fill="url(#topEdge)" />
              <rect x="50" y="10" width="180" height="4" rx="2" fill="#ffffff" fillOpacity="0.5" />

              <rect x="462" y="35" width="18" height="132" rx="9" fill="url(#rightEdge)" />
              <rect x="468" y="55" width="6" height="92" rx="3" fill="#ffffff" fillOpacity="0.35" />

              <rect x="35" y="178" width="418" height="16" rx="8" fill="url(#bottomEdge)" />
              <rect x="120" y="185" width="248" height="4" rx="2" fill="#ffffff" fillOpacity="0.35" />

              <rect x="30" y="45" width="10" height="112" rx="5" fill="#ffffff" fillOpacity="0.65" />
              <rect x="448" y="50" width="8" height="102" rx="4" fill="#ffffff" fillOpacity="0.4" />
              <rect x="50" y="165" width="388" height="10" rx="5" fill="url(#innerCurveBottom)" />
              <rect x="140" y="167" width="208" height="4" rx="2" fill="#ffffff" fillOpacity="0.3" />

              <rect
                x="42"
                y="28"
                width="404"
                height="142"
                rx="14"
                ry="14"
                fill="url(#smokedGlassTop)"
              />

              <g clipPath="url(#topPlateClip)">
                <rect x="42" y="120" width="404" height="50" fill="url(#innerShadowBottom)" />
                <rect x="42" y="28" width="40" height="142" fill="url(#innerShadowLeft)" />
                <rect x="406" y="28" width="40" height="142" fill="url(#innerShadowRight)" />
                <rect x="42" y="28" width="404" height="50" fill="url(#surfaceInnerHighlight)" />
              </g>

              <rect
                x="42"
                y="28"
                width="404"
                height="142"
                rx="14"
                ry="14"
                fill="none"
                stroke="#000000"
                strokeOpacity="0.08"
                strokeWidth="1"
              />
              <rect
                x="43"
                y="29"
                width="402"
                height="140"
                rx="13"
                ry="13"
                fill="none"
                stroke="#ffffff"
                strokeOpacity="0.05"
                strokeWidth="1"
              />

              <ellipse cx="18" cy="28" rx="7" ry="6" fill="url(#highlightSpot)" />
              <ellipse cx="27" cy="48" rx="4" ry="3.5" fill="url(#highlightSecondary)" />
              <circle cx="34" cy="18" r="2.5" fill="#ffffff" fillOpacity="0.45" />

              <text
                x="185"
                y="102"
                fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif"
                fontSize="28"
                fontWeight="400"
                fill="#fff9d2"
                fillOpacity="0.95"
                stroke="rgba(0, 0, 0, 0.35)"
                strokeWidth="0.5"
                textAnchor="middle"
                dominantBaseline="middle"
                filter="url(#textGlow)"
              >
                ↵
              </text>
              <text
                x="280"
                y="102"
                fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif"
                fontSize="28"
                fontWeight="400"
                letterSpacing="0.5"
                fill="#fff9d2"
                fillOpacity="0.95"
                stroke="rgba(0, 0, 0, 0.35)"
                strokeWidth="0.5"
                textAnchor="middle"
                dominantBaseline="middle"
                filter="url(#textGlow)"
              >
                enter
              </text>
            </g>
          </svg>
        </button>
        <span className="enter-label">FOID Foundation</span>
      </div>

      <div className={`boot-overlay ${bootActive ? "active" : ""}`}>
        <div className="scanlines" aria-hidden="true" />
        <div className="boot-logo" aria-hidden="true">
          <svg viewBox="0 0 120 120" className="boot-logo-svg">
            <defs>
              <radialGradient id="bootGlow" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#00ffd5" stopOpacity="0.6" />
                <stop offset="70%" stopColor="#00bfff" stopOpacity="0.2" />
                <stop offset="100%" stopColor="#0066ff" stopOpacity="0" />
              </radialGradient>
            </defs>
            <circle cx="60" cy="60" r="50" fill="url(#bootGlow)" className="boot-glow-circle" />
            <circle cx="60" cy="60" r="35" fill="none" stroke="#00ffd5" strokeWidth="2" strokeOpacity="0.6" className="boot-ring" />
          </svg>
        </div>
        <div className={`boot-text boot-text--title ${bootText1 ? "show" : ""}`}>FOID FOUNDATION</div>
        <div className={`boot-text ${bootText2 ? "show" : ""}`} style={{ marginTop: 8 }}>
          establishing connection...
        </div>
        <div className={`boot-progress ${bootProgressVisible ? "show" : ""}`}>
          <div className="boot-progress-bar" style={{ width: `${bootProgress}%` }} />
        </div>
        <div className={`boot-text boot-text--welcome ${bootProgress >= 100 ? "show" : ""}`}>
          welcome home
        </div>
      </div>

      <style jsx global>{`
        .enter-gate {
          position: fixed;
          inset: 0;
          z-index: 40;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
          font-family: var(--font-display, "Orbitron", sans-serif);
          color: rgba(200, 230, 255, 0.7);
        }

        .enter-gate * {
          box-sizing: border-box;
        }

        .caustics {
          position: fixed;
          inset: 0;
          pointer-events: none;
          z-index: 0;
        }

        .caustics::before,
        .caustics::after {
          content: "";
          position: absolute;
          width: 200%;
          height: 200%;
          top: -50%;
          left: -50%;
          background:
            radial-gradient(ellipse at 20% 30%, rgba(100, 200, 255, 0.15) 0%, transparent 50%),
            radial-gradient(ellipse at 80% 70%, rgba(150, 220, 255, 0.12) 0%, transparent 45%),
            radial-gradient(ellipse at 50% 50%, rgba(80, 180, 220, 0.1) 0%, transparent 60%);
          animation: causticMove1 12s ease-in-out infinite;
        }

        .caustics::after {
          background:
            radial-gradient(ellipse at 70% 20%, rgba(100, 220, 255, 0.12) 0%, transparent 45%),
            radial-gradient(ellipse at 25% 60%, rgba(80, 200, 240, 0.1) 0%, transparent 50%);
          animation: causticMove2 15s ease-in-out infinite;
        }

        .particles {
          position: fixed;
          width: 100%;
          height: 100%;
          pointer-events: none;
          z-index: 1;
        }

        .particle {
          position: absolute;
          width: 4px;
          height: 4px;
          background: radial-gradient(circle, rgba(255, 255, 255, 0.8) 0%, rgba(150, 220, 255, 0.4) 50%, transparent 70%);
          border-radius: 50%;
          animation: particleFloat 8s ease-in-out infinite;
        }

        .enter-container {
          --enter-scale: 0.7;
          position: relative;
          z-index: 10;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 28px;
          opacity: 0;
          animation: fadeInContainer 1.5s ease-out 0.5s forwards;
        }

        .enter-key {
          position: relative;
          width: calc(320px * var(--enter-scale));
          height: calc(133px * var(--enter-scale));
          cursor: pointer;
          border: none;
          padding: 0;
          background: transparent;
          animation: gentleFloat 4s ease-in-out infinite;
          transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), filter 0.3s ease;
          filter: drop-shadow(0 15px 35px rgba(0, 0, 0, 0.4));
        }

        .enter-key:hover {
          animation-play-state: paused;
          transform: translateY(-8px) rotate(0deg) scale(1.03);
          filter: drop-shadow(0 20px 45px rgba(0, 0, 0, 0.5));
        }

        .enter-key:active {
          transform: translateY(2px) rotate(1.5deg) scale(0.98);
          transition: transform 0.1s ease-out;
        }

        .enter-key:focus-visible {
          outline: 2px solid rgba(120, 200, 255, 0.6);
          outline-offset: 6px;
          border-radius: 24px;
        }

        .enter-key svg {
          width: 100%;
          height: 100%;
        }

        .key-glow {
          position: absolute;
          width: calc(360px * var(--enter-scale));
          height: calc(180px * var(--enter-scale));
          top: calc(-23px * var(--enter-scale));
          left: calc(-20px * var(--enter-scale));
          background: radial-gradient(
            ellipse at center,
            rgba(180, 220, 255, 0.1) 0%,
            rgba(140, 200, 250, 0.05) 40%,
            transparent 70%
          );
          border-radius: 30px;
          filter: blur(20px);
          opacity: 0.7;
          transition: opacity 0.3s ease;
          z-index: -1;
          pointer-events: none;
        }

        .enter-key:hover .key-glow {
          opacity: 0.9;
        }

        .enter-label {
          font-size: 11px;
          letter-spacing: 4px;
          color: #ffe462;
          text-transform: uppercase;
          text-shadow: 0 0 12px rgba(255, 228, 98, 0.8);
          opacity: 0;
          animation: labelFadeIn 1s ease-out 1.5s forwards;
        }

        .boot-overlay {
          position: fixed;
          inset: 0;
          background: #000;
          z-index: 1000;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          opacity: 0;
          pointer-events: none;
          transition: opacity 0.5s ease;
        }

        .boot-overlay.active {
          opacity: 1;
          pointer-events: all;
        }

        .boot-logo {
          position: relative;
          width: 120px;
          height: 120px;
          margin-bottom: 32px;
        }

        .boot-logo-svg {
          width: 100%;
          height: 100%;
        }

        .boot-glow-circle {
          animation: bootGlowPulse 2s ease-in-out infinite;
        }

        .boot-ring {
          animation: bootRingSpin 3s linear infinite;
          transform-origin: center;
        }

        .boot-text {
          font-family: var(--font-display, "Orbitron", sans-serif);
          font-size: 12px;
          color: rgba(0, 255, 213, 0.7);
          text-transform: lowercase;
          letter-spacing: 4px;
          opacity: 0;
        }

        .boot-text--title {
          font-size: 18px;
          font-weight: 600;
          letter-spacing: 8px;
          color: #00ffd5;
          text-transform: uppercase;
          text-shadow: 0 0 30px rgba(0, 255, 213, 0.5);
        }

        .boot-text--welcome {
          margin-top: 24px;
          font-size: 14px;
          color: rgba(255, 255, 255, 0.9);
          letter-spacing: 6px;
          text-shadow: 0 0 20px rgba(255, 255, 255, 0.4);
        }

        .boot-text.show {
          animation: bootTextReveal 0.5s ease forwards;
        }

        .boot-progress {
          width: 200px;
          height: 2px;
          background: rgba(100, 200, 255, 0.2);
          margin-top: 30px;
          border-radius: 1px;
          overflow: hidden;
          opacity: 0;
        }

        .boot-progress.show {
          opacity: 1;
        }

        .boot-progress-bar {
          width: 0%;
          height: 100%;
          background: linear-gradient(90deg, #4ae, #8df);
          box-shadow: 0 0 10px #4ae;
          transition: width 0.1s ease;
        }

        .scanlines {
          position: absolute;
          width: 100%;
          height: 100%;
          background: repeating-linear-gradient(
            0deg,
            transparent,
            transparent 2px,
            rgba(0, 0, 0, 0.1) 2px,
            rgba(0, 0, 0, 0.1) 4px
          );
          pointer-events: none;
          opacity: 0.3;
        }

        .ripple {
          position: absolute;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(150, 220, 255, 0.6) 0%, transparent 70%);
          transform: scale(0);
          animation: rippleEffect 0.6s ease-out forwards;
          pointer-events: none;
        }

        @keyframes causticMove1 {
          0%, 100% {
            transform: translate(0, 0) rotate(0deg) scale(1);
          }
          33% {
            transform: translate(3%, 2%) rotate(2deg) scale(1.02);
          }
          66% {
            transform: translate(-2%, 3%) rotate(-1deg) scale(0.98);
          }
        }

        @keyframes causticMove2 {
          0%, 100% {
            transform: translate(0, 0) rotate(0deg) scale(1);
          }
          33% {
            transform: translate(-4%, 3%) rotate(-2deg) scale(1.03);
          }
          66% {
            transform: translate(2%, -2%) rotate(1deg) scale(0.97);
          }
        }

        @keyframes particleFloat {
          0%, 100% {
            transform: translateY(0) translateX(0);
            opacity: 0.3;
          }
          50% {
            transform: translateY(-30px) translateX(10px);
            opacity: 0.8;
          }
        }

        @keyframes fadeInContainer {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes gentleFloat {
          0%, 100% {
            transform: translateY(0) rotate(1deg);
          }
          50% {
            transform: translateY(-10px) rotate(0.5deg);
          }
        }

        @keyframes labelFadeIn {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes bootTextReveal {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes bootGlowPulse {
          0%, 100% {
            opacity: 0.6;
            transform: scale(1);
          }
          50% {
            opacity: 1;
            transform: scale(1.1);
          }
        }

        @keyframes bootRingSpin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }

        @keyframes rippleEffect {
          to {
            transform: scale(4);
            opacity: 0;
          }
        }

        .enter-gate[data-reduced-motion="true"] .enter-container,
        .enter-gate[data-reduced-motion="true"] .enter-label {
          animation: none;
          opacity: 1;
          transform: none;
        }

        .enter-gate[data-reduced-motion="true"] .enter-key,
        .enter-gate[data-reduced-motion="true"] .particle,
        .enter-gate[data-reduced-motion="true"] .caustics::before,
        .enter-gate[data-reduced-motion="true"] .caustics::after {
          animation: none;
        }

        .enter-gate[data-reduced-motion="true"] .boot-text.show {
          animation: none;
          opacity: 1;
          transform: none;
        }

        @media (max-width: 640px) {
          .enter-container {
            --enter-scale: 0.62;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .enter-key,
          .caustics::before,
          .caustics::after,
          .particle {
            animation: none;
          }
        }
      `}</style>
    </div>
  );
}
