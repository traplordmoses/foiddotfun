// /src/components/board/PlacementGhost.tsx
// The drop-zone ghost: shows the snapped rect + validation status while the
// user drags an image over the canvas.
"use client";

import React, { memo } from "react";
import { toStageRect } from "@/lib/boardCoordinates";
import { formatEth } from "@/lib/wei";
import type { Ghost } from "@/hooks/board/useGhost";

const STATUS_COLOR: Record<Ghost["status"], string> = {
  ok: "rgba(72,255,171,0.9)",
  "not-touching": "rgba(255,184,0,0.9)",
  invalid: "rgba(255,71,87,0.9)",
  overlap: "rgba(255,71,87,0.9)",
  oversize: "rgba(255,184,0,0.9)",
};

export type PlacementGhostProps = {
  ghost: Ghost;
};

function PlacementGhostInner({ ghost }: PlacementGhostProps) {
  const sr = toStageRect(ghost.rect);
  const color = STATUS_COLOR[ghost.status];
  return (
    <div
      className="board-ghost"
      style={{
        left: sr.x,
        top: sr.y,
        width: sr.w,
        height: sr.h,
        outlineColor: color,
        background: color.replace("0.9", "0.08"),
      }}
    >
      <span className="board-ghost__label">
        {ghost.cells} cells · {formatEth(ghost.totalWei)} ETH
      </span>
    </div>
  );
}

// Memoize: ghost-rect updates trigger parent renders on every pointer-
// move during a drag. Without memo the ghost re-renders at ~60Hz.
// Shallow compare on `ghost` — the hook always produces a fresh object
// on rect change, so memo hits whenever rect + status + totalWei are all
// the same (e.g. during pan when drag isn't active).
export const PlacementGhost = memo(PlacementGhostInner);
