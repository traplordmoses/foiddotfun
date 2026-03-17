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

type Tool = "select" | "draw" | "eraser" | "stamp";

interface PlacedSticker {
  id: string;
  src: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

interface HistoryEntry {
  imageData: ImageData;
  stickers: PlacedSticker[];
}

const PRESET_COLORS = [
  "#ffffff",
  "#000000",
  "#ff0000",
  "#0066ff",
  "#00cc44",
  "#ffdd00",
  "#ff69b4",
  "#00cccc",
  "#ff8800",
  "#aa44ff",
] as const;

const BUILTIN_STICKERS = [
  { label: "Star", emoji: "\u2B50" },
  { label: "Heart", emoji: "\u2764\uFE0F" },
  { label: "Fire", emoji: "\uD83D\uDD25" },
  { label: "100", emoji: "\uD83D\uDCAF" },
  { label: "Skull", emoji: "\uD83D\uDC80" },
  { label: "Cat", emoji: "\uD83D\uDC31" },
  { label: "Dog", emoji: "\uD83D\uDC36" },
  { label: "Clown", emoji: "\uD83E\uDD21" },
  { label: "Eyes", emoji: "\uD83D\uDC40" },
  { label: "Ghost", emoji: "\uD83D\uDC7B" },
  { label: "Alien", emoji: "\uD83D\uDC7D" },
  { label: "Rainbow", emoji: "\uD83C\uDF08" },
  { label: "Crown", emoji: "\uD83D\uDC51" },
  { label: "Diamond", emoji: "\uD83D\uDC8E" },
  { label: "Sparkles", emoji: "\u2728" },
  { label: "Thumbs Up", emoji: "\uD83D\uDC4D" },
];

const MAX_HISTORY = 30;
const DEFAULT_STICKER_SIZE = 80;

// ============================================================================
// HELPERS
// ============================================================================

function emojiToDataURL(emoji: string, size: number = 128): string {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";
  ctx.font = `${size * 0.8}px serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(emoji, size / 2, size / 2);
  return canvas.toDataURL("image/png");
}

function generateId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

// ============================================================================
// PAINT EDITOR COMPONENT
// ============================================================================

export function PaintEditor({ imageFile, onDone, onCancel }: PaintEditorProps) {
  // Canvas refs
  const bgCanvasRef = useRef<HTMLCanvasElement>(null);
  const drawCanvasRef = useRef<HTMLCanvasElement>(null);
  const canvasContainerRef = useRef<HTMLDivElement>(null);

  // State
  const [tool, setTool] = useState<Tool>("draw");
  const [color, setColor] = useState("#ff0000");
  const [brushSize, setBrushSize] = useState(8);
  const [isDrawing, setIsDrawing] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [placedStickers, setPlacedStickers] = useState<PlacedSticker[]>([]);
  const [stampSrc, setStampSrc] = useState<string | null>(null);
  const [customStickers, setCustomStickers] = useState<string[]>([]);
  const [builtinStickerURLs, setBuiltinStickerURLs] = useState<string[]>([]);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [historyIdx, setHistoryIdx] = useState(-1);
  const [draggingSticker, setDraggingSticker] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [resizingSticker, setResizingSticker] = useState<string | null>(null);
  const [canvasDisplaySize, setCanvasDisplaySize] = useState({ w: 0, h: 0 });

  const originalImageRef = useRef<HTMLImageElement | null>(null);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Generate builtin sticker data URLs on mount
  useEffect(() => {
    const urls = BUILTIN_STICKERS.map((s) => emojiToDataURL(s.emoji));
    setBuiltinStickerURLs(urls);
  }, []);

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

    const maxW = container.clientWidth - 32;
    const maxH = container.clientHeight - 32;
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
    const entry: HistoryEntry = { imageData: initialData, stickers: [] };
    setHistory([entry]);
    setHistoryIdx(0);
    setPlacedStickers([]);
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
  // HISTORY
  // ============================================================================

  const pushHistory = useCallback(
    (stickers?: PlacedSticker[]) => {
      const drawCanvas = drawCanvasRef.current;
      if (!drawCanvas) return;
      const ctx = drawCanvas.getContext("2d");
      if (!ctx) return;
      const data = ctx.getImageData(0, 0, drawCanvas.width, drawCanvas.height);
      const entry: HistoryEntry = {
        imageData: data,
        stickers: stickers ?? placedStickers,
      };
      setHistory((prev) => {
        const truncated = prev.slice(0, historyIdx + 1);
        const next = [...truncated, entry];
        if (next.length > MAX_HISTORY) next.shift();
        return next;
      });
      setHistoryIdx((prev) => Math.min(prev + 1, MAX_HISTORY - 1));
    },
    [historyIdx, placedStickers]
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
    setPlacedStickers(prev.stickers);
    setHistoryIdx((i) => i - 1);
  }, [history, historyIdx]);

  const clearCanvas = useCallback(() => {
    const drawCanvas = drawCanvasRef.current;
    if (!drawCanvas) return;
    const ctx = drawCanvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, drawCanvas.width, drawCanvas.height);
    setPlacedStickers([]);
    pushHistory([]);
  }, [pushHistory]);

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
        ctx.strokeStyle = "rgba(0,0,0,1)";
      } else {
        ctx.globalCompositeOperation = "source-over";
        ctx.strokeStyle = color;
      }
      ctx.lineWidth = brushSize;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.stroke();
      ctx.globalCompositeOperation = "source-over";
    },
    [tool, color, brushSize]
  );

  const startDraw = useCallback(
    (clientX: number, clientY: number) => {
      if (tool !== "draw" && tool !== "eraser") return;
      const pos = getCanvasPos(clientX, clientY);
      lastPointRef.current = pos;
      setIsDrawing(true);
      drawLine(pos, pos);
    },
    [tool, getCanvasPos, drawLine]
  );

  const moveDraw = useCallback(
    (clientX: number, clientY: number) => {
      if (!isDrawing) return;
      const pos = getCanvasPos(clientX, clientY);
      if (lastPointRef.current) {
        drawLine(lastPointRef.current, pos);
      }
      lastPointRef.current = pos;
    },
    [isDrawing, getCanvasPos, drawLine]
  );

  const endDraw = useCallback(() => {
    if (!isDrawing) return;
    setIsDrawing(false);
    lastPointRef.current = null;
    pushHistory();
  }, [isDrawing, pushHistory]);

  // ============================================================================
  // STICKER PLACEMENT
  // ============================================================================

  const handleCanvasClick = useCallback(
    (clientX: number, clientY: number) => {
      if (tool !== "stamp" || !stampSrc) return;
      const canvas = drawCanvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const containerEl = canvasContainerRef.current;
      if (!containerEl) return;
      const containerRect = containerEl.getBoundingClientRect();

      // Position relative to canvas container (since stickers are absolutely positioned within it)
      // We need position relative to the canvas element's visual position within the container
      const canvasVisualX = rect.left - containerRect.left;
      const canvasVisualY = rect.top - containerRect.top;
      const clickX = clientX - containerRect.left - canvasVisualX - DEFAULT_STICKER_SIZE / 2;
      const clickY = clientY - containerRect.top - canvasVisualY - DEFAULT_STICKER_SIZE / 2;

      const newSticker: PlacedSticker = {
        id: generateId(),
        src: stampSrc,
        x: clickX,
        y: clickY,
        w: DEFAULT_STICKER_SIZE,
        h: DEFAULT_STICKER_SIZE,
      };
      const newStickers = [...placedStickers, newSticker];
      setPlacedStickers(newStickers);
      pushHistory(newStickers);
      // Stay in stamp mode for rapid placement
    },
    [tool, stampSrc, placedStickers, pushHistory]
  );

  // ============================================================================
  // STICKER DRAG
  // ============================================================================

  const startDragSticker = useCallback(
    (e: React.MouseEvent | React.TouchEvent, stickerId: string) => {
      e.stopPropagation();
      e.preventDefault();
      const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
      const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
      const sticker = placedStickers.find((s) => s.id === stickerId);
      if (!sticker) return;
      const containerEl = canvasContainerRef.current;
      if (!containerEl) return;
      const containerRect = containerEl.getBoundingClientRect();
      const canvasRect = drawCanvasRef.current?.getBoundingClientRect();
      if (!canvasRect) return;
      const canvasOffX = canvasRect.left - containerRect.left;
      const canvasOffY = canvasRect.top - containerRect.top;
      setDragOffset({
        x: clientX - containerRect.left - canvasOffX - sticker.x,
        y: clientY - containerRect.top - canvasOffY - sticker.y,
      });
      setDraggingSticker(stickerId);
      setTool("select");
      setStampSrc(null);
    },
    [placedStickers]
  );

  const startResizeSticker = useCallback(
    (e: React.MouseEvent | React.TouchEvent, stickerId: string) => {
      e.stopPropagation();
      e.preventDefault();
      setResizingSticker(stickerId);
    },
    []
  );

  useEffect(() => {
    if (!draggingSticker && !resizingSticker) return;

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

      if (draggingSticker) {
        const newX = clientX - containerRect.left - canvasOffX - dragOffset.x;
        const newY = clientY - containerRect.top - canvasOffY - dragOffset.y;
        setPlacedStickers((prev) =>
          prev.map((s) => (s.id === draggingSticker ? { ...s, x: newX, y: newY } : s))
        );
      }

      if (resizingSticker) {
        setPlacedStickers((prev) =>
          prev.map((s) => {
            if (s.id !== resizingSticker) return s;
            const stickerCenterX = canvasOffX + s.x + s.w / 2;
            const stickerCenterY = canvasOffY + s.y + s.h / 2;
            const dx = clientX - containerRect.left - stickerCenterX;
            const dy = clientY - containerRect.top - stickerCenterY;
            const dist = Math.max(30, Math.sqrt(dx * dx + dy * dy) * 2);
            return { ...s, w: dist, h: dist };
          })
        );
      }
    };

    const onUp = () => {
      if (draggingSticker || resizingSticker) {
        // Push to history after drag/resize
        setDraggingSticker(null);
        setResizingSticker(null);
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
  }, [draggingSticker, resizingSticker, dragOffset]);

  // Push history after drag/resize ends
  useEffect(() => {
    if (!draggingSticker && !resizingSticker && loaded && history.length > 0) {
      // Check if stickers changed from last history entry
      const lastEntry = history[historyIdx];
      if (lastEntry && JSON.stringify(lastEntry.stickers) !== JSON.stringify(placedStickers)) {
        pushHistory();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draggingSticker, resizingSticker]);

  // ============================================================================
  // CANVAS MOUSE/TOUCH EVENTS
  // ============================================================================

  const onCanvasMouseDown = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      e.preventDefault();
      if (tool === "stamp") {
        handleCanvasClick(e.clientX, e.clientY);
      } else if (tool === "draw" || tool === "eraser") {
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
      const touch = e.touches[0];
      if (!touch) return;
      if (tool === "stamp") {
        handleCanvasClick(touch.clientX, touch.clientY);
      } else if (tool === "draw" || tool === "eraser") {
        startDraw(touch.clientX, touch.clientY);
      }
    },
    [tool, handleCanvasClick, startDraw]
  );

  const onCanvasTouchMove = useCallback(
    (e: React.TouchEvent<HTMLCanvasElement>) => {
      e.preventDefault();
      const touch = e.touches[0];
      if (!touch) return;
      moveDraw(touch.clientX, touch.clientY);
    },
    [moveDraw]
  );

  const onCanvasTouchEnd = useCallback(
    (e: React.TouchEvent<HTMLCanvasElement>) => {
      e.preventDefault();
      endDraw();
    },
    [endDraw]
  );

  // ============================================================================
  // DELETE LAST STICKER
  // ============================================================================

  const deleteLastSticker = useCallback(() => {
    if (placedStickers.length === 0) return;
    const newStickers = placedStickers.slice(0, -1);
    setPlacedStickers(newStickers);
    pushHistory(newStickers);
  }, [placedStickers, pushHistory]);

  // ============================================================================
  // UPLOAD CUSTOM STICKER
  // ============================================================================

  const handleUploadSticker = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataURL = reader.result as string;
      setCustomStickers((prev) => [...prev, dataURL]);
    };
    reader.readAsDataURL(file);
    // Reset input so user can re-upload same file
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

    // 3. Draw stickers at proportional positions
    const scaleX = img.naturalWidth / canvasDisplaySize.w;
    const scaleY = img.naturalHeight / canvasDisplaySize.h;

    // We need to wait for all sticker images to load, then composite
    const stickerPromises = placedStickers.map((sticker) => {
      return new Promise<void>((resolve) => {
        const stickerImg = new Image();
        stickerImg.crossOrigin = "anonymous";
        stickerImg.onload = () => {
          ectx.drawImage(
            stickerImg,
            sticker.x * scaleX,
            sticker.y * scaleY,
            sticker.w * scaleX,
            sticker.h * scaleY
          );
          resolve();
        };
        stickerImg.onerror = () => resolve();
        stickerImg.src = sticker.src;
      });
    });

    Promise.all(stickerPromises).then(() => {
      exportCanvas.toBlob(
        (blob) => {
          if (!blob) return;
          const name = imageFile.name.replace(/\.[^.]+$/, "") + "_edited.jpg";
          const file = new File([blob], name, { type: "image/jpeg" });
          onDone(file);
        },
        "image/jpeg",
        0.92
      );
    });
  }, [imageFile, onDone, placedStickers, canvasDisplaySize]);

  // ============================================================================
  // KEYBOARD SHORTCUTS
  // ============================================================================

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "z") {
        e.preventDefault();
        undo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo]);

  // ============================================================================
  // CURSOR
  // ============================================================================

  const cursorStyle =
    tool === "stamp"
      ? "copy"
      : tool === "draw"
      ? "crosshair"
      : tool === "eraser"
      ? "crosshair"
      : "default";

  // ============================================================================
  // STICKER SIDEBAR DATA
  // ============================================================================

  const allStickerSrcs = [...builtinStickerURLs, ...customStickers];

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
        background: "rgba(12, 14, 22, 0.98)",
      }}
    >
      {/* ============ VISTA-STYLE TITLEBAR ============ */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 12px",
          height: 36,
          background: "linear-gradient(180deg, rgba(40, 50, 80, 0.95) 0%, rgba(20, 26, 44, 0.95) 100%)",
          borderBottom: "1px solid rgba(0, 204, 204, 0.15)",
          flexShrink: 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
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

      {/* ============ MAIN AREA: SIDEBAR + CANVAS ============ */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        {/* ---- STICKER SIDEBAR ---- */}
        <div
          style={{
            width: 180,
            flexShrink: 0,
            background: "rgba(20, 24, 36, 0.95)",
            borderRight: "1px solid rgba(255,255,255,0.06)",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          {/* Upload button */}
          <div style={{ padding: "12px 10px 8px" }}>
            <button
              onClick={() => fileInputRef.current?.click()}
              style={{
                width: "100%",
                padding: "8px 0",
                borderRadius: 5,
                border: "1px dashed rgba(0,204,204,0.4)",
                background: "rgba(0,204,204,0.06)",
                color: "#00cccc",
                fontFamily: "var(--font-terminal), monospace",
                fontSize: 11,
                letterSpacing: "0.06em",
                cursor: "pointer",
                fontWeight: 600,
              }}
            >
              + Upload Media
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              style={{ display: "none" }}
              onChange={handleUploadSticker}
            />
          </div>

          {/* Section label */}
          <div
            style={{
              padding: "6px 12px 6px",
              fontFamily: "var(--font-terminal), monospace",
              fontSize: 10,
              color: "rgba(255,255,255,0.35)",
              letterSpacing: "0.12em",
              borderTop: "1px solid rgba(255,255,255,0.06)",
            }}
          >
            MEME STICKERS
          </div>

          {/* Sticker grid */}
          <div
            style={{
              flex: 1,
              overflowY: "auto",
              padding: "4px 8px 8px",
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 6,
              alignContent: "start",
            }}
          >
            {allStickerSrcs.map((src, i) => (
              <button
                key={`sticker-${i}`}
                onClick={() => {
                  setStampSrc(src);
                  setTool("stamp");
                }}
                style={{
                  width: "100%",
                  aspectRatio: "1",
                  borderRadius: 6,
                  border:
                    stampSrc === src && tool === "stamp"
                      ? "2px solid #00cccc"
                      : "1px solid rgba(255,255,255,0.08)",
                  background:
                    stampSrc === src && tool === "stamp"
                      ? "rgba(0,204,204,0.1)"
                      : "rgba(255,255,255,0.03)",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: 4,
                  boxShadow:
                    stampSrc === src && tool === "stamp"
                      ? "0 0 8px rgba(0,204,204,0.3)"
                      : "none",
                }}
              >
                <img
                  src={src}
                  alt={i < BUILTIN_STICKERS.length ? BUILTIN_STICKERS[i].label : "custom"}
                  style={{
                    width: "80%",
                    height: "80%",
                    objectFit: "contain",
                    pointerEvents: "none",
                  }}
                />
              </button>
            ))}
          </div>
        </div>

        {/* ---- CANVAS AREA ---- */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <div
            ref={canvasContainerRef}
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              overflow: "hidden",
              padding: 16,
              position: "relative",
              background: "rgba(12, 14, 22, 0.98)",
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

            {/* Canvas stack */}
            <div
              style={{
                position: "relative",
                display: loaded ? "block" : "none",
                lineHeight: 0,
              }}
            >
              {/* Background canvas (image) */}
              <canvas
                ref={bgCanvasRef}
                style={{
                  display: "block",
                  borderRadius: 2,
                  boxShadow: "0 4px 24px rgba(0,0,0,0.5)",
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
                }}
                onMouseDown={onCanvasMouseDown}
                onMouseMove={onCanvasMouseMove}
                onMouseUp={onCanvasMouseUp}
                onMouseLeave={onCanvasMouseUp}
                onTouchStart={onCanvasTouchStart}
                onTouchMove={onCanvasTouchMove}
                onTouchEnd={onCanvasTouchEnd}
              />

              {/* Placed stickers */}
              {placedStickers.map((sticker) => (
                <div
                  key={sticker.id}
                  style={{
                    position: "absolute",
                    left: sticker.x,
                    top: sticker.y,
                    width: sticker.w,
                    height: sticker.h,
                    cursor: draggingSticker === sticker.id ? "grabbing" : "grab",
                    userSelect: "none",
                    touchAction: "none",
                    zIndex: 10,
                  }}
                  onMouseDown={(e) => startDragSticker(e, sticker.id)}
                  onTouchStart={(e) => startDragSticker(e, sticker.id)}
                >
                  <img
                    src={sticker.src}
                    alt=""
                    draggable={false}
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "contain",
                      pointerEvents: "none",
                    }}
                  />
                  {/* Resize handle */}
                  <div
                    style={{
                      position: "absolute",
                      right: -4,
                      bottom: -4,
                      width: 12,
                      height: 12,
                      background: "#00cccc",
                      border: "1px solid rgba(0,0,0,0.3)",
                      borderRadius: 2,
                      cursor: "nwse-resize",
                      zIndex: 11,
                    }}
                    onMouseDown={(e) => startResizeSticker(e, sticker.id)}
                    onTouchStart={(e) => startResizeSticker(e, sticker.id)}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Status bar */}
          <div
            style={{
              padding: "4px 16px",
              borderTop: "1px solid rgba(255,255,255,0.05)",
              background: "rgba(16, 20, 32, 0.8)",
              display: "flex",
              alignItems: "center",
              gap: 16,
              flexShrink: 0,
            }}
          >
            <span
              style={{
                fontSize: 11,
                color: "rgba(255,255,255,0.4)",
                fontFamily: "var(--font-terminal), monospace",
              }}
            >
              {placedStickers.length} sticker{placedStickers.length !== 1 ? "s" : ""}
            </span>
            <span
              style={{
                fontSize: 11,
                color: "rgba(255,255,255,0.3)",
                fontFamily: "var(--font-terminal), monospace",
              }}
            >
              |
            </span>
            <span
              style={{
                fontSize: 11,
                color: "rgba(255,255,255,0.4)",
                fontFamily: "var(--font-terminal), monospace",
              }}
            >
              {imageFile.name}
            </span>
            {originalImageRef.current && (
              <>
                <span
                  style={{
                    fontSize: 11,
                    color: "rgba(255,255,255,0.3)",
                    fontFamily: "var(--font-terminal), monospace",
                  }}
                >
                  |
                </span>
                <span
                  style={{
                    fontSize: 11,
                    color: "rgba(255,255,255,0.4)",
                    fontFamily: "var(--font-terminal), monospace",
                  }}
                >
                  {originalImageRef.current.naturalWidth}x{originalImageRef.current.naturalHeight}
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ============ BOTTOM TOOLBAR ============ */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: 8,
          padding: "10px 16px",
          borderTop: "1px solid rgba(0,204,204,0.1)",
          background: "rgba(16, 20, 32, 0.95)",
          flexShrink: 0,
        }}
      >
        {/* Tool buttons */}
        <ToolBtn
          label="Select"
          icon={
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M2 1L2 12L5.5 8.5L8.5 13L10 12L7 7.5L11 7L2 1Z" fill="currentColor" />
            </svg>
          }
          active={tool === "select"}
          onClick={() => {
            setTool("select");
            setStampSrc(null);
          }}
        />
        <ToolBtn
          label="Draw"
          icon={
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path
                d="M10.5 1.5L12.5 3.5L4.5 11.5L1.5 12.5L2.5 9.5L10.5 1.5Z"
                stroke="currentColor"
                strokeWidth="1.2"
                fill="none"
              />
            </svg>
          }
          active={tool === "draw"}
          onClick={() => {
            setTool("draw");
            setStampSrc(null);
          }}
        />
        <ToolBtn
          label="Eraser"
          icon={
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <rect x="2" y="6" width="10" height="5" rx="1" stroke="currentColor" strokeWidth="1.2" fill="none" />
              <path d="M4 6V4C4 3.4 4.4 3 5 3H9C9.6 3 10 3.4 10 4V6" stroke="currentColor" strokeWidth="1.2" />
            </svg>
          }
          active={tool === "eraser"}
          onClick={() => {
            setTool("eraser");
            setStampSrc(null);
          }}
        />

        <Divider />

        {/* Color swatches */}
        <div style={{ display: "flex", gap: 4, alignItems: "center", flexWrap: "wrap" }}>
          {PRESET_COLORS.map((c) => (
            <button
              key={c}
              title={c}
              onClick={() => {
                setColor(c);
                if (tool !== "draw" && tool !== "eraser") setTool("draw");
              }}
              style={{
                width: 22,
                height: 22,
                borderRadius: "50%",
                border: color === c ? "2px solid #00cccc" : "2px solid rgba(255,255,255,0.12)",
                background: c,
                cursor: "pointer",
                flexShrink: 0,
                boxShadow: color === c ? "0 0 8px rgba(0,204,204,0.4)" : "none",
                transition: "box-shadow 0.15s",
              }}
            />
          ))}
        </div>

        <Divider />

        {/* Size slider */}
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span
            style={{
              fontSize: 10,
              color: "rgba(255,255,255,0.4)",
              fontFamily: "var(--font-terminal), monospace",
              whiteSpace: "nowrap",
            }}
          >
            SIZE
          </span>
          <input
            type="range"
            min={1}
            max={30}
            value={brushSize}
            onChange={(e) => setBrushSize(Number(e.target.value))}
            style={{
              width: 80,
              accentColor: "#00cccc",
              cursor: "pointer",
            }}
          />
          <span
            style={{
              fontSize: 10,
              color: "rgba(255,255,255,0.5)",
              fontFamily: "var(--font-terminal), monospace",
              minWidth: 20,
              textAlign: "center",
            }}
          >
            {brushSize}
          </span>
        </div>

        <Divider />

        {/* Delete last sticker */}
        <ToolBtn
          label="Delete"
          icon={
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M3 4H11L10.2 12H3.8L3 4Z" stroke="currentColor" strokeWidth="1.2" fill="none" />
              <path d="M2 4H12" stroke="currentColor" strokeWidth="1.2" />
              <path d="M5 4V2.5C5 2.2 5.2 2 5.5 2H8.5C8.8 2 9 2.2 9 2.5V4" stroke="currentColor" strokeWidth="1.2" />
            </svg>
          }
          active={false}
          onClick={deleteLastSticker}
          disabled={placedStickers.length === 0}
        />

        {/* Undo */}
        <ToolBtn
          label="Undo"
          icon={
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M4 5L1 8L4 11" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" />
              <path d="M1 8H9C11 8 12.5 9.5 12.5 11" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" />
            </svg>
          }
          active={false}
          onClick={undo}
          disabled={historyIdx <= 0}
        />

        {/* Clear */}
        <ToolBtn
          label="Clear"
          icon={
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M3 3L11 11M11 3L3 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          }
          active={false}
          onClick={clearCanvas}
        />

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* Done CTA */}
        <button
          onClick={handleDone}
          style={{
            padding: "8px 28px",
            borderRadius: 6,
            border: "1px solid rgba(0,204,204,0.5)",
            background: "linear-gradient(135deg, rgba(0,204,204,0.3), rgba(0,180,180,0.15))",
            color: "#00cccc",
            fontSize: 13,
            fontWeight: 700,
            fontFamily: "var(--font-terminal), monospace",
            letterSpacing: "0.1em",
            cursor: "pointer",
            boxShadow: "0 0 16px rgba(0,204,204,0.2), inset 0 1px 0 rgba(255,255,255,0.1)",
            transition: "box-shadow 0.2s, background 0.2s",
          }}
          onMouseEnter={(e) => {
            (e.target as HTMLElement).style.boxShadow =
              "0 0 24px rgba(0,204,204,0.4), inset 0 1px 0 rgba(255,255,255,0.1)";
          }}
          onMouseLeave={(e) => {
            (e.target as HTMLElement).style.boxShadow =
              "0 0 16px rgba(0,204,204,0.2), inset 0 1px 0 rgba(255,255,255,0.1)";
          }}
        >
          DONE
        </button>
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
        height: 32,
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
