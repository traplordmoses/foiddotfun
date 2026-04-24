"use client";

import React, { useRef, useCallback, useEffect, useState } from "react";

// ============================================================================
// TYPES
// ============================================================================

export type PaintOverlayItem =
  | {
      id: string;
      kind: "text";
      x: number;          // canvas-local (unscaled) px
      y: number;
      scale: number;
      rotation: number;   // radians
      text: string;
      color: string;
      fontSize: number;   // px at scale=1
      /** Impact-font meme styling (white fill + black stroke, uppercase). */
      memeStyle?: boolean;
    }
  | {
      id: string;
      kind: "sticker";
      x: number;
      y: number;
      scale: number;
      rotation: number;
      content: string;    // emoji grapheme
      size: number;       // base font-size (px at scale=1)
    }
  | {
      id: string;
      kind: "stamp";
      x: number;
      y: number;
      scale: number;
      rotation: number;
      src: string;        // data-URL or blob-URL
      width: number;      // natural px at scale=1
      height: number;
    };

export type PaintOverlayPatch = Partial<{
  x: number;
  y: number;
  scale: number;
  rotation: number;
  text: string;
  color: string;
  fontSize: number;
  content: string;
  size: number;
  width: number;
  height: number;
  src: string;
  memeStyle: boolean;
}>;

interface PaintOverlayProps {
  overlay: PaintOverlayItem;
  selected: boolean;
  editing: boolean;
  viewScale: number;
  onTransform: (id: string, patch: PaintOverlayPatch) => void;
  onDragStart: (id: string) => void;
  onDragEnd: (id: string, clientX: number, clientY: number) => void;
  onDoubleTap: (id: string) => void;
  onSelect: (id: string) => void;
  onTextChange: (id: string, text: string) => void;
  onEditDone: () => void;
}

interface Pointer {
  clientX: number;
  clientY: number;
}

interface GestureStart {
  overlayX: number;
  overlayY: number;
  overlayScale: number;
  overlayRotation: number;
  centroidX: number;
  centroidY: number;
  distance: number;
  angle: number;
  pointerCount: number;
}

const DOUBLE_TAP_MS = 320;
const DOUBLE_TAP_DISTANCE = 36;
const MOVE_THRESHOLD = 6;

// ============================================================================
// COMPONENT
// ============================================================================

export function PaintOverlay({
  overlay,
  selected,
  editing,
  viewScale,
  onTransform,
  onDragStart,
  onDragEnd,
  onDoubleTap,
  onSelect,
  onTextChange,
  onEditDone,
}: PaintOverlayProps) {
  const pointersRef = useRef<Map<number, Pointer>>(new Map());
  const gestureStartRef = useRef<GestureStart | null>(null);
  const lastTapRef = useRef<{ time: number; x: number; y: number } | null>(null);
  const hasMovedRef = useRef<boolean>(false);
  const lastClientRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const didDragStartRef = useRef<boolean>(false);

  // Snapshot current gesture anchor from active pointers + overlay transform
  const recomputeStart = useCallback(() => {
    const pointers = Array.from(pointersRef.current.values());
    if (pointers.length === 0) {
      gestureStartRef.current = null;
      return;
    }
    let cx = 0;
    let cy = 0;
    for (const p of pointers) {
      cx += p.clientX;
      cy += p.clientY;
    }
    cx /= pointers.length;
    cy /= pointers.length;
    let distance = 0;
    let angle = 0;
    if (pointers.length >= 2) {
      const p0 = pointers[0];
      const p1 = pointers[1];
      distance = Math.hypot(p1.clientX - p0.clientX, p1.clientY - p0.clientY);
      angle = Math.atan2(p1.clientY - p0.clientY, p1.clientX - p0.clientX);
    }
    gestureStartRef.current = {
      overlayX: overlay.x,
      overlayY: overlay.y,
      overlayScale: overlay.scale,
      overlayRotation: overlay.rotation,
      centroidX: cx,
      centroidY: cy,
      distance,
      angle,
      pointerCount: pointers.length,
    };
  }, [overlay.x, overlay.y, overlay.scale, overlay.rotation]);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (editing) return;
      e.stopPropagation();
      try {
        (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
      } catch {
        /* ignored */
      }
      pointersRef.current.set(e.pointerId, { clientX: e.clientX, clientY: e.clientY });
      lastClientRef.current = { x: e.clientX, y: e.clientY };
      hasMovedRef.current = false;
      onSelect(overlay.id);
      if (!didDragStartRef.current) {
        onDragStart(overlay.id);
        didDragStartRef.current = true;
      }
      recomputeStart();
    },
    [editing, overlay.id, onSelect, onDragStart, recomputeStart]
  );

  // Meme-style text (top/bottom) is a locked template: users can select and
  // edit the text, and resize via the bottom-strip slider, but dragging and
  // pinch-scaling on the overlay itself are disabled. Everything else keeps
  // the full translate + pinch-scale gesture.
  const locked = overlay.kind === "text" && overlay.memeStyle === true;

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (editing) return;
      if (locked) return;
      if (!pointersRef.current.has(e.pointerId)) return;
      pointersRef.current.set(e.pointerId, { clientX: e.clientX, clientY: e.clientY });
      lastClientRef.current = { x: e.clientX, y: e.clientY };
      const start = gestureStartRef.current;
      if (!start) return;
      const pointers = Array.from(pointersRef.current.values());
      if (pointers.length !== start.pointerCount) {
        // Pointer count changed mid-stroke — re-snapshot
        recomputeStart();
        return;
      }

      let cx = 0;
      let cy = 0;
      for (const p of pointers) {
        cx += p.clientX;
        cy += p.clientY;
      }
      cx /= pointers.length;
      cy /= pointers.length;

      const safeScale = viewScale === 0 ? 1 : viewScale;
      const dx = (cx - start.centroidX) / safeScale;
      const dy = (cy - start.centroidY) / safeScale;

      if (Math.hypot(cx - start.centroidX, cy - start.centroidY) > MOVE_THRESHOLD) {
        hasMovedRef.current = true;
      }

      const patch: PaintOverlayPatch = {
        x: start.overlayX + dx,
        y: start.overlayY + dy,
      };

      if (pointers.length >= 2) {
        const p0 = pointers[0];
        const p1 = pointers[1];
        const distance = Math.hypot(p1.clientX - p0.clientX, p1.clientY - p0.clientY);
        const angle = Math.atan2(p1.clientY - p0.clientY, p1.clientX - p0.clientX);
        if (start.distance > 0) {
          const rawScale = start.overlayScale * (distance / start.distance);
          patch.scale = Math.max(0.15, Math.min(8, rawScale));
        }
        patch.rotation = start.overlayRotation + (angle - start.angle);
      }

      onTransform(overlay.id, patch);
    },
    [editing, locked, viewScale, onTransform, overlay.id, recomputeStart]
  );

  const finishPointer = useCallback(
    (pointerId: number, clientX: number, clientY: number) => {
      pointersRef.current.delete(pointerId);
      if (pointersRef.current.size === 0) {
        // All pointers released
        if (!hasMovedRef.current) {
          const now = Date.now();
          const last = lastTapRef.current;
          const isDouble =
            last &&
            now - last.time < DOUBLE_TAP_MS &&
            Math.hypot(clientX - last.x, clientY - last.y) < DOUBLE_TAP_DISTANCE;
          if (isDouble) {
            onDoubleTap(overlay.id);
            lastTapRef.current = null;
          } else {
            lastTapRef.current = { time: now, x: clientX, y: clientY };
          }
        }
        if (didDragStartRef.current) {
          onDragEnd(overlay.id, clientX, clientY);
          didDragStartRef.current = false;
        }
        gestureStartRef.current = null;
        hasMovedRef.current = false;
      } else {
        // Still at least one pointer down — re-snapshot for new regime (e.g. 2→1)
        recomputeStart();
      }
    },
    [overlay.id, onDoubleTap, onDragEnd, recomputeStart]
  );

  const onPointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (editing) return;
      e.stopPropagation();
      finishPointer(e.pointerId, e.clientX, e.clientY);
    },
    [editing, finishPointer]
  );

  const onPointerCancel = useCallback(
    (e: React.PointerEvent) => {
      finishPointer(e.pointerId, lastClientRef.current.x, lastClientRef.current.y);
    },
    [finishPointer]
  );

  // Touch events are a separate stream from pointer events. The canvas
  // container listens for touchstart/touchmove to drive view-level pinch-zoom
  // and pan — if we don't stop propagation here, a two-finger gesture on a
  // stamp/sticker zooms the whole canvas instead of resizing the overlay.
  const stopTouch = useCallback((e: React.TouchEvent) => {
    e.stopPropagation();
  }, []);

  // Text-edit local buffer so re-renders don't blow away in-flight input
  const [editValue, setEditValue] = useState<string>(
    overlay.kind === "text" ? overlay.text : ""
  );
  useEffect(() => {
    if (editing && overlay.kind === "text") setEditValue(overlay.text);
  }, [editing, overlay]);

  const commonFrameStyle: React.CSSProperties = {
    position: "absolute",
    left: overlay.x,
    top: overlay.y,
    transform: `translate(-50%, -50%) rotate(${overlay.rotation}rad) scale(${overlay.scale})`,
    transformOrigin: "center center",
    touchAction: "none",
    userSelect: "none",
    WebkitUserSelect: "none",
    pointerEvents: "auto",
    zIndex: selected ? 22 : 20,
    padding: 10,
    outline: selected ? "1.5px dashed rgba(0,204,204,0.7)" : "none",
    outlineOffset: 2,
    borderRadius: 6,
    willChange: "transform, left, top",
  };

  if (overlay.kind === "text") {
    const isMeme = overlay.memeStyle === true;
    const textStyle: React.CSSProperties = isMeme
      ? {
          fontSize: overlay.fontSize,
          color: "#ffffff",
          fontFamily: "'Impact', 'Arial Black', 'Haettenschweiler', sans-serif",
          fontWeight: 900,
          letterSpacing: "0.04em",
          textTransform: "uppercase",
          WebkitTextStroke: `${Math.max(2, overlay.fontSize / 14)}px #000000`,
          textAlign: "center",
          whiteSpace: "pre",
          lineHeight: 1.05,
        }
      : {
          fontSize: overlay.fontSize,
          color: overlay.color,
          fontFamily: "var(--font-display), 'Sora', 'Impact', 'Arial Black', sans-serif",
          fontWeight: 900,
          letterSpacing: "0.02em",
          textShadow: "0 1px 2px rgba(0,0,0,0.6), 0 0 6px rgba(0,0,0,0.3)",
          whiteSpace: "pre",
          lineHeight: 1.1,
        };
    return (
      <div
        style={commonFrameStyle}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        onTouchStart={stopTouch}
        onTouchMove={stopTouch}
        onTouchEnd={stopTouch}
      >
        {editing ? (
          <input
            autoFocus
            value={editValue}
            onChange={(e) => {
              setEditValue(e.target.value);
              onTextChange(overlay.id, e.target.value);
            }}
            onBlur={onEditDone}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === "Escape") {
                e.currentTarget.blur();
              }
            }}
            onPointerDown={(e) => e.stopPropagation()}
            style={{
              ...textStyle,
              background: "rgba(0,0,0,0.55)",
              border: "1px dashed rgba(0,204,204,0.7)",
              outline: "none",
              padding: "2px 8px",
              borderRadius: 4,
              minWidth: 60,
              textAlign: "center",
              caretColor: overlay.color,
            }}
          />
        ) : (
          <div style={textStyle}>{overlay.text || " "}</div>
        )}
      </div>
    );
  }

  if (overlay.kind === "stamp") {
    return (
      <div
        style={commonFrameStyle}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        onTouchStart={stopTouch}
        onTouchMove={stopTouch}
        onTouchEnd={stopTouch}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={overlay.src}
          alt=""
          draggable={false}
          style={{
            display: "block",
            width: overlay.width,
            height: overlay.height,
            filter: "drop-shadow(0 2px 6px rgba(0,0,0,0.4))",
            pointerEvents: "none",
            userSelect: "none",
            WebkitUserSelect: "none",
          }}
        />
      </div>
    );
  }

  // Sticker
  return (
    <div
      style={commonFrameStyle}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      onTouchStart={stopTouch}
      onTouchMove={stopTouch}
      onTouchEnd={stopTouch}
    >
      <div
        style={{
          fontSize: overlay.size,
          lineHeight: 1,
          filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.4))",
        }}
      >
        {overlay.content}
      </div>
    </div>
  );
}

export default PaintOverlay;
