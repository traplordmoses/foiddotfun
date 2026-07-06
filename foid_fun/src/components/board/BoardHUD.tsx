// /src/components/board/BoardHUD.tsx
// The zoom/pan/mode indicator that floats over the canvas, with visible
// zoom controls. Buttons mirror the keyboard shortcuts exactly (+/− step
// ×1.2, reset → 100%) so the affordance is discoverable without stealing
// any new behavior.
"use client";

import React from "react";

export type BoardHUDProps = {
  scale: number;
  pan: { x: number; y: number };
  mode: "PAN" | "PLACE";
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  onZoomReset?: () => void;
};

export function BoardHUD({ scale, pan, mode, onZoomIn, onZoomOut, onZoomReset }: BoardHUDProps) {
  const hasControls = onZoomIn || onZoomOut || onZoomReset;
  return (
    <div className="board-hud">
      <span>ZOOM: {Math.round(scale * 100)}%</span>
      <span>
        PAN: {Math.round(pan.x)}, {Math.round(pan.y)}
      </span>
      <span>MODE: {mode}</span>
      {hasControls && (
        <div className="board-hud__controls">
          <button
            type="button"
            className="board-hud__btn"
            aria-label="Zoom out"
            title="Zoom out (−)"
            onClick={onZoomOut}
          >
            −
          </button>
          <button
            type="button"
            className="board-hud__btn"
            aria-label="Reset zoom to 100%"
            title="Reset zoom (0)"
            onClick={onZoomReset}
          >
            1:1
          </button>
          <button
            type="button"
            className="board-hud__btn"
            aria-label="Zoom in"
            title="Zoom in (+)"
            onClick={onZoomIn}
          >
            +
          </button>
        </div>
      )}
    </div>
  );
}
