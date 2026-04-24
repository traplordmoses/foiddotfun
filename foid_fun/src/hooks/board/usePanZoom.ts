// /src/hooks/board/usePanZoom.ts
// Headless pan+zoom for the board canvas.
// Owns: scale, pan, space-to-pan, wheel zoom, drag-to-pan, keyboard zoom (+/=/-/0),
// initial centering, screenToWorld conversion, and zoomToRect.
//
// Phase 2 refactor:
//   - During pan/zoom gestures, scale and pan live in refs (scaleRef / panRef)
//     and the stage's `transform` is written directly to the DOM via rAF. This
//     means zero React re-renders per pointermove — the heavy placement tree no
//     longer reconciles 60 times a second while the user is dragging.
//   - React state scale / pan still exist for consumers (HUDs, hit-testing,
//     virtualization) but they are committed at rAF cadence (coalesced) and on
//     gesture end. Consumers that read them during a drag see a throttled
//     stream rather than one update per pointer event.
//   - Focal-point zoom preserved for both wheel and future pinch gestures.
//   - Momentum scrolling: on pan release, velocity decays at `v *= 0.92` per
//     frame until it falls below the stop threshold. Cancelled immediately if
//     the user starts another gesture.
//   - getViewport() exposes the current viewport AABB in stage coordinates for
//     virtualization consumers.
"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from "react";
import { TILE, type Rect } from "@/lib/grid";
import { BOARD_OFFSET_X, BOARD_OFFSET_Y } from "@/lib/boardSpace";
import {
  toStageRect,
  STAGE_CANVAS_W,
  STAGE_CANVAS_H,
  STAGE_PAD_X,
  STAGE_PAD_Y,
  GRID_RADIUS_X,
  GRID_RADIUS_Y,
  MIN_SCALE,
  MAX_SCALE,
} from "@/lib/boardCoordinates";

export type DropPos = { x: number; y: number };

export type Viewport = { x: number; y: number; w: number; h: number };

export type UsePanZoomReturn = {
  scale: number;
  pan: { x: number; y: number };
  spaceDown: boolean;
  isPanning: boolean;
  draggingBoard: boolean;
  onContainerPointerDown: React.PointerEventHandler<HTMLDivElement>;
  zoomToRect: (r: Rect, padding?: number) => void;
  screenToWorld: (clientX: number, clientY: number) => DropPos;
  /** Programmatic setters kept escape-hatch-only — prefer zoomToRect / default gestures. */
  setScale: (s: number | ((prev: number) => number)) => void;
  setPan: (p: { x: number; y: number } | ((prev: { x: number; y: number }) => { x: number; y: number })) => void;
  /** Register the stage DOM node whose transform the hook should drive directly. */
  bindStage: (el: HTMLElement | null) => void;
  /** Current viewport AABB in stage coords. Reads live refs — always current. */
  getViewport: () => Viewport;
  /**
   * Subscribe to viewport changes. Fires on gesture end and on rAF-coalesced
   * updates during a gesture — consumers get a smooth stream without the per-
   * pointer-event flood. Returns an unsubscribe function.
   */
  subscribeViewport: (cb: (viewport: Viewport) => void) => () => void;
};

type PointSample = { x: number; y: number; t: number };

const MOMENTUM_DECAY = 0.92;
const MOMENTUM_STOP = 0.1; // px/frame
const VELOCITY_WINDOW_MS = 80;

export function usePanZoom(containerRef: RefObject<HTMLElement | null>): UsePanZoomReturn {
  // --- React state (throttled view of the refs, for consumers) ---
  const [scale, setScaleState] = useState(1);
  const [pan, setPanState] = useState({ x: 0, y: 0 });
  const [spaceDown, setSpaceDown] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const [draggingBoard, setDraggingBoard] = useState(false);

  // --- Live refs (source of truth during gestures) ---
  const scaleRef = useRef(1);
  const panRef = useRef({ x: 0, y: 0 });
  const stageElRef = useRef<HTMLElement | null>(null);

  // Mirror of `spaceDown` state so onContainerPointerDown can read the
  // current value without taking spaceDown as a dep. Phase β perf — a
  // stable handler identity means board-canvas children don't re-render
  // when the user toggles the pan mode.
  const spaceDownRef = useRef(false);
  useEffect(() => {
    spaceDownRef.current = spaceDown;
  }, [spaceDown]);
  const commitScheduledRef = useRef(false);
  const transformScheduledRef = useRef(false);
  const momentumRafRef = useRef<number | null>(null);

  // --- Gesture bookkeeping ---
  const panStartRef = useRef({ x: 0, y: 0 });
  const panOriginRef = useRef({ x: 0, y: 0 });
  const boardDragStartRef = useRef({ x: 0, y: 0, panX: 0, panY: 0 });
  const velocitySamplesRef = useRef<PointSample[]>([]);

  // --- Viewport subscribers (for virtualization, etc.) ---
  const viewportSubsRef = useRef(new Set<(v: Viewport) => void>());

  // ---------------------------------------------------------------------------
  // Core helpers
  // ---------------------------------------------------------------------------

  const applyTransform = useCallback(() => {
    const el = stageElRef.current;
    if (!el) return;
    const s = scaleRef.current;
    const p = panRef.current;
    el.style.transform = `translate(${p.x}px, ${p.y}px) scale(${s})`;
    el.style.transformOrigin = "0 0";
  }, []);

  /** Schedule a single transform write per frame, regardless of how many times
   *  the refs change this frame. */
  const scheduleTransform = useCallback(() => {
    if (transformScheduledRef.current) return;
    transformScheduledRef.current = true;
    requestAnimationFrame(() => {
      transformScheduledRef.current = false;
      applyTransform();
    });
  }, [applyTransform]);

  const computeViewport = useCallback((): Viewport => {
    const el = containerRef.current;
    const s = scaleRef.current || 1;
    const p = panRef.current;
    const vw = el?.clientWidth ?? 0;
    const vh = el?.clientHeight ?? 0;
    return {
      x: -p.x / s,
      y: -p.y / s,
      w: vw / s,
      h: vh / s,
    };
  }, [containerRef]);

  const notifyViewport = useCallback(() => {
    const v = computeViewport();
    viewportSubsRef.current.forEach((cb) => cb(v));
  }, [computeViewport]);

  /** Schedule a coalesced commit of refs -> React state. The commit lands at
   *  rAF cadence during a gesture, never more than once per frame. */
  const scheduleCommit = useCallback(() => {
    if (commitScheduledRef.current) return;
    commitScheduledRef.current = true;
    requestAnimationFrame(() => {
      commitScheduledRef.current = false;
      setScaleState((prev) => (prev === scaleRef.current ? prev : scaleRef.current));
      setPanState((prev) => {
        const next = panRef.current;
        return prev.x === next.x && prev.y === next.y ? prev : { ...next };
      });
      notifyViewport();
    });
  }, [notifyViewport]);

  /** Update pan/scale refs atomically and push to the DOM immediately. */
  const writeRefs = useCallback(
    (next: { scale?: number; pan?: { x: number; y: number } }) => {
      if (typeof next.scale === "number") {
        scaleRef.current = Math.min(MAX_SCALE, Math.max(MIN_SCALE, next.scale));
      }
      if (next.pan) panRef.current = next.pan;
      scheduleTransform();
      scheduleCommit();
    },
    [scheduleTransform, scheduleCommit]
  );

  const cancelMomentum = useCallback(() => {
    if (momentumRafRef.current !== null) {
      cancelAnimationFrame(momentumRafRef.current);
      momentumRafRef.current = null;
    }
  }, []);

  const pushVelocitySample = useCallback((x: number, y: number) => {
    const now = performance.now();
    const samples = velocitySamplesRef.current;
    samples.push({ x, y, t: now });
    // Keep only the recent window so velocity reflects the final motion.
    while (samples.length > 0 && now - samples[0].t > VELOCITY_WINDOW_MS) {
      samples.shift();
    }
  }, []);

  const computeVelocity = useCallback((): { vx: number; vy: number } => {
    const samples = velocitySamplesRef.current;
    if (samples.length < 2) return { vx: 0, vy: 0 };
    const first = samples[0];
    const last = samples[samples.length - 1];
    const dt = last.t - first.t;
    if (dt <= 0) return { vx: 0, vy: 0 };
    // px / frame (assume 60fps for decay math)
    const frameMs = 16.6667;
    return {
      vx: ((last.x - first.x) / dt) * frameMs,
      vy: ((last.y - first.y) / dt) * frameMs,
    };
  }, []);

  const startMomentum = useCallback(() => {
    const { vx, vy } = computeVelocity();
    if (Math.hypot(vx, vy) < MOMENTUM_STOP) return;
    let velX = vx;
    let velY = vy;
    const step = () => {
      velX *= MOMENTUM_DECAY;
      velY *= MOMENTUM_DECAY;
      panRef.current = {
        x: panRef.current.x + velX,
        y: panRef.current.y + velY,
      };
      scheduleTransform();
      scheduleCommit();
      if (Math.hypot(velX, velY) < MOMENTUM_STOP) {
        momentumRafRef.current = null;
        return;
      }
      momentumRafRef.current = requestAnimationFrame(step);
    };
    momentumRafRef.current = requestAnimationFrame(step);
  }, [computeVelocity, scheduleCommit, scheduleTransform]);

  // ---------------------------------------------------------------------------
  // Public setters (still mutate React state + refs to keep them in sync)
  // ---------------------------------------------------------------------------

  const setScale = useCallback<UsePanZoomReturn["setScale"]>((value) => {
    const next = typeof value === "function" ? value(scaleRef.current) : value;
    const clamped = Math.min(MAX_SCALE, Math.max(MIN_SCALE, next));
    scaleRef.current = clamped;
    scheduleTransform();
    setScaleState(clamped);
    notifyViewport();
  }, [notifyViewport, scheduleTransform]);

  const setPan = useCallback<UsePanZoomReturn["setPan"]>((value) => {
    const next = typeof value === "function" ? value(panRef.current) : value;
    panRef.current = { ...next };
    scheduleTransform();
    setPanState({ ...next });
    notifyViewport();
  }, [notifyViewport, scheduleTransform]);

  // ---------------------------------------------------------------------------
  // bindStage — consumer hands us the DOM node to drive
  // ---------------------------------------------------------------------------

  const bindStage = useCallback(
    (el: HTMLElement | null) => {
      stageElRef.current = el;
      if (el) applyTransform();
    },
    [applyTransform]
  );

  // ---------------------------------------------------------------------------
  // Space-to-pan keyboard toggle
  // ---------------------------------------------------------------------------

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.code === "Space") {
        e.preventDefault();
        setSpaceDown(true);
      }
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === "Space") setSpaceDown(false);
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  // ---------------------------------------------------------------------------
  // Keyboard zoom (+/=/-/0)
  // ---------------------------------------------------------------------------

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return;

      if (e.key === "+" || e.key === "=") {
        e.preventDefault();
        setScale((s) => s * 1.2);
      } else if (e.key === "-") {
        e.preventDefault();
        setScale((s) => s / 1.2);
      } else if (e.key === "0") {
        e.preventDefault();
        setScale(1);
        const el = containerRef.current;
        if (el) {
          const r = el.getBoundingClientRect();
          setPan({
            x: (r.width - STAGE_CANVAS_W) / 2,
            y: (r.height - STAGE_CANVAS_H) / 2,
          });
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [containerRef, setScale, setPan]);

  // ---------------------------------------------------------------------------
  // Space-drag pan (ref-driven)
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (!isPanning) return;
    velocitySamplesRef.current = [];
    cancelMomentum();

    const onMove = (ev: PointerEvent) => {
      const nextPan = {
        x: panOriginRef.current.x + ev.clientX - panStartRef.current.x,
        y: panOriginRef.current.y + ev.clientY - panStartRef.current.y,
      };
      writeRefs({ pan: nextPan });
      pushVelocitySample(ev.clientX, ev.clientY);
    };
    const onUp = () => {
      setIsPanning(false);
      startMomentum();
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp, { once: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [isPanning, writeRefs, pushVelocitySample, startMomentum, cancelMomentum]);

  useEffect(() => {
    if (!spaceDown) setIsPanning(false);
  }, [spaceDown]);

  // ---------------------------------------------------------------------------
  // Board-drag pan (click empty canvas + drag)
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (!draggingBoard) return;
    velocitySamplesRef.current = [];
    cancelMomentum();

    const onMove = (ev: PointerEvent) => {
      const nextPan = {
        x: boardDragStartRef.current.panX + ev.clientX - boardDragStartRef.current.x,
        y: boardDragStartRef.current.panY + ev.clientY - boardDragStartRef.current.y,
      };
      writeRefs({ pan: nextPan });
      pushVelocitySample(ev.clientX, ev.clientY);
    };
    const onUp = () => {
      setDraggingBoard(false);
      startMomentum();
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp, { once: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [draggingBoard, writeRefs, pushVelocitySample, startMomentum, cancelMomentum]);

  // ---------------------------------------------------------------------------
  // Initial centering
  // ---------------------------------------------------------------------------

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    // Center viewport on world origin rather than stage center. BOARD_OFFSET
    // is frozen at the legacy 4096 (see boardSpace.ts), so the stage center
    // and world origin no longer coincide — centering on stage center would
    // land the viewport ~28k px away from every existing placement.
    const initial = {
      x: r.width / 2 - (STAGE_PAD_X + BOARD_OFFSET_X),
      y: r.height / 2 - (STAGE_PAD_Y + BOARD_OFFSET_Y),
    };
    panRef.current = initial;
    scaleRef.current = 1;
    setPanState(initial);
    setScaleState(1);
    applyTransform();
    notifyViewport();
  }, [containerRef, applyTransform, notifyViewport]);

  // Clean up any in-flight momentum on unmount.
  useEffect(() => () => cancelMomentum(), [cancelMomentum]);

  // ---------------------------------------------------------------------------
  // Pointer-down routing: space-pan OR board-drag-pan
  // ---------------------------------------------------------------------------

  const onContainerPointerDown: React.PointerEventHandler<HTMLDivElement> = useCallback(
    (e) => {
      const interactive = (e.target as HTMLElement).closest(
        "figure,button,input,textarea,select,label"
      );
      // Any new gesture cancels momentum immediately so the user's touch
      // anchors the view rather than fighting a decaying velocity.
      cancelMomentum();

      // Phase β: read spaceDown via ref so this handler's identity is
      // stable across renders — otherwise every board-canvas child gets
      // a new onPointerDown every time the user toggles space. cancelMomentum
      // is already stable (no React state deps).
      if (spaceDownRef.current) {
        e.preventDefault();
        panStartRef.current = { x: e.clientX, y: e.clientY };
        panOriginRef.current = { ...panRef.current };
        setIsPanning(true);
        e.currentTarget.setPointerCapture?.(e.pointerId);
        return;
      }
      if (interactive) return;
      e.preventDefault();
      boardDragStartRef.current = {
        x: e.clientX,
        y: e.clientY,
        panX: panRef.current.x,
        panY: panRef.current.y,
      };
      setDraggingBoard(true);
      e.currentTarget.setPointerCapture?.(e.pointerId);
    },
    [cancelMomentum]
  );

  // ---------------------------------------------------------------------------
  // Wheel zoom (focus-point preserving) — reads from refs, writes to refs.
  //
  // Attached via native addEventListener with { passive: false } so
  // preventDefault() actually suppresses page scroll. React synthetic wheel
  // handlers are passive since React 17, which turns preventDefault() into a
  // no-op + console warning per event.
  // ---------------------------------------------------------------------------

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (e.shiftKey) return;
      e.preventDefault();
      cancelMomentum();
      const factor = Math.exp(-e.deltaY * 0.003);
      const currScale = scaleRef.current;
      const currPan = panRef.current;
      const nextScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, currScale * factor));
      const r = el.getBoundingClientRect();
      const cx = e.clientX - r.left;
      const cy = e.clientY - r.top;
      const wx = (cx - currPan.x) / currScale;
      const wy = (cy - currPan.y) / currScale;
      writeRefs({
        scale: nextScale,
        pan: { x: cx - wx * nextScale, y: cy - wy * nextScale },
      });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [containerRef, cancelMomentum, writeRefs]);

  // ---------------------------------------------------------------------------
  // zoomToRect / screenToWorld
  // ---------------------------------------------------------------------------

  const zoomToRect = useCallback(
    (r: Rect, padding = 32) => {
      cancelMomentum();
      const el = containerRef.current;
      if (!el) return;
      const viewW = el.clientWidth || 1;
      const viewH = el.clientHeight || 1;
      const stageRect = toStageRect(r);
      const s = Math.max(
        MIN_SCALE,
        Math.min(
          MAX_SCALE,
          Math.min(
            viewW / (stageRect.w + padding * 2),
            viewH / (stageRect.h + padding * 2)
          )
        )
      );
      const nextPan = {
        x: (viewW - stageRect.w * s) / 2 - stageRect.x * s,
        y: (viewH - stageRect.h * s) / 2 - stageRect.y * s,
      };
      writeRefs({ scale: s, pan: nextPan });
    },
    [containerRef, cancelMomentum, writeRefs]
  );

  const screenToWorld = useCallback(
    (clientX: number, clientY: number): DropPos => {
      const el = containerRef.current;
      if (!el) return { x: 0, y: 0 };
      const r = el.getBoundingClientRect();
      const p = panRef.current;
      const s = scaleRef.current || 1;
      const stageX = (clientX - r.left - p.x) / s;
      const stageY = (clientY - r.top - p.y) / s;
      const worldX = stageX - STAGE_PAD_X - BOARD_OFFSET_X;
      const worldY = stageY - STAGE_PAD_Y - BOARD_OFFSET_Y;
      const gridX = Math.max(
        -GRID_RADIUS_X,
        Math.min(GRID_RADIUS_X, Math.round(worldX / TILE))
      );
      const gridY = Math.max(
        -GRID_RADIUS_Y,
        Math.min(GRID_RADIUS_Y, Math.round(worldY / TILE))
      );
      return { x: gridX * TILE, y: gridY * TILE };
    },
    [containerRef]
  );

  // ---------------------------------------------------------------------------
  // Viewport API (for virtualization)
  // ---------------------------------------------------------------------------

  const getViewport = useCallback(() => computeViewport(), [computeViewport]);

  const subscribeViewport = useCallback((cb: (v: Viewport) => void) => {
    viewportSubsRef.current.add(cb);
    // Fire once immediately so subscribers can initialize.
    try {
      cb(computeViewport());
    } catch {
      /* don't let a bad subscriber take down the hook */
    }
    return () => {
      viewportSubsRef.current.delete(cb);
    };
  }, [computeViewport]);

  return useMemo(
    () => ({
      scale,
      pan,
      spaceDown,
      isPanning,
      draggingBoard,
      onContainerPointerDown,
      zoomToRect,
      screenToWorld,
      setScale,
      setPan,
      bindStage,
      getViewport,
      subscribeViewport,
    }),
    [
      scale,
      pan,
      spaceDown,
      isPanning,
      draggingBoard,
      onContainerPointerDown,
      zoomToRect,
      screenToWorld,
      setScale,
      setPan,
      bindStage,
      getViewport,
      subscribeViewport,
    ]
  );
}
