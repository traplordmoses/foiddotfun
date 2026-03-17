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

type Tool = "brush" | "eraser" | "text";
type BrushSize = "small" | "medium" | "large";

const PRESET_COLORS = [
  "#ffffff",
  "#000000",
  "#ff0000",
  "#0066ff",
  "#00cc44",
  "#ffdd00",
  "#ff69b4",
  "#00cccc",
] as const;

const BRUSH_SIZES: Record<BrushSize, number> = {
  small: 3,
  medium: 8,
  large: 18,
};

const MAX_HISTORY = 20;

// ============================================================================
// PAINT EDITOR COMPONENT
// ============================================================================

export function PaintEditor({ imageFile, onDone, onCancel }: PaintEditorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [tool, setTool] = useState<Tool>("brush");
  const [color, setColor] = useState("#ff0000");
  const [brushSize, setBrushSize] = useState<BrushSize>("medium");
  const [isDrawing, setIsDrawing] = useState(false);
  const [history, setHistory] = useState<ImageData[]>([]);
  const [historyIdx, setHistoryIdx] = useState(-1);
  const [textMode, setTextMode] = useState(false);
  const [textInput, setTextInput] = useState("");
  const [textPos, setTextPos] = useState<{ x: number; y: number } | null>(null);
  const [loaded, setLoaded] = useState(false);

  const originalImageRef = useRef<HTMLImageElement | null>(null);
  const canvasSizeRef = useRef<{ w: number; h: number }>({ w: 0, h: 0 });
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);

  // Load image onto canvas
  useEffect(() => {
    const img = new Image();
    const url = URL.createObjectURL(imageFile);
    img.onload = () => {
      originalImageRef.current = img;
      fitCanvas(img);
      URL.revokeObjectURL(url);
      setLoaded(true);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
    };
    img.src = url;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imageFile]);

  const fitCanvas = useCallback((img: HTMLImageElement) => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const maxW = container.clientWidth - 8;
    const maxH = container.clientHeight - 8;
    const ratio = Math.min(maxW / img.naturalWidth, maxH / img.naturalHeight, 1);
    const w = Math.round(img.naturalWidth * ratio);
    const h = Math.round(img.naturalHeight * ratio);

    canvas.width = w;
    canvas.height = h;
    canvasSizeRef.current = { w, h };

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(img, 0, 0, w, h);

    // Save initial state
    const initial = ctx.getImageData(0, 0, w, h);
    setHistory([initial]);
    setHistoryIdx(0);
  }, []);

  // Resize handler
  useEffect(() => {
    if (!loaded || !originalImageRef.current) return;
    const onResize = () => {
      // Debounce
      clearTimeout((onResize as any)._t);
      (onResize as any)._t = setTimeout(() => {
        if (originalImageRef.current) fitCanvas(originalImageRef.current);
      }, 200);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [loaded, fitCanvas]);

  // ============================================================================
  // DRAWING
  // ============================================================================

  const getCanvasPos = useCallback((clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    };
  }, []);

  const pushHistory = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
    setHistory((prev) => {
      const truncated = prev.slice(0, historyIdx + 1);
      const next = [...truncated, data];
      if (next.length > MAX_HISTORY) next.shift();
      return next;
    });
    setHistoryIdx((prev) => Math.min(prev + 1, MAX_HISTORY - 1));
  }, [historyIdx]);

  const drawLine = useCallback(
    (from: { x: number; y: number }, to: { x: number; y: number }) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(to.x, to.y);
      ctx.strokeStyle = tool === "eraser" ? "#ffffff" : color;
      ctx.lineWidth = BRUSH_SIZES[brushSize];
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      if (tool === "eraser") {
        ctx.globalCompositeOperation = "source-over";
      } else {
        ctx.globalCompositeOperation = "source-over";
      }
      ctx.stroke();
    },
    [tool, color, brushSize]
  );

  const startDraw = useCallback(
    (clientX: number, clientY: number) => {
      if (tool === "text") return;
      const pos = getCanvasPos(clientX, clientY);
      lastPointRef.current = pos;
      setIsDrawing(true);
      // Draw a dot for single click
      drawLine(pos, pos);
    },
    [tool, getCanvasPos, drawLine]
  );

  const moveDraw = useCallback(
    (clientX: number, clientY: number) => {
      if (!isDrawing || tool === "text") return;
      const pos = getCanvasPos(clientX, clientY);
      if (lastPointRef.current) {
        drawLine(lastPointRef.current, pos);
      }
      lastPointRef.current = pos;
    },
    [isDrawing, tool, getCanvasPos, drawLine]
  );

  const endDraw = useCallback(() => {
    if (!isDrawing) return;
    setIsDrawing(false);
    lastPointRef.current = null;
    pushHistory();
  }, [isDrawing, pushHistory]);

  // Text placement
  const handleCanvasClick = useCallback(
    (clientX: number, clientY: number) => {
      if (tool !== "text") return;
      const pos = getCanvasPos(clientX, clientY);
      setTextPos(pos);
      setTextMode(true);
      setTextInput("");
    },
    [tool, getCanvasPos]
  );

  const placeText = useCallback(() => {
    if (!textPos || !textInput.trim()) {
      setTextMode(false);
      setTextPos(null);
      return;
    }
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const fontSize = BRUSH_SIZES[brushSize] * 3 + 10;
    ctx.font = `bold ${fontSize}px sans-serif`;
    ctx.fillStyle = color;
    ctx.textBaseline = "top";
    ctx.fillText(textInput, textPos.x, textPos.y);

    pushHistory();
    setTextMode(false);
    setTextPos(null);
    setTextInput("");
  }, [textPos, textInput, color, brushSize, pushHistory]);

  // ============================================================================
  // MOUSE EVENTS
  // ============================================================================

  const onMouseDown = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      e.preventDefault();
      if (tool === "text") {
        handleCanvasClick(e.clientX, e.clientY);
      } else {
        startDraw(e.clientX, e.clientY);
      }
    },
    [tool, handleCanvasClick, startDraw]
  );

  const onMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      moveDraw(e.clientX, e.clientY);
    },
    [moveDraw]
  );

  const onMouseUp = useCallback(() => {
    endDraw();
  }, [endDraw]);

  // ============================================================================
  // TOUCH EVENTS
  // ============================================================================

  const onTouchStart = useCallback(
    (e: React.TouchEvent<HTMLCanvasElement>) => {
      e.preventDefault();
      const touch = e.touches[0];
      if (!touch) return;
      if (tool === "text") {
        handleCanvasClick(touch.clientX, touch.clientY);
      } else {
        startDraw(touch.clientX, touch.clientY);
      }
    },
    [tool, handleCanvasClick, startDraw]
  );

  const onTouchMove = useCallback(
    (e: React.TouchEvent<HTMLCanvasElement>) => {
      e.preventDefault();
      const touch = e.touches[0];
      if (!touch) return;
      moveDraw(touch.clientX, touch.clientY);
    },
    [moveDraw]
  );

  const onTouchEnd = useCallback(
    (e: React.TouchEvent<HTMLCanvasElement>) => {
      e.preventDefault();
      endDraw();
    },
    [endDraw]
  );

  // ============================================================================
  // UNDO / CLEAR
  // ============================================================================

  const undo = useCallback(() => {
    if (historyIdx <= 0) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const prev = history[historyIdx - 1];
    if (!prev) return;
    ctx.putImageData(prev, 0, 0);
    setHistoryIdx((i) => i - 1);
  }, [history, historyIdx]);

  const clearCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const img = originalImageRef.current;
    if (!canvas || !img) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    pushHistory();
  }, [pushHistory]);

  // ============================================================================
  // DONE / CANCEL
  // ============================================================================

  const handleDone = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Export at original resolution
    const img = originalImageRef.current;
    if (!img) return;

    const exportCanvas = document.createElement("canvas");
    exportCanvas.width = img.naturalWidth;
    exportCanvas.height = img.naturalHeight;
    const ectx = exportCanvas.getContext("2d");
    if (!ectx) return;

    // Draw original image at full resolution
    ectx.drawImage(img, 0, 0);

    // Draw edits scaled up from display canvas
    ectx.drawImage(canvas, 0, 0, img.naturalWidth, img.naturalHeight);

    exportCanvas.toBlob(
      (blob) => {
        if (!blob) return;
        const name = imageFile.name.replace(/\.[^.]+$/, "") + "_edited.jpg";
        const file = new File([blob], name, { type: "image/jpeg" });
        onDone(file);
      },
      "image/jpeg",
      0.9
    );
  }, [imageFile, onDone]);

  // Keyboard shortcut: Ctrl+Z for undo
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
  // RENDER
  // ============================================================================

  const cursorStyle =
    tool === "text"
      ? "text"
      : tool === "eraser"
      ? "crosshair"
      : "crosshair";

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 99999,
        display: "flex",
        flexDirection: "column",
        background: "rgba(20,20,30,0.95)",
        backdropFilter: "blur(12px)",
      }}
    >
      {/* Top Toolbar */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: 6,
          padding: "8px 12px",
          borderBottom: "1px solid rgba(255,255,255,0.1)",
          background: "rgba(10,10,20,0.9)",
          minHeight: 48,
        }}
      >
        {/* Tool buttons */}
        <ToolBtn
          label="B"
          title="Brush"
          active={tool === "brush"}
          onClick={() => { setTool("brush"); setTextMode(false); }}
        />
        <ToolBtn
          label="E"
          title="Eraser"
          active={tool === "eraser"}
          onClick={() => { setTool("eraser"); setTextMode(false); }}
        />
        <ToolBtn
          label="T"
          title="Text"
          active={tool === "text"}
          onClick={() => setTool("text")}
        />

        <Divider />

        {/* Color swatches */}
        {PRESET_COLORS.map((c) => (
          <button
            key={c}
            title={c}
            onClick={() => setColor(c)}
            style={{
              width: 24,
              height: 24,
              borderRadius: 4,
              border: color === c ? "2px solid #00cccc" : "2px solid rgba(255,255,255,0.15)",
              background: c,
              cursor: "pointer",
              flexShrink: 0,
              boxShadow: color === c ? "0 0 8px rgba(0,204,204,0.5)" : "none",
            }}
          />
        ))}

        <Divider />

        {/* Size selector */}
        {(["small", "medium", "large"] as BrushSize[]).map((s) => (
          <button
            key={s}
            title={`Size: ${s}`}
            onClick={() => setBrushSize(s)}
            style={{
              width: 28,
              height: 28,
              borderRadius: 4,
              border: brushSize === s ? "2px solid #00cccc" : "1px solid rgba(255,255,255,0.2)",
              background: brushSize === s ? "rgba(0,204,204,0.15)" : "rgba(255,255,255,0.05)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <span
              style={{
                width: BRUSH_SIZES[s],
                height: BRUSH_SIZES[s],
                borderRadius: "50%",
                background: "#fff",
                display: "block",
              }}
            />
          </button>
        ))}

        <Divider />

        {/* Undo */}
        <ToolBtn
          label="&larr;"
          title="Undo (Ctrl+Z)"
          active={false}
          onClick={undo}
          disabled={historyIdx <= 0}
        />

        {/* Clear */}
        <ToolBtn
          label="X"
          title="Clear (reset to original)"
          active={false}
          onClick={clearCanvas}
        />
      </div>

      {/* Canvas area */}
      <div
        ref={containerRef}
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
          padding: 4,
          position: "relative",
        }}
      >
        {!loaded && (
          <div style={{ color: "rgba(255,255,255,0.6)", fontSize: 14, letterSpacing: "0.1em" }}>
            Loading image...
          </div>
        )}
        <canvas
          ref={canvasRef}
          style={{
            display: loaded ? "block" : "none",
            border: "1px solid rgba(255,255,255,0.15)",
            borderRadius: 4,
            cursor: cursorStyle,
            touchAction: "none",
            maxWidth: "100%",
            maxHeight: "100%",
          }}
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseLeave={onMouseUp}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        />

        {/* Text input overlay */}
        {textMode && textPos && (
          <div
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              right: 0,
              bottom: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "rgba(0,0,0,0.4)",
              zIndex: 10,
            }}
            onClick={(e) => { if (e.target === e.currentTarget) { placeText(); } }}
          >
            <div
              style={{
                background: "rgba(20,20,30,0.95)",
                border: "1px solid rgba(0,204,204,0.4)",
                borderRadius: 8,
                padding: 16,
                display: "flex",
                flexDirection: "column",
                gap: 10,
                minWidth: 240,
              }}
            >
              <label style={{ color: "rgba(255,255,255,0.7)", fontSize: 12, letterSpacing: "0.1em" }}>
                ENTER TEXT
              </label>
              <input
                autoFocus
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") placeText(); if (e.key === "Escape") { setTextMode(false); setTextPos(null); } }}
                style={{
                  background: "rgba(255,255,255,0.08)",
                  border: "1px solid rgba(255,255,255,0.2)",
                  borderRadius: 4,
                  padding: "8px 10px",
                  color: "#fff",
                  fontSize: 14,
                  outline: "none",
                }}
                placeholder="Type here..."
              />
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <button
                  onClick={() => { setTextMode(false); setTextPos(null); }}
                  style={{
                    padding: "6px 14px",
                    borderRadius: 4,
                    border: "1px solid rgba(255,255,255,0.2)",
                    background: "rgba(255,255,255,0.05)",
                    color: "rgba(255,255,255,0.7)",
                    fontSize: 12,
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={placeText}
                  style={{
                    padding: "6px 14px",
                    borderRadius: 4,
                    border: "1px solid rgba(0,204,204,0.4)",
                    background: "rgba(0,204,204,0.15)",
                    color: "#00cccc",
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Place
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Bottom bar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-end",
          gap: 10,
          padding: "10px 16px",
          borderTop: "1px solid rgba(255,255,255,0.1)",
          background: "rgba(10,10,20,0.9)",
        }}
      >
        <button
          onClick={onCancel}
          style={{
            padding: "8px 24px",
            borderRadius: 6,
            border: "1px solid rgba(255,255,255,0.2)",
            background: "rgba(255,255,255,0.05)",
            color: "rgba(255,255,255,0.7)",
            fontSize: 13,
            fontWeight: 600,
            letterSpacing: "0.06em",
            cursor: "pointer",
          }}
        >
          Cancel
        </button>
        <button
          onClick={handleDone}
          style={{
            padding: "8px 24px",
            borderRadius: 6,
            border: "1px solid rgba(0,204,204,0.5)",
            background: "linear-gradient(135deg, rgba(0,204,204,0.2), rgba(0,204,204,0.1))",
            color: "#00cccc",
            fontSize: 13,
            fontWeight: 700,
            letterSpacing: "0.06em",
            cursor: "pointer",
            boxShadow: "0 0 12px rgba(0,204,204,0.2)",
          }}
        >
          Done
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
  title,
  active,
  onClick,
  disabled,
}: {
  label: string;
  title: string;
  active: boolean;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      disabled={disabled}
      style={{
        width: 30,
        height: 30,
        borderRadius: 4,
        border: active ? "2px solid #00cccc" : "1px solid rgba(255,255,255,0.2)",
        background: active ? "rgba(0,204,204,0.15)" : "rgba(255,255,255,0.05)",
        color: disabled ? "rgba(255,255,255,0.25)" : active ? "#00cccc" : "rgba(255,255,255,0.8)",
        fontSize: 14,
        fontWeight: 700,
        cursor: disabled ? "not-allowed" : "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        boxShadow: active ? "0 0 8px rgba(0,204,204,0.3)" : "none",
      }}
      dangerouslySetInnerHTML={{ __html: label }}
    />
  );
}

function Divider() {
  return (
    <div
      style={{
        width: 1,
        height: 24,
        background: "rgba(255,255,255,0.12)",
        flexShrink: 0,
        margin: "0 2px",
      }}
    />
  );
}

export default PaintEditor;
