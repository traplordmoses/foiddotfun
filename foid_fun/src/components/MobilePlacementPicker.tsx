"use client";

import React, { useRef, useState, useMemo, useCallback } from "react";
import { TILE, snap, hasOverlap, isTouching, type Rect } from "@/lib/grid";
import { getBoundsFromRects } from "@/lib/boardCoordinates";
import { clampWorldRect } from "@/lib/boardSpace";
import { MAX_CELLS_PER_RECT, capRectToMaxCells } from "@/lib/boardImages";
import { cidToHttpUrl } from "@/lib/ipfsUrl";
import { useHaptic } from "@/hooks/useHaptic";

export type PlacedItem = Rect & { cid?: string };

// ============================================================================
// RESIZE HANDLE TYPES & CONFIG
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

/** Which axes does each handle affect? */
function getHandleAxes(handle: ResizeHandle): { affectsW: boolean; affectsH: boolean } {
  switch (handle) {
    case "tc": case "bc": return { affectsW: false, affectsH: true };
    case "ml": case "mr": return { affectsW: true, affectsH: false };
    default: return { affectsW: true, affectsH: true }; // all corners
  }
}

/** Sign of delta: +1 if handle is on right/bottom edge, -1 if on left/top */
function getDeltaSigns(handle: ResizeHandle): { sx: number; sy: number } {
  const sx = handle.includes("l") ? -1 : handle.includes("r") ? 1 : 0;
  const sy = handle.startsWith("t") ? -1 : handle.startsWith("b") ? 1 : 0;
  return { sx, sy };
}

// ============================================================================
// HANDLE DIMENSIONS
// ============================================================================

const CORNER_SIZE = 14;
const EDGE_W = 18; // along-edge dimension
const EDGE_H = 10; // cross-edge dimension
const HIT_PAD = 4; // extra touch padding per side

function getHandleDims(shape: "square" | "hbar" | "vbar") {
  switch (shape) {
    case "square": return { w: CORNER_SIZE, h: CORNER_SIZE };
    case "hbar": return { w: EDGE_W, h: EDGE_H };
    case "vbar": return { w: EDGE_H, h: EDGE_W };
  }
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

const VIEW_W = 280;
const VIEW_H = 240;
const PAD_TILES = 3;

// Preset sizes in tiles
const PRESETS = [1, 2, 3, 4];

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
  const [dragging, setDragging] = useState(false);
  const [resizing, setResizing] = useState(false);
  const [activeHandle, setActiveHandle] = useState<ResizeHandle | null>(null);
  const [aspectLocked, setAspectLocked] = useState(true);
  const { trigger: haptic } = useHaptic();

  const dragStartRef = useRef({ px: 0, py: 0, rx: 0, ry: 0 });
  const resizeStartRef = useRef<{ px: number; py: number; rect: Rect }>({ px: 0, py: 0, rect: { x: 0, y: 0, w: TILE, h: TILE } });

  const allOccupiedRects = useMemo(() => [...placedRects, ...pendingRects], [placedRects, pendingRects]);

  // Viewport transform
  const { viewScale, viewOffsetX, viewOffsetY } = useMemo(() => {
    const allRects = [...allOccupiedRects, rect];
    const bounds = getBoundsFromRects(allRects);
    const pad = PAD_TILES * TILE;
    const bx = (bounds?.x ?? 0) - pad;
    const by = (bounds?.y ?? 0) - pad;
    const bw = (bounds?.w ?? TILE) + pad * 2;
    const bh = (bounds?.h ?? TILE) + pad * 2;
    const s = Math.min(VIEW_W / bw, VIEW_H / bh, 1);
    const ox = (VIEW_W - bw * s) / 2 - bx * s;
    const oy = (VIEW_H - bh * s) / 2 - by * s;
    return { viewScale: s, viewOffsetX: ox, viewOffsetY: oy };
  }, [allOccupiedRects, rect]);

  const worldToView = useCallback(
    (wx: number, wy: number) => ({
      vx: wx * viewScale + viewOffsetX,
      vy: wy * viewScale + viewOffsetY,
    }),
    [viewScale, viewOffsetX, viewOffsetY],
  );

  // Validation
  const overlapping = hasOverlap(rect, allOccupiedRects);
  const touching = isTouching(rect, allOccupiedRects);
  const valid = !overlapping && touching;
  const statusText = overlapping
    ? "Overlapping"
    : !touching
      ? "Must touch an existing placement"
      : "Valid";
  const borderColor = valid ? "rgba(72,255,171,0.9)" : "rgba(255,71,87,0.9)";

  // Current tile dimensions
  const wTiles = Math.max(1, Math.round(rect.w / TILE));
  const hTiles = Math.max(1, Math.round(rect.h / TILE));
  const totalCells = wTiles * hTiles;

  // ============================================================================
  // DRAG (MOVE) HANDLERS
  // ============================================================================

  const onPointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const el = containerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    dragStartRef.current = {
      px: e.clientX - r.left,
      py: e.clientY - r.top,
      rx: rect.x,
      ry: rect.y,
    };
    setDragging(true);
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };

  // ============================================================================
  // RESIZE HANDLERS — ANCHOR-BASED, MULTI-DIRECTIONAL
  // ============================================================================

  const onHandlePointerDown = useCallback((handle: ResizeHandle, e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const el = containerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    resizeStartRef.current = {
      px: e.clientX - r.left,
      py: e.clientY - r.top,
      rect: { ...rect },
    };
    setActiveHandle(handle);
    setResizing(true);
    haptic("light");
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  }, [rect, haptic]);

  const onPointerMove = (e: React.PointerEvent) => {
    const el = containerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();

    if (dragging) {
      const cx = e.clientX - r.left;
      const cy = e.clientY - r.top;
      const dx = cx - dragStartRef.current.px;
      const dy = cy - dragStartRef.current.py;
      const worldDx = dx / viewScale;
      const worldDy = dy / viewScale;
      const nx = snap(dragStartRef.current.rx + worldDx);
      const ny = snap(dragStartRef.current.ry + worldDy);
      const clamped = clampWorldRect({ x: nx, y: ny, w: rect.w, h: rect.h });
      onRectChange(clamped);
    }

    if (resizing && activeHandle) {
      const cx = e.clientX - r.left;
      const cy = e.clientY - r.top;
      const dx = (cx - resizeStartRef.current.px) / viewScale;
      const dy = (cy - resizeStartRef.current.py) / viewScale;
      const startRect = resizeStartRef.current.rect;
      const anchor = getAnchor(activeHandle, startRect);
      const { affectsW, affectsH } = getHandleAxes(activeHandle);
      const { sx, sy } = getDeltaSigns(activeHandle);

      let newW = startRect.w;
      let newH = startRect.h;

      if (aspectLocked && imageAspectRatio && imageAspectRatio > 0) {
        // Aspect-locked: one axis drives the other
        if (affectsW && affectsH) {
          // Corner: use the larger proportional delta
          const candidateW = Math.max(TILE, snap(startRect.w + sx * dx));
          const candidateH = Math.max(TILE, snap(startRect.h + sy * dy));
          const wRatio = candidateW / startRect.w;
          const hRatio = candidateH / startRect.h;
          // Use whichever axis moved more proportionally
          if (Math.abs(wRatio - 1) >= Math.abs(hRatio - 1)) {
            newW = candidateW;
            newH = Math.max(TILE, Math.ceil(newW / imageAspectRatio / TILE) * TILE);
          } else {
            newH = candidateH;
            newW = Math.max(TILE, Math.ceil(newH * imageAspectRatio / TILE) * TILE);
          }
        } else if (affectsW) {
          // Edge horizontal: width drives height
          newW = Math.max(TILE, snap(startRect.w + sx * dx));
          newH = Math.max(TILE, Math.ceil(newW / imageAspectRatio / TILE) * TILE);
        } else {
          // Edge vertical: height drives width
          newH = Math.max(TILE, snap(startRect.h + sy * dy));
          newW = Math.max(TILE, Math.ceil(newH * imageAspectRatio / TILE) * TILE);
        }
      } else {
        // Free-form: independent axes
        if (affectsW) {
          newW = Math.max(TILE, snap(startRect.w + sx * dx));
        }
        if (affectsH) {
          newH = Math.max(TILE, snap(startRect.h + sy * dy));
        }
      }

      // Derive position from anchor
      let newX = anchor.x;
      let newY = anchor.y;

      // For handles on the right/bottom, anchor is top-left, position = anchor
      // For handles on the left/top, position = anchor - newSize
      if (sx <= 0 && affectsW) newX = anchor.x - newW; // left-side handles
      if (sy <= 0 && affectsH) newY = anchor.y - newH; // top-side handles
      // For edge handles that don't affect an axis, keep original position
      if (!affectsW) newX = startRect.x;
      if (!affectsH) newY = startRect.y;

      let result = { x: newX, y: newY, w: newW, h: newH };
      result = capRectToMaxCells(result, MAX_CELLS_PER_RECT);
      result = clampWorldRect(result);
      onRectChange(result);
    }
  };

  const onPointerUp = () => {
    setDragging(false);
    setResizing(false);
    setActiveHandle(null);
  };

  // ============================================================================
  // PRESET & STEPPER HELPERS
  // ============================================================================

  const applySize = useCallback((newWTiles: number, newHTiles: number) => {
    let nw = Math.max(1, newWTiles) * TILE;
    let nh = Math.max(1, newHTiles) * TILE;
    let result = { x: rect.x, y: rect.y, w: nw, h: nh };
    result = capRectToMaxCells(result, MAX_CELLS_PER_RECT);
    result = clampWorldRect(result);
    onRectChange(result);
    haptic("light");
  }, [rect.x, rect.y, onRectChange, haptic]);

  const applyPreset = useCallback((tiles: number) => {
    if (aspectLocked && imageAspectRatio && imageAspectRatio > 0) {
      const nw = tiles;
      const nh = Math.max(1, Math.round(nw / imageAspectRatio));
      applySize(nw, nh);
    } else {
      applySize(tiles, tiles);
    }
  }, [aspectLocked, imageAspectRatio, applySize]);

  const stepW = useCallback((delta: number) => {
    const newW = Math.max(1, wTiles + delta);
    if (aspectLocked && imageAspectRatio && imageAspectRatio > 0) {
      const newH = Math.max(1, Math.round(newW / imageAspectRatio));
      applySize(newW, newH);
    } else {
      applySize(newW, hTiles);
    }
  }, [wTiles, hTiles, aspectLocked, imageAspectRatio, applySize]);

  const stepH = useCallback((delta: number) => {
    const newH = Math.max(1, hTiles + delta);
    if (aspectLocked && imageAspectRatio && imageAspectRatio > 0) {
      const newW = Math.max(1, Math.round(newH * imageAspectRatio));
      applySize(newW, newH);
    } else {
      applySize(wTiles, newH);
    }
  }, [wTiles, hTiles, aspectLocked, imageAspectRatio, applySize]);

  // ============================================================================
  // RENDER
  // ============================================================================

  const { vx, vy } = worldToView(rect.x, rect.y);
  const vw = rect.w * viewScale;
  const vh = rect.h * viewScale;
  const hideEdgeHandles = vw < 30 || vh < 30;

  // Check which preset matches
  const activePreset = PRESETS.find((p) => {
    if (aspectLocked && imageAspectRatio && imageAspectRatio > 0) {
      return wTiles === p && hTiles === Math.max(1, Math.round(p / imageAspectRatio));
    }
    return wTiles === p && hTiles === p;
  });

  // Size indicator color
  const sizeColor =
    resizing
      ? totalCells > 350
        ? "rgba(255,180,0,0.9)"
        : "rgba(72,255,171,0.9)"
      : totalCells > 350
        ? "rgba(255,180,0,0.6)"
        : "rgba(255,255,255,0.4)";

  return (
    <div className="flex flex-col items-center gap-2">
      {/* Instruction + aspect lock row */}
      <div className="flex items-center justify-between w-full px-1">
        <p className="text-[10px] uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.5)" }}>
          Drag to move &middot; Handles to resize
        </p>
        {imageAspectRatio && imageAspectRatio > 0 && (
          <button
            onClick={() => { setAspectLocked((v) => !v); haptic("medium"); }}
            className="flex items-center gap-1 select-none"
            style={{
              height: 24,
              padding: "0 8px",
              borderRadius: 5,
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
            {/* Lock / unlock icon */}
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

      {/* Mini-board view */}
      <div
        ref={containerRef}
        className="relative rounded-xl overflow-hidden"
        style={{
          width: VIEW_W,
          height: VIEW_H,
          background: "rgba(0,0,0,0.6)",
          border: "1px solid rgba(255,255,255,0.1)",
          touchAction: "none",
        }}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
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

        {/* Pending vote proposals (amber, dashed) */}
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

        {/* Candidate rect (draggable) */}
        <div
          className="absolute cursor-grab active:cursor-grabbing"
          style={{
            left: vx,
            top: vy,
            width: vw,
            height: vh,
            border: `2px solid ${borderColor}`,
            borderRadius: 3,
            backgroundImage: `url(${previewUrl})`,
            backgroundSize: "100% 100%",
            backgroundPosition: "center",
            boxShadow: `0 0 8px ${borderColor}`,
            zIndex: 10,
          }}
          onPointerDown={onPointerDown}
        />

        {/* 8 Resize handles */}
        {HANDLE_CONFIGS.map((cfg) => {
          if (cfg.edge && hideEdgeHandles) return null;
          const dims = getHandleDims(cfg.shape);
          const hx = vx + vw * cfg.fx - dims.w / 2;
          const hy = vy + vh * cfg.fy - dims.h / 2;
          const isActive = activeHandle === cfg.id;
          return (
            <div
              key={cfg.id}
              className={`absolute cursor-${cfg.cursor}`}
              style={{
                left: hx - HIT_PAD,
                top: hy - HIT_PAD,
                width: dims.w + HIT_PAD * 2,
                height: dims.h + HIT_PAD * 2,
                zIndex: isActive ? 13 : 12,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: cfg.cursor,
              }}
              onPointerDown={(e) => onHandlePointerDown(cfg.id, e)}
            >
              <div
                style={{
                  width: dims.w,
                  height: dims.h,
                  background: isActive ? "rgba(72,255,171,1)" : "rgba(72,255,171,0.85)",
                  border: "1px solid rgba(0,0,0,0.3)",
                  borderRadius: cfg.shape === "square" ? 3 : 2,
                  boxShadow: isActive ? "0 0 8px rgba(72,255,171,0.6)" : "none",
                  transition: "box-shadow 0.1s",
                }}
              />
            </div>
          );
        })}
      </div>

      {/* Live size indicator */}
      <p
        style={{
          fontSize: 11,
          fontFamily: "var(--font-terminal), monospace",
          color: sizeColor,
          letterSpacing: "0.08em",
          transition: "color 0.15s",
          margin: 0,
        }}
      >
        {wTiles} &times; {hTiles} tiles
        {resizing && (
          <span style={{ opacity: 0.7 }}> ({totalCells} cells)</span>
        )}
        {totalCells > 350 && !resizing && (
          <span style={{ opacity: 0.6 }}> &middot; near max</span>
        )}
      </p>

      {/* Status */}
      <p
        className="text-xs font-bold"
        style={{ color: valid ? "rgba(72,255,171,0.9)" : "rgba(255,71,87,0.9)", margin: 0 }}
      >
        {statusText}
      </p>

      {/* Pending vote warning */}
      {pendingRects.length > 0 && (
        <p className="text-[10px] text-amber-400/70 text-center px-4" style={{ margin: 0 }}>
          {pendingRects.length} proposal{pendingRects.length !== 1 ? "s" : ""} pending vote (shown in amber)
        </p>
      )}

      {/* Preset size pills */}
      <div className="flex items-center gap-1.5">
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
                height: 26,
                padding: "0 10px",
                borderRadius: 13,
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

      {/* Manual tile dimension steppers */}
      <div className="flex items-center gap-4">
        {/* Width stepper */}
        <div className="flex items-center gap-1.5">
          <span style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", fontWeight: 600, letterSpacing: "0.06em" }}>W</span>
          <button
            onClick={() => stepW(-1)}
            disabled={wTiles <= 1}
            style={{
              width: 22, height: 22, borderRadius: 4,
              border: "1px solid rgba(255,255,255,0.1)",
              background: "rgba(255,255,255,0.04)",
              color: wTiles <= 1 ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.55)",
              fontSize: 14, fontWeight: 700, cursor: wTiles <= 1 ? "default" : "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              lineHeight: 1,
            }}
          >
            -
          </button>
          <span style={{
            minWidth: 22, textAlign: "center",
            fontSize: 12, fontFamily: "var(--font-terminal), monospace",
            color: "#00cccc",
          }}>
            {wTiles}
          </span>
          <button
            onClick={() => stepW(1)}
            style={{
              width: 22, height: 22, borderRadius: 4,
              border: "1px solid rgba(255,255,255,0.1)",
              background: "rgba(255,255,255,0.04)",
              color: "rgba(255,255,255,0.55)",
              fontSize: 14, fontWeight: 700, cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              lineHeight: 1,
            }}
          >
            +
          </button>
        </div>

        {/* Height stepper */}
        <div className="flex items-center gap-1.5">
          <span style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", fontWeight: 600, letterSpacing: "0.06em" }}>H</span>
          <button
            onClick={() => stepH(-1)}
            disabled={hTiles <= 1}
            style={{
              width: 22, height: 22, borderRadius: 4,
              border: "1px solid rgba(255,255,255,0.1)",
              background: "rgba(255,255,255,0.04)",
              color: hTiles <= 1 ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.55)",
              fontSize: 14, fontWeight: 700, cursor: hTiles <= 1 ? "default" : "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              lineHeight: 1,
            }}
          >
            -
          </button>
          <span style={{
            minWidth: 22, textAlign: "center",
            fontSize: 12, fontFamily: "var(--font-terminal), monospace",
            color: "#00cccc",
          }}>
            {hTiles}
          </span>
          <button
            onClick={() => stepH(1)}
            style={{
              width: 22, height: 22, borderRadius: 4,
              border: "1px solid rgba(255,255,255,0.1)",
              background: "rgba(255,255,255,0.04)",
              color: "rgba(255,255,255,0.55)",
              fontSize: 14, fontWeight: 700, cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              lineHeight: 1,
            }}
          >
            +
          </button>
        </div>
      </div>

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
    </div>
  );
}
