"use client";

import React, { useRef, useState, useMemo, useCallback } from "react";
import { TILE, snap, hasOverlap, isTouching, type Rect } from "@/lib/grid";
import { getBoundsFromRects } from "@/lib/boardCoordinates";
import { clampWorldRect } from "@/lib/boardSpace";
import { MAX_CELLS_PER_RECT, capRectToMaxCells } from "@/lib/boardImages";
import { cidToHttpUrl } from "@/lib/ipfsUrl";

export type PlacedItem = Rect & { cid?: string };

interface MobilePlacementPickerProps {
  previewUrl: string;
  rect: Rect;
  imageAspectRatio?: number; // w/h ratio for aspect-ratio-constrained resize
  placedRects: PlacedItem[];
  pendingRects?: Rect[]; // proposals currently being voted on
  onRectChange: (r: Rect) => void;
  onConfirm: () => void;
  onBack: () => void;
}

const VIEW_W = 280;
const VIEW_H = 240;
const PAD_TILES = 3;
const HANDLE_SIZE = 14;

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
  const dragStartRef = useRef({ px: 0, py: 0, rx: 0, ry: 0 });
  const resizeStartRef = useRef({ px: 0, py: 0, rw: 0, rh: 0 });

  // All occupied rects (canonized + pending votes) for overlap checking
  const allOccupiedRects = useMemo(() => [...placedRects, ...pendingRects], [placedRects, pendingRects]);

  // Compute viewport bounds around all rects + candidate + padding
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

  // Validation — check against all occupied rects
  const overlapping = hasOverlap(rect, allOccupiedRects);
  const touching = isTouching(rect, allOccupiedRects);
  const valid = !overlapping && touching;

  const statusText = overlapping
    ? "Overlapping"
    : !touching
      ? "Must touch an existing placement"
      : "Valid";

  const borderColor = valid ? "rgba(72,255,171,0.9)" : "rgba(255,71,87,0.9)";

  // Drag handlers (move)
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

  // Resize handler (bottom-right corner)
  const onResizePointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const el = containerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    resizeStartRef.current = {
      px: e.clientX - r.left,
      py: e.clientY - r.top,
      rw: rect.w,
      rh: rect.h,
    };
    setResizing(true);
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };

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

    if (resizing) {
      const cx = e.clientX - r.left;
      const cy = e.clientY - r.top;
      const dx = cx - resizeStartRef.current.px;
      const dy = cy - resizeStartRef.current.py;
      const worldDx = dx / viewScale;
      const worldDy = dy / viewScale;
      let nw: number, nh: number;
      if (imageAspectRatio && imageAspectRatio > 0) {
        // Aspect-ratio-constrained resize: width drives, height follows
        nw = Math.max(TILE, snap(resizeStartRef.current.rw + worldDx));
        const rawH = nw / imageAspectRatio;
        nh = Math.max(TILE, Math.ceil(rawH / TILE) * TILE);
      } else {
        // Free-form resize (fallback)
        nw = Math.max(TILE, snap(resizeStartRef.current.rw + worldDx));
        nh = Math.max(TILE, snap(resizeStartRef.current.rh + worldDy));
      }
      // Cap to max cells
      const capped = capRectToMaxCells({ x: rect.x, y: rect.y, w: nw, h: nh }, MAX_CELLS_PER_RECT);
      const clamped = clampWorldRect(capped);
      onRectChange(clamped);
    }
  };

  const onPointerUp = () => {
    setDragging(false);
    setResizing(false);
  };

  return (
    <div className="flex flex-col items-center gap-3">
      <p className="text-xs uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.5)" }}>
        Drag to position &middot; Corner to resize
      </p>

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
          const { vx, vy } = worldToView(pr.x, pr.y);
          return (
            <div
              key={`placed-${i}`}
              className="absolute overflow-hidden"
              style={{
                left: vx,
                top: vy,
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
          const { vx, vy } = worldToView(pr.x, pr.y);
          return (
            <div
              key={`pending-${i}`}
              className="absolute"
              style={{
                left: vx,
                top: vy,
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

        {/* Candidate (draggable + resizable) */}
        {(() => {
          const { vx, vy } = worldToView(rect.x, rect.y);
          const vw = rect.w * viewScale;
          const vh = rect.h * viewScale;
          return (
            <>
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
              {/* Bottom-right resize handle */}
              <div
                className="absolute cursor-nwse-resize"
                style={{
                  left: vx + vw - HANDLE_SIZE / 2,
                  top: vy + vh - HANDLE_SIZE / 2,
                  width: HANDLE_SIZE,
                  height: HANDLE_SIZE,
                  background: "rgba(72,255,171,0.9)",
                  border: "1px solid rgba(0,0,0,0.3)",
                  borderRadius: 3,
                  zIndex: 11,
                }}
                onPointerDown={onResizePointerDown}
              />
            </>
          );
        })()}
      </div>

      {/* Status */}
      <p
        className="text-xs font-bold"
        style={{ color: valid ? "rgba(72,255,171,0.9)" : "rgba(255,71,87,0.9)" }}
      >
        {statusText}
      </p>

      {/* Pending vote warning */}
      {pendingRects.length > 0 && (
        <p className="text-[10px] text-amber-400/70 text-center px-4">
          {pendingRects.length} proposal{pendingRects.length !== 1 ? "s" : ""} pending vote (shown in amber)
        </p>
      )}

      {/* Buttons */}
      <div className="flex gap-3 w-full">
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
