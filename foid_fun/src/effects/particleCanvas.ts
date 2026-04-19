// src/effects/particleCanvas.ts
// Lightweight particle system for the celebration overlay.
//
// Why a canvas instead of 500 DOM elements?
//   The previous celebration spawned ~500 <i> elements each with their own
//   5s CSS animation driving `translate(var(--x), var(--y))`. At 60fps that's
//   ~30k style+paint events per second — enough to spike INP past 400ms on
//   the lower-end devices we care about (iPhone 12 mini class). Rendering all
//   of them into a single <canvas> collapses that into a single compositor
//   upload per frame.
//
// API:
//   startParticles(canvas, config) → stopFn
//   - Sizes the canvas to its container's DPR-scaled bounding box.
//   - Precomputes particle positions, velocities, colors, and shape kinds.
//   - Runs one requestAnimationFrame loop until the stop fn is called or
//     `config.durationMs` elapses. Stopping is idempotent.
//   - Honors prefers-reduced-motion by rendering a single static frame with
//     alpha=0.4 scattered positions (so the visual still reads "confetti!"
//     but nothing moves).
//
// Palette matches the existing FOID_COLORS array in PlacementCelebration.
"use client";

export type ParticleKind = "sparkle" | "star" | "crystal" | "confetti" | "ring";

export type ParticleCanvasConfig = {
  /** Total particle count. Spec target: ~200 (previously 500 DOM nodes). */
  count?: number;
  /** How long the burst runs before freezing (ms). Default 5500. */
  durationMs?: number;
  /** Brand palette. Defaults to the FOID eight-color cyan/purple/pink set. */
  colors?: string[];
  /**
   * Distribution across particle kinds. Values are relative weights — they
   * don't need to sum to 1.
   */
  weights?: Partial<Record<ParticleKind, number>>;
};

const DEFAULT_COLORS = [
  "#74ffeb", // cyan
  "#a78bfa", // purple
  "#fbbf24", // gold
  "#f472b6", // pink
  "#22c55e", // green
  "#06b6d4", // teal
  "#e879f9", // magenta
  "#ffffff", // white
];

const DEFAULT_WEIGHTS: Record<ParticleKind, number> = {
  sparkle: 0.40, // dots w/ soft glow — the bulk
  star: 0.20,    // 5-pt stars
  crystal: 0.18, // diamond shape
  confetti: 0.14, // rotated squares
  ring: 0.08,    // stroked circles
};

type Particle = {
  kind: ParticleKind;
  color: string;
  // Starting position in canvas pixels.
  x0: number;
  y0: number;
  // Target offset at t=1. Used with easing to compute x(t), y(t).
  dx: number;
  dy: number;
  /** Animation start delay (ms from burst-start). Staggers the explosion. */
  delay: number;
  /** Final scale at t=1. Rings grow 4×, dots grow 2.5×. */
  scaleEnd: number;
  /** Rotation at t=1 in radians. */
  rotEnd: number;
  /** Base size in canvas pixels. */
  size: number;
};

/** Weighted pick of a kind. `weights` must be a {kind: weight} map. */
function pickKind(weights: Record<ParticleKind, number>, rng: () => number): ParticleKind {
  const total = Object.values(weights).reduce((s, w) => s + w, 0);
  let r = rng() * total;
  for (const k of Object.keys(weights) as ParticleKind[]) {
    r -= weights[k];
    if (r <= 0) return k;
  }
  return "sparkle";
}

function makeParticles(
  count: number,
  width: number,
  height: number,
  colors: string[],
  weights: Record<ParticleKind, number>,
  rng: () => number = Math.random,
): Particle[] {
  const cx = width / 2;
  const cy = height / 2;
  const particles: Particle[] = [];
  // Travel reach = ~1.5x the screen diagonal so particles fly clean off-frame.
  const reach = Math.hypot(width, height) * 1.5;
  for (let i = 0; i < count; i++) {
    const kind = pickKind(weights, rng);
    const angle = rng() * Math.PI * 2;
    // Use a bias toward the outer half so particles don't cluster in the
    // middle. dist ~ sqrt(rand) for uniform area distribution.
    const dist = Math.sqrt(rng()) * reach;
    particles.push({
      kind,
      color: colors[Math.floor(rng() * colors.length)],
      x0: cx,
      y0: cy,
      dx: Math.cos(angle) * dist,
      dy: Math.sin(angle) * dist,
      delay: i * 18, // stagger ~18ms between particles — 200 * 18 = 3.6s spread
      scaleEnd: kind === "ring" ? 4 : 2.5,
      rotEnd: rng() * Math.PI * 6, // up to 3 full rotations
      size:
        kind === "crystal"
          ? 10
          : kind === "confetti"
            ? 6
            : kind === "ring"
              ? 11
              : 7, // sparkle/star
    });
  }
  return particles;
}

/**
 * Ease-out-quint — matches the existing `pc-burst` CSS keyframe shape
 * (mostly-linear outward with a soft tail).
 */
function ease(t: number): number {
  const clamped = Math.max(0, Math.min(1, t));
  return 1 - Math.pow(1 - clamped, 5);
}

function drawParticle(
  ctx: CanvasRenderingContext2D,
  p: Particle,
  t: number, // per-particle eased progress [0,1]
  dpr: number,
) {
  if (t <= 0) return;
  const x = p.x0 + p.dx * t;
  const y = p.y0 + p.dy * t;
  const scale = 0.4 + (p.scaleEnd - 0.4) * t;
  const rot = p.rotEnd * t;
  // Opacity: fade in fast, fade out slow.
  const alpha = t < 0.12 ? t / 0.12 : 1 - Math.pow((t - 0.12) / 0.88, 1.4);
  if (alpha <= 0.02) return;

  ctx.save();
  ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
  ctx.translate(x * dpr, y * dpr);
  ctx.rotate(rot);
  ctx.scale(scale * dpr, scale * dpr);
  ctx.fillStyle = p.color;
  ctx.strokeStyle = p.color;
  // Subtle glow — matches the box-shadow on the DOM particles.
  ctx.shadowColor = p.color;
  ctx.shadowBlur = 8;

  const s = p.size;
  switch (p.kind) {
    case "sparkle": {
      ctx.beginPath();
      ctx.arc(0, 0, s / 2, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case "star": {
      // 5-pt star matching the CSS clip-path in the old implementation.
      const spikes = 5;
      const outer = s * 0.7;
      const inner = s * 0.3;
      ctx.beginPath();
      for (let i = 0; i < spikes * 2; i++) {
        const r = i % 2 === 0 ? outer : inner;
        const a = (i * Math.PI) / spikes - Math.PI / 2;
        const px = Math.cos(a) * r;
        const py = Math.sin(a) * r;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      break;
    }
    case "crystal": {
      // Diamond: polygon(50% 0, 100% 35%, 80% 100%, 20% 100%, 0 35%)
      ctx.beginPath();
      ctx.moveTo(0, -s * 0.5);
      ctx.lineTo(s * 0.5, -s * 0.15);
      ctx.lineTo(s * 0.3, s * 0.5);
      ctx.lineTo(-s * 0.3, s * 0.5);
      ctx.lineTo(-s * 0.5, -s * 0.15);
      ctx.closePath();
      ctx.fill();
      break;
    }
    case "confetti": {
      // 6×6 square rotated — the rotation is already applied by ctx.rotate.
      ctx.fillRect(-s / 2, -s / 2, s, s);
      break;
    }
    case "ring": {
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, s / 2, 0, Math.PI * 2);
      ctx.stroke();
      break;
    }
  }
  ctx.restore();
}

export type StartParticlesReturn = () => void;

export function startParticles(
  canvas: HTMLCanvasElement,
  config: ParticleCanvasConfig = {},
): StartParticlesReturn {
  const count = config.count ?? 200;
  const durationMs = config.durationMs ?? 5500;
  const colors = config.colors ?? DEFAULT_COLORS;
  const weights = { ...DEFAULT_WEIGHTS, ...(config.weights ?? {}) };

  const container = canvas.parentElement ?? canvas;
  const dpr = typeof window !== "undefined" ? Math.min(window.devicePixelRatio || 1, 2) : 1;

  const sizeCanvas = () => {
    const rect = container.getBoundingClientRect();
    canvas.width = Math.max(1, Math.floor(rect.width * dpr));
    canvas.height = Math.max(1, Math.floor(rect.height * dpr));
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;
  };
  sizeCanvas();

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    // Safari with canvas disabled (rare) — silently no-op so the rest of
    // the celebration still renders.
    return () => {};
  }

  // Build the particle set against the current canvas CSS pixel size so the
  // reach calculation is correct regardless of DPR.
  const cssWidth = canvas.width / dpr;
  const cssHeight = canvas.height / dpr;
  const particles = makeParticles(count, cssWidth, cssHeight, colors, weights);

  const prefersReduced =
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

  let stopped = false;
  let rafId = 0;
  const startedAt = performance.now();

  const renderStatic = () => {
    // Reduced-motion path: draw particles once at mid-travel with faded alpha.
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const p of particles) {
      drawParticle(ctx, p, 0.45, dpr);
    }
  };

  if (prefersReduced) {
    renderStatic();
    return () => {
      stopped = true;
    };
  }

  const tick = (now: number) => {
    if (stopped) return;
    const elapsed = now - startedAt;
    if (elapsed >= durationMs + 200) {
      // Fade to clear and stop — durationMs + small tail covers the
      // longest-delayed particle.
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      stopped = true;
      return;
    }
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const p of particles) {
      const localT = ease((elapsed - p.delay) / durationMs);
      drawParticle(ctx, p, localT, dpr);
    }
    rafId = requestAnimationFrame(tick);
  };
  rafId = requestAnimationFrame(tick);

  // Resize observer — the celebration covers the full viewport, but if the
  // window rotates mid-celebration we want the canvas to keep pace.
  const ro =
    typeof ResizeObserver !== "undefined"
      ? new ResizeObserver(() => {
          if (stopped) return;
          sizeCanvas();
        })
      : null;
  ro?.observe(container);

  return () => {
    stopped = true;
    if (rafId) cancelAnimationFrame(rafId);
    ro?.disconnect();
  };
}
