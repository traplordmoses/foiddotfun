"use client";

import React, { useRef, useState, useEffect, useCallback } from "react";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import { PaintOverlay, PaintOverlayItem, PaintOverlayPatch } from "./PaintOverlay";
import { applyFilter, FILTERS, FilterId } from "../lib/paintFilters";

// ============================================================================
// TYPES
// ============================================================================

interface PaintEditorProps {
  imageFile: File;
  onDone: (editedFile: File) => void;
  onCancel: () => void;
  /**
   * Phase 5 · Step 17 — Preview on Board.
   * When supplied, the editor shows a "peek" button in the top bar. Clicking
   * it composes the current canvas (bg + filter + strokes + overlays) into a
   * File and hands it to the host, which is expected to render a placement
   * modal ABOVE this editor without unmounting it. When the user returns,
   * the editor is still mounted so paint state (history, overlays, filters,
   * zoom/pan) is preserved untouched. No side effects are mutated here —
   * composing is read-only with respect to editor state.
   */
  onPreviewOnBoard?: (editedFile: File) => void;
}

type Tool = "select" | "draw" | "eraser" | "sticker" | "text" | "eyedropper" | "stamp";

interface HistoryEntry {
  imageData: ImageData;
  paintOverlays: PaintOverlayItem[];
}

// FOID Foundation brand colors + essential drawing colors
const FOID_COLORS = [
  "#00cccc", "#a855f7", "#e040fb", "#f06292", "#74ffeb", "#00ddff",
] as const;

const STANDARD_COLORS = [
  "#ffffff", "#000000", "#ff0000", "#0066ff",
  "#00cc44", "#ffdd00", "#ff8800", "#ff69b4",
] as const;

const DEFAULT_MAX_HISTORY = 30;
const HISTORY_MEMORY_BUDGET = 100 * 1024 * 1024; // 100MB
const DEFAULT_TEXT_FONT_SIZE = 48;
const DEFAULT_STICKER_SIZE = 72;
// Foid-branded text font — matches --font-display (Sora) used elsewhere in the app
const TEXT_FONT_FAMILY = "'Sora', 'Inter', system-ui, sans-serif";
// Classic meme-text font for the Top/Bottom Impact overlay mode
const MEME_FONT_FAMILY = "'Impact', 'Arial Black', 'Haettenschweiler', sans-serif";
// Default natural size for a freshly-placed stamp (largest side, px)
const DEFAULT_STAMP_MAX = 240;
// Foid palette for text overlays
const TEXT_COLORS = ["#f06292", "#ffffff", "#000000", "#00cccc", "#a855f7", "#ffdd00"] as const;
const DEFAULT_TEXT_COLOR = "#f06292";

// Sticker drawer presets — emoji for now (Step 15 will upgrade visuals)
const STICKER_PRESETS: string[] = [
  "\u{1F525}", // 🔥 fire
  "\u{1F440}", // 👀 eyes
  "\u{1F4AF}", // 💯 hundred
  "\u{1F947}", // 🥇 gold medal
  "\u{1F680}", // 🚀 rocket
  "\u{2728}",  // ✨ sparkles
  "\u{1F44D}", // 👍
  "\u{1F4AB}", // 💫
];

// Magnifier constants
const MAGNIFIER_SIZE = 72;
const MAGNIFIER_ZOOM = 1.5;
const MAGNIFIER_OFFSET = 60;
const MAGNIFIER_SRC_CSS = MAGNIFIER_SIZE / MAGNIFIER_ZOOM;

// Trash zone
const TRASH_SIZE = 64;

// ============================================================================
// HELPERS
// ============================================================================

function generateId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

function haptic(style: "light" | "medium" | "heavy" = "light") {
  try {
    const ms = style === "light" ? 10 : style === "medium" ? 25 : 50;
    navigator?.vibrate?.(ms);
  } catch {
    /* not supported */
  }
}

function isTouchDevice(): boolean {
  if (typeof window === "undefined") return false;
  return "ontouchstart" in window || navigator.maxTouchPoints > 0;
}

// Composite a single overlay onto an arbitrary 2D context using its transform
function drawOverlayToCtx(
  ctx: CanvasRenderingContext2D,
  overlay: PaintOverlayItem,
  scaleX: number,
  scaleY: number,
  stampCache?: Map<string, HTMLImageElement>
) {
  ctx.save();
  ctx.translate(overlay.x * scaleX, overlay.y * scaleY);
  ctx.rotate(overlay.rotation);
  // Use average of scaleX/scaleY for uniform scale of overlay content
  const unifScale = (scaleX + scaleY) / 2;
  ctx.scale(overlay.scale * unifScale, overlay.scale * unifScale);

  if (overlay.kind === "text") {
    const isMeme = overlay.memeStyle === true;
    const fontFamily = isMeme ? MEME_FONT_FAMILY : TEXT_FONT_FAMILY;
    const body = isMeme ? (overlay.text || " ").toUpperCase() : overlay.text || " ";
    ctx.font = `900 ${overlay.fontSize}px ${fontFamily}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.lineJoin = "round";
    ctx.miterLimit = 2;
    if (isMeme) {
      ctx.lineWidth = Math.max(3, overlay.fontSize / 7);
      ctx.strokeStyle = "#000000";
      ctx.strokeText(body, 0, 0);
      ctx.fillStyle = "#ffffff";
      ctx.fillText(body, 0, 0);
    } else {
      ctx.lineWidth = Math.max(2, overlay.fontSize / 16);
      ctx.strokeStyle = "rgba(0,0,0,0.6)";
      ctx.strokeText(body, 0, 0);
      ctx.fillStyle = overlay.color;
      ctx.fillText(body, 0, 0);
    }
  } else if (overlay.kind === "stamp") {
    const img = stampCache?.get(overlay.src);
    if (img && img.complete && img.naturalWidth > 0) {
      ctx.drawImage(
        img,
        -overlay.width / 2,
        -overlay.height / 2,
        overlay.width,
        overlay.height
      );
    }
  } else {
    // Sticker (emoji)
    ctx.font = `${overlay.size}px ${TEXT_FONT_FAMILY}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(overlay.content, 0, 0);
  }

  ctx.restore();
}

// ============================================================================
// PAINT EDITOR COMPONENT
// ============================================================================

export function PaintEditor({ imageFile, onDone, onCancel, onPreviewOnBoard }: PaintEditorProps) {
  // Track music bar expansion to add bottom padding. The bar signals its
  // visible state by toggling `.cmp-active` on <html>. Watching that class
  // (not the old `.cmp-bar--visible` selector, which never existed) is how
  // the editor keeps the canvas from being occluded when the Easter-egg
  // player slides up.
  const [musicBarVisible, setMusicBarVisible] = useState(false);
  useEffect(() => {
    const html = document.documentElement;
    const sync = () => setMusicBarVisible(html.classList.contains("cmp-active"));
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(html, {
      attributes: true,
      attributeFilter: ["class"],
    });
    return () => observer.disconnect();
  }, []);

  // Desktop vs. mobile layout switch. Desktop (≥900 px) gets the classic
  // horizontal FOID_PAINT.EXE bottom toolbar with labels; narrower viewports
  // keep the existing right-side icon rail so mobile / tablet layout is
  // unchanged. Re-evaluated on resize so an orientation change flips cleanly.
  const [isDesktop, setIsDesktop] = useState(false);
  useEffect(() => {
    const check = () => setIsDesktop(window.innerWidth >= 900);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // Canvas refs
  const bgCanvasRef = useRef<HTMLCanvasElement>(null);
  const drawCanvasRef = useRef<HTMLCanvasElement>(null);
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const magnifierCanvasRef = useRef<HTMLCanvasElement>(null);
  const trashZoneRef = useRef<HTMLDivElement>(null);
  // Root of the editor dialog — used for the focus trap so Tab can't leak
  // out to the board behind it while the editor is open.
  const editorRootRef = useRef<HTMLDivElement>(null);
  // Unfiltered background at display resolution — used to re-apply filters non-destructively
  const originalBgImageDataRef = useRef<ImageData | null>(null);

  // Focus trap keeps Tab inside the editor + restores focus to the element
  // that opened it (usually the PROPOSE IMAGE button). Escape handling
  // stays in the keyboard shortcuts effect below because it already has
  // the cascading "clear selection first, then cancel" logic.
  useFocusTrap(editorRootRef);

  // State
  const [tool, setTool] = useState<Tool>("draw");
  const [color, setColor] = useState("#ff0000");
  const [brushSize, setBrushSize] = useState(8);
  const [brushOpacity, setBrushOpacity] = useState(1);
  const [isDrawing, setIsDrawing] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [fileName] = useState(() => imageFile.name.replace(/\.[^.]+$/, ""));
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [historyIdx, setHistoryIdx] = useState(-1);
  const [canvasDisplaySize, setCanvasDisplaySize] = useState({ w: 0, h: 0 });
  const [clearPending, setClearPending] = useState(false);
  const clearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchCountRef = useRef(0);

  // Overlay state
  const [paintOverlays, setPaintOverlays] = useState<PaintOverlayItem[]>([]);
  const [selectedOverlayId, setSelectedOverlayId] = useState<string | null>(null);
  const [editingOverlayId, setEditingOverlayId] = useState<string | null>(null);
  const [draggingOverlayId, setDraggingOverlayId] = useState<string | null>(null);
  const [trashHot, setTrashHot] = useState(false);
  const [showStickerDrawer, setShowStickerDrawer] = useState(false);

  // Effects drawer state
  const [effectsDrawerOpen, setEffectsDrawerOpen] = useState(false);
  const [effectsDrawerDragY, setEffectsDrawerDragY] = useState<number | null>(null);
  const drawerDragStartRef = useRef<{ y: number; open: boolean } | null>(null);
  const [currentFilter, setCurrentFilter] = useState<FilterId | null>(null);
  const [filterPerfMs, setFilterPerfMs] = useState<number | null>(null);

  // Wax-seal Done animation. `sealRect` captures the canvas-image bounds at
  // stamp time so the seal SVG can anchor to the centre of the image (including
  // current zoom + pan + scroll state) rather than the page.
  const [sealPhase, setSealPhase] = useState<"idle" | "stamping">("idle");
  const [sealRect, setSealRect] = useState<
    { x: number; y: number; w: number; h: number } | null
  >(null);

  // Magnifier state
  const [magnifier, setMagnifier] = useState<{ x: number; y: number; visible: boolean }>({
    x: 0,
    y: 0,
    visible: false,
  });

  // Zoom/pan state
  const [viewScale, setViewScale] = useState(1);
  const [viewOffset, setViewOffset] = useState({ x: 0, y: 0 });
  const pinchRef = useRef<{ dist: number; scale: number; cx: number; cy: number; ox: number; oy: number } | null>(null);
  const panRef = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);
  const viewScaleRef = useRef(viewScale);
  viewScaleRef.current = viewScale;
  // Persist zoom + pan across tool switches — nothing in the tool handlers touches these,
  // and the refs back the state so the transform is guaranteed stable even if a parent
  // re-render re-instantiates callbacks.
  const viewOffsetRef = useRef(viewOffset);
  viewOffsetRef.current = viewOffset;

  const originalImageRef = useRef<HTMLImageElement | null>(null);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);

  // Stamp state: hidden <input> for picking an image file + in-memory cache of
  // loaded HTMLImageElements keyed by overlay `src`. The cache lets the export
  // path (composeCurrentFile) paint the stamp onto the final canvas without
  // async re-loads per overlay.
  const stampInputRef = useRef<HTMLInputElement>(null);
  const stampImageCacheRef = useRef<Map<string, HTMLImageElement>>(new Map());
  // Bumped whenever a stamp image finishes loading so React re-renders
  // overlays that depend on the cache being populated.
  const [, setStampCacheVersion] = useState(0);

  // ============================================================================
  // IMAGE LOADING
  // ============================================================================

  const initCanvas = useCallback((img: HTMLImageElement) => {
    const bgCanvas = bgCanvasRef.current;
    const drawCanvas = drawCanvasRef.current;
    const container = canvasContainerRef.current;
    if (!bgCanvas || !drawCanvas || !container) return;

    const maxW = container.clientWidth;
    const maxH = container.clientHeight;
    const ratio = Math.min(maxW / img.naturalWidth, maxH / img.naturalHeight, 1);
    const w = Math.round(img.naturalWidth * ratio);
    const h = Math.round(img.naturalHeight * ratio);

    bgCanvas.width = w;
    bgCanvas.height = h;
    drawCanvas.width = w;
    drawCanvas.height = h;
    setCanvasDisplaySize({ w, h });

    const bgCtx = bgCanvas.getContext("2d");
    if (!bgCtx) return;
    bgCtx.drawImage(img, 0, 0, w, h);
    // Snapshot the unfiltered background so filters can be re-applied from source
    originalBgImageDataRef.current = bgCtx.getImageData(0, 0, w, h);
    setCurrentFilter(null);

    const drawCtx = drawCanvas.getContext("2d");
    if (!drawCtx) return;
    drawCtx.clearRect(0, 0, w, h);

    const initialData = drawCtx.getImageData(0, 0, w, h);
    const entry: HistoryEntry = { imageData: initialData, paintOverlays: [] };
    setHistory([entry]);
    setHistoryIdx(0);
    setPaintOverlays([]);
    setSelectedOverlayId(null);
    setEditingOverlayId(null);
  }, []);

  useEffect(() => {
    const img = new Image();
    const url = URL.createObjectURL(imageFile);
    img.onload = () => {
      originalImageRef.current = img;
      initCanvas(img);
      URL.revokeObjectURL(url);
      setLoaded(true);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
    };
    img.src = url;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imageFile]);

  // Resize handler
  useEffect(() => {
    if (!loaded || !originalImageRef.current) return;
    const onResize = () => {
      clearTimeout((onResize as unknown as Record<string, ReturnType<typeof setTimeout>>)._t);
      (onResize as unknown as Record<string, ReturnType<typeof setTimeout>>)._t = setTimeout(() => {
        if (originalImageRef.current) initCanvas(originalImageRef.current);
      }, 300);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [loaded, initCanvas]);

  // ============================================================================
  // HISTORY
  // ============================================================================

  const maxHistory = React.useMemo(() => {
    const { w, h } = canvasDisplaySize;
    if (!w || !h) return DEFAULT_MAX_HISTORY;
    const bytesPerSnapshot = w * h * 4;
    const limit = Math.max(10, Math.floor(HISTORY_MEMORY_BUDGET / bytesPerSnapshot));
    return Math.min(limit, 80);
  }, [canvasDisplaySize]);

  const pushHistory = useCallback(
    (nextOverlays?: PaintOverlayItem[]) => {
      const drawCanvas = drawCanvasRef.current;
      if (!drawCanvas) return;
      const ctx = drawCanvas.getContext("2d");
      if (!ctx) return;
      const data = ctx.getImageData(0, 0, drawCanvas.width, drawCanvas.height);
      const entry: HistoryEntry = {
        imageData: data,
        paintOverlays: nextOverlays ?? paintOverlays,
      };
      setHistory((prev) => {
        const truncated = prev.slice(0, historyIdx + 1);
        const next = [...truncated, entry];
        if (next.length > maxHistory) next.shift();
        return next;
      });
      setHistoryIdx((prev) => Math.min(prev + 1, maxHistory - 1));
    },
    [historyIdx, paintOverlays, maxHistory]
  );

  const undo = useCallback(() => {
    if (historyIdx <= 0) return;
    const drawCanvas = drawCanvasRef.current;
    if (!drawCanvas) return;
    const ctx = drawCanvas.getContext("2d");
    if (!ctx) return;
    const prev = history[historyIdx - 1];
    if (!prev) return;
    ctx.putImageData(prev.imageData, 0, 0);
    setPaintOverlays(prev.paintOverlays);
    setHistoryIdx((i) => i - 1);
  }, [history, historyIdx]);

  const redo = useCallback(() => {
    if (historyIdx >= history.length - 1) return;
    const drawCanvas = drawCanvasRef.current;
    if (!drawCanvas) return;
    const ctx = drawCanvas.getContext("2d");
    if (!ctx) return;
    const next = history[historyIdx + 1];
    if (!next) return;
    ctx.putImageData(next.imageData, 0, 0);
    setPaintOverlays(next.paintOverlays);
    setHistoryIdx((i) => i + 1);
  }, [history, historyIdx]);

  const handleClearClick = useCallback(() => {
    if (!clearPending) {
      setClearPending(true);
      haptic("medium");
      if (clearTimerRef.current) clearTimeout(clearTimerRef.current);
      clearTimerRef.current = setTimeout(() => setClearPending(false), 2000);
      return;
    }
    if (clearTimerRef.current) clearTimeout(clearTimerRef.current);
    setClearPending(false);
    haptic("heavy");
    const drawCanvas = drawCanvasRef.current;
    if (!drawCanvas) return;
    const ctx = drawCanvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, drawCanvas.width, drawCanvas.height);
    setPaintOverlays([]);
    setSelectedOverlayId(null);
    setEditingOverlayId(null);
    pushHistory([]);
  }, [clearPending, pushHistory]);

  // ============================================================================
  // DRAWING
  // ============================================================================

  const getCanvasPos = useCallback((clientX: number, clientY: number) => {
    const canvas = drawCanvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    };
  }, []);

  const drawLine = useCallback(
    (from: { x: number; y: number }, to: { x: number; y: number }) => {
      const canvas = drawCanvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(to.x, to.y);
      if (tool === "eraser") {
        ctx.globalCompositeOperation = "destination-out";
        ctx.globalAlpha = 1;
        ctx.strokeStyle = "rgba(0,0,0,1)";
      } else {
        ctx.globalCompositeOperation = "source-over";
        ctx.globalAlpha = brushOpacity;
        ctx.strokeStyle = color;
      }
      ctx.lineWidth = brushSize;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.stroke();
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = 1;
    },
    [tool, color, brushSize, brushOpacity]
  );

  // Magnifier blit
  const updateMagnifier = useCallback((clientX: number, clientY: number) => {
    const mag = magnifierCanvasRef.current;
    const bg = bgCanvasRef.current;
    const draw = drawCanvasRef.current;
    if (!mag || !bg || !draw) return;
    const rect = draw.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    const bmpPerCssX = draw.width / rect.width;
    const bmpPerCssY = draw.height / rect.height;

    const centerBmpX = (clientX - rect.left) * bmpPerCssX;
    const centerBmpY = (clientY - rect.top) * bmpPerCssY;
    const srcW = MAGNIFIER_SRC_CSS * bmpPerCssX;
    const srcH = MAGNIFIER_SRC_CSS * bmpPerCssY;
    const sx = centerBmpX - srcW / 2;
    const sy = centerBmpY - srcH / 2;

    const mctx = mag.getContext("2d");
    if (!mctx) return;
    mctx.clearRect(0, 0, MAGNIFIER_SIZE, MAGNIFIER_SIZE);
    mctx.fillStyle = "rgba(8,12,20,1)";
    mctx.fillRect(0, 0, MAGNIFIER_SIZE, MAGNIFIER_SIZE);

    const clampedSx = Math.max(0, Math.min(sx, bg.width));
    const clampedSy = Math.max(0, Math.min(sy, bg.height));
    const clampedSw = Math.max(0, Math.min(sx + srcW, bg.width) - clampedSx);
    const clampedSh = Math.max(0, Math.min(sy + srcH, bg.height) - clampedSy);
    if (clampedSw > 0 && clampedSh > 0) {
      const dx = (clampedSx - sx) * (MAGNIFIER_SIZE / srcW);
      const dy = (clampedSy - sy) * (MAGNIFIER_SIZE / srcH);
      const dw = clampedSw * (MAGNIFIER_SIZE / srcW);
      const dh = clampedSh * (MAGNIFIER_SIZE / srcH);
      try {
        mctx.drawImage(bg, clampedSx, clampedSy, clampedSw, clampedSh, dx, dy, dw, dh);
        mctx.drawImage(draw, clampedSx, clampedSy, clampedSw, clampedSh, dx, dy, dw, dh);
        // Also composite any text/sticker overlays so the lens matches reality
        for (const ov of paintOverlays) {
          drawOverlayToCtx(
            mctx,
            ov,
            MAGNIFIER_SIZE / srcW,
            MAGNIFIER_SIZE / srcH,
            stampImageCacheRef.current
          );
        }
      } catch {
        /* defensive */
      }
    }

    mctx.strokeStyle = "rgba(0,204,204,0.9)";
    mctx.lineWidth = 1;
    mctx.beginPath();
    mctx.moveTo(MAGNIFIER_SIZE / 2 - 6, MAGNIFIER_SIZE / 2);
    mctx.lineTo(MAGNIFIER_SIZE / 2 + 6, MAGNIFIER_SIZE / 2);
    mctx.moveTo(MAGNIFIER_SIZE / 2, MAGNIFIER_SIZE / 2 - 6);
    mctx.lineTo(MAGNIFIER_SIZE / 2, MAGNIFIER_SIZE / 2 + 6);
    mctx.stroke();
  }, [paintOverlays]);

  // Eyedropper
  const eyedrop = useCallback(
    (clientX: number, clientY: number) => {
      const bgCanvas = bgCanvasRef.current;
      const drawCanvas = drawCanvasRef.current;
      if (!bgCanvas || !drawCanvas) return;
      const pos = getCanvasPos(clientX, clientY);
      const drawCtx = drawCanvas.getContext("2d");
      const bgCtx = bgCanvas.getContext("2d");
      let pixel: Uint8ClampedArray | null = null;
      if (drawCtx) {
        const d = drawCtx.getImageData(Math.round(pos.x), Math.round(pos.y), 1, 1).data;
        if (d[3] > 10) pixel = d;
      }
      if (!pixel && bgCtx) {
        pixel = bgCtx.getImageData(Math.round(pos.x), Math.round(pos.y), 1, 1).data;
      }
      if (pixel) {
        const hex = `#${pixel[0].toString(16).padStart(2, "0")}${pixel[1]
          .toString(16)
          .padStart(2, "0")}${pixel[2].toString(16).padStart(2, "0")}`;
        setColor(hex);
        haptic("medium");
        setTool("draw");
      }
    },
    [getCanvasPos]
  );

  const startDraw = useCallback(
    (clientX: number, clientY: number) => {
      if (tool === "eyedropper") {
        eyedrop(clientX, clientY);
        return;
      }
      if (tool !== "draw" && tool !== "eraser") return;
      const pos = getCanvasPos(clientX, clientY);
      lastPointRef.current = pos;
      setIsDrawing(true);
      drawLine(pos, pos);
      if (isTouchDevice()) {
        setMagnifier({ x: clientX, y: clientY, visible: true });
        requestAnimationFrame(() => updateMagnifier(clientX, clientY));
      }
    },
    [tool, getCanvasPos, drawLine, eyedrop, updateMagnifier]
  );

  const moveDraw = useCallback(
    (clientX: number, clientY: number) => {
      if (!isDrawing) return;
      const pos = getCanvasPos(clientX, clientY);
      if (lastPointRef.current) {
        drawLine(lastPointRef.current, pos);
      }
      lastPointRef.current = pos;
      if (isTouchDevice()) {
        setMagnifier({ x: clientX, y: clientY, visible: true });
        updateMagnifier(clientX, clientY);
      }
    },
    [isDrawing, getCanvasPos, drawLine, updateMagnifier]
  );

  const endDraw = useCallback(() => {
    if (!isDrawing) return;
    setIsDrawing(false);
    lastPointRef.current = null;
    touchCountRef.current = 0;
    pushHistory();
    setMagnifier((prev) => ({ ...prev, visible: false }));
  }, [isDrawing, pushHistory]);

  // ============================================================================
  // CANVAS MOUSE/TOUCH EVENTS
  // ============================================================================

  const onCanvasMouseDown = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      e.preventDefault();
      if (tool === "draw" || tool === "eraser" || tool === "eyedropper") {
        startDraw(e.clientX, e.clientY);
      }
    },
    [tool, startDraw]
  );

  const onCanvasMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => moveDraw(e.clientX, e.clientY),
    [moveDraw]
  );

  const onCanvasMouseUp = useCallback(() => endDraw(), [endDraw]);

  const onCanvasTouchStart = useCallback(
    (e: React.TouchEvent<HTMLCanvasElement>) => {
      e.preventDefault();
      touchCountRef.current = e.touches.length;
      if (e.touches.length >= 2 && isDrawing) {
        setIsDrawing(false);
        lastPointRef.current = null;
        setMagnifier((prev) => ({ ...prev, visible: false }));
        const drawCanvas = drawCanvasRef.current;
        if (drawCanvas && history[historyIdx]) {
          const ctx = drawCanvas.getContext("2d");
          if (ctx) ctx.putImageData(history[historyIdx].imageData, 0, 0);
        }
        return;
      }
      const touch = e.touches[0];
      if (!touch) return;
      if (tool === "draw" || tool === "eraser" || tool === "eyedropper") {
        startDraw(touch.clientX, touch.clientY);
      }
    },
    [tool, startDraw, isDrawing, history, historyIdx]
  );

  const onCanvasTouchMove = useCallback(
    (e: React.TouchEvent<HTMLCanvasElement>) => {
      e.preventDefault();
      if (e.touches.length >= 2) return;
      const touch = e.touches[0];
      if (!touch) return;
      moveDraw(touch.clientX, touch.clientY);
    },
    [moveDraw]
  );

  const onCanvasTouchEnd = useCallback(
    (e: React.TouchEvent<HTMLCanvasElement>) => {
      e.preventDefault();
      touchCountRef.current = e.touches.length;
      if (e.touches.length === 0) endDraw();
    },
    [endDraw]
  );

  // ============================================================================
  // OVERLAY CREATION / MANAGEMENT
  // ============================================================================

  const addTextOverlay = useCallback(() => {
    const { w, h } = canvasDisplaySize;
    if (!w || !h) return;
    const id = generateId();
    const overlay: PaintOverlayItem = {
      id,
      kind: "text",
      x: w / 2,
      y: h / 2,
      scale: 1,
      rotation: 0,
      text: "Text",
      color: DEFAULT_TEXT_COLOR,
      fontSize: DEFAULT_TEXT_FONT_SIZE,
    };
    const updated = [...paintOverlays, overlay];
    setPaintOverlays(updated);
    setSelectedOverlayId(id);
    setEditingOverlayId(id);
    pushHistory(updated);
    haptic("light");
  }, [canvasDisplaySize, color, paintOverlays, pushHistory]);

  // Meme text: two classic Impact-styled overlays — one pinned top-centre and
  // one bottom-centre of the image. Users can still drag them after placement,
  // but the initial positions + styling match the "top text / bottom text"
  // mental model. Additive to the free-positioned text tool above.
  const addMemeTextOverlays = useCallback(() => {
    const { w, h } = canvasDisplaySize;
    if (!w || !h) return;
    const fontSize = Math.max(28, Math.min(w / 10, 72));
    const pad = Math.max(24, h * 0.08);
    const topId = generateId();
    const bottomId = generateId();
    const top: PaintOverlayItem = {
      id: topId,
      kind: "text",
      x: w / 2,
      y: pad,
      scale: 1,
      rotation: 0,
      text: "TOP TEXT",
      color: "#ffffff",
      fontSize,
      memeStyle: true,
    };
    const bottom: PaintOverlayItem = {
      id: bottomId,
      kind: "text",
      x: w / 2,
      y: h - pad,
      scale: 1,
      rotation: 0,
      text: "BOTTOM TEXT",
      color: "#ffffff",
      fontSize,
      memeStyle: true,
    };
    const updated = [...paintOverlays, top, bottom];
    setPaintOverlays(updated);
    setSelectedOverlayId(topId);
    setEditingOverlayId(topId);
    pushHistory(updated);
    haptic("light");
  }, [canvasDisplaySize, paintOverlays, pushHistory]);

  const addStickerOverlay = useCallback(
    (content: string) => {
      const { w, h } = canvasDisplaySize;
      if (!w || !h) return;
      const id = generateId();
      const overlay: PaintOverlayItem = {
        id,
        kind: "sticker",
        x: w / 2,
        y: h / 2,
        scale: 1,
        rotation: 0,
        content,
        size: DEFAULT_STICKER_SIZE,
      };
      const updated = [...paintOverlays, overlay];
      setPaintOverlays(updated);
      setSelectedOverlayId(id);
      setShowStickerDrawer(false);
      pushHistory(updated);
      haptic("light");
    },
    [canvasDisplaySize, paintOverlays, pushHistory]
  );

  // Stamp overlay: load a file as a data-URL + HTMLImageElement, then drop it
  // in the centre of the canvas. Dimensions are constrained so a large stamp
  // (say a 4000px JPEG) starts at DEFAULT_STAMP_MAX on its longest edge —
  // small enough to see, large enough to immediately read.
  const addStampFromFile = useCallback(
    (file: File) => {
      const { w: cw, h: ch } = canvasDisplaySize;
      if (!cw || !ch) return;
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result;
        if (typeof dataUrl !== "string") return;
        const img = new Image();
        img.onload = () => {
          const nw = img.naturalWidth;
          const nh = img.naturalHeight;
          if (!nw || !nh) return;
          const longest = Math.max(nw, nh);
          const targetMax = Math.min(DEFAULT_STAMP_MAX, Math.min(cw, ch) * 0.7);
          const ratio = longest > targetMax ? targetMax / longest : 1;
          const width = Math.round(nw * ratio);
          const height = Math.round(nh * ratio);
          stampImageCacheRef.current.set(dataUrl, img);
          setStampCacheVersion((v) => v + 1);
          const id = generateId();
          const overlay: PaintOverlayItem = {
            id,
            kind: "stamp",
            x: cw / 2,
            y: ch / 2,
            scale: 1,
            rotation: 0,
            src: dataUrl,
            width,
            height,
          };
          setPaintOverlays((prev) => {
            const next = [...prev, overlay];
            pushHistory(next);
            return next;
          });
          setSelectedOverlayId(id);
          haptic("light");
        };
        img.src = dataUrl;
      };
      reader.readAsDataURL(file);
    },
    [canvasDisplaySize, pushHistory]
  );

  const handleStampInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) addStampFromFile(file);
      e.target.value = "";
    },
    [addStampFromFile]
  );

  const handleOverlayTransform = useCallback(
    (id: string, patch: PaintOverlayPatch) => {
      setPaintOverlays((prev) =>
        prev.map((o) => {
          if (o.id !== id) return o;
          if (o.kind === "text") {
            return {
              ...o,
              ...(patch.x !== undefined ? { x: patch.x } : {}),
              ...(patch.y !== undefined ? { y: patch.y } : {}),
              ...(patch.scale !== undefined ? { scale: patch.scale } : {}),
              ...(patch.rotation !== undefined ? { rotation: patch.rotation } : {}),
              ...(patch.text !== undefined ? { text: patch.text } : {}),
              ...(patch.color !== undefined ? { color: patch.color } : {}),
              ...(patch.fontSize !== undefined ? { fontSize: patch.fontSize } : {}),
              ...(patch.memeStyle !== undefined ? { memeStyle: patch.memeStyle } : {}),
            };
          } else if (o.kind === "stamp") {
            return {
              ...o,
              ...(patch.x !== undefined ? { x: patch.x } : {}),
              ...(patch.y !== undefined ? { y: patch.y } : {}),
              ...(patch.scale !== undefined ? { scale: patch.scale } : {}),
              ...(patch.rotation !== undefined ? { rotation: patch.rotation } : {}),
              ...(patch.width !== undefined ? { width: patch.width } : {}),
              ...(patch.height !== undefined ? { height: patch.height } : {}),
              ...(patch.src !== undefined ? { src: patch.src } : {}),
            };
          } else {
            return {
              ...o,
              ...(patch.x !== undefined ? { x: patch.x } : {}),
              ...(patch.y !== undefined ? { y: patch.y } : {}),
              ...(patch.scale !== undefined ? { scale: patch.scale } : {}),
              ...(patch.rotation !== undefined ? { rotation: patch.rotation } : {}),
              ...(patch.content !== undefined ? { content: patch.content } : {}),
              ...(patch.size !== undefined ? { size: patch.size } : {}),
            };
          }
        })
      );

      // During active drag, update trash hot state against trash bbox
      if (draggingOverlayId === id) {
        const trash = trashZoneRef.current;
        if (trash) {
          // We don't have clientX here; track hot via dragEnd instead.
          // But we can update via screen coords derived from overlay state — skip for now.
        }
      }
    },
    [draggingOverlayId]
  );

  const handleOverlayDragStart = useCallback((id: string) => {
    setDraggingOverlayId(id);
    setTrashHot(false);
  }, []);

  const handleOverlayDragEnd = useCallback(
    (id: string, clientX: number, clientY: number) => {
      const trash = trashZoneRef.current;
      let deleted = false;
      if (trash) {
        const r = trash.getBoundingClientRect();
        if (clientX >= r.left && clientX <= r.right && clientY >= r.top && clientY <= r.bottom) {
          // Dropped on trash
          const updated = paintOverlays.filter((o) => o.id !== id);
          setPaintOverlays(updated);
          if (selectedOverlayId === id) setSelectedOverlayId(null);
          if (editingOverlayId === id) setEditingOverlayId(null);
          pushHistory(updated);
          haptic("heavy");
          deleted = true;
        }
      }
      if (!deleted) {
        // Also delete if the overlay was dragged off the canvas
        const drawCanvas = drawCanvasRef.current;
        if (drawCanvas) {
          const r = drawCanvas.getBoundingClientRect();
          if (clientX < r.left || clientX > r.right || clientY < r.top || clientY > r.bottom) {
            const updated = paintOverlays.filter((o) => o.id !== id);
            setPaintOverlays(updated);
            if (selectedOverlayId === id) setSelectedOverlayId(null);
            if (editingOverlayId === id) setEditingOverlayId(null);
            pushHistory(updated);
            haptic("heavy");
            deleted = true;
          }
        }
      }
      if (!deleted) {
        // Transform likely committed — snapshot history after a settle
        pushHistory();
      }
      setDraggingOverlayId(null);
      setTrashHot(false);
    },
    [paintOverlays, selectedOverlayId, editingOverlayId, pushHistory]
  );

  const handleOverlayDoubleTap = useCallback((id: string) => {
    const overlay = paintOverlays.find((o) => o.id === id);
    if (!overlay) return;
    if (overlay.kind === "text") {
      setEditingOverlayId(id);
      setSelectedOverlayId(id);
      haptic("light");
    }
  }, [paintOverlays]);

  const handleOverlayTextChange = useCallback((id: string, text: string) => {
    setPaintOverlays((prev) =>
      prev.map((o) => (o.id === id && o.kind === "text" ? { ...o, text } : o))
    );
  }, []);

  const handleOverlayEditDone = useCallback(() => {
    setEditingOverlayId(null);
    pushHistory();
  }, [pushHistory]);

  // Track trash-hot during drag via a global pointermove listener
  useEffect(() => {
    if (!draggingOverlayId) return;
    const onMove = (e: PointerEvent) => {
      const trash = trashZoneRef.current;
      if (!trash) return;
      const r = trash.getBoundingClientRect();
      const inside =
        e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
      setTrashHot((prev) => (prev === inside ? prev : inside));
    };
    window.addEventListener("pointermove", onMove);
    return () => window.removeEventListener("pointermove", onMove);
  }, [draggingOverlayId]);

  // ============================================================================
  // FILTERS
  // ============================================================================

  const applyFilterToBg = useCallback((id: FilterId | null) => {
    const bgCanvas = bgCanvasRef.current;
    const src = originalBgImageDataRef.current;
    if (!bgCanvas || !src) return;
    const ctx = bgCanvas.getContext("2d");
    if (!ctx) return;
    const t0 = performance.now();
    if (id === null) {
      // Reset to original
      ctx.putImageData(src, 0, 0);
    } else {
      const filtered = applyFilter(id, src);
      ctx.putImageData(filtered, 0, 0);
    }
    const dt = performance.now() - t0;
    setFilterPerfMs(dt);
    setCurrentFilter(id);
    haptic("light");
  }, []);

  // ============================================================================
  // EFFECTS DRAWER GESTURES
  // ============================================================================
  // The drawer lives in a fixed-position element whose transform is a mix of
  // its "rest state" (0% when open, 100% when closed) plus a live pixel offset
  // pulled from effectsDrawerDragY. Clamping keeps the drawer on-screen.

  const clampDragOffset = useCallback((rawDy: number, wasOpen: boolean) => {
    const drawerH = typeof window !== "undefined" ? window.innerHeight * 0.4 : 300;
    if (wasOpen) {
      // Rest = 0%; can only drag down (positive dy) toward 100%.
      return Math.max(0, Math.min(drawerH, rawDy));
    }
    // Rest = 100%; can only drag up (negative dy) toward 0%.
    return Math.max(-drawerH, Math.min(0, rawDy));
  }, []);

  const onDrawerPointerDown = useCallback(
    (e: React.PointerEvent) => {
      try {
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      } catch {
        /* capture not supported */
      }
      drawerDragStartRef.current = { y: e.clientY, open: effectsDrawerOpen };
      setEffectsDrawerDragY(0);
    },
    [effectsDrawerOpen]
  );

  const onDrawerPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!drawerDragStartRef.current) return;
      const raw = e.clientY - drawerDragStartRef.current.y;
      setEffectsDrawerDragY(clampDragOffset(raw, drawerDragStartRef.current.open));
    },
    [clampDragOffset]
  );

  const onDrawerPointerUp = useCallback((e: React.PointerEvent) => {
    if (!drawerDragStartRef.current) return;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      /* already released */
    }
    const raw = e.clientY - drawerDragStartRef.current.y;
    const wasOpen = drawerDragStartRef.current.open;
    const drawerH = typeof window !== "undefined" ? window.innerHeight * 0.4 : 300;
    const threshold = drawerH * 0.25; // 25% commits, else snap back
    if (wasOpen && raw > threshold) {
      setEffectsDrawerOpen(false);
      haptic("light");
    } else if (!wasOpen && raw < -threshold) {
      setEffectsDrawerOpen(true);
      haptic("light");
    }
    drawerDragStartRef.current = null;
    setEffectsDrawerDragY(null);
  }, []);

  // ============================================================================
  // EXPORT / DONE
  // ============================================================================

  const [exporting, setExporting] = useState(false);
  const [previewing, setPreviewing] = useState(false);

  // Pure composite — returns a File without touching editor state. Used by
  // both the final "Done" flow (which also runs the seal animation) and the
  // Step-17 "Preview on Board" peek (which must not mutate anything).
  const composeCurrentFile = useCallback((): Promise<File | null> => {
    return new Promise((resolve) => {
      const bgCanvas = bgCanvasRef.current;
      const drawCanvas = drawCanvasRef.current;
      const img = originalImageRef.current;
      if (!bgCanvas || !drawCanvas || !img) {
        resolve(null);
        return;
      }
      const exportCanvas = document.createElement("canvas");
      exportCanvas.width = img.naturalWidth;
      exportCanvas.height = img.naturalHeight;
      const ectx = exportCanvas.getContext("2d");
      if (!ectx) {
        resolve(null);
        return;
      }
      // 1. Filtered background at full res (bgCanvas already has filter baked in).
      ectx.drawImage(bgCanvas, 0, 0, img.naturalWidth, img.naturalHeight);
      // 2. Drawing strokes, upscaled.
      ectx.drawImage(drawCanvas, 0, 0, img.naturalWidth, img.naturalHeight);
      // 3. Text + sticker overlays.
      const scaleX = img.naturalWidth / canvasDisplaySize.w;
      const scaleY = img.naturalHeight / canvasDisplaySize.h;
      for (const overlay of paintOverlays) {
        drawOverlayToCtx(ectx, overlay, scaleX, scaleY, stampImageCacheRef.current);
      }

      const isPng =
        imageFile.type === "image/png" || imageFile.name.toLowerCase().endsWith(".png");
      const mimeType = isPng ? "image/png" : "image/jpeg";
      const ext = isPng ? ".png" : ".jpg";
      const quality = isPng ? undefined : 0.92;
      exportCanvas.toBlob(
        (blob) => {
          if (!blob) {
            resolve(null);
            return;
          }
          const name = (fileName || imageFile.name.replace(/\.[^.]+$/, "")) + ext;
          resolve(new File([blob], name, { type: mimeType }));
        },
        mimeType,
        quality
      );
    });
  }, [imageFile, paintOverlays, canvasDisplaySize, fileName]);

  const composeAndEmit = useCallback(() => {
    composeCurrentFile().then((file) => {
      if (!file) {
        setExporting(false);
        setSealPhase("idle");
        return;
      }
      onDone(file);
    });
  }, [composeCurrentFile, onDone]);

  const handleDone = useCallback(() => {
    if (exporting || sealPhase !== "idle") return;
    // Snapshot the image rect now so the seal can anchor to the current
    // image centre — cheaper than re-reading on every paint during the
    // animation, and avoids mid-animation drift if the layout shifts.
    const bg = bgCanvasRef.current;
    if (bg) {
      const r = bg.getBoundingClientRect();
      setSealRect({ x: r.left, y: r.top, w: r.width, h: r.height });
    } else {
      setSealRect(null);
    }
    setExporting(true);
    setSealPhase("stamping");
    haptic("heavy");
    // Seal animates 0→~380ms (scale-in + bounce). Composite kicks off near the end
    // so the returned image is ready as the seal fades out (~500ms total).
    window.setTimeout(() => {
      composeAndEmit();
    }, 460);
  }, [exporting, sealPhase, composeAndEmit]);

  // Step 17 — Preview on Board. Compose silently (no seal animation) and hand
  // the file to the host. State is untouched so the round-trip is transparent.
  const previewDisabled =
    !loaded || isDrawing || exporting || previewing || sealPhase !== "idle";
  const handlePreviewOnBoard = useCallback(async () => {
    if (!onPreviewOnBoard || previewDisabled) return;
    setPreviewing(true);
    haptic("light");
    try {
      const file = await composeCurrentFile();
      if (file) onPreviewOnBoard(file);
    } finally {
      setPreviewing(false);
    }
  }, [onPreviewOnBoard, previewDisabled, composeCurrentFile]);

  // ============================================================================
  // KEYBOARD SHORTCUTS
  // ============================================================================

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;

      if ((e.ctrlKey || e.metaKey) && e.key === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "y") {
        e.preventDefault();
        redo();
        return;
      }
      if ((e.key === "Delete" || e.key === "Backspace") && selectedOverlayId) {
        e.preventDefault();
        const updated = paintOverlays.filter((o) => o.id !== selectedOverlayId);
        setPaintOverlays(updated);
        setSelectedOverlayId(null);
        setEditingOverlayId(null);
        pushHistory(updated);
        return;
      }
      if (e.key === "Escape") {
        // Escape cascade: if a selection/drawer is open, clear that first.
        // Only if we're idle does Escape cancel the whole editor. This
        // matches the one-action-per-Escape mental model from other pro
        // image editors (Figma, Photoshop) and keeps power users happy.
        if (selectedOverlayId || editingOverlayId || showStickerDrawer) {
          setSelectedOverlayId(null);
          setEditingOverlayId(null);
          setShowStickerDrawer(false);
          return;
        }
        e.preventDefault();
        onCancel();
        return;
      }
      if (e.key === "Enter" && !e.shiftKey) {
        // Enter confirms — same effect as clicking the DONE button. Ignored
        // while an overlay is being edited (that Enter goes into the text
        // input). Shift+Enter is reserved for newlines in text overlays.
        if (editingOverlayId) return;
        e.preventDefault();
        handleDone();
        return;
      }
      if (e.key === "b" || e.key === "B") {
        setTool("draw");
        haptic("light");
      }
      if (e.key === "e" || e.key === "E") {
        setTool("eraser");
        haptic("light");
      }
      if (e.key === "t" || e.key === "T") {
        // T selects the text tool — placed here (not bound in the existing
        // V/I cluster) so its shortcut lands with B/E in the user-facing
        // toolbar order: Brush / Eraser / Text.
        setTool("text");
        haptic("light");
      }
      if (e.key === "v" || e.key === "V") {
        setTool("select");
        haptic("light");
      }
      if (e.key === "i" || e.key === "I") {
        setTool("eyedropper");
        haptic("light");
      }
      if (e.key === "[" || e.key === "-") setBrushSize((s) => Math.max(1, s - (s > 10 ? 4 : 2)));
      if (e.key === "]" || e.key === "=" || e.key === "+")
        setBrushSize((s) => Math.min(100, s + (s >= 10 ? 4 : 2)));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [
    undo,
    redo,
    selectedOverlayId,
    paintOverlays,
    pushHistory,
    // New deps from Escape/Enter/T extensions below:
    editingOverlayId,
    showStickerDrawer,
    onCancel,
    handleDone,
  ]);

  // ============================================================================
  // ZOOM/PAN GESTURES (canvas container)
  // ============================================================================

  const handleContainerTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (e.touches.length === 2) {
        const t1 = e.touches[0];
        const t2 = e.touches[1];
        const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
        const cx = (t1.clientX + t2.clientX) / 2;
        const cy = (t1.clientY + t2.clientY) / 2;
        pinchRef.current = {
          dist,
          scale: viewScale,
          cx,
          cy,
          ox: viewOffset.x,
          oy: viewOffset.y,
        };
        panRef.current = null;
      } else if (e.touches.length === 1 && tool === "select") {
        const t = e.touches[0];
        panRef.current = {
          x: t.clientX,
          y: t.clientY,
          ox: viewOffset.x,
          oy: viewOffset.y,
        };
      }
    },
    [viewScale, viewOffset, tool]
  );

  const handleContainerTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (e.touches.length === 2 && pinchRef.current) {
        e.preventDefault();
        const t1 = e.touches[0];
        const t2 = e.touches[1];
        const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
        const newScale = Math.min(
          5,
          Math.max(0.5, pinchRef.current.scale * (dist / pinchRef.current.dist))
        );
        const cx = (t1.clientX + t2.clientX) / 2;
        const cy = (t1.clientY + t2.clientY) / 2;
        const dx = cx - pinchRef.current.cx;
        const dy = cy - pinchRef.current.cy;
        setViewScale(newScale);
        setViewOffset({ x: pinchRef.current.ox + dx, y: pinchRef.current.oy + dy });
      } else if (e.touches.length === 1 && panRef.current && tool === "select") {
        const t = e.touches[0];
        setViewOffset({
          x: panRef.current.ox + (t.clientX - panRef.current.x),
          y: panRef.current.oy + (t.clientY - panRef.current.y),
        });
      }
    },
    [tool]
  );

  const handleContainerTouchEnd = useCallback(() => {
    pinchRef.current = null;
    panRef.current = null;
  }, []);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const factor = Math.exp(-e.deltaY * 0.003);
    setViewScale((s) => Math.min(5, Math.max(0.5, s * factor)));
  }, []);

  const zoomIn = useCallback(() => {
    setViewScale((s) => Math.min(5, s * 1.3));
    haptic("light");
  }, []);
  const zoomOut = useCallback(() => {
    setViewScale((s) => Math.max(0.5, s / 1.3));
    haptic("light");
  }, []);
  const resetZoom = useCallback(() => {
    setViewScale(1);
    setViewOffset({ x: 0, y: 0 });
    haptic("light");
  }, []);

  // ============================================================================
  // BRUSH CURSOR
  // ============================================================================

  const cursorStyle = React.useMemo(() => {
    if (tool === "sticker") return "copy";
    if (tool === "eyedropper") return "crosshair";
    if (tool !== "draw" && tool !== "eraser") return "default";
    // Foid sigil cursor — stylised "F" on a soft rounded tile, brush colour fills the F.
    // Fixed 28×28 glyph; brush size is visible in the bottom strip rather than the cursor.
    const sigilColor = tool === "eraser" ? "#ffffff" : color;
    const bg = tool === "eraser" ? "rgba(16,20,32,0.55)" : "rgba(16,20,32,0.42)";
    const accent = tool === "eraser" ? "rgba(255,255,255,0.55)" : "rgba(0,204,204,0.55)";
    const svg =
      `<svg xmlns='http://www.w3.org/2000/svg' width='28' height='28' viewBox='0 0 32 32'>` +
      `<rect x='2' y='2' width='28' height='28' rx='7' fill='${bg}' stroke='${accent}' stroke-width='1'/>` +
      `<path d='M10 24V8h12v3h-8v4h6v3h-6v6z' fill='${sigilColor}'/>` +
      `<circle cx='16' cy='16' r='1' fill='${sigilColor}'/>` +
      `</svg>`;
    const encoded = encodeURIComponent(svg);
    // Hotspot at sigil centre
    return `url("data:image/svg+xml,${encoded}") 14 14, crosshair`;
  }, [tool, color]);

  // ============================================================================
  // RENDER
  // ============================================================================

  const ICON = {
    draw: (
      <svg width="20" height="20" viewBox="0 0 14 14" fill="none">
        <path d="M10.5 1.5L12.5 3.5L4.5 11.5L1.5 12.5L2.5 9.5L10.5 1.5Z" stroke="currentColor" strokeWidth="1.2" fill="none" />
      </svg>
    ),
    text: (
      <svg width="20" height="20" viewBox="0 0 14 14" fill="none">
        <text x="2" y="12" fontSize="12" fontWeight="900" fontFamily="Impact" fill="currentColor">
          A
        </text>
      </svg>
    ),
    sticker: (
      <svg width="20" height="20" viewBox="0 0 14 14" fill="none">
        <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.2" fill="none" />
        <circle cx="5" cy="6" r="0.8" fill="currentColor" />
        <circle cx="9" cy="6" r="0.8" fill="currentColor" />
        <path d="M4.5 9C5.5 10 8.5 10 9.5 9" stroke="currentColor" strokeWidth="1.2" fill="none" strokeLinecap="round" />
      </svg>
    ),
    pick: (
      <svg width="20" height="20" viewBox="0 0 14 14" fill="none">
        <path
          d="M11.5 2.5L9.5 4.5M9.5 4.5L5 9L4 10.5L3.5 10L5 9L9.5 4.5Z"
          stroke="currentColor"
          strokeWidth="1.2"
          fill="none"
          strokeLinecap="round"
        />
        <path d="M2 12L3.5 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <circle cx="11.5" cy="2.5" r="1.5" stroke="currentColor" strokeWidth="1" fill="none" />
      </svg>
    ),
    eraser: (
      <svg width="20" height="20" viewBox="0 0 14 14" fill="none">
        <rect x="2" y="6" width="10" height="5" rx="1" stroke="currentColor" strokeWidth="1.2" fill="none" />
        <path d="M4 6V4C4 3.4 4.4 3 5 3H9C9.6 3 10 3.4 10 4V6" stroke="currentColor" strokeWidth="1.2" />
      </svg>
    ),
    undo: (
      <svg width="20" height="20" viewBox="0 0 14 14" fill="none">
        <path d="M4 5L1 8L4 11" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" />
        <path d="M1 8H9C11 8 12.5 9.5 12.5 11" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" />
      </svg>
    ),
    redo: (
      <svg width="18" height="18" viewBox="0 0 14 14" fill="none">
        <path d="M10 5L13 8L10 11" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" />
        <path d="M13 8H5C3 8 1.5 9.5 1.5 11" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" />
      </svg>
    ),
    trash: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
        <path d="M4 7H20" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        <path d="M10 4H14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        <path d="M6 7L7 20C7 20.5 7.5 21 8 21H16C16.5 21 17 20.5 17 20L18 7" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      </svg>
    ),
    effects: (
      <svg width="20" height="20" viewBox="0 0 16 16" fill="none">
        <path
          d="M8 1.5L9.5 5.5L13.5 6L10.5 8.8L11.3 12.8L8 10.8L4.7 12.8L5.5 8.8L2.5 6L6.5 5.5L8 1.5Z"
          stroke="currentColor"
          strokeWidth="1.2"
          fill="none"
          strokeLinejoin="round"
        />
      </svg>
    ),
    stamp: (
      <svg width="20" height="20" viewBox="0 0 14 14" fill="none">
        <rect x="1" y="3" width="12" height="8" rx="1" stroke="currentColor" strokeWidth="1.2" fill="none" />
        <circle cx="4" cy="6" r="1.2" fill="currentColor" />
        <path d="M1 10L4.5 7L7 9L9.5 6.5L13 10" stroke="currentColor" strokeWidth="1.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    memeText: (
      <svg width="20" height="20" viewBox="0 0 16 16" fill="none">
        <text x="2" y="7" fontSize="6" fontWeight="900" fontFamily="Impact" fill="currentColor">TOP</text>
        <text x="2" y="14" fontSize="6" fontWeight="900" fontFamily="Impact" fill="currentColor">BOT</text>
      </svg>
    ),
  };

  // Mobile shows the contextual bottom strip for both drawing (color/size/
  // opacity) and text editing. On desktop, color + size live in the main
  // horizontal toolbar, so the contextual strip is only useful for text
  // editing — otherwise it'd just duplicate controls.
  const showBottomStrip = isDesktop
    ? tool === "text" && selectedOverlayId !== null
    : tool === "draw" || (tool === "text" && selectedOverlayId !== null);
  const selectedOverlay = selectedOverlayId
    ? paintOverlays.find((o) => o.id === selectedOverlayId) ?? null
    : null;
  const magnifierFlipBelow = magnifier.y - MAGNIFIER_OFFSET - MAGNIFIER_SIZE < 8;

  return (
    <div
      ref={editorRootRef}
      role="dialog"
      aria-modal="true"
      aria-label="Paint editor — draw, add text, and confirm your image before placement"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 99999,
        display: "flex",
        flexDirection: "column",
        background: "rgba(8, 12, 20, 0.98)",
        // Bottom padding shrinks the canvas area so the music bar and the
        // desktop bottom toolbar never occlude the image: canvas + strokes
        // are guaranteed rendered fully above whichever chrome is present.
        paddingBottom: (isDesktop ? 64 : 0) + (musicBarVisible ? 48 : 0),
        transition: "padding-bottom 0.2s ease",
      }}
    >
      {/* ============ FULL-BLEED CANVAS AREA ============ */}
      <div
        ref={canvasContainerRef}
        style={{
          flex: 1,
          minHeight: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
          padding: 0,
          position: "relative",
          background: "rgba(8, 12, 20, 0.95)",
        }}
        onTouchStart={handleContainerTouchStart}
        onTouchMove={handleContainerTouchMove}
        onTouchEnd={handleContainerTouchEnd}
        onWheel={handleWheel}
        onClick={() => {
          setSelectedOverlayId(null);
          setShowStickerDrawer(false);
        }}
      >
        {!loaded && (
          <div
            style={{
              color: "rgba(255,255,255,0.5)",
              fontSize: 13,
              fontFamily: "var(--font-terminal), monospace",
              letterSpacing: "0.1em",
            }}
          >
            LOADING IMAGE...
          </div>
        )}

        {/* Canvas stack + overlays */}
        <div
          style={{
            position: "relative",
            display: loaded ? "block" : "none",
            lineHeight: 0,
            transform: `translate(${viewOffset.x}px, ${viewOffset.y}px) scale(${viewScale})`,
            transformOrigin: "center center",
            transition: pinchRef.current ? "none" : "transform 0.15s ease-out",
          }}
        >
          <canvas
            ref={bgCanvasRef}
            style={{ display: "block", boxShadow: "0 4px 24px rgba(0,0,0,0.5)" }}
          />
          <canvas
            ref={drawCanvasRef}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              display: "block",
              cursor: cursorStyle,
              touchAction: "none",
            }}
            onMouseDown={onCanvasMouseDown}
            onMouseMove={onCanvasMouseMove}
            onMouseUp={onCanvasMouseUp}
            onMouseLeave={onCanvasMouseUp}
            onTouchStart={onCanvasTouchStart}
            onTouchMove={onCanvasTouchMove}
            onTouchEnd={onCanvasTouchEnd}
          />

          {/* Paint overlays (text + stickers) */}
          {paintOverlays.map((ov) => (
            <PaintOverlay
              key={ov.id}
              overlay={ov}
              selected={selectedOverlayId === ov.id}
              editing={editingOverlayId === ov.id}
              viewScale={viewScale}
              onTransform={handleOverlayTransform}
              onDragStart={handleOverlayDragStart}
              onDragEnd={handleOverlayDragEnd}
              onDoubleTap={handleOverlayDoubleTap}
              onSelect={(id) => setSelectedOverlayId(id)}
              onTextChange={handleOverlayTextChange}
              onEditDone={handleOverlayEditDone}
            />
          ))}
        </div>

        {/* ============ MAGNIFIER LENS ============ */}
        {magnifier.visible && (tool === "draw" || tool === "eraser") && (
          <div
            style={{
              position: "fixed",
              left: magnifier.x,
              top: magnifierFlipBelow ? magnifier.y + MAGNIFIER_OFFSET : magnifier.y - MAGNIFIER_OFFSET,
              width: MAGNIFIER_SIZE,
              height: MAGNIFIER_SIZE,
              transform: magnifierFlipBelow ? "translate(-50%, 0)" : "translate(-50%, -100%)",
              pointerEvents: "none",
              zIndex: 60,
              borderRadius: "50%",
              overflow: "hidden",
              border: "2px solid rgba(0,204,204,0.9)",
              boxShadow: "0 6px 20px rgba(0,0,0,0.6), 0 0 0 3px rgba(8,12,20,0.6)",
              background: "rgba(8,12,20,1)",
            }}
          >
            <canvas
              ref={magnifierCanvasRef}
              width={MAGNIFIER_SIZE}
              height={MAGNIFIER_SIZE}
              style={{ display: "block", width: "100%", height: "100%" }}
            />
          </div>
        )}
      </div>

      {/* ============ CANCEL CHIP ============ */}
      <button
        onClick={onCancel}
        title="Cancel"
        aria-label="Cancel"
        style={{
          position: "fixed",
          top: "max(8px, env(safe-area-inset-top))",
          left: "max(8px, env(safe-area-inset-left))",
          width: 40,
          height: 40,
          borderRadius: 8,
          border: "1px solid rgba(255,255,255,0.15)",
          background: "rgba(16,20,32,0.92)",
          backdropFilter: "blur(10px)",
          WebkitBackdropFilter: "blur(10px)",
          color: "rgba(255,255,255,0.8)",
          fontSize: 20,
          fontWeight: 700,
          lineHeight: 1,
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 50,
          boxShadow: "0 2px 8px rgba(0,0,0,0.4)",
        }}
      >
        &times;
      </button>

      {/* ============ PREVIEW ON BOARD BUTTON ============ */}
      {/*
        Phase 5 · Step 17 — peek button. Only rendered when the host has
        wired an onPreviewOnBoard callback, so PaintEditor stays backward-
        compatible with any caller that doesn't opt in. Sits immediately
        left of the Done pill, sharing the same top-right safe-area inset.
        On desktop, PEEK moves into the bottom toolbar — rendered there
        instead of the top-right.
      */}
      {!isDesktop && onPreviewOnBoard && (
        <button
          onClick={handlePreviewOnBoard}
          disabled={previewDisabled}
          title={
            previewDisabled && isDrawing
              ? "Finish your stroke first"
              : "Preview on board"
          }
          aria-label="Preview on board"
          style={{
            position: "fixed",
            top: "max(8px, env(safe-area-inset-top))",
            right: "calc(max(8px, env(safe-area-inset-right)) + 100px)",
            padding: "0 12px",
            height: 40,
            borderRadius: 999,
            border: "1px solid rgba(224,64,251,0.55)",
            background:
              "linear-gradient(135deg, rgba(224,64,251,0.28), rgba(160,40,200,0.18))",
            color: "#f06292",
            fontSize: 11,
            fontWeight: 700,
            fontFamily: "var(--font-terminal), monospace",
            letterSpacing: "0.1em",
            cursor: previewDisabled ? "not-allowed" : "pointer",
            opacity: previewDisabled ? 0.42 : 1,
            transition: "opacity 160ms ease, transform 120ms ease",
            boxShadow:
              "0 0 18px rgba(224,64,251,0.22), inset 0 1px 0 rgba(255,255,255,0.08), 0 2px 8px rgba(0,0,0,0.4)",
            backdropFilter: "blur(10px)",
            WebkitBackdropFilter: "blur(10px)",
            zIndex: 50,
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path
              d="M1 8C2.8 4.5 5.2 3 8 3s5.2 1.5 7 5c-1.8 3.5-4.2 5-7 5S2.8 11.5 1 8Z"
              stroke="currentColor"
              strokeWidth="1.3"
              fill="none"
            />
            <circle cx="8" cy="8" r="2.2" stroke="currentColor" strokeWidth="1.3" fill="none" />
          </svg>
          {previewing ? "..." : "PEEK"}
        </button>
      )}

      {/* ============ DONE PILL (mobile only; desktop uses bottom toolbar) ============ */}
      {!isDesktop && (
      <button
        onClick={handleDone}
        disabled={exporting || sealPhase !== "idle"}
        style={{
          position: "fixed",
          top: "max(8px, env(safe-area-inset-top))",
          right: "max(8px, env(safe-area-inset-right))",
          padding: "0 18px",
          height: 40,
          borderRadius: 999,
          border: "1px solid rgba(0,204,204,0.7)",
          background: "linear-gradient(135deg, rgba(0,204,204,0.4), rgba(0,180,180,0.25))",
          color: "#00cccc",
          fontSize: 13,
          fontWeight: 700,
          fontFamily: "var(--font-terminal), monospace",
          letterSpacing: "0.1em",
          cursor: exporting || sealPhase !== "idle" ? "wait" : "pointer",
          boxShadow:
            "0 0 20px rgba(0,204,204,0.25), inset 0 1px 0 rgba(255,255,255,0.1), 0 2px 8px rgba(0,0,0,0.4)",
          opacity: exporting || sealPhase !== "idle" ? 0.45 : 1,
          transition: "opacity 180ms ease",
          backdropFilter: "blur(10px)",
          WebkitBackdropFilter: "blur(10px)",
          zIndex: 50,
        }}
      >
        {sealPhase === "stamping" ? "SEALING..." : exporting ? "EXPORTING..." : "DONE"}
      </button>
      )}

      {/* ============ FOID_PAINT.EXE TITLE (desktop only) ============ */}
      {isDesktop && (
        <div
          aria-hidden="true"
          style={{
            position: "fixed",
            top: "max(8px, env(safe-area-inset-top))",
            left: "calc(max(8px, env(safe-area-inset-left)) + 52px)",
            height: 40,
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "0 14px",
            borderRadius: 8,
            border: "1px solid rgba(255,255,255,0.08)",
            background: "rgba(16,20,32,0.85)",
            backdropFilter: "blur(10px)",
            WebkitBackdropFilter: "blur(10px)",
            color: "rgba(255,255,255,0.72)",
            zIndex: 50,
            boxShadow: "0 2px 8px rgba(0,0,0,0.4)",
            pointerEvents: "none",
          }}
        >
          <div
            style={{
              width: 14,
              height: 14,
              borderRadius: 2,
              background: "linear-gradient(135deg, #00cccc 0%, #0088aa 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 9,
              color: "#000",
              fontWeight: 900,
            }}
          >
            F
          </div>
          <span
            style={{
              fontFamily: "var(--font-terminal), monospace",
              fontSize: 11,
              letterSpacing: "0.12em",
            }}
          >
            FOID_PAINT.EXE
          </span>
        </div>
      )}

      {/* ============ TOOL RAIL (mobile only; desktop uses bottom toolbar) ============ */}
      {!isDesktop && (
      <aside
        role="toolbar"
        aria-label="Paint tools"
        style={{
          position: "fixed",
          top: "calc(max(8px, env(safe-area-inset-top)) + 56px)",
          right: "max(8px, env(safe-area-inset-right))",
          display: "flex",
          flexDirection: "column",
          gap: 6,
          zIndex: 50,
          padding: 4,
          borderRadius: 12,
          background: "rgba(16,20,32,0.85)",
          backdropFilter: "blur(10px)",
          WebkitBackdropFilter: "blur(10px)",
          border: "1px solid rgba(255,255,255,0.08)",
          boxShadow: "0 4px 20px rgba(0,0,0,0.5)",
        }}
      >
        <RailChip
          title="Draw (B)"
          icon={ICON.draw}
          active={tool === "draw"}
          onClick={() => {
            setTool("draw");
            setShowStickerDrawer(false);
            haptic("light");
          }}
        />
        <RailChip
          title="Text (T)"
          icon={ICON.text}
          active={tool === "text"}
          onClick={() => {
            setTool("text");
            setShowStickerDrawer(false);
            haptic("light");
            addTextOverlay();
          }}
        />
        <RailChip
          title="Meme text — top + bottom"
          icon={ICON.memeText}
          active={false}
          onClick={() => {
            setTool("text");
            setShowStickerDrawer(false);
            haptic("light");
            addMemeTextOverlays();
          }}
        />
        <RailChip
          title="Sticker"
          icon={ICON.sticker}
          active={tool === "sticker" || showStickerDrawer}
          onClick={() => {
            setTool("sticker");
            setShowStickerDrawer((v) => !v);
            haptic("light");
          }}
        />
        <RailChip
          title="Stamp — paste an image on top"
          icon={ICON.stamp}
          active={false}
          onClick={() => {
            setShowStickerDrawer(false);
            haptic("light");
            stampInputRef.current?.click();
          }}
        />
        <RailChip
          title="Eyedropper (I)"
          icon={ICON.pick}
          active={tool === "eyedropper"}
          onClick={() => {
            setTool("eyedropper");
            setShowStickerDrawer(false);
            haptic("light");
          }}
        />
        <RailChip
          title="Eraser (E)"
          icon={ICON.eraser}
          active={tool === "eraser"}
          onClick={() => {
            setTool("eraser");
            setShowStickerDrawer(false);
            haptic("light");
          }}
        />
        <RailChip
          title="Effects"
          icon={ICON.effects}
          active={effectsDrawerOpen || currentFilter !== null}
          onClick={() => {
            setEffectsDrawerOpen((v) => !v);
            setShowStickerDrawer(false);
            haptic("light");
          }}
        />
        <div style={{ height: 1, background: "rgba(255,255,255,0.08)", margin: "2px 4px" }} />
        <RailChip
          title="Undo"
          icon={ICON.undo}
          active={false}
          onClick={() => {
            undo();
            haptic("light");
          }}
          disabled={historyIdx <= 0}
        />
      </aside>
      )}

      {/* ============ STICKER DRAWER ============ */}
      {showStickerDrawer && (
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            position: "fixed",
            right: "calc(max(8px, env(safe-area-inset-right)) + 60px)",
            top: "calc(max(8px, env(safe-area-inset-top)) + 56px)",
            display: "grid",
            gridTemplateColumns: "repeat(4, 48px)",
            gap: 6,
            padding: 8,
            borderRadius: 12,
            background: "rgba(16,20,32,0.95)",
            border: "1px solid rgba(255,255,255,0.1)",
            boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
            zIndex: 49,
            backdropFilter: "blur(10px)",
            WebkitBackdropFilter: "blur(10px)",
          }}
        >
          {STICKER_PRESETS.map((emoji) => (
            <button
              key={emoji}
              onClick={() => addStickerOverlay(emoji)}
              style={{
                width: 48,
                height: 48,
                borderRadius: 8,
                border: "1px solid rgba(255,255,255,0.1)",
                background: "rgba(255,255,255,0.04)",
                fontSize: 28,
                lineHeight: 1,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: 0,
              }}
            >
              {emoji}
            </button>
          ))}
        </div>
      )}

      {/* ============ BOTTOM STRIP ============ */}
      {showBottomStrip && (
        <div
          style={{
            position: "fixed",
            left: "max(8px, env(safe-area-inset-left))",
            right: isDesktop
              ? "max(8px, env(safe-area-inset-right))"
              : "calc(max(8px, env(safe-area-inset-right)) + 60px)",
            bottom: `calc(max(8px, env(safe-area-inset-bottom)) + ${
              (isDesktop ? 64 : 0) + (musicBarVisible ? 48 : 0)
            }px)`,
            display: "flex",
            flexDirection: "column",
            gap: 6,
            padding: 8,
            borderRadius: 12,
            background: "rgba(16,20,32,0.92)",
            backdropFilter: "blur(10px)",
            WebkitBackdropFilter: "blur(10px)",
            border: "1px solid rgba(255,255,255,0.08)",
            boxShadow: "0 4px 20px rgba(0,0,0,0.5)",
            zIndex: 45,
            maxHeight: "40vh",
            overflowY: "auto",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {tool === "draw" && (
            <>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                <span
                  style={{
                    fontSize: 8,
                    color: "rgba(0,204,204,0.7)",
                    fontFamily: "var(--font-terminal), monospace",
                    letterSpacing: "0.1em",
                    marginRight: 2,
                  }}
                >
                  COLOR
                </span>
                {FOID_COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => {
                      setColor(c);
                      haptic("light");
                    }}
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 6,
                      border: color === c ? "2px solid #fff" : "1px solid rgba(255,255,255,0.15)",
                      background: c,
                      cursor: "pointer",
                      flexShrink: 0,
                      boxShadow: color === c ? `0 0 8px ${c}80` : "none",
                    }}
                  />
                ))}
                {STANDARD_COLORS.slice(0, 4).map((c) => (
                  <button
                    key={c}
                    onClick={() => {
                      setColor(c);
                      haptic("light");
                    }}
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 6,
                      border: color === c ? "2px solid #00cccc" : `1px solid ${c === "#000000" ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.1)"}`,
                      background: c,
                      cursor: "pointer",
                      flexShrink: 0,
                    }}
                  />
                ))}
                <input
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  style={{
                    width: 32,
                    height: 28,
                    cursor: "pointer",
                    border: "1px solid rgba(255,255,255,0.15)",
                    borderRadius: 6,
                    padding: 0,
                    background: "transparent",
                  }}
                />
              </div>

              <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                <span
                  style={{
                    fontSize: 8,
                    color: "rgba(0,204,204,0.7)",
                    fontFamily: "var(--font-terminal), monospace",
                    letterSpacing: "0.1em",
                  }}
                >
                  SIZE
                </span>
                {[2, 4, 8, 16, 30].map((size) => (
                  <button
                    key={size}
                    onClick={() => setBrushSize(size)}
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 6,
                      border: brushSize === size ? "1px solid rgba(0,204,204,0.6)" : "1px solid rgba(255,255,255,0.1)",
                      background: brushSize === size ? "rgba(0,204,204,0.15)" : "rgba(255,255,255,0.04)",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: brushSize === size ? "#00cccc" : "rgba(255,255,255,0.6)",
                    }}
                  >
                    <div
                      style={{
                        width: Math.min(size, 16),
                        height: Math.min(size, 16),
                        borderRadius: "50%",
                        background: "currentColor",
                      }}
                    />
                  </button>
                ))}
                <span
                  style={{
                    fontSize: 8,
                    color: "rgba(0,204,204,0.7)",
                    fontFamily: "var(--font-terminal), monospace",
                    letterSpacing: "0.1em",
                    marginLeft: 4,
                  }}
                >
                  OPAC
                </span>
                <input
                  type="range"
                  min={5}
                  max={100}
                  value={Math.round(brushOpacity * 100)}
                  onChange={(e) => setBrushOpacity(Number(e.target.value) / 100)}
                  style={{ flex: 1, minWidth: 60, accentColor: "#00cccc", cursor: "pointer" }}
                />
                <span
                  style={{
                    fontSize: 9,
                    color: "#00cccc",
                    fontFamily: "var(--font-terminal), monospace",
                    minWidth: 28,
                    textAlign: "right",
                  }}
                >
                  {Math.round(brushOpacity * 100)}%
                </span>
                <button
                  title="Redo"
                  onClick={() => {
                    redo();
                    haptic("light");
                  }}
                  disabled={historyIdx >= history.length - 1}
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 6,
                    border: "1px solid rgba(255,255,255,0.1)",
                    background: "rgba(255,255,255,0.04)",
                    color: historyIdx >= history.length - 1 ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.65)",
                    cursor: historyIdx >= history.length - 1 ? "not-allowed" : "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {ICON.redo}
                </button>
                <button
                  title={clearPending ? "Tap again to confirm" : "Clear all"}
                  onClick={handleClearClick}
                  style={{
                    height: 32,
                    padding: "0 10px",
                    borderRadius: 6,
                    border: clearPending ? "1px solid rgba(255,60,60,0.6)" : "1px solid rgba(255,255,255,0.1)",
                    background: clearPending ? "rgba(255,60,60,0.15)" : "rgba(255,255,255,0.04)",
                    color: clearPending ? "#ff6666" : "rgba(255,255,255,0.65)",
                    fontSize: 10,
                    fontFamily: "var(--font-terminal), monospace",
                    letterSpacing: "0.04em",
                    cursor: "pointer",
                  }}
                >
                  {clearPending ? "SURE?" : "CLEAR"}
                </button>
              </div>
            </>
          )}

          {tool === "text" && selectedOverlay && selectedOverlay.kind === "text" && (
            <>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                <span
                  style={{
                    fontSize: 8,
                    color: "rgba(0,204,204,0.7)",
                    fontFamily: "var(--font-terminal), monospace",
                    letterSpacing: "0.1em",
                  }}
                >
                  COLOR
                </span>
                {[...FOID_COLORS, ...STANDARD_COLORS.slice(0, 4)].map((c) => (
                  <button
                    key={c}
                    onClick={() =>
                      handleOverlayTransform(selectedOverlay.id, { color: c })
                    }
                    style={{
                      width: 26,
                      height: 26,
                      borderRadius: 6,
                      border:
                        selectedOverlay.color === c ? "2px solid #fff" : "1px solid rgba(255,255,255,0.15)",
                      background: c,
                      cursor: "pointer",
                      flexShrink: 0,
                    }}
                  />
                ))}
              </div>
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <span
                  style={{
                    fontSize: 8,
                    color: "rgba(0,204,204,0.7)",
                    fontFamily: "var(--font-terminal), monospace",
                    letterSpacing: "0.1em",
                  }}
                >
                  SIZE
                </span>
                <input
                  type="range"
                  min={16}
                  max={160}
                  step={2}
                  value={selectedOverlay.fontSize}
                  onChange={(e) =>
                    handleOverlayTransform(selectedOverlay.id, {
                      fontSize: Number(e.target.value),
                    })
                  }
                  style={{ flex: 1, accentColor: "#00cccc", cursor: "pointer" }}
                />
                <span
                  style={{
                    fontSize: 9,
                    color: "#00cccc",
                    fontFamily: "var(--font-terminal), monospace",
                    minWidth: 32,
                    textAlign: "right",
                  }}
                >
                  {selectedOverlay.fontSize}px
                </span>
                <button
                  onClick={() => {
                    setEditingOverlayId(selectedOverlay.id);
                    haptic("light");
                  }}
                  style={{
                    height: 30,
                    padding: "0 10px",
                    borderRadius: 6,
                    border: "1px solid rgba(0,204,204,0.4)",
                    background: "rgba(0,204,204,0.12)",
                    color: "#00cccc",
                    fontSize: 10,
                    fontFamily: "var(--font-terminal), monospace",
                    letterSpacing: "0.06em",
                    cursor: "pointer",
                  }}
                >
                  EDIT
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* ============ DESKTOP BOTTOM TOOLBAR — FOID_PAINT.EXE ============ */}
      {/*
        Classic MS-Paint-style horizontal strip shown on viewports ≥ 900 px.
        All buttons are labelled because the right-side icon rail proved
        unintelligible to new users. Order follows the canonical layout:
        Draw · Eraser · Text · (Meme · Stamp · Sticker · Pick · Effects) ·
        [color] · [size] · Undo · Redo · Clear · ZOOM −/+ · [Lock slot] ·
        [PEEK] · DONE. Meme/Sticker/Effects are secondary but kept visible
        so desktop users don't lose access to those features.

        NOTE to Session A (stamp restoration): the Stamp button is already
        wired here via stampInputRef.current?.click(). No stub slot needed.

        NOTE to future selves: a draw-lock toggle once lived between ZOOM
        and DONE in the old 3a74a88 layout — it's intentionally omitted
        here because the `drawLock` state isn't implemented on the current
        PaintEditor. If it comes back, drop the button into the slot
        marked with a TODO comment below.
      */}
      {isDesktop && (
        <div
          role="toolbar"
          aria-label="Paint tools"
          onClick={(e) => e.stopPropagation()}
          style={{
            position: "fixed",
            left: "max(8px, env(safe-area-inset-left))",
            right: "max(8px, env(safe-area-inset-right))",
            bottom: `calc(max(8px, env(safe-area-inset-bottom)) + ${
              musicBarVisible ? 48 : 0
            }px)`,
            display: "flex",
            alignItems: "center",
            gap: 4,
            padding: "6px 10px",
            height: 52,
            borderRadius: 10,
            background: "rgba(16,20,32,0.92)",
            backdropFilter: "blur(10px)",
            WebkitBackdropFilter: "blur(10px)",
            border: "1px solid rgba(255,255,255,0.08)",
            boxShadow: "0 4px 20px rgba(0,0,0,0.5)",
            zIndex: 50,
            overflowX: "auto",
          }}
        >
          <DeskBtn
            label="Draw"
            icon={ICON.draw}
            active={tool === "draw"}
            onClick={() => {
              setTool("draw");
              setShowStickerDrawer(false);
              haptic("light");
            }}
          />
          <DeskBtn
            label="Eraser"
            icon={ICON.eraser}
            active={tool === "eraser"}
            onClick={() => {
              setTool("eraser");
              setShowStickerDrawer(false);
              haptic("light");
            }}
          />
          <DeskBtn
            label="Text"
            icon={ICON.text}
            active={tool === "text"}
            onClick={() => {
              setTool("text");
              setShowStickerDrawer(false);
              addTextOverlay();
              haptic("light");
            }}
          />
          <DeskBtn
            label="Meme"
            icon={ICON.memeText}
            active={false}
            onClick={() => {
              setTool("text");
              setShowStickerDrawer(false);
              addMemeTextOverlays();
              haptic("light");
            }}
          />
          <DeskBtn
            label="Stamp"
            icon={ICON.stamp}
            active={false}
            onClick={() => {
              setShowStickerDrawer(false);
              stampInputRef.current?.click();
              haptic("light");
            }}
          />
          <DeskBtn
            label="Sticker"
            icon={ICON.sticker}
            active={tool === "sticker" || showStickerDrawer}
            onClick={() => {
              setTool("sticker");
              setShowStickerDrawer((v) => !v);
              haptic("light");
            }}
          />
          <DeskBtn
            label="Pick"
            icon={ICON.pick}
            active={tool === "eyedropper"}
            onClick={() => {
              setTool("eyedropper");
              setShowStickerDrawer(false);
              haptic("light");
            }}
          />
          <DeskBtn
            label="Effects"
            icon={ICON.effects}
            active={effectsDrawerOpen || currentFilter !== null}
            onClick={() => {
              setEffectsDrawerOpen((v) => !v);
              setShowStickerDrawer(false);
              haptic("light");
            }}
          />

          <DeskDivider />

          {/* Color dot — native color input for full palette */}
          <label
            title="Color"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              height: 34,
              padding: "0 8px",
              borderRadius: 6,
              border: "1px solid rgba(255,255,255,0.1)",
              background: "rgba(255,255,255,0.04)",
              cursor: "pointer",
              flexShrink: 0,
            }}
          >
            <span
              style={{
                fontSize: 10,
                fontFamily: "var(--font-terminal), monospace",
                letterSpacing: "0.08em",
                color: "rgba(255,255,255,0.55)",
              }}
            >
              COLOR
            </span>
            <span
              aria-hidden="true"
              style={{
                width: 20,
                height: 20,
                borderRadius: "50%",
                background: color,
                border: "2px solid rgba(255,255,255,0.25)",
                boxShadow: `0 0 6px ${color}66`,
              }}
            />
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              style={{
                width: 0,
                height: 0,
                padding: 0,
                border: 0,
                opacity: 0,
                pointerEvents: "none",
                position: "absolute",
              }}
            />
          </label>

          {/* Size picker */}
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              height: 34,
              padding: "0 6px",
              borderRadius: 6,
              border: "1px solid rgba(255,255,255,0.1)",
              background: "rgba(255,255,255,0.04)",
              flexShrink: 0,
            }}
          >
            <span
              style={{
                fontSize: 10,
                fontFamily: "var(--font-terminal), monospace",
                letterSpacing: "0.08em",
                color: "rgba(255,255,255,0.55)",
              }}
            >
              SIZE
            </span>
            {[2, 4, 8, 16, 30].map((size) => (
              <button
                key={size}
                title={`Brush size ${size}`}
                aria-label={`Brush size ${size}`}
                aria-pressed={brushSize === size}
                onClick={() => {
                  setBrushSize(size);
                  haptic("light");
                }}
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: 4,
                  border:
                    brushSize === size
                      ? "1px solid rgba(0,204,204,0.6)"
                      : "1px solid rgba(255,255,255,0.08)",
                  background:
                    brushSize === size
                      ? "rgba(0,204,204,0.18)"
                      : "rgba(255,255,255,0.03)",
                  color:
                    brushSize === size ? "#00cccc" : "rgba(255,255,255,0.6)",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: 0,
                }}
              >
                <div
                  style={{
                    width: Math.min(size, 14),
                    height: Math.min(size, 14),
                    borderRadius: "50%",
                    background: "currentColor",
                  }}
                />
              </button>
            ))}
          </div>

          <DeskDivider />

          <DeskBtn
            label="Undo"
            icon={ICON.undo}
            active={false}
            onClick={() => {
              undo();
              haptic("light");
            }}
            disabled={historyIdx <= 0}
          />
          <DeskBtn
            label="Redo"
            icon={ICON.redo}
            active={false}
            onClick={() => {
              redo();
              haptic("light");
            }}
            disabled={historyIdx >= history.length - 1}
          />
          <DeskBtn
            label={clearPending ? "Sure?" : "Clear"}
            active={clearPending}
            danger={clearPending}
            onClick={handleClearClick}
          />

          <DeskDivider />

          {/* Zoom controls */}
          <span
            style={{
              fontSize: 9,
              color: "rgba(255,255,255,0.4)",
              fontFamily: "var(--font-terminal), monospace",
              letterSpacing: "0.1em",
              flexShrink: 0,
            }}
          >
            ZOOM
          </span>
          <button
            title="Zoom out"
            aria-label="Zoom out"
            onClick={zoomOut}
            style={deskIconBtn(false)}
          >
            −
          </button>
          <button
            title={viewScale === 1 ? "100%" : "Reset zoom"}
            aria-label="Reset zoom"
            onClick={resetZoom}
            style={{
              ...deskIconBtn(viewScale !== 1),
              minWidth: 44,
              fontSize: 10,
              fontFamily: "var(--font-terminal), monospace",
            }}
          >
            {Math.round(viewScale * 100)}%
          </button>
          <button
            title="Zoom in"
            aria-label="Zoom in"
            onClick={zoomIn}
            style={deskIconBtn(false)}
          >
            +
          </button>

          {/* TODO(drawLock): drop a Lock toggle here when the state is
              re-implemented. Intentionally no-op today — see comment above. */}

          <div style={{ flex: 1, minWidth: 4 }} />

          {onPreviewOnBoard && (
            <button
              onClick={handlePreviewOnBoard}
              disabled={previewDisabled}
              title={
                previewDisabled && isDrawing
                  ? "Finish your stroke first"
                  : "Preview on board"
              }
              aria-label="Preview on board"
              style={{
                height: 34,
                padding: "0 12px",
                borderRadius: 6,
                border: "1px solid rgba(224,64,251,0.55)",
                background:
                  "linear-gradient(135deg, rgba(224,64,251,0.28), rgba(160,40,200,0.18))",
                color: "#f06292",
                fontSize: 11,
                fontWeight: 700,
                fontFamily: "var(--font-terminal), monospace",
                letterSpacing: "0.1em",
                cursor: previewDisabled ? "not-allowed" : "pointer",
                opacity: previewDisabled ? 0.42 : 1,
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                flexShrink: 0,
              }}
            >
              {previewing ? "..." : "PEEK"}
            </button>
          )}
          <button
            onClick={handleDone}
            disabled={exporting || sealPhase !== "idle"}
            aria-label="Done"
            style={{
              height: 34,
              padding: "0 18px",
              borderRadius: 6,
              border: "1px solid rgba(0,204,204,0.7)",
              background:
                "linear-gradient(135deg, rgba(0,204,204,0.4), rgba(0,180,180,0.25))",
              color: "#00cccc",
              fontSize: 12,
              fontWeight: 700,
              fontFamily: "var(--font-terminal), monospace",
              letterSpacing: "0.12em",
              cursor:
                exporting || sealPhase !== "idle" ? "wait" : "pointer",
              opacity: exporting || sealPhase !== "idle" ? 0.45 : 1,
              boxShadow:
                "0 0 14px rgba(0,204,204,0.2), inset 0 1px 0 rgba(255,255,255,0.08)",
              flexShrink: 0,
            }}
          >
            {sealPhase === "stamping"
              ? "SEALING..."
              : exporting
              ? "EXPORTING..."
              : "DONE"}
          </button>
        </div>
      )}

      {/* ============ TRASH ZONE ============ */}
      {draggingOverlayId && (
        <div
          ref={trashZoneRef}
          style={{
            position: "fixed",
            bottom: `calc(max(20px, env(safe-area-inset-bottom)) + ${
              (isDesktop ? 64 : 0) + (musicBarVisible ? 56 : 0)
            }px)`,
            left: "50%",
            transform: `translate(-50%, 0) scale(${trashHot ? 1.15 : 1})`,
            width: TRASH_SIZE,
            height: TRASH_SIZE,
            borderRadius: TRASH_SIZE / 2,
            background: trashHot
              ? "linear-gradient(135deg, rgba(255,60,60,0.55), rgba(200,40,40,0.4))"
              : "rgba(16,20,32,0.92)",
            border: trashHot
              ? "2px solid rgba(255,100,100,0.9)"
              : "1px solid rgba(255,255,255,0.15)",
            color: trashHot ? "#fff" : "rgba(255,255,255,0.7)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backdropFilter: "blur(10px)",
            WebkitBackdropFilter: "blur(10px)",
            boxShadow: trashHot
              ? "0 0 24px rgba(255,60,60,0.5), 0 4px 12px rgba(0,0,0,0.5)"
              : "0 4px 12px rgba(0,0,0,0.5)",
            zIndex: 55,
            pointerEvents: "none",
            animation: "paint-trash-in 180ms ease-out",
            transition: "transform 120ms ease-out, background 120ms, border-color 120ms, color 120ms",
          }}
        >
          {ICON.trash}
          <style>{`@keyframes paint-trash-in { from { transform: translate(-50%, 40px) scale(0.6); opacity: 0; } to { transform: translate(-50%, 0) scale(1); opacity: 1; } }`}</style>
        </div>
      )}

      {/* ============ EFFECTS DRAWER — BACKDROP ============ */}
      {effectsDrawerOpen && (
        <div
          onClick={() => setEffectsDrawerOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.28)",
            zIndex: 57,
            cursor: "pointer",
            animation: "paint-fade-in 180ms ease-out",
          }}
        />
      )}

      {/* ============ EFFECTS DRAWER ============ */}
      <div
        role="region"
        aria-label="Effects drawer"
        aria-hidden={!effectsDrawerOpen}
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "fixed",
          left: 0,
          right: 0,
          bottom: 0,
          height: "40vh",
          minHeight: 240,
          background:
            "linear-gradient(to bottom, rgba(20,24,38,0.97), rgba(12,16,26,0.98))",
          borderTop: "1px solid rgba(0,204,204,0.28)",
          borderTopLeftRadius: 16,
          borderTopRightRadius: 16,
          boxShadow: "0 -8px 40px rgba(0,0,0,0.65)",
          backdropFilter: "blur(14px)",
          WebkitBackdropFilter: "blur(14px)",
          zIndex: 58,
          transform: `translateY(calc(${
            effectsDrawerOpen ? "0%" : "100%"
          } + ${effectsDrawerDragY ?? 0}px))`,
          transition:
            effectsDrawerDragY !== null
              ? "none"
              : "transform 240ms cubic-bezier(0.2, 0.9, 0.2, 1)",
          display: "flex",
          flexDirection: "column",
          paddingBottom: `calc(max(12px, env(safe-area-inset-bottom)) + ${
            musicBarVisible ? 48 : 0
          }px)`,
          pointerEvents: effectsDrawerOpen || effectsDrawerDragY !== null ? "auto" : "none",
        }}
      >
        {/* Drag handle */}
        <div
          onPointerDown={onDrawerPointerDown}
          onPointerMove={onDrawerPointerMove}
          onPointerUp={onDrawerPointerUp}
          onPointerCancel={onDrawerPointerUp}
          style={{
            padding: "10px 0 6px",
            display: "flex",
            justifyContent: "center",
            cursor: "grab",
            touchAction: "none",
            flexShrink: 0,
          }}
        >
          <div
            style={{
              width: 44,
              height: 4,
              borderRadius: 2,
              background: "rgba(255,255,255,0.28)",
            }}
          />
        </div>

        {/* Header — label + perf readout */}
        <div
          style={{
            padding: "0 18px 10px",
            display: "flex",
            alignItems: "baseline",
            justifyContent: "space-between",
            flexShrink: 0,
          }}
        >
          <span
            style={{
              fontSize: 10,
              color: "rgba(0,204,204,0.8)",
              fontFamily: "var(--font-terminal), monospace",
              letterSpacing: "0.18em",
              fontWeight: 700,
            }}
          >
            EFFECTS
          </span>
          {filterPerfMs !== null && (
            <span
              style={{
                fontSize: 9,
                color: "rgba(255,255,255,0.35)",
                fontFamily: "var(--font-terminal), monospace",
                letterSpacing: "0.08em",
              }}
            >
              {filterPerfMs.toFixed(1)}ms · {canvasDisplaySize.w}×{canvasDisplaySize.h}
            </span>
          )}
        </div>

        {/* Filter chips */}
        <div
          style={{
            flex: 1,
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(110px, 1fr))",
            gap: 10,
            padding: "4px 18px 18px",
            overflowY: "auto",
            alignContent: "start",
          }}
        >
          <FilterChip
            label="NONE"
            active={currentFilter === null}
            onClick={() => applyFilterToBg(null)}
          />
          {FILTERS.map((f) => (
            <FilterChip
              key={f.id}
              label={f.label}
              active={currentFilter === f.id}
              onClick={() => applyFilterToBg(f.id)}
            />
          ))}
        </div>
      </div>

      {/* ============ SWIPE-UP-FROM-BOTTOM TRIGGER ============ */}
      {/*
        A thin invisible strip along the bottom edge. Only active when no
        other bottom UI is in the way, so swipe gestures don't fight the
        sticker drawer, bottom strip, trash zone, or seal animation.
        Desktop replaces it with an explicit Effects button in the bottom
        toolbar, so the gesture strip is suppressed there to avoid stealing
        clicks from the toolbar.
      */}
      {!isDesktop &&
        !effectsDrawerOpen &&
        !showBottomStrip &&
        !draggingOverlayId &&
        !showStickerDrawer &&
        sealPhase === "idle" && (
          <div
            onPointerDown={onDrawerPointerDown}
            onPointerMove={onDrawerPointerMove}
            onPointerUp={onDrawerPointerUp}
            onPointerCancel={onDrawerPointerUp}
            style={{
              position: "fixed",
              left: 0,
              right: 0,
              bottom: 0,
              height: 18,
              zIndex: 44,
              touchAction: "none",
              background: "transparent",
            }}
          />
        )}

      {/* ============ WAX-SEAL DONE ANIMATION ============ */}
      {/*
        The full-screen fixed backdrop still spans inset:0 (so the dim
        wash covers the whole editor), but the seal SVG + ENGRAVED label
        are absolutely positioned inside at the centre of the image rect
        captured at stamp-start. That way the seal lands on the image,
        not the page, regardless of the current zoom/pan or which side
        of the viewport the toolbars are occupying.
      */}
      {sealPhase === "stamping" && (
        <div
          aria-hidden="true"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 70,
            pointerEvents: "none",
            animation: "paint-seal-bg 500ms ease-out forwards",
          }}
        >
          <div
            style={{
              position: "absolute",
              left: sealRect ? sealRect.x + sealRect.w / 2 : "50%",
              top: sealRect ? sealRect.y + sealRect.h / 2 : "50%",
              transform: "translate(-50%, -50%)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 14,
              willChange: "transform, opacity",
              animation:
                "paint-seal-stamp 500ms cubic-bezier(0.34, 1.56, 0.64, 1) forwards",
            }}
          >
            <svg
              width="220"
              height="220"
              viewBox="0 0 200 200"
              style={{
                filter:
                  "drop-shadow(0 10px 28px rgba(240, 98, 146, 0.55)) drop-shadow(0 2px 6px rgba(0,0,0,0.55))",
                display: "block",
              }}
            >
              <defs>
                <radialGradient id="foid-wax-grad" cx="50%" cy="42%" r="58%">
                  <stop offset="0%" stopColor="#ff9ec3" />
                  <stop offset="48%" stopColor="#f06292" />
                  <stop offset="100%" stopColor="#8a214d" />
                </radialGradient>
              </defs>
              {/* Jagged wax puddle */}
              <path
                d="M100 10 L116 26 L138 18 L150 36 L172 42 L172 66 L188 82 L180 104 L190 128 L172 142 L166 166 L144 170 L128 186 L108 180 L90 190 L70 180 L52 186 L40 170 L22 162 L16 140 L8 118 L18 96 L10 74 L24 60 L26 38 L48 34 L60 14 L82 20 Z"
                fill="url(#foid-wax-grad)"
                stroke="rgba(0,0,0,0.38)"
                strokeWidth="2"
                strokeLinejoin="round"
              />
              {/* Inner recess */}
              <rect
                x="56"
                y="54"
                width="88"
                height="92"
                rx="14"
                fill="rgba(16,20,32,0.22)"
              />
              {/* Foid F sigil */}
              <path
                d="M76 136 V66 h50 v11 h-34 v16 h26 v11 h-26 v32 z"
                fill="rgba(255,255,255,0.94)"
              />
              <circle cx="100" cy="100" r="3.2" fill="rgba(255,255,255,0.94)" />
            </svg>
            <span
              style={{
                fontFamily: "var(--font-terminal), ui-monospace, monospace",
                fontSize: 14,
                fontWeight: 700,
                letterSpacing: "0.36em",
                color: "#f06292",
                textTransform: "uppercase",
                textAlign: "center",
                textShadow:
                  "0 0 12px rgba(240,98,146,0.55), 0 2px 6px rgba(0,0,0,0.6)",
              }}
            >
              ENGRAVED
            </span>
          </div>
          <style>{`
            @keyframes paint-seal-stamp {
              0%   { transform: translate(-50%, -50%) scale(0.3) rotate(-12deg); opacity: 0; }
              45%  { transform: translate(-50%, -50%) scale(1.14) rotate(3deg);  opacity: 1; }
              65%  { transform: translate(-50%, -50%) scale(0.98) rotate(-1deg); opacity: 1; }
              80%  { transform: translate(-50%, -50%) scale(1) rotate(0deg);     opacity: 1; }
              100% { transform: translate(-50%, -50%) scale(1) rotate(0deg);     opacity: 0; }
            }
            @keyframes paint-seal-bg {
              0%   { background: rgba(8,12,20,0); }
              35%  { background: rgba(8,12,20,0.42); }
              100% { background: rgba(8,12,20,0); }
            }
            @keyframes paint-fade-in {
              from { opacity: 0; }
              to { opacity: 1; }
            }
          `}</style>
        </div>
      )}

      {/* Shared keyframes (backdrop fade, used outside stamping block too) */}
      <style>{`
        @keyframes paint-fade-in { from { opacity: 0; } to { opacity: 1; } }
      `}</style>

      {/* Hidden file input for Stamp uploads — triggered by the Stamp rail chip */}
      <input
        ref={stampInputRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={handleStampInputChange}
      />
    </div>
  );
}

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

function RailChip({
  title,
  icon,
  active,
  onClick,
  disabled,
}: {
  title: string;
  icon: React.ReactNode;
  active: boolean;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      title={title}
      aria-label={title}
      aria-pressed={active}
      onClick={onClick}
      disabled={disabled}
      style={{
        width: 44,
        height: 44,
        borderRadius: 8,
        border: active ? "1px solid rgba(0,204,204,0.6)" : "1px solid rgba(255,255,255,0.12)",
        background: active ? "rgba(0,204,204,0.18)" : "rgba(255,255,255,0.04)",
        color: disabled ? "rgba(255,255,255,0.2)" : active ? "#00cccc" : "rgba(255,255,255,0.7)",
        cursor: disabled ? "not-allowed" : "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        boxShadow: active ? "0 0 12px rgba(0,204,204,0.2), inset 0 1px 0 rgba(255,255,255,0.05)" : "none",
        transition: "all 0.15s",
        padding: 0,
      }}
    >
      {icon}
    </button>
  );
}

function DeskBtn({
  label,
  icon,
  active,
  onClick,
  disabled,
  danger,
}: {
  label: string;
  icon?: React.ReactNode;
  active: boolean;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  const borderColor = danger
    ? "rgba(255,80,80,0.55)"
    : active
    ? "rgba(0,204,204,0.55)"
    : "rgba(255,255,255,0.1)";
  const bg = danger
    ? "rgba(255,80,80,0.14)"
    : active
    ? "rgba(0,204,204,0.15)"
    : "rgba(255,255,255,0.04)";
  const fg = disabled
    ? "rgba(255,255,255,0.22)"
    : danger
    ? "#ff7070"
    : active
    ? "#00cccc"
    : "rgba(255,255,255,0.72)";
  return (
    <button
      title={label}
      aria-label={label}
      aria-pressed={active}
      onClick={onClick}
      disabled={disabled}
      style={{
        height: 34,
        padding: icon ? "0 10px 0 8px" : "0 10px",
        borderRadius: 6,
        border: `1px solid ${borderColor}`,
        background: bg,
        color: fg,
        fontSize: 11,
        fontFamily: "var(--font-terminal), monospace",
        letterSpacing: "0.06em",
        cursor: disabled ? "not-allowed" : "pointer",
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        flexShrink: 0,
        boxShadow: active
          ? "0 0 10px rgba(0,204,204,0.15), inset 0 1px 0 rgba(255,255,255,0.06)"
          : "none",
        transition: "all 0.15s",
      }}
    >
      {icon}
      {label}
    </button>
  );
}

function DeskDivider() {
  return (
    <div
      aria-hidden="true"
      style={{
        width: 1,
        height: 22,
        background: "rgba(255,255,255,0.08)",
        flexShrink: 0,
        margin: "0 4px",
      }}
    />
  );
}

function deskIconBtn(active: boolean): React.CSSProperties {
  return {
    width: 30,
    height: 30,
    borderRadius: 5,
    border: active
      ? "1px solid rgba(0,204,204,0.55)"
      : "1px solid rgba(255,255,255,0.1)",
    background: active
      ? "rgba(0,204,204,0.15)"
      : "rgba(255,255,255,0.04)",
    color: active ? "#00cccc" : "rgba(255,255,255,0.6)",
    fontSize: 14,
    fontWeight: 700,
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    padding: 0,
  };
}

function FilterChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={() => {
        onClick();
        haptic("light");
      }}
      aria-pressed={active}
      style={{
        height: 56,
        borderRadius: 10,
        border: active ? "1.5px solid #00cccc" : "1px solid rgba(255,255,255,0.1)",
        background: active
          ? "linear-gradient(135deg, rgba(0,204,204,0.22), rgba(0,180,180,0.10))"
          : "rgba(255,255,255,0.04)",
        color: active ? "#00cccc" : "rgba(255,255,255,0.72)",
        fontSize: 11,
        fontWeight: 700,
        fontFamily: "var(--font-terminal), monospace",
        letterSpacing: "0.14em",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        boxShadow: active
          ? "0 0 14px rgba(0,204,204,0.28), inset 0 1px 0 rgba(255,255,255,0.06)"
          : "none",
        transition: "all 160ms",
        padding: 0,
      }}
    >
      {label}
    </button>
  );
}

export default PaintEditor;
