// ============================================================================
// Paint Filters — non-destructive ImageData -> ImageData transforms.
//
// Each function takes a source ImageData and returns a NEW ImageData so the
// caller can always re-apply from the original (stored once on canvas init).
// All pixel work happens directly on the underlying Uint8ClampedArray —
// clamping is free because of the clamped array type.
//
// Target: < 16 ms for a 1000×1000 image on a mid-tier phone.
// ============================================================================

export type FilterId = "static" | "vhs" | "holyGlow" | "mommyPink" | "deepFried";

export interface FilterSpec {
  id: FilterId;
  label: string;
}

export const FILTERS: FilterSpec[] = [
  { id: "static", label: "STATIC" },
  { id: "vhs", label: "VHS" },
  { id: "holyGlow", label: "HOLY GLOW" },
  { id: "mommyPink", label: "MOMMY PINK" },
  { id: "deepFried", label: "DEEP FRIED" },
];

// ============================================================================
// STATIC — grainy luminance noise
// ============================================================================

export function applyStatic(src: ImageData, intensity = 36): ImageData {
  const w = src.width;
  const h = src.height;
  const s = src.data;
  const dst = new ImageData(w, h);
  const d = dst.data;
  const n = s.length;
  // Single Math.random per pixel; same noise across RGB to read as luminance grain
  for (let i = 0; i < n; i += 4) {
    const noise = (Math.random() - 0.5) * intensity;
    d[i] = s[i] + noise;
    d[i + 1] = s[i + 1] + noise;
    d[i + 2] = s[i + 2] + noise;
    d[i + 3] = s[i + 3];
  }
  return dst;
}

// ============================================================================
// VHS — horizontal RGB split + soft scanlines
// ============================================================================

export function applyVHS(src: ImageData): ImageData {
  const w = src.width;
  const h = src.height;
  const s = src.data;
  const dst = new ImageData(w, h);
  const d = dst.data;
  const shift = Math.max(2, Math.round(w * 0.006)); // ~6px on 1000px wide
  for (let y = 0; y < h; y++) {
    const rowStart = y * w * 4;
    // Alternate scanline darkening — every other row dims to 0.82
    const scan = (y & 1) === 0 ? 1.0 : 0.82;
    for (let x = 0; x < w; x++) {
      const i = rowStart + (x << 2);
      const rx = x - shift < 0 ? 0 : x - shift;
      const bx = x + shift >= w ? w - 1 : x + shift;
      const rI = rowStart + (rx << 2);
      const bI = rowStart + (bx << 2);
      // R pulled from left, B pulled from right, G as-is
      d[i] = s[rI] * scan;
      d[i + 1] = s[i + 1] * scan;
      d[i + 2] = s[bI + 2] * scan;
      d[i + 3] = s[i + 3];
    }
  }
  return dst;
}

// ============================================================================
// HOLY GLOW — +20% brightness with warm radial vignette bloom at centre
// ============================================================================

export function applyHolyGlow(src: ImageData): ImageData {
  const w = src.width;
  const h = src.height;
  const s = src.data;
  const dst = new ImageData(w, h);
  const d = dst.data;
  const cx = w * 0.5;
  const cy = h * 0.5;
  const invMax = 1 / Math.hypot(cx, cy);
  // Pre-compute per-row to halve Math.hypot calls
  for (let y = 0; y < h; y++) {
    const dy = y - cy;
    const dy2 = dy * dy;
    const rowStart = y * w * 4;
    for (let x = 0; x < w; x++) {
      const i = rowStart + (x << 2);
      const dx = x - cx;
      const dist = Math.sqrt(dx * dx + dy2);
      // t: 1 at centre, 0 at corners
      const t = 1 - dist * invMax;
      const warmth = t * t * 40; // quadratic falloff for halo shape
      d[i] = s[i] * 1.2 + warmth;
      d[i + 1] = s[i + 1] * 1.2 + warmth * 0.7;
      d[i + 2] = s[i + 2] * 1.2 + warmth * 0.2;
      d[i + 3] = s[i + 3];
    }
  }
  return dst;
}

// ============================================================================
// MOMMY PINK — pink tint overlay blended toward #f06292
// ============================================================================

export function applyMommyPink(src: ImageData, tint = 0.38): ImageData {
  const w = src.width;
  const h = src.height;
  const s = src.data;
  const dst = new ImageData(w, h);
  const d = dst.data;
  const n = s.length;
  const inv = 1 - tint;
  const tR = 240 * tint; // #f06292
  const tG = 98 * tint;
  const tB = 146 * tint;
  for (let i = 0; i < n; i += 4) {
    d[i] = s[i] * inv + tR;
    d[i + 1] = s[i + 1] * inv + tG;
    d[i + 2] = s[i + 2] * inv + tB;
    d[i + 3] = s[i + 3];
  }
  return dst;
}

// ============================================================================
// DEEP FRIED — cranked brightness/contrast/saturation + noise + JPEG blockiness
// ============================================================================
// Three-pass effect:
//  1. Per-pixel brightness × contrast × saturation (HSL-ish via luma-weighted mix).
//  2. Per-pixel salt-and-pepper noise so the grain reads as compression artifact.
//  3. A cheap JPEG-artifact fake: downscale to ~1/6 then upscale, pasted back at
//     low alpha so edges blockify without obliterating the detail pass above.
//
// Numbers tuned to match the "my phone has been through three group chats and a
// Facebook repost" look: brightness 1.3, contrast 1.6, saturation 2.2.

export function applyDeepFried(src: ImageData): ImageData {
  const w = src.width;
  const h = src.height;
  const s = src.data;
  const dst = new ImageData(w, h);
  const d = dst.data;
  const n = s.length;

  const brightness = 1.3;
  const contrast = 1.6;
  const saturation = 2.2;
  const noise = 38;

  for (let i = 0; i < n; i += 4) {
    let r = s[i];
    let g = s[i + 1];
    let b = s[i + 2];

    // Brightness: linear gain.
    r *= brightness;
    g *= brightness;
    b *= brightness;

    // Contrast around 128.
    r = (r - 128) * contrast + 128;
    g = (g - 128) * contrast + 128;
    b = (b - 128) * contrast + 128;

    // Saturation: mix toward luma by (1 - sat).
    const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    r = luma + (r - luma) * saturation;
    g = luma + (g - luma) * saturation;
    b = luma + (b - luma) * saturation;

    // Salt-and-pepper noise — one sample per pixel, applied to all channels.
    const np = (Math.random() - 0.5) * noise;
    d[i] = r + np;
    d[i + 1] = g + np;
    d[i + 2] = b + np;
    d[i + 3] = s[i + 3];
  }

  // Cheap JPEG-artifact pass: downscale then upscale with nearest-ish interpolation.
  // We only run it in the browser — the SSR path has no OffscreenCanvas / document,
  // and applyFilter is client-only anyway (ImageData comes off a real canvas).
  if (typeof document !== "undefined") {
    const scaleDown = 6;
    const dw = Math.max(1, Math.floor(w / scaleDown));
    const dh = Math.max(1, Math.floor(h / scaleDown));
    const src2 = document.createElement("canvas");
    src2.width = w;
    src2.height = h;
    const sctx = src2.getContext("2d");
    const small = document.createElement("canvas");
    small.width = dw;
    small.height = dh;
    const smctx = small.getContext("2d");
    const out = document.createElement("canvas");
    out.width = w;
    out.height = h;
    const octx = out.getContext("2d");
    if (sctx && smctx && octx) {
      sctx.putImageData(dst, 0, 0);
      smctx.imageSmoothingEnabled = false;
      smctx.drawImage(src2, 0, 0, dw, dh);
      octx.imageSmoothingEnabled = false;
      octx.drawImage(small, 0, 0, w, h);
      // Composite the blocky layer at partial alpha over the color pass.
      sctx.globalAlpha = 0.4;
      sctx.drawImage(out, 0, 0);
      return sctx.getImageData(0, 0, w, h);
    }
  }

  return dst;
}

// ============================================================================
// Entry point: pick a filter by id
// ============================================================================

export function applyFilter(id: FilterId, src: ImageData): ImageData {
  switch (id) {
    case "static":
      return applyStatic(src);
    case "vhs":
      return applyVHS(src);
    case "holyGlow":
      return applyHolyGlow(src);
    case "mommyPink":
      return applyMommyPink(src);
    case "deepFried":
      return applyDeepFried(src);
  }
}
