// /src/components/board/BoardActions.tsx
// The floating action affordance that sits bottom-center ON the canvas
// (screen space — it never pans/zooms with the stage).
//
// Two states (founder direction, 2026-07):
//
//   IDLE (no pending items) — a quiet glass chip: a small "+" gel and a
//   lowercase "propose" label at ~0.65 resting opacity, lifting to 1 on
//   hover/focus. Drag-and-drop is the primary invitation; this is the
//   discoverable fallback, so it whispers instead of shouting. The fee
//   lives in the tooltip only.
//
//   PENDING (items staged) — that state has earned prominence: the full
//   pill returns with SUBMIT PROPOSAL (n) as the loud primary action,
//   plus the fee line for what you're about to sign.
//
// The old VOTING (n) flyout is gone: removal voting now lives where the
// judgment happens — click a placement to expand it (PlacementModal) and
// the active removal vote for THAT placement is right there. Flagging
// stays on the placement card hover.
"use client";

import React from "react";
import { PrimaryButton } from "@/components/ui";
import { formatEth } from "@/lib/wei";

export type BoardActionsProps = {
  /**
   * Flat per-placement submission fee in wei. Surfaced as tooltip copy in
   * the idle chip and as the fee line in the pending pill. The contract
   * charges this flat amount per propose() call.
   */
  submissionFeeWei: bigint;
  onPickImage: () => void;
  onSubmit: () => void;
  /** Items staged in the tray — the prominent pill renders only when > 0. */
  pendingCount: number;
  submitting: boolean;
  /** If set, propose is disabled with this as tooltip/sub-line. */
  proposeDisabledReason?: string | null;
  fileInputRef: React.Ref<HTMLInputElement>;
  onFileChange: React.ChangeEventHandler<HTMLInputElement>;
};

export function BoardActions({
  submissionFeeWei,
  onPickImage,
  onSubmit,
  pendingCount,
  submitting,
  proposeDisabledReason,
  fileInputRef,
  onFileChange,
}: BoardActionsProps) {
  const hasPending = pendingCount > 0;
  const feeLabel = `${formatEth(submissionFeeWei)} ETH flat fee · any size`;

  // Shared hidden input — the P-key shortcut and both propose affordances
  // click through fileInputRef, so it must exist in every state.
  const fileInput = (
    <input
      ref={fileInputRef}
      type="file"
      accept="image/*"
      className="hidden"
      onChange={onFileChange}
      aria-label="Choose image to propose"
    />
  );

  if (!hasPending) {
    return (
      <div
        className="board-dock"
        // The chip lives inside the pan/zoom canvas — swallow pointerdowns
        // so a click here never starts a board drag.
        onPointerDown={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          className="board-dock__quiet"
          onClick={onPickImage}
          disabled={!!proposeDisabledReason || submitting}
          title={proposeDisabledReason ?? `propose an image · ${feeLabel}`}
          aria-label={`Propose an image (${feeLabel})`}
        >
          <span className="board-dock__quiet-gel" aria-hidden="true">
            +
          </span>
          <span className="board-dock__quiet-label">propose</span>
        </button>
        {fileInput}
      </div>
    );
  }

  return (
    <div
      className="board-dock"
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div className="board-dock__pill">
        <PrimaryButton
          onClick={onPickImage}
          label="PROPOSE IMAGE"
          variant="primary"
          className="board-dock__btn"
          disabled={!!proposeDisabledReason || submitting}
          title={proposeDisabledReason ?? undefined}
          describedBy={proposeDisabledReason ? "board-propose-disabled" : undefined}
        />
        {fileInput}
        <PrimaryButton
          onClick={onSubmit}
          label={
            submitting
              ? "SUBMITTING..."
              : `SUBMIT PROPOSAL (${pendingCount})`
          }
          disabled={submitting}
          variant="secondary"
          className="board-dock__btn"
        />
        <span
          className="board-dock__fee"
          title="Flat fee charged per placement, regardless of size"
        >
          {formatEth(submissionFeeWei)} ETH · any size
        </span>
      </div>

      {proposeDisabledReason && !submitting && (
        <span id="board-propose-disabled" className="board-dock__note">
          {proposeDisabledReason}
        </span>
      )}
    </div>
  );
}
