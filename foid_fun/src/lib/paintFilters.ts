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

export type FilterId = "static" | "vhs" | "holyGlow" | "mommyPink";

export interface FilterSpec {
  id: FilterId;
  label: string;
}

export const FILTERS: FilterSpec[] = [
  { id: "static", label: "STATIC" },
  { id: "vhs", label: "VHS" },
  { id: "holyGlow", label: "HOLY GLOW" },
  { id: "mommyPink", label: "MOMMY PINK" },
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
  }
}
