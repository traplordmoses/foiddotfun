// /src/components/board/PendingItemCard.tsx
// A not-yet-submitted pending item rendered on the canvas. Carries its own
// move/resize/remove affordances — the parent supplies the handlers (which
// hold onto the pointermove loops so they outlive the card re-renders).
//
// Phase 3: accepts an optional live-submit state so users can see each
// item's per-item progress (uploading / signing / confirmed / failed) right
// on the canvas instead of hunting for it in a sidebar log.
"use client";

import React from "react";
import { toStageRect } from "@/lib/boardCoordinates";
import { formatEth } from "@/lib/wei";
import type { Rect } from "@/lib/grid";
import type { SubmitItemState } from "@/hooks/board/useProposalSubmit";
import { IconButton, NeonBadge, type NeonBadgeTone } from "@/components/ui";

type BadgeSpec = { label: string; tone: NeonBadgeTone };

// Label + tone for every submit FSM state. Tone values map 1:1 to the
// token-backed palette in tokens.css via <NeonBadge />.
const BADGE_SPEC: Partial<Record<SubmitItemState, BadgeSpec>> = {
  queued:     { label: "QUEUED",           tone: "info" },
  validating: { label: "VALIDATING",       tone: "info" },
  uploading:  { label: "UPLOADING…",       tone: "info" },
  signing:    { label: "SIGN IN WALLET ➜", tone: "warn" },
  confirmed:  { label: "ENGRAVED ✓",       tone: "ok" },
  rejected:   { label: "CANCELLED",        tone: "warn" },
  failed:     { label: "FAILED — RETRY?",  tone: "err" },
};

export type PendingItemCardProps = {
  id: string;
  name: string;
  rect: Rect;
  previewUrl: string;
  cells: number;
  totalWei: bigint;
  /** Live submit state. If omitted, no badge is rendered. */
  submitState?: SubmitItemState;
  onBeginMove: (e: React.PointerEvent) => void;
  onBeginResize: (e: React.PointerEvent) => void;
  onRemove: () => void;
};

export function PendingItemCard({
  name,
  rect,
  previewUrl,
  cells,
  totalWei,
  submitState,
  onBeginMove,
  onBeginResize,
  onRemove,
}: PendingItemCardProps) {
  const sr = toStageRect(rect);
  const badge = submitState ? BADGE_SPEC[submitState] : undefined;
  return (
    <figure
      className="board-pending"
      style={{ left: sr.x, top: sr.y, width: sr.w, height: sr.h }}
    >
      {badge && (
        <NeonBadge
          tone={badge.tone}
          live
          className="board-pending__badge"
          style={{
            position: "absolute",
            top: 6,
            left: 6,
            pointerEvents: "none",
            zIndex: 3,
          }}
        >
          {badge.label}
        </NeonBadge>
      )}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={previewUrl}
        alt={name}
        className="board-pending__img"
        draggable={false}
        loading="lazy"
      />
      <IconButton
        icon="⠿"
        label={`Move ${name}`}
        onPointerDown={onBeginMove}
        className="board-pending__move"
        style={{ position: "absolute", left: 4, top: 4, width: 32, cursor: "move" }}
      />
      <IconButton
        icon="↘"
        label={`Resize ${name}`}
        onPointerDown={onBeginResize}
        className="board-pending__resize"
        style={{ position: "absolute", right: 4, bottom: 4, cursor: "se-resize" }}
      />
      <IconButton
        icon="×"
        label={`Remove ${name}`}
        tone="danger"
        onClick={onRemove}
        className="board-pending__remove"
        style={{ position: "absolute", right: 4, top: 4 }}
      />
      <span className="board-pending__info">
        {cells} cells · {formatEth(totalWei)} ETH
      </span>
    </figure>
  );
}
