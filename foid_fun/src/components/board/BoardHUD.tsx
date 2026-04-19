// /src/components/board/BoardHUD.tsx
// The zoom/pan/mode indicator that floats over the canvas.
"use client";

import React from "react";

export type BoardHUDProps = {
  scale: number;
  pan: { x: number; y: number };
  mode: "PAN" | "PLACE";
};

export function BoardHUD({ scale, pan, mode }: BoardHUDProps) {
  return (
    <div className="board-hud">
      <span>ZOOM: {Math.round(scale * 100)}%</span>
      <span>
        PAN: {Math.round(pan.x)}, {Math.round(pan.y)}
      </span>
      <span>MODE: {mode}</span>
    </div>
  );
}
