"use client";

import React, { useRef, useState, useEffect, useCallback } from "react";

// ============================================================================
// TYPES
// ============================================================================

interface PaintEditorProps {
  imageFile: File;
  onDone: (editedFile: File) => void;
  onCancel: () => void;
}

type Tool = "select" | "draw" | "eraser" | "stamp" | "text" | "eyedropper";

interface ImageOverlay {
  id: string;
  src: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

interface MemeText {
  top: string;
  bottom: string;
  fontSize: number; // 0 = auto
}

interface HistoryEntry {
  imageData: ImageData;
  overlays: ImageOverlay[];
  memeText: MemeText;
}

// FOID Foundation brand colors + essential drawing colors
const FOID_COLORS = [
  "#00cccc", // FOID teal
  "#a855f7", // FOID purple
  "#e040fb", // FOID magenta
  "#f06292", // FOID pink
  "#74ffeb", // FOID mint
  "#00ddff", // FOID cyan
] as const;

const STANDARD_COLORS = [
  "#ffffff", "#000000", "#ff0000", "#0066ff",
  "#00cc44", "#ffdd00", "#ff8800", "#ff69b4",
] as const;

const DEFAULT_MAX_HISTORY = 30;
const HISTORY_MEMORY_BUDGET = 100 * 1024 * 1024; // 100MB for history snapshots
const DEFAULT_OVERLAY_SIZE = 80;
const DEFAULT_MEME_TEXT: MemeText = { top: "", bottom: "", fontSize: 0 };
const MEME_FONT = "'Impact', 'Arial Black', 'Haettenschweiler', sans-serif";

// ============================================================================
// HELPERS
// ============================================================================

function generateId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

/** Haptic feedback — fires on supported devices, silently ignored elsewhere */
function haptic(style: "light" | "medium" | "heavy" = "light") {
  try {
    const ms = style === "light" ? 10 : style === "medium" ? 25 : 50;
    navigator?.vibrate?.(ms);
  } catch { /* not supported */ }
}

/** Detect if running on a touch-primary device */
function isTouchDevice(): boolean {
  if (typeof window === "undefined") return false;
  return "ontouchstart" in window || navigator.maxTouchPoints > 0;
}

// ============================================================================
// PAINT EDITOR COMPONENT
// ============================================================================

export function PaintEditor({ imageFile, onDone, onCancel }: PaintEditorProps) {
  // Track music bar expansion to add bottom padding
  const [musicBarVisible, setMusicBarVisible] = useState(false);
  useEffect(() => {
    // Watch for music bar expansion by checking for the visible class
    const observer = new MutationObserver(() => {
      const bar = document.querySelector('.cmp-bar--visible');
      setMusicBarVisible(!!bar);
    });
    observer.observe(document.body, { subtree: true, attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  // Responsive: detect narrow screens for compact toolbar
  useEffect(() => {
    const check = () => setIsCompact(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // Canvas refs
  const bgCanvasRef = useRef<HTMLCanvasElement>(null);
  const drawCanvasRef = useRef<HTMLCanvasElement>(null);
  const canvasContainerRef = useRef<HTMLDivElement>(null);

  // State
  const [tool, setTool] = useState<Tool>("draw");
  const [color, setColor] = useState("#ff0000");
  const [brushSize, setBrushSize] = useState(8);
  const [brushOpacity, setBrushOpacity] = useState(1);
  const [isDrawing, setIsDrawing] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [fileName, setFileName] = useState(() => imageFile.name.replace(/\.[^.]+$/, ""));
  const [overlays, setOverlays] = useState<ImageOverlay[]>([]);
  const [overlaySrc, setOverlaySrc] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [historyIdx, setHistoryIdx] = useState(-1);
  const [draggingOverlay, setDraggingOverlay] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [resizingOverlay, setResizingOverlay] = useState<string | null>(null);
  const [canvasDisplaySize, setCanvasDisplaySize] = useState({ w: 0, h: 0 });
  const [memeText, setMemeText] = useState<MemeText>({ ...DEFAULT_MEME_TEXT });
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showBrushMenu, setShowBrushMenu] = useState(false);
  const [selectedOverlay, setSelectedOverlay] = useState<string | null>(null);
  const [clearPending, setClearPending] = useState(false);
  const clearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const colorInputRef = useRef<HTMLInputElement>(null);

  // Mobile enhancements
  const [drawLock, setDrawLock] = useState(false); // prevents accidental zoom while drawing
  const [touchIndicator, setTouchIndicator] = useState<{ x: number; y: number; visible: boolean }>({ x: 0, y: 0, visible: false });
  const touchIndicatorTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isCompact, setIsCompact] = useState(false); // icon-only toolbar on narrow screens
  const [showMoreTools, setShowMoreTools] = useState(false); // mobile: expand secondary tools
  const touchCountRef = useRef(0); // track active touches to guard two-finger zoom

  // Zoom/pan state for canvas
  const [viewScale, setViewScale] = useState(1);
  const [viewOffset, setViewOffset] = useState({ x: 0, y: 0 });
  const pinchRef = useRef<{ dist: number; scale: number; cx: number; cy: number; ox: number; oy: number } | null>(null);
  const panRef = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);

  const originalImageRef = useRef<HTMLImageElement | null>(null);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ============================================================================
  // IMAGE LOADING
  // ============================================================================

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

  const initCanvas = useCallback((img: HTMLImageElement) => {
    const bgCanvas = bgCanvasRef.current;
    const drawCanvas = drawCanvasRef.current;
    const container = canvasContainerRef.current;
    if (!bgCanvas || !drawCanvas || !container) return;

    const maxW = container.clientWidth - 16;
    const maxH = container.clientHeight - 16;
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

    // Clear drawing canvas
    const drawCtx = drawCanvas.getContext("2d");
    if (!drawCtx) return;
    drawCtx.clearRect(0, 0, w, h);

    // Save initial history
    const initialData = drawCtx.getImageData(0, 0, w, h);
    const entry: HistoryEntry = { imageData: initialData, overlays: [], memeText: { ...DEFAULT_MEME_TEXT } };
    setHistory([entry]);
    setHistoryIdx(0);
    setOverlays([]);
    setMemeText({ ...DEFAULT_MEME_TEXT });
  }, []);

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
  // HISTORY (with redo support + dynamic memory management)
  // ============================================================================

  // Dynamic max history based on canvas size (memory budget)
  const maxHistory = React.useMemo(() => {
    const { w, h } = canvasDisplaySize;
    if (!w || !h) return DEFAULT_MAX_HISTORY;
    const bytesPerSnapshot = w * h * 4; // RGBA
    const limit = Math.max(10, Math.floor(HISTORY_MEMORY_BUDGET / bytesPerSnapshot));
    return Math.min(limit, 80); // cap at 80 entries
  }, [canvasDisplaySize]);

  const pushHistory = useCallback(
    (newOverlays?: ImageOverlay[], newMemeText?: MemeText) => {
      const drawCanvas = drawCanvasRef.current;
      if (!drawCanvas) return;
      const ctx = drawCanvas.getContext("2d");
      if (!ctx) return;
      const data = ctx.getImageData(0, 0, drawCanvas.width, drawCanvas.height);
      const entry: HistoryEntry = {
        imageData: data,
        overlays: newOverlays ?? overlays,
        memeText: newMemeText ?? memeText,
      };
      setHistory((prev) => {
        const truncated = prev.slice(0, historyIdx + 1);
        const next = [...truncated, entry];
        if (next.length > maxHistory) next.shift();
        return next;
      });
      setHistoryIdx((prev) => Math.min(prev + 1, maxHistory - 1));
    },
    [historyIdx, overlays, memeText, maxHistory]
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
    setOverlays(prev.overlays);
    setMemeText(prev.memeText);
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
    setOverlays(next.overlays);
    setMemeText(next.memeText);
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
    // Confirmed — clear everything
    if (clearTimerRef.current) clearTimeout(clearTimerRef.current);
    setClearPending(false);
    haptic("heavy");
    const drawCanvas = drawCanvasRef.current;
    if (!drawCanvas) return;
    const ctx = drawCanvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, drawCanvas.width, drawCanvas.height);
    setOverlays([]);
    setSelectedOverlay(null);
    const cleared = { ...DEFAULT_MEME_TEXT };
    setMemeText(cleared);
    pushHistory([], cleared);
  }, [clearPending, pushHistory]);

  // ============================================================================
  // MEME TEXT RENDERING
  // ============================================================================

  const drawMemeTextOnCanvas = useCallback(
    (ctx: CanvasRenderingContext2D, w: number, h: number, text: MemeText) => {
      if (!text.top && !text.bottom) return;

      const autoSize = Math.max(16, Math.min(w / 8, h / 6));
      const size = text.fontSize > 0 ? text.fontSize : autoSize;
      const padding = w * 0.04;
      const strokeWidth = Math.max(2, size / 12);

      ctx.font = `900 ${size}px ${MEME_FONT}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.lineJoin = "round";
      ctx.miterLimit = 2;

      const drawText = (str: string, y: number) => {
        const upper = str.toUpperCase();
        // Word-wrap if text is wider than canvas
        const maxWidth = w - padding * 2;
        const lines: string[] = [];
        const words = upper.split(" ");
        let currentLine = "";
        for (const word of words) {
          const test = currentLine ? `${currentLine} ${word}` : word;
          if (ctx.measureText(test).width > maxWidth && currentLine) {
            lines.push(currentLine);
            currentLine = word;
          } else {
            currentLine = test;
          }
        }
        if (currentLine) lines.push(currentLine);

        let lineY = y;
        for (const line of lines) {
          ctx.strokeStyle = "#000000";
          ctx.lineWidth = strokeWidth;
          ctx.strokeText(line, w / 2, lineY, maxWidth);
          ctx.fillStyle = "#ffffff";
          ctx.fillText(line, w / 2, lineY, maxWidth);
          lineY += size * 1.15;
        }
      };

      if (text.top) {
        drawText(text.top, h * 0.04);
      }
      if (text.bottom) {
        // Measure lines to position from bottom
        const upper = text.bottom.toUpperCase();
        const maxWidth = w - padding * 2;
        const words = upper.split(" ");
        let currentLine = "";
        const lines: string[] = [];
        for (const word of words) {
          const test = currentLine ? `${currentLine} ${word}` : word;
          if (ctx.measureText(test).width > maxWidth && currentLine) {
            lines.push(currentLine);
            currentLine = word;
          } else {
            currentLine = test;
          }
        }
        if (currentLine) lines.push(currentLine);
        const totalH = lines.length * size * 1.15;
        const startY = h - totalH - h * 0.04;
        drawText(text.bottom, startY);
      }
    },
    []
  );

  // Live preview: draw meme text on a transparent overlay canvas
  const textCanvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const textCanvas = textCanvasRef.current;
    if (!textCanvas || !loaded) return;
    const { w, h } = canvasDisplaySize;
    if (!w || !h) return;
    textCanvas.width = w;
    textCanvas.height = h;
    const ctx = textCanvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, w, h);
    drawMemeTextOnCanvas(ctx, w, h, memeText);
  }, [memeText, canvasDisplaySize, loaded, drawMemeTextOnCanvas]);

  const commitMemeText = useCallback(() => {
    pushHistory(undefined, memeText);
  }, [pushHistory, memeText]);

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

  // Eyedropper: pick color from canvas at the given position
  const eyedrop = useCallback(
    (clientX: number, clientY: number) => {
      const bgCanvas = bgCanvasRef.current;
      const drawCanvas = drawCanvasRef.current;
      if (!bgCanvas || !drawCanvas) return;
      const pos = getCanvasPos(clientX, clientY);
      // Sample from draw canvas first (user strokes), fall back to bg canvas
      const drawCtx = drawCanvas.getContext("2d");
      const bgCtx = bgCanvas.getContext("2d");
      let pixel: Uint8ClampedArray | null = null;
      if (drawCtx) {
        const d = drawCtx.getImageData(Math.round(pos.x), Math.round(pos.y), 1, 1).data;
        if (d[3] > 10) pixel = d; // only use if not transparent
      }
      if (!pixel && bgCtx) {
        pixel = bgCtx.getImageData(Math.round(pos.x), Math.round(pos.y), 1, 1).data;
      }
      if (pixel) {
        const hex = `#${pixel[0].toString(16).padStart(2, "0")}${pixel[1].toString(16).padStart(2, "0")}${pixel[2].toString(16).padStart(2, "0")}`;
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
      // Show touch indicator on mobile
      if (isTouchDevice()) {
        setTouchIndicator({ x: clientX, y: clientY, visible: true });
      }
    },
    [tool, getCanvasPos, drawLine, eyedrop]
  );

  const moveDraw = useCallback(
    (clientX: number, clientY: number) => {
      if (!isDrawing) return;
      const pos = getCanvasPos(clientX, clientY);
      if (lastPointRef.current) {
        drawLine(lastPointRef.current, pos);
      }
      lastPointRef.current = pos;
      // Update touch indicator position
      if (isTouchDevice()) {
        setTouchIndicator({ x: clientX, y: clientY, visible: true });
      }
    },
    [isDrawing, getCanvasPos, drawLine]
  );

  const endDraw = useCallback(() => {
    if (!isDrawing) return;
    setIsDrawing(false);
    lastPointRef.current = null;
    touchCountRef.current = 0;
    pushHistory();
    // Fade out touch indicator
    if (touchIndicatorTimer.current) clearTimeout(touchIndicatorTimer.current);
    touchIndicatorTimer.current = setTimeout(() => setTouchIndicator(prev => ({ ...prev, visible: false })), 150);
  }, [isDrawing, pushHistory]);

  // ============================================================================
  // OVERLAY PLACEMENT
  // ============================================================================

  const handleCanvasClick = useCallback(
    (clientX: number, clientY: number) => {
      if (tool !== "stamp" || !overlaySrc) return;
      const canvas = drawCanvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const containerEl = canvasContainerRef.current;
      if (!containerEl) return;
      const containerRect = containerEl.getBoundingClientRect();

      const canvasVisualX = rect.left - containerRect.left;
      const canvasVisualY = rect.top - containerRect.top;
      const clickX = clientX - containerRect.left - canvasVisualX - DEFAULT_OVERLAY_SIZE / 2;
      const clickY = clientY - containerRect.top - canvasVisualY - DEFAULT_OVERLAY_SIZE / 2;

      const newOverlay: ImageOverlay = {
        id: generateId(),
        src: overlaySrc,
        x: clickX,
        y: clickY,
        w: DEFAULT_OVERLAY_SIZE,
        h: DEFAULT_OVERLAY_SIZE,
      };
      const updated = [...overlays, newOverlay];
      setOverlays(updated);
      pushHistory(updated);
    },
    [tool, overlaySrc, overlays, pushHistory]
  );

  // ============================================================================
  // OVERLAY DRAG
  // ============================================================================

  const startDragOverlay = useCallback(
    (e: React.MouseEvent | React.TouchEvent, overlayId: string) => {
      e.stopPropagation();
      e.preventDefault();
      const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
      const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
      const overlay = overlays.find((s) => s.id === overlayId);
      if (!overlay) return;
      const containerEl = canvasContainerRef.current;
      if (!containerEl) return;
      const containerRect = containerEl.getBoundingClientRect();
      const canvasRect = drawCanvasRef.current?.getBoundingClientRect();
      if (!canvasRect) return;
      const canvasOffX = canvasRect.left - containerRect.left;
      const canvasOffY = canvasRect.top - containerRect.top;
      setDragOffset({
        x: clientX - containerRect.left - canvasOffX - overlay.x,
        y: clientY - containerRect.top - canvasOffY - overlay.y,
      });
      setDraggingOverlay(overlayId);
      setTool("select");
      setOverlaySrc(null);
    },
    [overlays]
  );

  const startResizeOverlay = useCallback(
    (e: React.MouseEvent | React.TouchEvent, overlayId: string) => {
      e.stopPropagation();
      e.preventDefault();
      setResizingOverlay(overlayId);
    },
    []
  );

  useEffect(() => {
    if (!draggingOverlay && !resizingOverlay) return;

    const onMove = (e: MouseEvent | TouchEvent) => {
      const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
      const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
      const containerEl = canvasContainerRef.current;
      if (!containerEl) return;
      const containerRect = containerEl.getBoundingClientRect();
      const canvasRect = drawCanvasRef.current?.getBoundingClientRect();
      if (!canvasRect) return;
      const canvasOffX = canvasRect.left - containerRect.left;
      const canvasOffY = canvasRect.top - containerRect.top;

      if (draggingOverlay) {
        const newX = clientX - containerRect.left - canvasOffX - dragOffset.x;
        const newY = clientY - containerRect.top - canvasOffY - dragOffset.y;
        setOverlays((prev) =>
          prev.map((s) => (s.id === draggingOverlay ? { ...s, x: newX, y: newY } : s))
        );
      }

      if (resizingOverlay) {
        setOverlays((prev) =>
          prev.map((s) => {
            if (s.id !== resizingOverlay) return s;
            const centerX = canvasOffX + s.x + s.w / 2;
            const centerY = canvasOffY + s.y + s.h / 2;
            const dx = clientX - containerRect.left - centerX;
            const dy = clientY - containerRect.top - centerY;
            const dist = Math.max(30, Math.sqrt(dx * dx + dy * dy) * 2);
            return { ...s, w: dist, h: dist };
          })
        );
      }
    };

    const onUp = () => {
      if (draggingOverlay || resizingOverlay) {
        setDraggingOverlay(null);
        setResizingOverlay(null);
      }
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    window.addEventListener("touchmove", onMove, { passive: false });
    window.addEventListener("touchend", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onUp);
    };
  }, [draggingOverlay, resizingOverlay, dragOffset]);

  // Push history after drag/resize ends
  useEffect(() => {
    if (!draggingOverlay && !resizingOverlay && loaded && history.length > 0) {
      const lastEntry = history[historyIdx];
      if (lastEntry && JSON.stringify(lastEntry.overlays) !== JSON.stringify(overlays)) {
        pushHistory();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draggingOverlay, resizingOverlay]);

  // ============================================================================
  // CANVAS MOUSE/TOUCH EVENTS
  // ============================================================================

  const onCanvasMouseDown = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      e.preventDefault();
      if (tool === "stamp") {
        handleCanvasClick(e.clientX, e.clientY);
      } else if (tool === "draw" || tool === "eraser" || tool === "eyedropper") {
        startDraw(e.clientX, e.clientY);
      }
    },
    [tool, handleCanvasClick, startDraw]
  );

  const onCanvasMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      moveDraw(e.clientX, e.clientY);
    },
    [moveDraw]
  );

  const onCanvasMouseUp = useCallback(() => {
    endDraw();
  }, [endDraw]);

  const onCanvasTouchStart = useCallback(
    (e: React.TouchEvent<HTMLCanvasElement>) => {
      e.preventDefault();
      touchCountRef.current = e.touches.length;
      // Two-finger guard: if a second finger appears while drawing, cancel the stroke
      if (e.touches.length >= 2 && isDrawing) {
        // Cancel current stroke — undo the in-progress drawing
        setIsDrawing(false);
        lastPointRef.current = null;
        setTouchIndicator(prev => ({ ...prev, visible: false }));
        // Don't push history — discard this partial stroke
        const drawCanvas = drawCanvasRef.current;
        if (drawCanvas && history[historyIdx]) {
          const ctx = drawCanvas.getContext("2d");
          if (ctx) ctx.putImageData(history[historyIdx].imageData, 0, 0);
        }
        return;
      }
      const touch = e.touches[0];
      if (!touch) return;
      if (tool === "stamp") {
        handleCanvasClick(touch.clientX, touch.clientY);
      } else if (tool === "draw" || tool === "eraser" || tool === "eyedropper") {
        startDraw(touch.clientX, touch.clientY);
      }
    },
    [tool, handleCanvasClick, startDraw, isDrawing, history, historyIdx]
  );

  const onCanvasTouchMove = useCallback(
    (e: React.TouchEvent<HTMLCanvasElement>) => {
      e.preventDefault();
      // If multiple fingers appear mid-stroke, ignore
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
      if (e.touches.length === 0) {
        endDraw();
      }
    },
    [endDraw]
  );

  // ============================================================================
  // DELETE LAST OVERLAY
  // ============================================================================

  const deleteOverlay = useCallback((id: string) => {
    const updated = overlays.filter((o) => o.id !== id);
    setOverlays(updated);
    setSelectedOverlay(null);
    pushHistory(updated);
  }, [overlays, pushHistory]);

  // ============================================================================
  // UPLOAD IMAGE OVERLAY
  // ============================================================================

  const handleUploadOverlay = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataURL = reader.result as string;
      setOverlaySrc(dataURL);
      setTool("stamp");
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  }, []);

  // ============================================================================
  // EXPORT / DONE
  // ============================================================================

  const handleDone = useCallback(() => {
    const bgCanvas = bgCanvasRef.current;
    const drawCanvas = drawCanvasRef.current;
    const img = originalImageRef.current;
    if (!bgCanvas || !drawCanvas || !img) return;

    const exportCanvas = document.createElement("canvas");
    exportCanvas.width = img.naturalWidth;
    exportCanvas.height = img.naturalHeight;
    const ectx = exportCanvas.getContext("2d");
    if (!ectx) return;

    // 1. Draw original image at full resolution
    ectx.drawImage(img, 0, 0, img.naturalWidth, img.naturalHeight);

    // 2. Draw brush strokes scaled up
    ectx.drawImage(drawCanvas, 0, 0, img.naturalWidth, img.naturalHeight);

    // 3. Draw overlays at proportional positions
    const scaleX = img.naturalWidth / canvasDisplaySize.w;
    const scaleY = img.naturalHeight / canvasDisplaySize.h;

    const overlayPromises = overlays.map((overlay) => {
      return new Promise<void>((resolve) => {
        const overlayImg = new Image();
        overlayImg.crossOrigin = "anonymous";
        overlayImg.onload = () => {
          ectx.drawImage(
            overlayImg,
            overlay.x * scaleX,
            overlay.y * scaleY,
            overlay.w * scaleX,
            overlay.h * scaleY
          );
          resolve();
        };
        overlayImg.onerror = () => resolve();
        overlayImg.src = overlay.src;
      });
    });

    Promise.all(overlayPromises).then(() => {
      // 4. Draw meme text at full resolution
      drawMemeTextOnCanvas(ectx, img.naturalWidth, img.naturalHeight, memeText);

      // Detect export format: preserve PNG transparency, otherwise export JPEG
      const isPng = imageFile.type === "image/png" || imageFile.name.toLowerCase().endsWith(".png");
      const mimeType = isPng ? "image/png" : "image/jpeg";
      const ext = isPng ? ".png" : ".jpg";
      const quality = isPng ? undefined : 0.92;

      exportCanvas.toBlob(
        (blob) => {
          if (!blob) return;
          const name = (fileName || imageFile.name.replace(/\.[^.]+$/, "")) + ext;
          const file = new File([blob], name, { type: mimeType });
          onDone(file);
        },
        mimeType,
        quality
      );
    });
  }, [imageFile, onDone, overlays, canvasDisplaySize, memeText, drawMemeTextOnCanvas, fileName]);

  // ============================================================================
  // KEYBOARD SHORTCUTS
  // ============================================================================

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Don't intercept when typing in inputs
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;

      // Ctrl/Cmd+Z = undo, Ctrl/Cmd+Shift+Z = redo
      if ((e.ctrlKey || e.metaKey) && e.key === "z") {
        e.preventDefault();
        if (e.shiftKey) {
          redo();
        } else {
          undo();
        }
        return;
      }
      // Ctrl/Cmd+Y = redo (Windows)
      if ((e.ctrlKey || e.metaKey) && e.key === "y") {
        e.preventDefault();
        redo();
        return;
      }

      // Delete selected overlay
      if ((e.key === "Delete" || e.key === "Backspace") && selectedOverlay) {
        e.preventDefault();
        deleteOverlay(selectedOverlay);
        return;
      }

      // Escape to deselect overlay or close popups
      if (e.key === "Escape") {
        setSelectedOverlay(null);
        setShowColorPicker(false);
        setShowBrushMenu(false);
        return;
      }

      // Tool shortcuts
      if (e.key === "b" || e.key === "B") { setTool("draw"); setOverlaySrc(null); haptic("light"); }
      if (e.key === "e" || e.key === "E") { setTool("eraser"); setOverlaySrc(null); haptic("light"); }
      if (e.key === "t" || e.key === "T") { setTool("text"); setOverlaySrc(null); haptic("light"); }
      if (e.key === "v" || e.key === "V") { setTool("select"); setOverlaySrc(null); haptic("light"); }
      if (e.key === "i" || e.key === "I") { setTool("eyedropper"); setOverlaySrc(null); haptic("light"); }

      // Brush size: [ = decrease, ] = increase
      if (e.key === "[" || e.key === "-") {
        setBrushSize((s) => Math.max(1, s - (s > 10 ? 4 : 2)));
      }
      if (e.key === "]" || e.key === "=" || e.key === "+") {
        setBrushSize((s) => Math.min(100, s + (s >= 10 ? 4 : 2)));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo, selectedOverlay, deleteOverlay]);

  // ============================================================================
  // ZOOM/PAN GESTURES (two-finger pinch + pan on canvas container)
  // ============================================================================

  const handleContainerTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2 && !drawLock) {
      // Start pinch zoom (only if draw lock is OFF)
      const t1 = e.touches[0], t2 = e.touches[1];
      const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
      const cx = (t1.clientX + t2.clientX) / 2;
      const cy = (t1.clientY + t2.clientY) / 2;
      pinchRef.current = { dist, scale: viewScale, cx, cy, ox: viewOffset.x, oy: viewOffset.y };
      panRef.current = null;
    } else if (e.touches.length === 1 && tool === "select") {
      // Single finger pan in select mode
      const t = e.touches[0];
      panRef.current = { x: t.clientX, y: t.clientY, ox: viewOffset.x, oy: viewOffset.y };
    }
  }, [viewScale, viewOffset, tool, drawLock]);

  const handleContainerTouchMove = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2 && pinchRef.current && !drawLock) {
      e.preventDefault();
      const t1 = e.touches[0], t2 = e.touches[1];
      const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
      const newScale = Math.min(5, Math.max(0.5, pinchRef.current.scale * (dist / pinchRef.current.dist)));
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
  }, [tool, drawLock]);

  const handleContainerTouchEnd = useCallback(() => {
    pinchRef.current = null;
    panRef.current = null;
  }, []);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const factor = Math.exp(-e.deltaY * 0.003);
    setViewScale(s => Math.min(5, Math.max(0.5, s * factor)));
  }, []);

  const resetZoom = useCallback(() => {
    setViewScale(1);
    setViewOffset({ x: 0, y: 0 });
  }, []);

  // ============================================================================
  // BRUSH PREVIEW CURSOR (dynamic SVG circle)
  // ============================================================================

  const cursorStyle = React.useMemo(() => {
    if (tool === "stamp") return "copy";
    if (tool === "eyedropper") return "crosshair";
    if (tool !== "draw" && tool !== "eraser") return "default";

    // Generate a circle SVG cursor that matches brush size + color
    const displaySize = Math.max(4, Math.min(brushSize, 64)); // cap cursor size for usability
    const svgSize = displaySize + 4; // padding for stroke
    const center = svgSize / 2;
    const radius = displaySize / 2;
    const strokeColor = tool === "eraser" ? "rgba(255,255,255,0.8)" : color;
    const fillColor = tool === "eraser"
      ? "rgba(255,255,255,0.15)"
      : `${color}${Math.round(brushOpacity * 0.3 * 255).toString(16).padStart(2, "0")}`;

    const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${svgSize}' height='${svgSize}'><circle cx='${center}' cy='${center}' r='${radius}' fill='${fillColor}' stroke='${strokeColor}' stroke-width='1'/><circle cx='${center}' cy='${center}' r='1' fill='${strokeColor}'/></svg>`;
    const encoded = encodeURIComponent(svg);
    return `url("data:image/svg+xml,${encoded}") ${center} ${center}, crosshair`;
  }, [tool, brushSize, color, brushOpacity]);

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 99999,
        display: "flex",
        flexDirection: "column",
        background: "rgba(8, 12, 20, 0.98)",
        paddingBottom: musicBarVisible ? 48 : 0,
        transition: "padding-bottom 0.2s ease",
      }}
    >
      {/* ============ VISTA-STYLE TITLEBAR ============ */}
      <div
        className="vista-window__titlebar"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 12px",
          height: 36,
          flexShrink: 0,
        }}
      >
        <div className="vista-window__title" style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div
            style={{
              width: 14,
              height: 14,
              borderRadius: 2,
              background: "linear-gradient(135deg, #00cccc 0%, #0088aa 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 8,
              color: "#000",
              fontWeight: 900,
            }}
          >
            F
          </div>
          <span
            style={{
              fontFamily: "var(--font-terminal), monospace",
              fontSize: 12,
              color: "rgba(255,255,255,0.7)",
              letterSpacing: "0.08em",
            }}
          >
            FOID_PAINT.EXE
          </span>
        </div>
        <div className="vista-window__controls">
          <button
            onClick={onCancel}
            style={{
              width: 28,
              height: 22,
              border: "1px solid rgba(255,255,255,0.15)",
              borderRadius: 3,
              background: "rgba(255, 60, 60, 0.15)",
              color: "rgba(255,255,255,0.8)",
              fontSize: 13,
              fontWeight: 700,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              lineHeight: 1,
            }}
            title="Close (Cancel)"
          >
            &times;
          </button>
        </div>
      </div>

      {/* ============ CANVAS AREA (full width, fills remaining space) ============ */}
      <div
        ref={canvasContainerRef}
        style={{
          flex: 1,
          minHeight: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
          padding: 8,
          position: "relative",
          background: "rgba(8, 12, 20, 0.95)",
        }}
        onTouchStart={handleContainerTouchStart}
        onTouchMove={handleContainerTouchMove}
        onTouchEnd={handleContainerTouchEnd}
        onWheel={handleWheel}
        onClick={() => { setShowColorPicker(false); setShowBrushMenu(false); setSelectedOverlay(null); }}
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

        {/* Mobile touch brush indicator — shows where the finger is drawing */}
        {touchIndicator.visible && (tool === "draw" || tool === "eraser") && (
          <div
            style={{
              position: "fixed",
              left: touchIndicator.x,
              top: touchIndicator.y,
              width: Math.max(brushSize * viewScale, 8),
              height: Math.max(brushSize * viewScale, 8),
              borderRadius: "50%",
              border: `1.5px solid ${tool === "eraser" ? "rgba(255,255,255,0.7)" : color}`,
              background: tool === "eraser" ? "rgba(255,255,255,0.1)" : `${color}${Math.round(brushOpacity * 0.2 * 255).toString(16).padStart(2, "0")}`,
              transform: "translate(-50%, -50%)",
              pointerEvents: "none",
              zIndex: 30,
              transition: "opacity 0.15s",
              opacity: touchIndicator.visible ? 0.9 : 0,
            }}
          />
        )}

        {/* Canvas stack */}
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
          {/* Background canvas (image) */}
          <canvas
            ref={bgCanvasRef}
            style={{
              display: "block",
              borderRadius: 2,
              boxShadow: isDrawing
                ? "0 0 20px rgba(0,204,204,0.25), 0 4px 24px rgba(0,0,0,0.5)"
                : "0 4px 24px rgba(0,0,0,0.5)",
              transition: "box-shadow 0.3s",
            }}
          />

          {/* Drawing overlay canvas */}
          <canvas
            ref={drawCanvasRef}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              display: "block",
              cursor: cursorStyle,
              touchAction: "none",
              borderRadius: 2,
              boxShadow: isDrawing
                ? "inset 0 0 0 1px rgba(0,204,204,0.2)"
                : "none",
              transition: "box-shadow 0.3s",
            }}
            onMouseDown={onCanvasMouseDown}
            onMouseMove={onCanvasMouseMove}
            onMouseUp={onCanvasMouseUp}
            onMouseLeave={onCanvasMouseUp}
            onTouchStart={onCanvasTouchStart}
            onTouchMove={onCanvasTouchMove}
            onTouchEnd={onCanvasTouchEnd}
          />

          {/* Meme text preview canvas */}
          <canvas
            ref={textCanvasRef}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              display: "block",
              pointerEvents: "none",
              borderRadius: 2,
              zIndex: 5,
            }}
          />

          {/* Placed image overlays */}
          {overlays.map((overlay) => {
            const isSelected = selectedOverlay === overlay.id;
            return (
              <div
                key={overlay.id}
                style={{
                  position: "absolute",
                  left: overlay.x,
                  top: overlay.y,
                  width: overlay.w,
                  height: overlay.h,
                  cursor: draggingOverlay === overlay.id ? "grabbing" : "grab",
                  userSelect: "none",
                  touchAction: "none",
                  zIndex: isSelected ? 12 : 10,
                  outline: isSelected ? "2px solid #00cccc" : "none",
                  outlineOffset: 2,
                  borderRadius: 2,
                }}
                onMouseDown={(e) => { setSelectedOverlay(overlay.id); startDragOverlay(e, overlay.id); }}
                onTouchStart={(e) => { setSelectedOverlay(overlay.id); startDragOverlay(e, overlay.id); }}
                onClick={(e) => { e.stopPropagation(); setSelectedOverlay(overlay.id); }}
              >
                <img
                  src={overlay.src}
                  alt=""
                  draggable={false}
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "contain",
                    pointerEvents: "none",
                  }}
                />
                {/* Delete button (visible when selected) */}
                {isSelected && (
                  <button
                    onClick={(e) => { e.stopPropagation(); deleteOverlay(overlay.id); }}
                    onTouchStart={(e) => { e.stopPropagation(); }}
                    style={{
                      position: "absolute",
                      top: -10,
                      right: -10,
                      width: 22,
                      height: 22,
                      borderRadius: "50%",
                      background: "rgba(255, 60, 60, 0.9)",
                      border: "2px solid rgba(255,255,255,0.8)",
                      color: "#fff",
                      fontSize: 12,
                      fontWeight: 900,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      lineHeight: 1,
                      zIndex: 13,
                      boxShadow: "0 2px 8px rgba(0,0,0,0.5)",
                    }}
                    title="Delete sticker"
                  >
                    &times;
                  </button>
                )}
                {/* Resize handle */}
                <div
                  style={{
                    position: "absolute",
                    right: -4,
                    bottom: -4,
                    width: isSelected ? 16 : 12,
                    height: isSelected ? 16 : 12,
                    background: "#00cccc",
                    border: isSelected ? "2px solid rgba(255,255,255,0.6)" : "1px solid rgba(0,0,0,0.3)",
                    borderRadius: 2,
                    cursor: "nwse-resize",
                    zIndex: 13,
                    transition: "width 0.1s, height 0.1s",
                  }}
                  onMouseDown={(e) => startResizeOverlay(e, overlay.id)}
                  onTouchStart={(e) => startResizeOverlay(e, overlay.id)}
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* ============ THIN STATUS BAR (hidden on mobile) ============ */}
      {!isCompact && (
      <div
        style={{
          height: 20,
          padding: "0 16px",
          borderTop: "1px solid rgba(255,255,255,0.04)",
          background: "rgba(16, 20, 32, 0.7)",
          display: "flex",
          alignItems: "center",
          gap: 12,
          flexShrink: 0,
          overflow: "hidden",
        }}
      >
        <input
          type="text"
          value={fileName}
          onChange={(e) => setFileName(e.target.value)}
          style={{
            fontSize: 9,
            color: "rgba(255,255,255,0.5)",
            fontFamily: "var(--font-terminal), monospace",
            whiteSpace: "nowrap",
            background: "transparent",
            border: "none",
            borderBottom: "1px solid rgba(255,255,255,0.1)",
            outline: "none",
            padding: "0 2px",
            minWidth: 60,
            maxWidth: 180,
          }}
          title="Edit filename"
        />
        {originalImageRef.current && (
          <span
            style={{
              fontSize: 9,
              color: "rgba(255,255,255,0.25)",
              fontFamily: "var(--font-terminal), monospace",
              whiteSpace: "nowrap",
            }}
          >
            {originalImageRef.current.naturalWidth}x{originalImageRef.current.naturalHeight}
          </span>
        )}
        {/* Mode indicator badge */}
        <span
          style={{
            fontSize: 8,
            color: tool === "draw" ? "#00cccc" : tool === "eraser" ? "#ff8800" : tool === "text" ? "#a855f7" : tool === "stamp" ? "#f06292" : tool === "eyedropper" ? "#ffdd00" : "rgba(255,255,255,0.4)",
            fontFamily: "var(--font-terminal), monospace",
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            background: tool === "draw" ? "rgba(0,204,204,0.1)" : tool === "eraser" ? "rgba(255,136,0,0.1)" : tool === "text" ? "rgba(168,85,247,0.1)" : tool === "stamp" ? "rgba(240,98,146,0.1)" : tool === "eyedropper" ? "rgba(255,221,0,0.1)" : "transparent",
            padding: "1px 6px",
            borderRadius: 3,
            border: `1px solid ${tool === "draw" ? "rgba(0,204,204,0.2)" : tool === "eraser" ? "rgba(255,136,0,0.2)" : tool === "text" ? "rgba(168,85,247,0.2)" : tool === "stamp" ? "rgba(240,98,146,0.2)" : tool === "eyedropper" ? "rgba(255,221,0,0.2)" : "rgba(255,255,255,0.06)"}`,
            whiteSpace: "nowrap",
          }}
        >
          {tool === "draw" ? "BRUSH" : tool === "eraser" ? "ERASER" : tool === "text" ? "MEME TXT" : tool === "stamp" ? "STAMP" : tool === "eyedropper" ? "PICKER" : "SELECT"}
          {(tool === "draw" || tool === "eraser") && ` ${brushSize}px`}
          {tool === "draw" && brushOpacity < 1 && ` ${Math.round(brushOpacity * 100)}%`}
        </span>
        {/* Draw lock indicator */}
        {drawLock && (
          <span
            style={{
              fontSize: 7,
              color: "#ff8800",
              fontFamily: "var(--font-terminal), monospace",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              whiteSpace: "nowrap",
            }}
          >
            LOCKED
          </span>
        )}
        {/* Export format indicator */}
        <span
          style={{
            fontSize: 8,
            color: imageFile.type === "image/png" || imageFile.name.toLowerCase().endsWith(".png") ? "rgba(116,255,235,0.5)" : "rgba(255,255,255,0.25)",
            fontFamily: "var(--font-terminal), monospace",
            whiteSpace: "nowrap",
          }}
        >
          {imageFile.type === "image/png" || imageFile.name.toLowerCase().endsWith(".png") ? "PNG" : "JPG"}
        </span>
      </div>
      )}

      {/* ============ TEXT TOOL PANEL (above toolbar when active) ============ */}
      {tool === "text" && (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            gap: 8,
            padding: isCompact ? "6px 8px" : "8px 12px",
            borderTop: "1px solid rgba(0,204,204,0.1)",
            background: "rgba(16, 20, 32, 0.98)",
            flexShrink: 0,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 6, flex: "1 1 140px", minWidth: 0 }}>
            <span style={{ fontSize: 9, color: "rgba(255,255,255,0.5)", fontFamily: "var(--font-terminal), monospace", whiteSpace: "nowrap" }}>TOP</span>
            <input
              type="text"
              placeholder="TOP TEXT"
              value={memeText.top}
              onChange={(e) => setMemeText((prev) => ({ ...prev, top: e.target.value }))}
              onBlur={commitMemeText}
              style={{
                flex: 1,
                minWidth: 0,
                height: 28,
                padding: "0 8px",
                borderRadius: 4,
                border: "1px solid rgba(0,204,204,0.3)",
                background: "rgba(0,0,0,0.4)",
                color: "#fff",
                fontSize: 12,
                fontFamily: MEME_FONT,
                textTransform: "uppercase",
                letterSpacing: "0.04em",
              }}
            />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, flex: "1 1 140px", minWidth: 0 }}>
            <span style={{ fontSize: 9, color: "rgba(255,255,255,0.5)", fontFamily: "var(--font-terminal), monospace", whiteSpace: "nowrap" }}>BTM</span>
            <input
              type="text"
              placeholder="BOTTOM TEXT"
              value={memeText.bottom}
              onChange={(e) => setMemeText((prev) => ({ ...prev, bottom: e.target.value }))}
              onBlur={commitMemeText}
              style={{
                flex: 1,
                minWidth: 0,
                height: 28,
                padding: "0 8px",
                borderRadius: 4,
                border: "1px solid rgba(0,204,204,0.3)",
                background: "rgba(0,0,0,0.4)",
                color: "#fff",
                fontSize: 12,
                fontFamily: MEME_FONT,
                textTransform: "uppercase",
                letterSpacing: "0.04em",
              }}
            />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
            <span style={{ fontSize: 9, color: "rgba(255,255,255,0.4)", fontFamily: "var(--font-terminal), monospace", whiteSpace: "nowrap" }}>
              {memeText.fontSize > 0 ? `${memeText.fontSize}px` : "AUTO"}
            </span>
            <input
              type="range"
              min={0}
              max={120}
              step={2}
              value={memeText.fontSize}
              onChange={(e) => setMemeText((prev) => ({ ...prev, fontSize: Number(e.target.value) }))}
              onMouseUp={commitMemeText}
              onTouchEnd={commitMemeText}
              style={{ width: 70, accentColor: "#00cccc", cursor: "pointer" }}
            />
          </div>
        </div>
      )}

      {/* Hidden file input for stamp uploads */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={handleUploadOverlay}
      />

      {/* ============ BOTTOM TOOLBAR ============ */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          borderTop: "1px solid rgba(0,204,204,0.1)",
          background: "rgba(16, 20, 32, 0.95)",
          flexShrink: 0,
          position: "relative",
          overflow: "visible",
        }}
      >
        {/* ---- MOBILE: Expanded secondary tools panel ---- */}
        {isCompact && showMoreTools && (
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6, padding: "8px 10px", borderBottom: "1px solid rgba(0,204,204,0.08)" }}>
            <ToolBtn label="" icon={<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><text x="2" y="12" fontSize="12" fontWeight="900" fontFamily="Impact" fill="currentColor">A</text></svg>}
              active={tool === "text"} onClick={() => { setTool("text"); setOverlaySrc(null); setShowMoreTools(false); haptic("light"); }} />
            <ToolBtn label="" icon={<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="1" y="3" width="12" height="8" rx="1" stroke="currentColor" strokeWidth="1.2" fill="none" /><circle cx="4" cy="6" r="1.2" fill="currentColor" /><path d="M1 10L4.5 7L7 9L9.5 6.5L13 10" stroke="currentColor" strokeWidth="1.2" /></svg>}
              active={tool === "stamp"} onClick={() => { fileInputRef.current?.click(); setShowMoreTools(false); haptic("light"); }} />
            <ToolBtn label="" icon={<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M11.5 2.5L9.5 4.5M9.5 4.5L5 9L4 10.5L3.5 10L5 9L9.5 4.5Z" stroke="currentColor" strokeWidth="1.2" fill="none" strokeLinecap="round" /><path d="M2 12L3.5 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /><circle cx="11.5" cy="2.5" r="1.5" stroke="currentColor" strokeWidth="1" fill="none" /></svg>}
              active={tool === "eyedropper"} onClick={() => { setTool("eyedropper"); setOverlaySrc(null); setShowMoreTools(false); haptic("light"); }} />
            <ToolBtn label="" icon={<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M10 5L13 8L10 11" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" /><path d="M13 8H5C3 8 1.5 9.5 1.5 11" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" /></svg>}
              active={false} onClick={() => { redo(); haptic("light"); }} disabled={historyIdx >= history.length - 1} />
            <button title={clearPending ? "Tap again" : "Clear"} onClick={handleClearClick}
              style={{ height: 36, padding: "0 10px", borderRadius: 5, border: clearPending ? "1px solid rgba(255, 60, 60, 0.6)" : "1px solid rgba(255,255,255,0.1)", background: clearPending ? "rgba(255, 60, 60, 0.15)" : "rgba(255,255,255,0.04)", color: clearPending ? "#ff6666" : "rgba(255,255,255,0.65)", fontSize: 11, fontFamily: "var(--font-terminal), monospace", cursor: "pointer", display: "flex", alignItems: "center", gap: 3, flexShrink: 0 }}>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M3 3L11 11M11 3L3 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
              {clearPending ? "Sure?" : "Clear"}
            </button>
            {/* Brush size */}
            <div style={{ position: "relative", flexShrink: 0 }}>
              <button title="Brush size" onClick={(e) => { e.stopPropagation(); setShowBrushMenu(!showBrushMenu); setShowColorPicker(false); }}
                style={{ height: 36, padding: "0 10px", borderRadius: 5, border: showBrushMenu ? "1px solid rgba(0,204,204,0.5)" : "1px solid rgba(255,255,255,0.1)", background: showBrushMenu ? "rgba(0,204,204,0.12)" : "rgba(255,255,255,0.04)", color: showBrushMenu ? "#00cccc" : "rgba(255,255,255,0.65)", fontSize: 11, fontFamily: "var(--font-terminal), monospace", cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
                <div style={{ width: Math.min(brushSize, 14), height: Math.min(brushSize, 14), borderRadius: "50%", background: "currentColor" }} />
                {brushSize}px
              </button>
              {showBrushMenu && (
                <div onClick={(e) => e.stopPropagation()} style={{ position: "absolute", bottom: "100%", left: "50%", transform: "translateX(-50%)", marginBottom: 6, padding: 8, borderRadius: 10, background: "rgba(16, 20, 32, 0.98)", border: "1px solid rgba(0,204,204,0.25)", boxShadow: "0 8px 32px rgba(0,0,0,0.6)", display: "flex", gap: 5, flexWrap: "wrap", width: 170, zIndex: 20 }}>
                  {[2, 4, 8, 12, 16, 24, 30].map(size => (
                    <button key={size} onClick={() => { setBrushSize(size); setShowBrushMenu(false); }} style={{ width: 36, height: 36, borderRadius: 6, border: brushSize === size ? "1px solid rgba(0,204,204,0.6)" : "1px solid rgba(255,255,255,0.1)", background: brushSize === size ? "rgba(0,204,204,0.15)" : "rgba(255,255,255,0.04)", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2, color: brushSize === size ? "#00cccc" : "rgba(255,255,255,0.5)" }}>
                      <div style={{ width: Math.min(size, 16), height: Math.min(size, 16), borderRadius: "50%", background: "currentColor" }} />
                      <span style={{ fontSize: 7, fontFamily: "var(--font-terminal), monospace" }}>{size}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            {/* Lock */}
            <button title={drawLock ? "Draw lock ON" : "Draw lock OFF"} onClick={() => { setDrawLock(l => !l); haptic(drawLock ? "light" : "medium"); }}
              style={{ height: 36, padding: "0 10px", borderRadius: 5, border: drawLock ? "1px solid rgba(255,136,0,0.5)" : "1px solid rgba(255,255,255,0.1)", background: drawLock ? "rgba(255,136,0,0.12)" : "rgba(255,255,255,0.04)", color: drawLock ? "#ff8800" : "rgba(255,255,255,0.4)", fontSize: 10, fontFamily: "var(--font-terminal), monospace", cursor: "pointer", display: "flex", alignItems: "center", gap: 3, flexShrink: 0 }}>
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                {drawLock ? (<><rect x="2" y="5" width="8" height="6" rx="1" stroke="currentColor" strokeWidth="1.2" fill="none" /><path d="M4 5V3.5C4 2.1 5.1 1 6.5 1H5.5C6.9 1 8 2.1 8 3.5V5" stroke="currentColor" strokeWidth="1.2" /></>) : (<><rect x="2" y="5" width="8" height="6" rx="1" stroke="currentColor" strokeWidth="1.2" fill="none" /><path d="M4 5V3.5C4 2.1 4.6 1 6 1C7.4 1 8 2.1 8 3.5" stroke="currentColor" strokeWidth="1.2" /></>)}
              </svg>
              {drawLock ? "On" : "Lock"}
            </button>
          </div>
        )}

        {/* ---- MOBILE: Main toolbar row ---- */}
        {isCompact ? (
          <div style={{ display: "flex", alignItems: "center", gap: 4, padding: "6px 8px", minHeight: 48, overflow: "visible" }}>
            <ToolBtn label="" icon={<svg width="18" height="18" viewBox="0 0 14 14" fill="none"><path d="M10.5 1.5L12.5 3.5L4.5 11.5L1.5 12.5L2.5 9.5L10.5 1.5Z" stroke="currentColor" strokeWidth="1.2" fill="none" /></svg>}
              active={tool === "draw"} onClick={() => { setTool("draw"); setOverlaySrc(null); haptic("light"); }} />
            <ToolBtn label="" icon={<svg width="18" height="18" viewBox="0 0 14 14" fill="none"><rect x="2" y="6" width="10" height="5" rx="1" stroke="currentColor" strokeWidth="1.2" fill="none" /><path d="M4 6V4C4 3.4 4.4 3 5 3H9C9.6 3 10 3.4 10 4V6" stroke="currentColor" strokeWidth="1.2" /></svg>}
              active={tool === "eraser"} onClick={() => { setTool("eraser"); setOverlaySrc(null); haptic("light"); }} />

            {/* Color */}
            <div style={{ position: "relative", flexShrink: 0 }}>
              <button title="Color" onClick={(e) => { e.stopPropagation(); setShowColorPicker(!showColorPicker); setShowBrushMenu(false); }}
                style={{ width: 36, height: 36, borderRadius: "50%", border: showColorPicker ? "2px solid rgba(0,204,204,0.8)" : "2px solid rgba(0,204,204,0.5)", background: color, cursor: "pointer", boxShadow: showColorPicker ? "0 0 10px rgba(0,204,204,0.5)" : "0 0 4px rgba(0,0,0,0.4)" }} />
              {showColorPicker && (
                <div onClick={(e) => e.stopPropagation()} style={{ position: "absolute", bottom: "100%", left: "50%", transform: "translateX(-50%)", marginBottom: 6, padding: 10, borderRadius: 10, background: "rgba(16, 20, 32, 0.98)", border: "1px solid rgba(0,204,204,0.25)", boxShadow: "0 8px 32px rgba(0,0,0,0.6)", zIndex: 20, width: 200 }}>
                  <div style={{ fontSize: 8, color: "rgba(0,204,204,0.7)", fontFamily: "var(--font-terminal), monospace", letterSpacing: "0.1em", marginBottom: 4, textTransform: "uppercase" }}>FOID</div>
                  <div style={{ display: "flex", gap: 6, marginBottom: 8, flexWrap: "wrap" }}>
                    {FOID_COLORS.map(c => (<button key={c} onClick={() => { setColor(c); setShowColorPicker(false); if (tool !== "draw" && tool !== "eraser") setTool("draw"); }} style={{ width: 32, height: 32, borderRadius: 6, border: color === c ? "2px solid #fff" : "1px solid rgba(255,255,255,0.15)", background: c, cursor: "pointer", flexShrink: 0, boxShadow: color === c ? `0 0 8px ${c}80` : "none" }} />))}
                  </div>
                  <div style={{ fontSize: 8, color: "rgba(255,255,255,0.4)", fontFamily: "var(--font-terminal), monospace", letterSpacing: "0.1em", marginBottom: 4, textTransform: "uppercase" }}>Standard</div>
                  <div style={{ display: "flex", gap: 6, marginBottom: 8, flexWrap: "wrap" }}>
                    {STANDARD_COLORS.map(c => (<button key={c} onClick={() => { setColor(c); setShowColorPicker(false); if (tool !== "draw" && tool !== "eraser") setTool("draw"); }} style={{ width: 32, height: 32, borderRadius: 6, border: color === c ? "2px solid #00cccc" : `1px solid ${c === "#000000" ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.1)"}`, background: c, cursor: "pointer", flexShrink: 0, boxShadow: color === c ? "0 0 6px rgba(0,204,204,0.4)" : "none" }} />))}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: 8, color: "rgba(255,255,255,0.4)", fontFamily: "var(--font-terminal), monospace", letterSpacing: "0.1em", textTransform: "uppercase" }}>Custom</span>
                    <input ref={colorInputRef} type="color" value={color} onChange={(e) => { setColor(e.target.value); if (tool !== "draw" && tool !== "eraser") setTool("draw"); }} style={{ width: 36, height: 28, cursor: "pointer", border: "none", borderRadius: 4, padding: 0 }} />
                  </div>
                </div>
              )}
            </div>

            {/* Undo */}
            <ToolBtn label="" icon={<svg width="18" height="18" viewBox="0 0 14 14" fill="none"><path d="M4 5L1 8L4 11" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" /><path d="M1 8H9C11 8 12.5 9.5 12.5 11" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" /></svg>}
              active={false} onClick={() => { undo(); haptic("light"); }} disabled={historyIdx <= 0} />

            {/* More */}
            <button title="More tools" onClick={() => { setShowMoreTools(v => !v); haptic("light"); }}
              style={{ width: 44, height: 44, borderRadius: 8, border: showMoreTools ? "1px solid rgba(0,204,204,0.5)" : "1px solid rgba(255,255,255,0.15)", background: showMoreTools ? "rgba(0,204,204,0.12)" : "rgba(255,255,255,0.04)", color: showMoreTools ? "#00cccc" : "rgba(255,255,255,0.55)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <svg width="18" height="18" viewBox="0 0 16 16" fill="none"><circle cx="3" cy="8" r="1.5" fill="currentColor" /><circle cx="8" cy="8" r="1.5" fill="currentColor" /><circle cx="13" cy="8" r="1.5" fill="currentColor" /></svg>
            </button>

            <div style={{ flex: 1, minWidth: 4 }} />

            {/* DONE — large, always visible */}
            <button onClick={handleDone}
              style={{ padding: "0 20px", height: 44, borderRadius: 8, border: "1px solid rgba(0,204,204,0.7)", background: "linear-gradient(135deg, rgba(0,204,204,0.4), rgba(0,180,180,0.25))", color: "#00cccc", fontSize: 14, fontWeight: 700, fontFamily: "var(--font-terminal), monospace", letterSpacing: "0.1em", cursor: "pointer", boxShadow: "0 0 20px rgba(0,204,204,0.25), inset 0 1px 0 rgba(255,255,255,0.1)", flexShrink: 0 }}>
              DONE
            </button>
          </div>
        ) : (
        /* ---- DESKTOP: Single-row toolbar ---- */
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 4,
            padding: "6px 12px",
            minHeight: 44,
            overflow: "visible",
          }}
        >
          <ToolBtn label="Draw" icon={<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M10.5 1.5L12.5 3.5L4.5 11.5L1.5 12.5L2.5 9.5L10.5 1.5Z" stroke="currentColor" strokeWidth="1.2" fill="none" /></svg>}
            active={tool === "draw"} onClick={() => { setTool("draw"); setOverlaySrc(null); haptic("light"); }} />
          <ToolBtn label="Eraser" icon={<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="2" y="6" width="10" height="5" rx="1" stroke="currentColor" strokeWidth="1.2" fill="none" /><path d="M4 6V4C4 3.4 4.4 3 5 3H9C9.6 3 10 3.4 10 4V6" stroke="currentColor" strokeWidth="1.2" /></svg>}
            active={tool === "eraser"} onClick={() => { setTool("eraser"); setOverlaySrc(null); haptic("light"); }} />
          <ToolBtn label="Text" icon={<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><text x="2" y="12" fontSize="12" fontWeight="900" fontFamily="Impact" fill="currentColor">A</text></svg>}
            active={tool === "text"} onClick={() => { setTool("text"); setOverlaySrc(null); haptic("light"); }} />
          <ToolBtn label="Stamp" icon={<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="1" y="3" width="12" height="8" rx="1" stroke="currentColor" strokeWidth="1.2" fill="none" /><circle cx="4" cy="6" r="1.2" fill="currentColor" /><path d="M1 10L4.5 7L7 9L9.5 6.5L13 10" stroke="currentColor" strokeWidth="1.2" /></svg>}
            active={tool === "stamp"} onClick={() => { fileInputRef.current?.click(); haptic("light"); }} />
          <ToolBtn label="Pick" icon={<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M11.5 2.5L9.5 4.5M9.5 4.5L5 9L4 10.5L3.5 10L5 9L9.5 4.5Z" stroke="currentColor" strokeWidth="1.2" fill="none" strokeLinecap="round" /><path d="M2 12L3.5 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /><circle cx="11.5" cy="2.5" r="1.5" stroke="currentColor" strokeWidth="1" fill="none" /></svg>}
            active={tool === "eyedropper"} onClick={() => { setTool("eyedropper"); setOverlaySrc(null); haptic("light"); }} />

          <Divider />

          {/* Color picker */}
          <div style={{ position: "relative", flexShrink: 0 }}>
            <button title="Pick color" onClick={(e) => { e.stopPropagation(); setShowColorPicker(!showColorPicker); setShowBrushMenu(false); }}
              style={{ width: 28, height: 28, borderRadius: "50%", border: showColorPicker ? "2px solid rgba(0,204,204,0.8)" : "2px solid rgba(0,204,204,0.5)", background: color, cursor: "pointer", boxShadow: showColorPicker ? "0 0 10px rgba(0,204,204,0.5)" : "0 0 4px rgba(0,0,0,0.4)", transition: "box-shadow 0.15s, border-color 0.15s" }} />
            {showColorPicker && (
              <div onClick={(e) => e.stopPropagation()} style={{ position: "absolute", bottom: "100%", left: "50%", transform: "translateX(-50%)", marginBottom: 6, padding: 10, borderRadius: 10, background: "rgba(16, 20, 32, 0.98)", border: "1px solid rgba(0,204,204,0.25)", boxShadow: "0 8px 32px rgba(0,0,0,0.6)", zIndex: 20, width: 180 }}>
                <div style={{ fontSize: 8, color: "rgba(0,204,204,0.7)", fontFamily: "var(--font-terminal), monospace", letterSpacing: "0.1em", marginBottom: 4, textTransform: "uppercase" }}>FOID</div>
                <div style={{ display: "flex", gap: 4, marginBottom: 8, flexWrap: "wrap" }}>
                  {FOID_COLORS.map(c => (<button key={c} onClick={() => { setColor(c); setShowColorPicker(false); if (tool !== "draw" && tool !== "eraser") setTool("draw"); }} style={{ width: 24, height: 24, borderRadius: 6, border: color === c ? "2px solid #fff" : "1px solid rgba(255,255,255,0.15)", background: c, cursor: "pointer", flexShrink: 0, boxShadow: color === c ? `0 0 8px ${c}80` : "none" }} />))}
                </div>
                <div style={{ fontSize: 8, color: "rgba(255,255,255,0.4)", fontFamily: "var(--font-terminal), monospace", letterSpacing: "0.1em", marginBottom: 4, textTransform: "uppercase" }}>Standard</div>
                <div style={{ display: "flex", gap: 4, marginBottom: 8, flexWrap: "wrap" }}>
                  {STANDARD_COLORS.map(c => (<button key={c} onClick={() => { setColor(c); setShowColorPicker(false); if (tool !== "draw" && tool !== "eraser") setTool("draw"); }} style={{ width: 24, height: 24, borderRadius: 6, border: color === c ? "2px solid #00cccc" : `1px solid ${c === "#000000" ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.1)"}`, background: c, cursor: "pointer", flexShrink: 0, boxShadow: color === c ? "0 0 6px rgba(0,204,204,0.4)" : "none" }} />))}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: 8, color: "rgba(255,255,255,0.4)", fontFamily: "var(--font-terminal), monospace", letterSpacing: "0.1em", textTransform: "uppercase" }}>Custom</span>
                  <input ref={colorInputRef} type="color" value={color} onChange={(e) => { setColor(e.target.value); if (tool !== "draw" && tool !== "eraser") setTool("draw"); }} style={{ width: 32, height: 24, cursor: "pointer", border: "none", borderRadius: 4, padding: 0 }} />
                  <span style={{ fontSize: 9, color: "rgba(255,255,255,0.5)", fontFamily: "var(--font-terminal), monospace" }}>{color}</span>
                </div>
              </div>
            )}
          </div>

          {/* Brush size dropdown */}
          <div style={{ position: "relative", flexShrink: 0 }}>
            <button title="Brush size & opacity" onClick={(e) => { e.stopPropagation(); setShowBrushMenu(!showBrushMenu); setShowColorPicker(false); }}
              style={{ height: 32, padding: "0 8px", borderRadius: 5, border: showBrushMenu ? "1px solid rgba(0,204,204,0.5)" : "1px solid rgba(255,255,255,0.1)", background: showBrushMenu ? "rgba(0,204,204,0.12)" : "rgba(255,255,255,0.04)", color: showBrushMenu ? "#00cccc" : "rgba(255,255,255,0.65)", fontSize: 11, fontFamily: "var(--font-terminal), monospace", cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
              <div style={{ width: Math.min(brushSize, 14), height: Math.min(brushSize, 14), borderRadius: "50%", background: "currentColor" }} />
              {brushSize}
            </button>
            {showBrushMenu && (
              <div onClick={(e) => e.stopPropagation()} style={{ position: "absolute", bottom: "100%", left: "50%", transform: "translateX(-50%)", marginBottom: 6, padding: 8, borderRadius: 10, background: "rgba(16, 20, 32, 0.98)", border: "1px solid rgba(0,204,204,0.25)", boxShadow: "0 8px 32px rgba(0,0,0,0.6)", display: "flex", gap: 5, flexWrap: "wrap", width: 170, zIndex: 20 }}>
                {[2, 4, 8, 12, 16, 24, 30].map(size => (
                  <button key={size} onClick={() => { setBrushSize(size); setShowBrushMenu(false); }} style={{ width: 32, height: 32, borderRadius: 6, border: brushSize === size ? "1px solid rgba(0,204,204,0.6)" : "1px solid rgba(255,255,255,0.1)", background: brushSize === size ? "rgba(0,204,204,0.15)" : "rgba(255,255,255,0.04)", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2, color: brushSize === size ? "#00cccc" : "rgba(255,255,255,0.5)" }}>
                    <div style={{ width: Math.min(size, 16), height: Math.min(size, 16), borderRadius: "50%", background: "currentColor" }} />
                    <span style={{ fontSize: 7, fontFamily: "var(--font-terminal), monospace" }}>{size}</span>
                  </button>
                ))}
                <div style={{ width: "100%", display: "flex", alignItems: "center", gap: 6, marginTop: 4, paddingTop: 4, borderTop: "1px solid rgba(255,255,255,0.08)" }}>
                  <span style={{ fontSize: 8, color: "rgba(0,204,204,0.7)", fontFamily: "var(--font-terminal), monospace", letterSpacing: "0.1em", textTransform: "uppercase", whiteSpace: "nowrap" }}>Opacity</span>
                  <input type="range" min={5} max={100} value={Math.round(brushOpacity * 100)} onChange={(e) => setBrushOpacity(Number(e.target.value) / 100)} style={{ flex: 1, accentColor: "#00cccc", cursor: "pointer", height: 14 }} />
                  <span style={{ fontSize: 9, color: "#00cccc", fontFamily: "var(--font-terminal), monospace", minWidth: 28, textAlign: "right" }}>{Math.round(brushOpacity * 100)}%</span>
                </div>
              </div>
            )}
          </div>

          <Divider />

          {/* Undo / Redo */}
          <ToolBtn label="Undo" icon={<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M4 5L1 8L4 11" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" /><path d="M1 8H9C11 8 12.5 9.5 12.5 11" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" /></svg>}
            active={false} onClick={() => { undo(); haptic("light"); }} disabled={historyIdx <= 0} />
          <ToolBtn label="Redo" icon={<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M10 5L13 8L10 11" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" /><path d="M13 8H5C3 8 1.5 9.5 1.5 11" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" /></svg>}
            active={false} onClick={() => { redo(); haptic("light"); }} disabled={historyIdx >= history.length - 1} />

          <Divider />

          {/* Clear */}
          <button title={clearPending ? "Tap again to confirm clear" : "Clear all edits"} onClick={handleClearClick}
            style={{ height: 32, padding: "0 10px", borderRadius: 5, border: clearPending ? "1px solid rgba(255, 60, 60, 0.6)" : "1px solid rgba(255,255,255,0.1)", background: clearPending ? "rgba(255, 60, 60, 0.15)" : "rgba(255,255,255,0.04)", color: clearPending ? "#ff6666" : "rgba(255,255,255,0.65)", fontSize: 11, fontFamily: "var(--font-terminal), monospace", letterSpacing: "0.04em", cursor: "pointer", display: "flex", alignItems: "center", gap: 5, flexShrink: 0, transition: "all 0.15s" }}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M3 3L11 11M11 3L3 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
            {clearPending ? "Sure?" : "Clear"}
          </button>

          {/* Zoom */}
          <span style={{ fontSize: 8, color: "rgba(255,255,255,0.3)", fontFamily: "var(--font-terminal), monospace", letterSpacing: "0.08em", textTransform: "uppercase", flexShrink: 0, marginLeft: 2 }}>Zoom</span>
          <button title="Zoom out" onClick={() => setViewScale(s => Math.max(0.5, s / 1.3))} style={{ width: 28, height: 28, borderRadius: 4, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.55)", fontSize: 14, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>-</button>
          <button title={viewScale === 1 ? "100%" : "Reset zoom"} onClick={resetZoom} style={{ height: 28, padding: "0 6px", borderRadius: 4, border: viewScale !== 1 ? "1px solid rgba(0,204,204,0.3)" : "1px solid rgba(255,255,255,0.1)", background: viewScale !== 1 ? "rgba(0,204,204,0.08)" : "rgba(255,255,255,0.04)", color: viewScale !== 1 ? "#00cccc" : "rgba(255,255,255,0.4)", fontSize: 10, fontFamily: "var(--font-terminal), monospace", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, minWidth: 38, transition: "all 0.15s" }}>{Math.round(viewScale * 100)}%</button>
          <button title="Zoom in" onClick={() => setViewScale(s => Math.min(5, s * 1.3))} style={{ width: 28, height: 28, borderRadius: 4, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.55)", fontSize: 14, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>+</button>

          {/* Lock */}
          <button title={drawLock ? "Draw lock ON" : "Draw lock OFF"} onClick={() => { setDrawLock(l => !l); haptic(drawLock ? "light" : "medium"); }}
            style={{ height: 28, padding: "0 8px", borderRadius: 4, border: drawLock ? "1px solid rgba(255,136,0,0.5)" : "1px solid rgba(255,255,255,0.1)", background: drawLock ? "rgba(255,136,0,0.12)" : "rgba(255,255,255,0.04)", color: drawLock ? "#ff8800" : "rgba(255,255,255,0.4)", fontSize: 10, fontFamily: "var(--font-terminal), monospace", cursor: "pointer", display: "flex", alignItems: "center", gap: 3, flexShrink: 0, transition: "all 0.15s" }}>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              {drawLock ? (<><rect x="2" y="5" width="8" height="6" rx="1" stroke="currentColor" strokeWidth="1.2" fill="none" /><path d="M4 5V3.5C4 2.1 5.1 1 6.5 1H5.5C6.9 1 8 2.1 8 3.5V5" stroke="currentColor" strokeWidth="1.2" /></>) : (<><rect x="2" y="5" width="8" height="6" rx="1" stroke="currentColor" strokeWidth="1.2" fill="none" /><path d="M4 5V3.5C4 2.1 4.6 1 6 1C7.4 1 8 2.1 8 3.5" stroke="currentColor" strokeWidth="1.2" /></>)}
            </svg>
            {drawLock ? "Locked" : "Lock"}
          </button>

          <div style={{ flex: 1, minWidth: 4 }} />

          {/* Done CTA */}
          <button onClick={handleDone} style={{ padding: "0 20px", height: 34, borderRadius: 6, border: "1px solid rgba(0,204,204,0.6)", background: "linear-gradient(135deg, rgba(0,204,204,0.35), rgba(0,180,180,0.2))", color: "#00cccc", fontSize: 12, fontWeight: 700, fontFamily: "var(--font-terminal), monospace", letterSpacing: "0.1em", cursor: "pointer", boxShadow: "0 0 16px rgba(0,204,204,0.2), inset 0 1px 0 rgba(255,255,255,0.1)", transition: "box-shadow 0.2s, background 0.2s", flexShrink: 0 }}>DONE</button>
        </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

function ToolBtn({
  label,
  icon,
  active,
  onClick,
  disabled,
}: {
  label: string;
  icon?: React.ReactNode;
  active: boolean;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      title={label}
      onClick={onClick}
      disabled={disabled}
      style={{
        height: 36,
        paddingLeft: icon ? 8 : 12,
        paddingRight: 12,
        borderRadius: 5,
        border: active ? "1px solid rgba(0,204,204,0.5)" : "1px solid rgba(255,255,255,0.1)",
        background: active ? "rgba(0,204,204,0.12)" : "rgba(255,255,255,0.04)",
        color: disabled
          ? "rgba(255,255,255,0.2)"
          : active
          ? "#00cccc"
          : "rgba(255,255,255,0.65)",
        fontSize: 11,
        fontFamily: "var(--font-terminal), monospace",
        letterSpacing: "0.04em",
        cursor: disabled ? "not-allowed" : "pointer",
        display: "flex",
        alignItems: "center",
        gap: 5,
        flexShrink: 0,
        boxShadow: active ? "0 0 10px rgba(0,204,204,0.15)" : "none",
        transition: "all 0.15s",
      }}
    >
      {icon}
      {label}
    </button>
  );
}

function Divider() {
  return (
    <div
      style={{
        width: 1,
        height: 24,
        background: "rgba(255,255,255,0.08)",
        flexShrink: 0,
        margin: "0 4px",
      }}
    />
  );
}

export default PaintEditor;
