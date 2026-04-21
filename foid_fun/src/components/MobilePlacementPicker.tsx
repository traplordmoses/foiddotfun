"use client";

import React, {
  useRef,
  useState,
  useMemo,
  useCallback,
  useEffect,
  useLayoutEffect,
} from "react";
import { createPortal } from "react-dom";
import { TILE, snap, hasOverlap, isTouching, type Rect } from "@/lib/grid";
import { getBoundsFromRects } from "@/lib/boardCoordinates";
import { clampWorldRect } from "@/lib/boardSpace";
import { MAX_CELLS_PER_RECT, capRectToMaxCells } from "@/lib/boardImages";
import { cidToHttpUrl } from "@/lib/ipfsUrl";
import { useHaptic } from "@/hooks/useHaptic";

export type PlacedItem = Rect & { cid?: string };

// ============================================================================
// RESIZE HANDLE TYPES & CONFIG  (Phase 3 · Step 10 — bumped to 24 px)
// ============================================================================

type ResizeHandle = "tl" | "tc" | "tr" | "ml" | "mr" | "bl" | "bc" | "br";

interface HandleConfig {
  id: ResizeHandle;
  /** Position as fraction of (vw, vh) from (vx, vy) */
  fx: number;
  fy: number;
  cursor: string;
  /** Whether this is an edge midpoint (hidden when rect is small) */
  edge: boolean;
  /** Visual shape: 'square' for corners, 'hbar' for top/bottom, 'vbar' for left/right */
  shape: "square" | "hbar" | "vbar";
}

const HANDLE_CONFIGS: HandleConfig[] = [
  { id: "tl", fx: 0, fy: 0, cursor: "nwse-resize", edge: false, shape: "square" },
  { id: "tc", fx: 0.5, fy: 0, cursor: "ns-resize", edge: true, shape: "hbar" },
  { id: "tr", fx: 1, fy: 0, cursor: "nesw-resize", edge: false, shape: "square" },
  { id: "ml", fx: 0, fy: 0.5, cursor: "ew-resize", edge: true, shape: "vbar" },
  { id: "mr", fx: 1, fy: 0.5, cursor: "ew-resize", edge: true, shape: "vbar" },
  { id: "bl", fx: 0, fy: 1, cursor: "nesw-resize", edge: false, shape: "square" },
  { id: "bc", fx: 0.5, fy: 1, cursor: "ns-resize", edge: true, shape: "hbar" },
  { id: "br", fx: 1, fy: 1, cursor: "nwse-resize", edge: false, shape: "square" },
];

/** Get the anchor point (the opposite corner/edge that stays fixed) */
function getAnchor(handle: ResizeHandle, r: Rect): { x: number; y: number } {
  switch (handle) {
    case "tl": return { x: r.x + r.w, y: r.y + r.h };
    case "tc": return { x: r.x, y: r.y + r.h };
    case "tr": return { x: r.x, y: r.y + r.h };
    case "ml": return { x: r.x + r.w, y: r.y };
    case "mr": return { x: r.x, y: r.y };
    case "bl": return { x: r.x + r.w, y: r.y };
    case "bc": return { x: r.x, y: r.y };
    case "br": return { x: r.x, y: r.y };
  }
}

function getHandleAxes(handle: ResizeHandle): { affectsW: boolean; affectsH: boolean } {
  switch (handle) {
    case "tc": case "bc": return { affectsW: false, affectsH: true };
    case "ml": case "mr": return { affectsW: true, affectsH: false };
    default: return { affectsW: true, affectsH: true };
  }
}

function getDeltaSigns(handle: ResizeHandle): { sx: number; sy: number } {
  const sx = handle.includes("l") ? -1 : handle.includes("r") ? 1 : 0;
  const sy = handle.startsWith("t") ? -1 : handle.startsWith("b") ? 1 : 0;
  return { sx, sy };
}

// Phase 3 · Step 10: 24 px touch targets, bumped from 14. These now meet
// Apple HIG / Material minimums for accessibility.
const CORNER_SIZE = 24;
const EDGE_W = 28;
const EDGE_H = 16;
const HIT_PAD = 10;

function getHandleDims(shape: "square" | "hbar" | "vbar") {
  switch (shape) {
    case "square": return { w: CORNER_SIZE, h: CORNER_SIZE };
    case "hbar": return { w: EDGE_W, h: EDGE_H };
    case "vbar": return { w: EDGE_H, h: EDGE_W };
  }
}

// ============================================================================
// LAYOUT / GESTURE CONSTANTS
// ============================================================================

const VIEW_H = 340;              // Phase 3 · Step 8 — minimap height (width flexes)
const PAD_TILES = 3;
const PRESETS = [1, 2, 3, 4];

// Phase 3 · Step 11 — tile-scale slider range
const SCALE_MIN = 1;
const SCALE_MAX = 10;

// Phase 3 · Step 9 — floating ghost preview offset above the finger
const GHOST_OFFSET_Y = 90;
const GHOST_SIZE = 112;

// Phase 3 · Step 8 — minimap zoom limits (user zoom within the minimap)
const MINIMAP_MIN_ZOOM = 0.5;
const MINIMAP_MAX_ZOOM = 4;

// Phase 3 · Step 10 — double-tap window (ms)
const DOUBLE_TAP_MS = 280;

// Phase 3 · Step 11 — validation colors for the halo. Base triples so we can
// compose alpha variants cheaply without brittle string rewriting.
const VALID_RGB = "72,255,171";
const WARNING_RGB = "255,180,0";
const INVALID_RGB = "255,71,87";
const VALID_COLOR = `rgba(${VALID_RGB},0.9)`;
const WARNING_COLOR = `rgba(${WARNING_RGB},0.9)`;
const INVALID_COLOR = `rgba(${INVALID_RGB},0.9)`;
/** Return the same hue as one of the halo colors at a different alpha. */
function haloTone(rgb: string, alpha: number): string {
  return `rgba(${rgb},${alpha})`;
}

// ============================================================================
// COMPONENT
// ============================================================================

interface MobilePlacementPickerProps {
  previewUrl: string;
  rect: Rect;
  imageAspectRatio?: number;
  placedRects: PlacedItem[];
  pendingRects?: Rect[];
  onRectChange: (r: Rect) => void;
  onConfirm: () => void;
  onBack: () => void;
}

type GestureState =
  | { kind: "idle" }
  | {
      kind: "drag-candidate";
      pointerId: number;
      startClient: { x: number; y: number };
      startRect: Rect;
      lastSnap: { x: number; y: number };
    }
  | {
      kind: "resize-handle";
      pointerId: number;
      handle: ResizeHandle;
      startClient: { x: number; y: number };
      startRect: Rect;
    }
  | {
      kind: "pan-minimap";
      pointerId: number;
      startClient: { x: number; y: number };
      startPan: { x: number; y: number };
    }
  | {
      kind: "pinch-minimap";
      pointerA: number;
      pointerB: number;
      startDist: number;
      startZoom: number;
      startPan: { x: number; y: number };
      startCenter: { x: number; y: number };
    };

export function MobilePlacementPicker({
  previewUrl,
  rect,
  imageAspectRatio,
  placedRects,
  pendingRects = [],
  onRectChange,
  onConfirm,
  onBack,
}: MobilePlacementPickerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [aspectLocked, setAspectLocked] = useState(true);
  const { trigger: haptic } = useHaptic();

  // --- Responsive minimap width (Step 8) ---
  const [viewW, setViewW] = useState(320);
  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => {
      const w = el.clientWidth;
      if (w > 0) setViewW(w);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // --- Minimap pan/zoom (Step 8) ---
  const [minimapZoom, setMinimapZoom] = useState(1);
  const [minimapPan, setMinimapPan] = useState({ x: 0, y: 0 });

  // --- Ghost preview position (Step 9) — client coords; null when idle ---
  const [ghostPos, setGhostPos] = useState<{ x: number; y: number } | null>(null);

  // --- Gesture bookkeeping ---
  const pointersRef = useRef(new Map<number, { x: number; y: number }>());
  const gestureRef = useRef<GestureState>({ kind: "idle" });
  const lastTapRef = useRef<{ t: number; x: number; y: number } | null>(null);

  const allOccupiedRects = useMemo(
    () => [...placedRects, ...pendingRects],
    [placedRects, pendingRects]
  );

  // --- Base viewport transform (fits everything) ---
  const { baseScale, baseOffsetX, baseOffsetY } = useMemo(() => {
    const allRects = [...allOccupiedRects, rect];
    const bounds = getBoundsFromRects(allRects);
    const pad = PAD_TILES * TILE;
    const bx = (bounds?.x ?? 0) - pad;
    const by = (bounds?.y ?? 0) - pad;
    const bw = (bounds?.w ?? TILE) + pad * 2;
    const bh = (bounds?.h ?? TILE) + pad * 2;
    const s = Math.min(viewW / bw, VIEW_H / bh, 1);
    const ox = (viewW - bw * s) / 2 - bx * s;
    const oy = (VIEW_H - bh * s) / 2 - by * s;
    return { baseScale: s, baseOffsetX: ox, baseOffsetY: oy };
  }, [allOccupiedRects, rect, viewW]);

  // Effective transform = base × user pan/zoom inside the minimap
  const viewScale = baseScale * minimapZoom;
  const viewOffsetX = baseOffsetX * minimapZoom + minimapPan.x;
  const viewOffsetY = baseOffsetY * minimapZoom + minimapPan.y;

  const worldToView = useCallback(
    (wx: number, wy: number) => ({
      vx: wx * viewScale + viewOffsetX,
      vy: wy * viewScale + viewOffsetY,
    }),
    [viewScale, viewOffsetX, viewOffsetY]
  );

  const viewToWorld = useCallback(
    (vx: number, vy: number) => ({
      wx: (vx - viewOffsetX) / viewScale,
      wy: (vy - viewOffsetY) / viewScale,
    }),
    [viewScale, viewOffsetX, viewOffsetY]
  );

  // --- Validation (Step 11 — halo instead of text-first) ---
  const overlapping = hasOverlap(rect, allOccupiedRects);
  const touching = isTouching(rect, allOccupiedRects);
  const valid = !overlapping && touching;

  const haloRgb = overlapping ? INVALID_RGB : !touching ? WARNING_RGB : VALID_RGB;
  const haloColor = haloTone(haloRgb, 0.9);
  const statusText = overlapping ? "Overlap" : !touching ? "Touch" : "Valid";

  const wTiles = Math.max(1, Math.round(rect.w / TILE));
  const hTiles = Math.max(1, Math.round(rect.h / TILE));
  const totalCells = wTiles * hTiles;

  // --- Helpers used by multiple gestures ---

  const distance = (a: { x: number; y: number }, b: { x: number; y: number }) =>
    Math.hypot(a.x - b.x, a.y - b.y);

  const center = (a: { x: number; y: number }, b: { x: number; y: number }) => ({
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2,
  });

  /** Does a client-space (minimap-local) point land on the candidate? */
  const pointOnCandidate = useCallback(
    (localX: number, localY: number) => {
      const { vx, vy } = worldToView(rect.x, rect.y);
      const vw = rect.w * viewScale;
      const vh = rect.h * viewScale;
      return localX >= vx && localX <= vx + vw && localY >= vy && localY <= vy + vh;
    },
    [rect, viewScale, worldToView]
  );

  /** Teleport the candidate so its top-left lands at the given world point,
   *  snapped to the grid and clamped to valid board space. */
  const teleportTo = useCallback(
    (worldX: number, worldY: number) => {
      const nx = snap(worldX - rect.w / 2);
      const ny = snap(worldY - rect.h / 2);
      const clamped = clampWorldRect({ x: nx, y: ny, w: rect.w, h: rect.h });
      onRectChange(clamped);
      haptic("medium");
    },
    [rect.w, rect.h, onRectChange, haptic]
  );

  // ==========================================================================
  // POINTER GESTURE ROUTING
  // ==========================================================================

  const onMinimapPointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      const el = containerRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const localX = e.clientX - r.left;
      const localY = e.clientY - r.top;

      pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      (e.target as HTMLElement).setPointerCapture?.(e.pointerId);

      // Two pointers active → pinch-minimap, cancelling whatever single-touch
      // gesture was in progress.
      if (pointersRef.current.size >= 2) {
        const ids = Array.from(pointersRef.current.keys()).slice(0, 2);
        const a = pointersRef.current.get(ids[0])!;
        const b = pointersRef.current.get(ids[1])!;
        gestureRef.current = {
          kind: "pinch-minimap",
          pointerA: ids[0],
          pointerB: ids[1],
          startDist: distance(a, b),
          startZoom: minimapZoom,
          startPan: { ...minimapPan },
          startCenter: { x: (a.x + b.x) / 2 - r.left, y: (a.y + b.y) / 2 - r.top },
        };
        setGhostPos(null);
        return;
      }

      // Single-touch paths below.
      // Double-tap detection — two quick taps in the same region teleport.
      const now = performance.now();
      const last = lastTapRef.current;
      if (
        last &&
        now - last.t < DOUBLE_TAP_MS &&
        Math.hypot(localX - last.x, localY - last.y) < 24
      ) {
        // Double-tap on empty space teleports the candidate there.
        if (!pointOnCandidate(localX, localY)) {
          const { wx, wy } = viewToWorld(localX, localY);
          teleportTo(wx, wy);
          lastTapRef.current = null;
          return;
        }
      }
      lastTapRef.current = { t: now, x: localX, y: localY };

      // Candidate drag
      if (pointOnCandidate(localX, localY)) {
        gestureRef.current = {
          kind: "drag-candidate",
          pointerId: e.pointerId,
          startClient: { x: e.clientX, y: e.clientY },
          startRect: { ...rect },
          lastSnap: { x: rect.x, y: rect.y },
        };
        setGhostPos({ x: e.clientX, y: e.clientY });
        haptic("light");
        return;
      }

      // Empty-space tap = pan minimap
      gestureRef.current = {
        kind: "pan-minimap",
        pointerId: e.pointerId,
        startClient: { x: e.clientX, y: e.clientY },
        startPan: { ...minimapPan },
      };
    },
    [
      minimapZoom,
      minimapPan,
      pointOnCandidate,
      viewToWorld,
      teleportTo,
      rect,
      haptic,
    ]
  );

  const onMinimapPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!pointersRef.current.has(e.pointerId)) return;
      pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const g = gestureRef.current;

      if (g.kind === "drag-candidate" && g.pointerId === e.pointerId) {
        const dx = (e.clientX - g.startClient.x) / viewScale;
        const dy = (e.clientY - g.startClient.y) / viewScale;
        const nx = snap(g.startRect.x + dx);
        const ny = snap(g.startRect.y + dy);
        const clamped = clampWorldRect({ x: nx, y: ny, w: g.startRect.w, h: g.startRect.h });
        // Haptic tick on snap boundary crossing (Step 9).
        if (clamped.x !== g.lastSnap.x || clamped.y !== g.lastSnap.y) {
          g.lastSnap = { x: clamped.x, y: clamped.y };
          haptic("light");
        }
        onRectChange(clamped);
        setGhostPos({ x: e.clientX, y: e.clientY });
        return;
      }

      if (g.kind === "resize-handle" && g.pointerId === e.pointerId) {
        const dx = (e.clientX - g.startClient.x) / viewScale;
        const dy = (e.clientY - g.startClient.y) / viewScale;
        const startRect = g.startRect;
        const anchor = getAnchor(g.handle, startRect);
        const { affectsW, affectsH } = getHandleAxes(g.handle);
        const { sx, sy } = getDeltaSigns(g.handle);

        let newW = startRect.w;
        let newH = startRect.h;

        if (aspectLocked && imageAspectRatio && imageAspectRatio > 0) {
          if (affectsW && affectsH) {
            const candidateW = Math.max(TILE, snap(startRect.w + sx * dx));
            const candidateH = Math.max(TILE, snap(startRect.h + sy * dy));
            const wRatio = candidateW / startRect.w;
            const hRatio = candidateH / startRect.h;
            if (Math.abs(wRatio - 1) >= Math.abs(hRatio - 1)) {
              newW = candidateW;
              newH = Math.max(TILE, Math.ceil(newW / imageAspectRatio / TILE) * TILE);
            } else {
              newH = candidateH;
              newW = Math.max(TILE, Math.ceil(newH * imageAspectRatio / TILE) * TILE);
            }
          } else if (affectsW) {
            newW = Math.max(TILE, snap(startRect.w + sx * dx));
            newH = Math.max(TILE, Math.ceil(newW / imageAspectRatio / TILE) * TILE);
          } else {
            newH = Math.max(TILE, snap(startRect.h + sy * dy));
            newW = Math.max(TILE, Math.ceil(newH * imageAspectRatio / TILE) * TILE);
          }
        } else {
          if (affectsW) newW = Math.max(TILE, snap(startRect.w + sx * dx));
          if (affectsH) newH = Math.max(TILE, snap(startRect.h + sy * dy));
        }

        let newX = anchor.x;
        let newY = anchor.y;
        if (sx <= 0 && affectsW) newX = anchor.x - newW;
        if (sy <= 0 && affectsH) newY = anchor.y - newH;
        if (!affectsW) newX = startRect.x;
        if (!affectsH) newY = startRect.y;

        let result = { x: newX, y: newY, w: newW, h: newH };
        result = capRectToMaxCells(result, MAX_CELLS_PER_RECT);
        result = clampWorldRect(result);
        onRectChange(result);
        return;
      }

      if (g.kind === "pan-minimap" && g.pointerId === e.pointerId) {
        const dx = e.clientX - g.startClient.x;
        const dy = e.clientY - g.startClient.y;
        setMinimapPan({ x: g.startPan.x + dx, y: g.startPan.y + dy });
        return;
      }

      if (g.kind === "pinch-minimap") {
        const a = pointersRef.current.get(g.pointerA);
        const b = pointersRef.current.get(g.pointerB);
        if (!a || !b) return;
        const dist = distance(a, b);
        if (dist <= 0 || g.startDist <= 0) return;
        const ratio = dist / g.startDist;
        const nextZoom = Math.max(
          MINIMAP_MIN_ZOOM,
          Math.min(MINIMAP_MAX_ZOOM, g.startZoom * ratio)
        );
        // Keep the pinch centroid fixed in the minimap coordinate space.
        // Rather than track the live centroid, we anchor to the gesture-start
        // centroid — this reads as "zooming into the spot where the gesture
        // started," which is what users expect.
        const cx = g.startCenter.x;
        const cy = g.startCenter.y;
        const nextPanX = cx - (cx - g.startPan.x) * (nextZoom / g.startZoom);
        const nextPanY = cy - (cy - g.startPan.y) * (nextZoom / g.startZoom);
        setMinimapZoom(nextZoom);
        setMinimapPan({ x: nextPanX, y: nextPanY });
      }
    },
    [viewScale, onRectChange, aspectLocked, imageAspectRatio, haptic]
  );

  const onMinimapPointerUp = useCallback(
    (e: React.PointerEvent) => {
      pointersRef.current.delete(e.pointerId);
      (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);

      const g = gestureRef.current;
      if (
        (g.kind === "drag-candidate" ||
          g.kind === "resize-handle" ||
          g.kind === "pan-minimap") &&
        g.pointerId === e.pointerId
      ) {
        gestureRef.current = { kind: "idle" };
        setGhostPos(null);
      }
      if (
        g.kind === "pinch-minimap" &&
        (g.pointerA === e.pointerId || g.pointerB === e.pointerId)
      ) {
        // Pinch over — if one pointer remains, fall back to pan-minimap.
        const remaining = Array.from(pointersRef.current.entries())[0];
        if (remaining) {
          const [pid, pt] = remaining;
          gestureRef.current = {
            kind: "pan-minimap",
            pointerId: pid,
            startClient: { x: pt.x, y: pt.y },
            startPan: { ...minimapPan },
          };
        } else {
          gestureRef.current = { kind: "idle" };
        }
      }
    },
    [minimapPan]
  );

  const onHandlePointerDown = useCallback(
    (handle: ResizeHandle, e: React.PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      gestureRef.current = {
        kind: "resize-handle",
        pointerId: e.pointerId,
        handle,
        startClient: { x: e.clientX, y: e.clientY },
        startRect: { ...rect },
      };
      haptic("light");
      (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    },
    [rect, haptic]
  );

  // ==========================================================================
  // SIZE CONTROLS
  // ==========================================================================

  const applySize = useCallback(
    (newWTiles: number, newHTiles: number) => {
      const nw = Math.max(1, newWTiles) * TILE;
      const nh = Math.max(1, newHTiles) * TILE;
      let result = { x: rect.x, y: rect.y, w: nw, h: nh };
      result = capRectToMaxCells(result, MAX_CELLS_PER_RECT);
      result = clampWorldRect(result);
      onRectChange(result);
      haptic("light");
    },
    [rect.x, rect.y, onRectChange, haptic]
  );

  const applyPreset = useCallback(
    (tiles: number) => {
      if (aspectLocked && imageAspectRatio && imageAspectRatio > 0) {
        const nw = tiles;
        const nh = Math.max(1, Math.round(nw / imageAspectRatio));
        applySize(nw, nh);
      } else {
        applySize(tiles, tiles);
      }
    },
    [aspectLocked, imageAspectRatio, applySize]
  );

  // Step 11 — tile-scale slider: width in tiles. When aspect is locked, height
  // is derived automatically. When unlocked, the slider drives both axes
  // proportionally to the current aspect so the user sees a "zoom" feel.
  const scaleSliderRef = useRef<HTMLInputElement>(null);
  const lastSliderValRef = useRef(wTiles);
  const onSliderChange = useCallback(
    (value: number) => {
      const v = Math.round(value);
      if (v === lastSliderValRef.current) return;
      lastSliderValRef.current = v;
      if (aspectLocked && imageAspectRatio && imageAspectRatio > 0) {
        applySize(v, Math.max(1, Math.round(v / imageAspectRatio)));
      } else {
        // Without aspect, maintain current w:h ratio as the slider drives w.
        const ratio = hTiles / Math.max(1, wTiles);
        applySize(v, Math.max(1, Math.round(v * ratio)));
      }
    },
    [aspectLocked, imageAspectRatio, applySize, hTiles, wTiles]
  );

  // --- Zoom reset affordance (tap the badge) ---
  const resetMinimap = useCallback(() => {
    setMinimapZoom(1);
    setMinimapPan({ x: 0, y: 0 });
    haptic("light");
  }, [haptic]);

  // --- Cleanup: clear lingering ghost when unmounting mid-gesture ---
  useEffect(() => {
    return () => setGhostPos(null);
  }, []);

  // ==========================================================================
  // RENDER
  // ==========================================================================

  const { vx, vy } = worldToView(rect.x, rect.y);
  const vw = rect.w * viewScale;
  const vh = rect.h * viewScale;
  const hideEdgeHandles = vw < 50 || vh < 50;

  const activePreset = PRESETS.find((p) => {
    if (aspectLocked && imageAspectRatio && imageAspectRatio > 0) {
      return wTiles === p && hTiles === Math.max(1, Math.round(p / imageAspectRatio));
    }
    return wTiles === p && hTiles === p;
  });

  return (
    <div className="flex flex-col items-stretch gap-3 w-full">
      {/* Instruction + aspect lock row */}
      <div className="flex items-center justify-between w-full px-1">
        <p className="text-[10px] uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.55)" }}>
          Drag &middot; Double-tap to teleport &middot; Pinch to zoom
        </p>
        {imageAspectRatio && imageAspectRatio > 0 && (
          <button
            onClick={() => { setAspectLocked((v) => !v); haptic("medium"); }}
            className="flex items-center gap-1 select-none"
            style={{
              height: 26,
              padding: "0 10px",
              borderRadius: 6,
              border: aspectLocked
                ? "1px solid rgba(0,204,204,0.5)"
                : "1px solid rgba(255,255,255,0.15)",
              background: aspectLocked
                ? "rgba(0,204,204,0.12)"
                : "rgba(255,255,255,0.04)",
              color: aspectLocked ? "#00cccc" : "rgba(255,255,255,0.4)",
              fontSize: 10,
              fontWeight: 600,
              letterSpacing: "0.04em",
              cursor: "pointer",
              transition: "all 0.15s",
            }}
          >
            <svg width="10" height="12" viewBox="0 0 10 12" fill="none" style={{ flexShrink: 0 }}>
              {aspectLocked ? (
                <>
                  <rect x="1" y="5" width="8" height="6" rx="1" stroke="currentColor" strokeWidth="1.2" fill="none" />
                  <path d="M3 5V3.5a2 2 0 0 1 4 0V5" stroke="currentColor" strokeWidth="1.2" fill="none" strokeLinecap="round" />
                </>
              ) : (
                <>
                  <rect x="1" y="5" width="8" height="6" rx="1" stroke="currentColor" strokeWidth="1.2" fill="none" />
                  <path d="M3 5V3.5a2 2 0 0 1 4 0" stroke="currentColor" strokeWidth="1.2" fill="none" strokeLinecap="round" />
                </>
              )}
            </svg>
            {aspectLocked ? "Locked" : "Free"}
          </button>
        )}
      </div>

      {/* Mini-board view — full width (Step 8) */}
      <div
        ref={containerRef}
        className="relative rounded-xl overflow-hidden w-full"
        style={{
          height: VIEW_H,
          background: "rgba(0,0,0,0.6)",
          border: "1px solid rgba(255,255,255,0.1)",
          touchAction: "none",
        }}
        onPointerDown={onMinimapPointerDown}
        onPointerMove={onMinimapPointerMove}
        onPointerUp={onMinimapPointerUp}
        onPointerCancel={onMinimapPointerUp}
      >
        {/* Zoom badge — tap to reset */}
        {(minimapZoom !== 1 || minimapPan.x !== 0 || minimapPan.y !== 0) && (
          <button
            onClick={resetMinimap}
            style={{
              position: "absolute",
              top: 8,
              right: 8,
              zIndex: 20,
              padding: "4px 8px",
              borderRadius: 999,
              fontSize: 10,
              fontFamily: "var(--font-terminal), monospace",
              color: "rgba(255,255,255,0.75)",
              background: "rgba(0,0,0,0.55)",
              border: "1px solid rgba(255,255,255,0.15)",
              letterSpacing: "0.08em",
              cursor: "pointer",
            }}
          >
            {minimapZoom.toFixed(1)}×  RESET
          </button>
        )}

        {/* Existing canonized placements */}
        {placedRects.map((pr, i) => {
          const { vx: pvx, vy: pvy } = worldToView(pr.x, pr.y);
          return (
            <div
              key={`placed-${i}`}
              className="absolute overflow-hidden"
              style={{
                left: pvx,
                top: pvy,
                width: pr.w * viewScale,
                height: pr.h * viewScale,
                background: pr.cid ? undefined : "rgba(0,200,180,0.25)",
                border: pr.cid ? "1px solid rgba(0,200,180,0.3)" : "1px solid rgba(0,200,180,0.5)",
                borderRadius: 2,
              }}
            >
              {pr.cid && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={cidToHttpUrl(pr.cid)}
                  alt=""
                  className="w-full h-full object-cover"
                  draggable={false}
                />
              )}
            </div>
          );
        })}

        {/* Pending vote proposals */}
        {pendingRects.map((pr, i) => {
          const { vx: pvx, vy: pvy } = worldToView(pr.x, pr.y);
          return (
            <div
              key={`pending-${i}`}
              className="absolute"
              style={{
                left: pvx,
                top: pvy,
                width: pr.w * viewScale,
                height: pr.h * viewScale,
                background: "rgba(255,180,0,0.15)",
                border: "1px dashed rgba(255,180,0,0.6)",
                borderRadius: 2,
              }}
              title="Pending vote"
            />
          );
        })}

        {/* Candidate rect — ambient validation halo (Step 11) */}
        <div
          className="absolute"
          style={{
            left: vx,
            top: vy,
            width: vw,
            height: vh,
            border: `2px solid ${haloColor}`,
            borderRadius: 3,
            backgroundImage: `url(${previewUrl})`,
            backgroundSize: "100% 100%",
            backgroundPosition: "center",
            // Multi-layer glow = the "halo". Outer bloom fades with distance
            // so the color reads as ambient rather than as a hard outline.
            boxShadow: `
              0 0 0 1px ${haloColor},
              0 0 10px ${haloColor},
              0 0 28px ${haloTone(haloRgb, 0.35)},
              0 0 56px ${haloTone(haloRgb, 0.18)}
            `,
            zIndex: 10,
            transition: "box-shadow 0.18s, border-color 0.18s",
          }}
        />

        {/* 8 Resize handles — 24 px targets (Step 10) */}
        {HANDLE_CONFIGS.map((cfg) => {
          if (cfg.edge && hideEdgeHandles) return null;
          const dims = getHandleDims(cfg.shape);
          const hx = vx + vw * cfg.fx - dims.w / 2;
          const hy = vy + vh * cfg.fy - dims.h / 2;
          const isActive =
            gestureRef.current.kind === "resize-handle" &&
            gestureRef.current.handle === cfg.id;
          return (
            <div
              key={cfg.id}
              style={{
                position: "absolute",
                left: hx - HIT_PAD,
                top: hy - HIT_PAD,
                width: dims.w + HIT_PAD * 2,
                height: dims.h + HIT_PAD * 2,
                zIndex: isActive ? 13 : 12,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: cfg.cursor,
                touchAction: "none",
              }}
              onPointerDown={(e) => onHandlePointerDown(cfg.id, e)}
            >
              <div
                style={{
                  width: dims.w,
                  height: dims.h,
                  background: isActive ? VALID_COLOR : "rgba(72,255,171,0.85)",
                  border: "1px solid rgba(0,0,0,0.3)",
                  borderRadius: cfg.shape === "square" ? 5 : 3,
                  boxShadow: isActive ? "0 0 10px rgba(72,255,171,0.7)" : "none",
                  transition: "box-shadow 0.12s, background 0.12s",
                }}
              />
            </div>
          );
        })}
      </div>

      {/* Live W×H + status (compact — halo now carries the signal) */}
      <div className="flex items-center justify-between gap-2 px-1" style={{ fontSize: 11 }}>
        <span
          style={{
            fontFamily: "var(--font-terminal), monospace",
            color: "rgba(255,255,255,0.6)",
            letterSpacing: "0.08em",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            minWidth: 0,
          }}
        >
          {wTiles}×{hTiles} &middot; {totalCells} cells
        </span>
        <span
          style={{
            fontWeight: 700,
            color: haloColor,
            letterSpacing: "0.06em",
            whiteSpace: "nowrap",
            flexShrink: 0,
          }}
        >
          {statusText}
        </span>
      </div>

      {/* Tile-scale slider (Step 11) */}
      <div className="flex items-center gap-3 px-1">
        <span style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", fontWeight: 600, letterSpacing: "0.08em" }}>SIZE</span>
        <input
          ref={scaleSliderRef}
          type="range"
          min={SCALE_MIN}
          max={SCALE_MAX}
          step={1}
          value={Math.min(SCALE_MAX, Math.max(SCALE_MIN, wTiles))}
          onChange={(e) => onSliderChange(Number(e.target.value))}
          style={{
            flex: 1,
            height: 32,
            accentColor: "#00cccc",
            touchAction: "none",
          }}
          aria-label="Placement size in tiles"
        />
        <span
          style={{
            minWidth: 28,
            textAlign: "right",
            fontSize: 12,
            fontFamily: "var(--font-terminal), monospace",
            color: "#00cccc",
          }}
        >
          {wTiles}×
        </span>
      </div>

      {/* Preset pills — secondary */}
      <div className="flex items-center justify-center gap-2">
        {PRESETS.map((p) => {
          const isActive = activePreset === p;
          const label = aspectLocked && imageAspectRatio && imageAspectRatio > 0
            ? `${p}x${Math.max(1, Math.round(p / imageAspectRatio))}`
            : `${p}x${p}`;
          return (
            <button
              key={p}
              onClick={() => applyPreset(p)}
              style={{
                height: 28,
                padding: "0 12px",
                borderRadius: 14,
                border: isActive
                  ? "1px solid rgba(0,204,204,0.6)"
                  : "1px solid rgba(255,255,255,0.1)",
                background: isActive
                  ? "rgba(0,204,204,0.15)"
                  : "rgba(255,255,255,0.04)",
                color: isActive ? "#00cccc" : "rgba(255,255,255,0.5)",
                fontSize: 10,
                fontWeight: 600,
                letterSpacing: "0.04em",
                cursor: "pointer",
                transition: "all 0.15s",
              }}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* Pending vote warning */}
      {pendingRects.length > 0 && (
        <p
          className="text-[10px] text-amber-400/70 text-center px-4"
          style={{ margin: 0 }}
        >
          {pendingRects.length} proposal{pendingRects.length !== 1 ? "s" : ""} pending vote (shown in amber)
        </p>
      )}

      {/* Buttons */}
      <div className="flex gap-3 w-full mt-1">
        <button
          onClick={onBack}
          className="flex-1 py-3 rounded-xl text-sm font-bold tracking-widest uppercase"
          style={{
            background: "rgba(255,255,255,0.1)",
            color: "rgba(255,255,255,0.7)",
            border: "1px solid rgba(255,255,255,0.1)",
          }}
        >
          Back
        </button>
        <button
          onClick={onConfirm}
          disabled={!valid}
          className="flex-1 py-3 rounded-xl text-sm font-bold tracking-widest uppercase touch-manipulation"
          style={{
            background: valid
              ? "linear-gradient(135deg, #e040fb, #f06292)"
              : "rgba(255,255,255,0.1)",
            color: valid ? "#fff" : "rgba(255,255,255,0.3)",
            border: "1px solid rgba(255,255,255,0.1)",
            boxShadow: valid ? "0 4px 16px rgba(224,64,251,0.35)" : "none",
          }}
        >
          Place Here
        </button>
      </div>

      {/* Floating ghost preview (Step 9) — portal to body so it escapes any
          clipped ancestor overflow. Only renders during an active
          candidate drag. */}
      {ghostPos !== null && typeof document !== "undefined"
        ? createPortal(<GhostPreview
            clientX={ghostPos.x}
            clientY={ghostPos.y}
            previewUrl={previewUrl}
            wTiles={wTiles}
            hTiles={hTiles}
            tileX={Math.round(rect.x / TILE)}
            tileY={Math.round(rect.y / TILE)}
            haloColor={haloColor}
            haloRgb={haloRgb}
          />, document.body)
        : null}
    </div>
  );
}

// ============================================================================
// Floating ghost preview (Step 9)
// ============================================================================

function GhostPreview({
  clientX,
  clientY,
  previewUrl,
  wTiles,
  hTiles,
  tileX,
  tileY,
  haloColor,
  haloRgb,
}: {
  clientX: number;
  clientY: number;
  previewUrl: string;
  wTiles: number;
  hTiles: number;
  tileX: number;
  tileY: number;
  haloColor: string;
  haloRgb: string;
}) {
  // Anchor 90 px above the finger, then clamp so the preview can never leave
  // the viewport — otherwise it pops off-screen near the edges just when the
  // user needs it most.
  const vw = typeof window !== "undefined" ? window.innerWidth : 0;
  const top = Math.max(8, clientY - GHOST_OFFSET_Y - GHOST_SIZE);
  const left = Math.max(8, Math.min(vw - GHOST_SIZE - 8, clientX - GHOST_SIZE / 2));

  return (
    <div
      aria-hidden
      style={{
        position: "fixed",
        top,
        left,
        width: GHOST_SIZE,
        pointerEvents: "none",
        zIndex: 9999,
        transition: "top 60ms linear, left 60ms linear",
      }}
    >
      {/* Preview image */}
      <div
        style={{
          width: GHOST_SIZE,
          height: GHOST_SIZE,
          borderRadius: 10,
          border: `2px solid ${haloColor}`,
          backgroundImage: `url(${previewUrl})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          boxShadow: `0 8px 24px rgba(0,0,0,0.4), 0 0 20px rgba(${haloRgb},0.45)`,
        }}
      />
      {/* Coordinate + size readout */}
      <div
        style={{
          marginTop: 6,
          padding: "4px 8px",
          borderRadius: 6,
          background: "rgba(0,0,0,0.7)",
          color: "rgba(255,255,255,0.9)",
          fontFamily: "var(--font-terminal), monospace",
          fontSize: 10,
          letterSpacing: "0.06em",
          textAlign: "center",
        }}
      >
        ({tileX}, {tileY}) &middot; {wTiles}×{hTiles}
      </div>
    </div>
  );
}
