'use client';

import { useEffect, useRef, type RefObject } from 'react';

interface Point {
  x: number;
  y: number;
}

interface TouchGestureConfig {
  minZoom?: number;
  maxZoom?: number;
  panEnabled?: boolean;
  zoomEnabled?: boolean;
  onPanStart?: (point: Point) => void;
  onPan?: (delta: Point) => void;
  onPanEnd?: () => void;
  onZoomStart?: (scale: number) => void;
  onZoom?: (scale: number, center: Point) => void;
  onZoomEnd?: () => void;
  onTap?: (point: Point) => void;
  onDoubleTap?: (point: Point) => void;
  onLongPress?: (point: Point) => void;
  longPressDuration?: number;
  /** Pixels per wheel delta unit for plain (non-ctrl) wheel pan. */
  wheelPanSpeed?: number;
  /** Exponent coefficient for ctrl+wheel zoom; matches usePanZoom.ts. */
  wheelZoomFactor?: number;
}

type ActivePointer = {
  x: number;
  y: number;
  pointerType: string;
  startX: number;
  startY: number;
  startT: number;
};

/**
 * Imperatively binds pointer + wheel listeners to `targetRef.current`.
 *
 * - Single pointer (mouse, pen, or touch) → drag-to-pan
 * - Two-finger touch → pinch-zoom + two-finger pan
 * - Ctrl/Cmd + wheel → focal-point zoom on cursor
 * - Plain wheel → pan by (-deltaX, -deltaY)
 *
 * Window-level pointermove/up/cancel listeners are attached only while a
 * gesture is active, and removed when the last pointer lifts. pointermove is
 * the only listener registered with `{ passive: false }` (so it can call
 * preventDefault during a drag); the idle pointerdown listener stays passive.
 */
export function useTouchGestures(
  targetRef: RefObject<HTMLElement | null>,
  config: TouchGestureConfig = {}
): void {
  const configRef = useRef(config);
  useEffect(() => {
    configRef.current = config;
  });

  useEffect(() => {
    const el = targetRef.current;
    if (!el) return;

    const active = new Map<number, ActivePointer>();
    let isPanning = false;
    let isPinching = false;
    let lastSingle: Point = { x: 0, y: 0 };
    let lastPinchDistance = 0;
    let lastPinchCenter: Point = { x: 0, y: 0 };
    let currentScale = 1;
    let hasMoved = false;
    let lastTapTime = 0;
    let longPressTimer: ReturnType<typeof setTimeout> | undefined;
    let windowListenersAttached = false;

    const distance = (a: Point, b: Point) => {
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      return Math.sqrt(dx * dx + dy * dy);
    };
    const midpoint = (a: Point, b: Point): Point => ({
      x: (a.x + b.x) / 2,
      y: (a.y + b.y) / 2,
    });
    const allPointersAreTouch = () => {
      for (const p of active.values()) {
        if (p.pointerType !== 'touch') return false;
      }
      return active.size > 0;
    };
    const twoTouchPointers = (): [ActivePointer, ActivePointer] | null => {
      if (active.size !== 2 || !allPointersAreTouch()) return null;
      const it = active.values();
      return [it.next().value as ActivePointer, it.next().value as ActivePointer];
    };

    const attachWindowListeners = () => {
      if (windowListenersAttached) return;
      window.addEventListener('pointermove', onPointerMove, { passive: false });
      window.addEventListener('pointerup', onPointerEnd);
      window.addEventListener('pointercancel', onPointerEnd);
      windowListenersAttached = true;
    };
    const detachWindowListeners = () => {
      if (!windowListenersAttached) return;
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerEnd);
      window.removeEventListener('pointercancel', onPointerEnd);
      windowListenersAttached = false;
    };

    function onPointerDown(e: PointerEvent) {
      // Only left mouse button starts a gesture; touch/pen always use button 0
      if (e.pointerType === 'mouse' && e.button !== 0) return;

      try {
        el!.setPointerCapture?.(e.pointerId);
      } catch {
        /* capture may fail if pointer already released elsewhere; ignore */
      }

      active.set(e.pointerId, {
        x: e.clientX,
        y: e.clientY,
        pointerType: e.pointerType,
        startX: e.clientX,
        startY: e.clientY,
        startT: Date.now(),
      });
      hasMoved = false;
      attachWindowListeners();

      const { panEnabled = true, zoomEnabled = true, onPanStart, onZoomStart, onLongPress, longPressDuration = 500 } =
        configRef.current;

      if (active.size === 1) {
        lastSingle = { x: e.clientX, y: e.clientY };
        if (panEnabled) {
          isPanning = true;
          onPanStart?.(lastSingle);
        }
        // Long press is a touch-only affordance.
        if (onLongPress && e.pointerType === 'touch') {
          clearTimeout(longPressTimer);
          longPressTimer = setTimeout(() => {
            if (!hasMoved) onLongPress({ x: e.clientX, y: e.clientY });
          }, longPressDuration);
        }
      } else if (active.size === 2) {
        clearTimeout(longPressTimer);
        const pair = twoTouchPointers();
        if (!pair) return; // second pointer was a mouse/pen — no pinch
        const [a, b] = pair;
        lastPinchDistance = distance(a, b);
        lastPinchCenter = midpoint(a, b);
        // Keep pan running on the pinch centroid
        if (panEnabled && !isPanning) {
          isPanning = true;
          configRef.current.onPanStart?.(lastPinchCenter);
        }
        if (zoomEnabled) {
          isPinching = true;
          onZoomStart?.(currentScale);
        }
      }
    }

    function onPointerMove(e: PointerEvent) {
      const p = active.get(e.pointerId);
      if (!p) return;
      p.x = e.clientX;
      p.y = e.clientY;

      const { panEnabled = true, zoomEnabled = true, minZoom = 0.05, maxZoom = 20, onPan, onZoom } = configRef.current;

      // Suppress browser gestures (scroll, pull-to-refresh) while actively
      // handling a gesture. Passive:false registration makes this valid.
      if (isPanning || isPinching) e.preventDefault();

      if (active.size === 1 && isPanning && panEnabled) {
        const delta = { x: e.clientX - lastSingle.x, y: e.clientY - lastSingle.y };
        if (!hasMoved && (Math.abs(e.clientX - p.startX) > 5 || Math.abs(e.clientY - p.startY) > 5)) {
          hasMoved = true;
          clearTimeout(longPressTimer);
        }
        onPan?.(delta);
        lastSingle = { x: e.clientX, y: e.clientY };
        return;
      }

      const pair = twoTouchPointers();
      if (pair) {
        const [a, b] = pair;
        const d = distance(a, b);
        const c = midpoint(a, b);

        if (isPinching && zoomEnabled && lastPinchDistance > 0) {
          const ratio = d / lastPinchDistance;
          const next = Math.max(minZoom, Math.min(maxZoom, currentScale * ratio));
          currentScale = next;
          onZoom?.(next, c);
        }
        if (isPanning && panEnabled) {
          onPan?.({ x: c.x - lastPinchCenter.x, y: c.y - lastPinchCenter.y });
        }
        lastPinchDistance = d;
        lastPinchCenter = c;
        hasMoved = true;
        clearTimeout(longPressTimer);
      }
    }

    function onPointerEnd(e: PointerEvent) {
      const p = active.get(e.pointerId);
      if (!p) return;
      active.delete(e.pointerId);
      try {
        el!.releasePointerCapture?.(e.pointerId);
      } catch {
        /* pointer already released; ignore */
      }

      const { onTap, onDoubleTap, onPanEnd, onZoomEnd, onPanStart } = configRef.current;

      if (active.size === 0) {
        // Tap detection — touch only, short, no movement
        if (p.pointerType === 'touch' && !hasMoved && Date.now() - p.startT < 300) {
          const now = Date.now();
          const tapPt = { x: e.clientX, y: e.clientY };
          if (now - lastTapTime < 300) {
            onDoubleTap?.(tapPt);
            lastTapTime = 0;
          } else {
            onTap?.(tapPt);
            lastTapTime = now;
          }
        }
        if (isPinching) {
          onZoomEnd?.();
          isPinching = false;
        }
        if (isPanning) {
          onPanEnd?.();
          isPanning = false;
        }
        hasMoved = false;
        clearTimeout(longPressTimer);
        detachWindowListeners();
      } else if (active.size === 1 && isPinching) {
        // Finger lifted, one remains — end pinch, let pan continue on it.
        isPinching = false;
        onZoomEnd?.();
        const remaining = active.values().next().value as ActivePointer;
        lastSingle = { x: remaining.x, y: remaining.y };
        if (!isPanning && configRef.current.panEnabled !== false) {
          isPanning = true;
          onPanStart?.(lastSingle);
        }
      }
    }

    function onWheel(e: WheelEvent) {
      const {
        panEnabled = true,
        zoomEnabled = true,
        minZoom = 0.05,
        maxZoom = 20,
        onPan,
        onZoom,
        wheelPanSpeed = 1,
        wheelZoomFactor = 0.003,
      } = configRef.current;

      // Ctrl/Cmd + wheel = focal-point zoom. Trackpad pinch in Chrome/Safari
      // also dispatches wheel events with ctrlKey=true, so this covers both.
      if (e.ctrlKey || e.metaKey) {
        if (!zoomEnabled) return;
        e.preventDefault();
        const factor = Math.exp(-e.deltaY * wheelZoomFactor);
        const next = Math.max(minZoom, Math.min(maxZoom, currentScale * factor));
        currentScale = next;
        onZoom?.(next, { x: e.clientX, y: e.clientY });
        return;
      }
      // Plain wheel = pan. Negated so scroll-down moves content up (standard).
      if (!panEnabled) return;
      e.preventDefault();
      onPan?.({ x: -e.deltaX * wheelPanSpeed, y: -e.deltaY * wheelPanSpeed });
    }

    el.addEventListener('pointerdown', onPointerDown);
    el.addEventListener('wheel', onWheel, { passive: false });

    return () => {
      el.removeEventListener('pointerdown', onPointerDown);
      el.removeEventListener('wheel', onWheel);
      detachWindowListeners();
      clearTimeout(longPressTimer);
    };
  }, [targetRef]);
}
