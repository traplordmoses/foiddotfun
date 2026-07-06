"use client";

import { useCallback, useEffect, useRef, useState, type MouseEvent, type PointerEvent as ReactPointerEvent } from "react";
import { useRouter } from "next/navigation";
import { getAudioSettings } from "@/lib/audioSettings";
import { BOOT_SESSION_KEY, hasEnteredRecently } from "@/lib/foidOsBoot";

const PARTICLE_COUNT = 20;

/*
 * FOID OS boot — /enter is the front door; every arrival boots the machine.
 *
 * Phases (data-boot on .enter-gate; visuals live in src/app/enter/enter.css):
 *   cover → sigil → sky → ready
 * Modes:
 *   full    first boot ever / cold visit          (~2.9s to interactive)
 *   fast    returning visitor                     (~0.9s) — booted this tab
 *           session (sessionStorage) OR entered within the cookie window
 *           (foid_entered, e.g. a fresh tab a few hours later)
 *   static  prefers-reduced-motion                (composed final frame, instant)
 * Override for debugging/QA: /enter?boot=full|fast|static
 *
 * Stage C: this boot IS the desktop's front door — the destination is the
 * shell, and finishing the boot sets BOOT_SESSION_KEY (lib/foidOsBoot) so
 * the desktop gate at / knows not to bounce back here (no double boot).
 *
 * The boot is skippable instantly (any key / click / tap) and shows no
 * numeric progress — the log lines fire when their stage actually starts,
 * so the story on screen is the real state of the reveal.
 */
type BootPhase = "cover" | "sigil" | "sky" | "ready";
type BootMode = "full" | "fast" | "static";
/* Timings below pair with the CSS durations in enter.css. */
const BOOT_LOG_LINES = [
  "waking foid mommy",
  "mounting permanent memory",
  "tuning the sky",
  "polishing the glass",
] as const;
const FAST_LOG_LINES = ["resuming session"] as const;
/* r=34 ring circumference for the draw-on animation. */
const BOOT_RING_CIRCUMFERENCE = 213.6;

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

  const [tiltX, setTiltX] = useState(0);
  const [tiltY, setTiltY] = useState(0);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const handlePointerMove = useCallback((e: globalThis.PointerEvent) => {
    const el = containerRef.current;
    if (!el || reducedMotion) return;
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = (e.clientX - cx) / (rect.width / 2);
    const dy = (e.clientY - cy) / (rect.height / 2);
    setTiltY(dx * 8);   // rotateY
    setTiltX(-dy * 6);  // rotateX
  }, [reducedMotion]);

  const handlePointerLeave = useCallback(() => {
    setTiltX(0);
    setTiltY(0);
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.addEventListener("pointermove", handlePointerMove);
    el.addEventListener("pointerleave", handlePointerLeave);
    return () => {
      el.removeEventListener("pointermove", handlePointerMove);
      el.removeEventListener("pointerleave", handlePointerLeave);
    };
  }, [handlePointerMove, handlePointerLeave]);

  /* ── FOID OS boot state ─────────────────────────────────────────────
     SSR renders the "cover" frame (dark screen) so the first paint is a
     machine that hasn't booted yet — never a flash of the finished page. */
  const [bootPhase, setBootPhase] = useState<BootPhase>("cover");
  const [bootMode, setBootMode] = useState<BootMode>("full");
  const [bootSkipped, setBootSkipped] = useState(false);
  const [logCount, setLogCount] = useState(0);
  const [outroActive, setOutroActive] = useState(false);
  const bootStartedRef = useRef(false);
  const bootReadyRef = useRef(false);
  /* When a key/click skips the boot, the same event would immediately
     activate the gate (both listeners see it). A short cooldown makes
     skip and enter two distinct gestures. */
  const bootSkipAtRef = useRef(0);

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

  /* Land the boot: final phase, remember this session, flush the log. */
  const finishBoot = useCallback(() => {
    if (bootReadyRef.current) return;
    bootReadyRef.current = true;
    setBootPhase("ready");
    setLogCount(BOOT_LOG_LINES.length);
    try {
      window.sessionStorage.setItem(BOOT_SESSION_KEY, "1");
    } catch {
      /* private mode — boot simply replays next visit */
    }
  }, []);

  /* Skip = jump cut to the composed end state. Never a different state,
     never slower than a frame. The skipped flag (which zeroes every boot
     transition) lifts shortly after, so the later login outro still
     animates normally. */
  const skipBoot = useCallback(() => {
    if (bootReadyRef.current) return;
    clearTimeouts();
    bootSkipAtRef.current = Date.now();
    setBootSkipped(true);
    finishBoot();
    schedule(() => setBootSkipped(false), 400);
  }, [clearTimeouts, finishBoot, schedule]);

  /* Boot timeline. All timeouts are scheduled up front (never chained) so
     background-tab timer throttling can only delay stages, not stack them.
     The log lines fire exactly when their stage begins — narrative
     progress, no invented percentages. */
  useEffect(() => {
    if (bootStartedRef.current) return;
    bootStartedRef.current = true;

    const params = new URLSearchParams(window.location.search);
    const override = params.get("boot");
    const prefersStatic = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let seenThisSession = false;
    try {
      seenThisSession = window.sessionStorage.getItem(BOOT_SESSION_KEY) === "1";
    } catch {
      seenThisSession = false;
    }
    /* Returning visitor = booted this tab session, or holds the entered
       cookie (a new tab inside the 24h window still resumes fast). */
    const returning = seenThisSession || hasEnteredRecently();

    const mode: BootMode =
      override === "static" || override === "fast" || override === "full"
        ? override
        : prefersStatic
          ? "static"
          : returning
            ? "fast"
            : "full";
    setBootMode(mode);

    if (mode === "static") {
      finishBoot();
      return;
    }

    if (mode === "fast") {
      /* Returning visitor: one breath — resume, bloom, key. (~0.9s) */
      schedule(() => setBootPhase("sigil"), 90);
      schedule(() => setLogCount(1), 210);
      schedule(() => setBootPhase("sky"), 500);
      schedule(finishBoot, 880);
      return;
    }

    /* First boot (~2.9s to interactive):
       dark → sigil draws → log ticks → sky blooms → key crystallizes. */
    schedule(() => setBootPhase("sigil"), 140);
    schedule(() => setLogCount(1), 640); //  waking foid mommy
    schedule(() => setLogCount(2), 980); //  mounting permanent memory
    schedule(() => setLogCount(3), 1320); // tuning the sky…
    schedule(() => setBootPhase("sky"), 1560); // …and the sky actually arrives
    schedule(() => setLogCount(4), 1720); // polishing the glass…
    schedule(finishBoot, 2260); //          …and the glass key crystallizes
  }, [finishBoot, schedule]);

  /* Any key or pointer during the theater skips it. Capture phase so the
     skip wins over every other handler; modifier combos stay untouched. */
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (bootReadyRef.current) return;
      if (event.metaKey || event.ctrlKey || event.altKey || event.key === "Tab") return;
      skipBoot();
    };
    const onPointerDown = () => {
      if (!bootReadyRef.current) skipBoot();
    };
    window.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("pointerdown", onPointerDown, true);
    return () => {
      window.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener("pointerdown", onPointerDown, true);
    };
  }, [skipBoot]);

  /* Login moment — the sky opens. The route is already prefetched, so no
     progress theater: chime, light bloom, "welcome home", go. */
  const runLoginOutro = useCallback(() => {
    if (reducedMotion) {
      schedule(() => navigate(), 230);
      return;
    }
    playBootChime();
    schedule(() => navigate(), 900);
  }, [navigate, playBootChime, reducedMotion, schedule]);

  const activateGate = useCallback(
    (event?: MouseEvent<HTMLButtonElement>) => {
      /* First gesture lands the boot; the next one enters. */
      if (!bootReadyRef.current) {
        skipBoot();
        return;
      }
      if (Date.now() - bootSkipAtRef.current < 450) return;
      if (outroActive || activationLocked.current) return;
      activationLocked.current = true;
      setOutroActive(true);
      if (onEnter) onEnter();
      if (event) createRipple(event);
      playClickSound();
      schedule(runLoginOutro, 120);
    },
    [createRipple, onEnter, outroActive, playClickSound, runLoginOutro, schedule, skipBoot]
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
    <div
      className="enter-gate"
      data-reduced-motion={reducedMotion ? "true" : "false"}
      data-boot={bootPhase}
      data-boot-mode={bootMode}
      data-boot-skipped={bootSkipped ? "true" : undefined}
      data-outro={outroActive ? "true" : undefined}
    >
      <div className="caustics" aria-hidden="true" />
      <div className="particles" ref={particlesRef} aria-hidden="true" />

      <div
        className="enter-container"
        ref={containerRef}
        style={{
          perspective: "600px",
        }}
      >
        <div
          className="enter-key-wrapper"
          style={{
            transform: `rotateX(${tiltX}deg) rotateY(${tiltY}deg)`,
            transition: tiltX === 0 && tiltY === 0 ? "transform 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)" : "transform 0.08s linear",
            transformStyle: "preserve-3d",
          }}
        >
          {/* Orbital particles */}
          <span className="orbital orbital--1" aria-hidden="true" />
          <span className="orbital orbital--2" aria-hidden="true" />
          <span className="orbital orbital--3" aria-hidden="true" />
          <span className="orbital orbital--4" aria-hidden="true" />
          <span className="orbital orbital--5" aria-hidden="true" />
          <span className="orbital orbital--6" aria-hidden="true" />

          {/* Depth shadow beneath key */}
          <span className="key-depth-shadow" aria-hidden="true" />

          <button
            type="button"
            className="enter-key"
            aria-label="Enter FOID Foundation"
            onClick={handleEnter}
            disabled={outroActive}
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
        </div>
        <span className="enter-label">FOID Foundation</span>
      </div>

      {/* ── FOID OS boot theater (visuals: src/app/enter/enter.css) ──
          The dark cover sits over the live wallpaper while it loads, so
          the ceremony costs zero time. Decorative throughout: the real
          button is in the page and enabled the whole way. */}
      <div className="boot-tint" aria-hidden="true" />
      <div className="boot-cover" aria-hidden="true" />
      <div className="boot-bloom" aria-hidden="true" />
      <div className="boot-core" aria-hidden="true">
        <div className="boot-sigil">
          <svg className="boot-sigil-svg" viewBox="0 0 96 96" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <radialGradient id="bootOrb" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="var(--foid-cyan)" stopOpacity="0.5" />
                <stop offset="55%" stopColor="var(--foid-cyan)" stopOpacity="0.16" />
                <stop offset="100%" stopColor="var(--foid-purple)" stopOpacity="0" />
              </radialGradient>
              <linearGradient id="bootRingGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="var(--foid-cyan)" />
                <stop offset="60%" stopColor="var(--foid-purple)" />
                <stop offset="100%" stopColor="var(--foid-pink)" />
              </linearGradient>
            </defs>
            <circle className="boot-orb" cx="48" cy="48" r="30" fill="url(#bootOrb)" />
            <circle
              className="boot-ring-orbit"
              cx="48"
              cy="48"
              r="43"
              fill="none"
              stroke="var(--foid-cyan)"
              strokeOpacity="0.22"
              strokeWidth="1"
              strokeDasharray="2 9"
              strokeLinecap="round"
            />
            <circle
              className="boot-ring-draw"
              cx="48"
              cy="48"
              r="34"
              fill="none"
              stroke="url(#bootRingGrad)"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeDasharray={BOOT_RING_CIRCUMFERENCE}
              strokeDashoffset={BOOT_RING_CIRCUMFERENCE}
              transform="rotate(-90 48 48)"
            />
          </svg>
          <div className="boot-wordmark">FOID OS</div>
          <div className="boot-tagline">the internet&apos;s permanent memory</div>
        </div>
        <div className="boot-log">
          {(bootMode === "fast" ? FAST_LOG_LINES : BOOT_LOG_LINES).map((line, index) => (
            <div key={line} className={`boot-line ${index < logCount ? "on" : ""}`}>
              <span className="boot-line-text">{line}</span>
              <span className="boot-line-dots" />
              <span className="boot-line-ok">ok</span>
            </div>
          ))}
        </div>
      </div>
      <div className="boot-skip-hint" aria-hidden="true">
        press any key to skip
      </div>

      {/* ── login flash — pressing enter opens the sky ── */}
      <div className="login-flash" aria-hidden="true">
        <span className="login-disc" />
        <div className="login-note">welcome home</div>
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
          /* Reveal is owned by the boot sequence (enter.css): the key
             crystallizes when data-boot flips to "ready". */
          opacity: 0;
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
          background:
            radial-gradient(
              ellipse at center,
              rgba(255, 228, 98, 0.12) 0%,
              rgba(255, 200, 60, 0.06) 35%,
              transparent 60%
            ),
            radial-gradient(
              ellipse at center,
              rgba(180, 220, 255, 0.08) 0%,
              rgba(140, 200, 250, 0.04) 45%,
              transparent 70%
            );
          border-radius: 30px;
          filter: blur(20px);
          opacity: 0.7;
          transition: opacity 0.3s ease;
          z-index: -1;
          pointer-events: none;
          animation: key-glow-breathe 4s ease-in-out infinite;
        }

        @keyframes key-glow-breathe {
          0%, 100% { opacity: 0.5; transform: scale(1); }
          50% { opacity: 0.85; transform: scale(1.08); }
        }

        .enter-key:hover .key-glow {
          opacity: 0.9;
        }

        /* 3D wrapper */
        .enter-key-wrapper {
          position: relative;
          display: flex;
          flex-direction: column;
          align-items: center;
        }

        /* Depth shadow beneath the key for 3D illusion */
        .key-depth-shadow {
          position: absolute;
          width: calc(280px * var(--enter-scale, 0.7));
          height: calc(40px * var(--enter-scale, 0.7));
          bottom: calc(-18px * var(--enter-scale, 0.7));
          left: 50%;
          transform: translateX(-50%) scaleY(0.4);
          background: radial-gradient(ellipse at center, rgba(0, 0, 0, 0.35) 0%, transparent 70%);
          border-radius: 50%;
          filter: blur(12px);
          pointer-events: none;
          animation: shadow-breathe 4s ease-in-out infinite;
        }

        @keyframes shadow-breathe {
          0%, 100% { opacity: 0.6; transform: translateX(-50%) scaleY(0.4) scaleX(1); }
          50% { opacity: 0.35; transform: translateX(-50%) scaleY(0.35) scaleX(0.95); }
        }

        /* Orbital particles */
        .orbital {
          position: absolute;
          width: 4px;
          height: 4px;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(255, 248, 180, 0.9) 0%, rgba(255, 228, 98, 0.5) 50%, transparent 70%);
          box-shadow: 0 0 6px rgba(255, 228, 98, 0.6), 0 0 12px rgba(255, 228, 98, 0.3);
          pointer-events: none;
          z-index: 5;
          animation: orbit var(--orbit-dur, 8s) linear infinite;
          --orbit-rx: 140px;
          --orbit-ry: 70px;
          top: calc(50% - 2px);
          left: calc(50% - 2px);
        }

        .orbital--1 { --orbit-dur: 7s;  animation-delay: 0s;    --orbit-rx: 130px; --orbit-ry: 65px; }
        .orbital--2 { --orbit-dur: 9s;  animation-delay: -1.5s; --orbit-rx: 145px; --orbit-ry: 72px; }
        .orbital--3 { --orbit-dur: 11s; animation-delay: -3s;   --orbit-rx: 155px; --orbit-ry: 78px; width: 3px; height: 3px; opacity: 0.7; }
        .orbital--4 { --orbit-dur: 8s;  animation-delay: -5s;   --orbit-rx: 135px; --orbit-ry: 68px; }
        .orbital--5 { --orbit-dur: 10s; animation-delay: -7s;   --orbit-rx: 150px; --orbit-ry: 75px; width: 3px; height: 3px; opacity: 0.6; }
        .orbital--6 { --orbit-dur: 12s; animation-delay: -4s;   --orbit-rx: 160px; --orbit-ry: 80px; width: 2px; height: 2px; opacity: 0.5; }

        .enter-key-wrapper:hover .orbital {
          animation-duration: calc(var(--orbit-dur, 8s) * 0.5);
        }

        @keyframes orbit {
          0%   { transform: translate(calc(var(--orbit-rx) * 1),    0); }
          25%  { transform: translate(0,    calc(var(--orbit-ry) * -1)); }
          50%  { transform: translate(calc(var(--orbit-rx) * -1),   0); }
          75%  { transform: translate(0,    calc(var(--orbit-ry) * 1));  }
          100% { transform: translate(calc(var(--orbit-rx) * 1),    0); }
        }

        .enter-label {
          font-size: 11px;
          letter-spacing: 4px;
          color: #ffe462;
          text-transform: uppercase;
          text-shadow: 0 0 12px rgba(255, 228, 98, 0.8);
          /* Revealed by the boot sequence (enter.css) on data-boot="ready". */
          opacity: 0;
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

        @keyframes gentleFloat {
          0%, 100% {
            transform: translateY(0) rotate(1deg);
          }
          50% {
            transform: translateY(-10px) rotate(0.5deg);
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

        .enter-gate[data-reduced-motion="true"] .orbital,
        .enter-gate[data-reduced-motion="true"] .key-depth-shadow {
          display: none;
        }

        .enter-gate[data-reduced-motion="true"] .key-glow {
          animation: none;
        }

        @media (max-width: 640px) {
          .enter-container {
            --enter-scale: 0.62;
          }
          .orbital {
            --orbit-rx: 95px;
            --orbit-ry: 48px;
          }
          .orbital--1 { --orbit-rx: 90px;  --orbit-ry: 45px; }
          .orbital--2 { --orbit-rx: 100px; --orbit-ry: 50px; }
          .orbital--3 { --orbit-rx: 105px; --orbit-ry: 53px; }
          .orbital--4 { --orbit-rx: 92px;  --orbit-ry: 46px; }
          .orbital--5 { --orbit-rx: 102px; --orbit-ry: 51px; }
          .orbital--6 { --orbit-rx: 108px; --orbit-ry: 54px; }
          .key-depth-shadow {
            width: calc(240px * var(--enter-scale));
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .enter-key,
          .caustics::before,
          .caustics::after,
          .particle,
          .orbital,
          .key-glow,
          .key-depth-shadow {
            animation: none;
          }
          .orbital { display: none; }
        }
      `}</style>
    </div>
  );
}
