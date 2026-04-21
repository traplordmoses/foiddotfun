// /src/components/board/VotingGhost.tsx
// An in-voting proposal rendered on the canvas — ghost placement with neon
// glow + vote tallies. Used for items pulled from /api/swipe/proposals.
"use client";

import React, { memo } from "react";
import { toStageRect } from "@/lib/boardCoordinates";
import { IpfsImage } from "@/components/IpfsImage";

export type VotingGhostProps = {
  id: number;
  cid: string;
  x: number;
  y: number;
  w: number;
  h: number;
  forCount: number;
  againstCount: number;
};

function VotingGhostInner({
  id,
  cid,
  x,
  y,
  w,
  h,
  forCount,
  againstCount,
}: VotingGhostProps) {
  const sr = toStageRect({ x, y, w, h });
  return (
    <figure
      className="board-voting-ghost"
      style={{
        left: sr.x,
        top: sr.y,
        width: sr.w,
        height: sr.h,
        cursor: "pointer",
      }}
      title={`Proposal #${id} — voting in progress`}
    >
      <IpfsImage
        cid={cid}
        alt={`Proposal #${id}`}
        className="board-voting-ghost__img"
        fetchPriority="low"
      />
      <div className="board-voting-ghost__badge">
        <span>VOTING #{id}</span>
        <div className="board-voting-ghost__votes">
          <span className="yes">{forCount}Y</span>
          <span className="sep">/</span>
          <span className="no">{againstCount}N</span>
        </div>
      </div>
    </figure>
  );
}

// React.memo — each pan tick re-runs the parent but VotingGhost's props
// (primitives + strings) are reference-stable, so shallow compare hits and
// every off-viewport ghost skips its reconciler pass. Phase β optimization.
export const VotingGhost = memo(VotingGhostInner);
