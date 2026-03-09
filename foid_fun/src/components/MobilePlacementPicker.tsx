"use client";

import React, { useRef, useState, useMemo, useCallback } from "react";
import { TILE, snap, hasOverlap, isTouching, type Rect } from "@/lib/grid";
import { getBoundsFromRects } from "@/lib/boardCoordinates";
import { clampWorldRect } from "@/lib/boardSpace";

interface MobilePlacementPickerProps {
  previewUrl: string;
  rect: Rect;
  placedRects: Rect[];
  onRectChange: (r: Rect) => void;
  onConfirm: () => void;
  onBack: () => void;
}

const VIEW_W = 280;
const VIEW_H = 240;
const PAD_TILES = 3;

export function MobilePlacementPicker({
  previewUrl,
  rect,
  placedRects,
  onRectChange,
  onConfirm,
  onBack,
}: MobilePlacementPickerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  const dragStartRef = useRef({ px: 0, py: 0, rx: 0, ry: 0 });

  // Compute viewport bounds around all rects + candidate + padding
  const { viewScale, viewOffsetX, viewOffsetY } = useMemo(() => {
    const allRects = [...placedRects, rect];
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
  }, [placedRects, rect]);

  const worldToView = useCallback(
    (wx: number, wy: number) => ({
      vx: wx * viewScale + viewOffsetX,
      vy: wy * viewScale + viewOffsetY,
    }),
    [viewScale, viewOffsetX, viewOffsetY],
  );

  const viewToWorld = useCallback(
    (vx: number, vy: number) => ({
      wx: (vx - viewOffsetX) / viewScale,
      wy: (vy - viewOffsetY) / viewScale,
    }),
    [viewScale, viewOffsetX, viewOffsetY],
  );

  // Validation
  const overlapping = hasOverlap(rect, placedRects);
  const touching = isTouching(rect, placedRects);
  const valid = !overlapping && touching;

  const statusText = overlapping
    ? "Overlapping"
    : !touching
      ? "Must touch an existing placement"
      : "Valid";

  const borderColor = valid ? "rgba(72,255,171,0.9)" : "rgba(255,71,87,0.9)";

  // Drag handlers
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

  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging) return;
    const el = containerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
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
  };

  const onPointerUp = () => {
    setDragging(false);
  };

  return (
    <div className="flex flex-col items-center gap-3">
      <p className="text-xs uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.5)" }}>
        Drag to position
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
        {/* Existing placements */}
        {placedRects.map((pr, i) => {
          const { vx, vy } = worldToView(pr.x, pr.y);
          return (
            <div
              key={i}
              className="absolute"
              style={{
                left: vx,
                top: vy,
                width: pr.w * viewScale,
                height: pr.h * viewScale,
                background: "rgba(0,200,180,0.25)",
                border: "1px solid rgba(0,200,180,0.5)",
                borderRadius: 2,
              }}
            />
          );
        })}

        {/* Candidate (draggable) */}
        {(() => {
          const { vx, vy } = worldToView(rect.x, rect.y);
          return (
            <div
              className="absolute cursor-grab active:cursor-grabbing"
              style={{
                left: vx,
                top: vy,
                width: rect.w * viewScale,
                height: rect.h * viewScale,
                border: `2px solid ${borderColor}`,
                borderRadius: 3,
                backgroundImage: `url(${previewUrl})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
                boxShadow: `0 0 8px ${borderColor}`,
                zIndex: 10,
              }}
              onPointerDown={onPointerDown}
            />
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
