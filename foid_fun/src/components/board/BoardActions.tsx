// /src/components/board/BoardActions.tsx
// The floating action dock that sits bottom-center ON the canvas (screen
// space — it never pans/zooms with the stage). Replaces the old right-hand
// sidebar ACTIONS section: the memes are the page, the chrome floats.
//
//   [ PROPOSE IMAGE ] [ SUBMIT PROPOSAL (n) ]  fee · any size │ VOTING (n)
//
// - SUBMIT only renders while there are pending items (with the count).
// - The fee reads as a quiet .foid-label-style line inside the pill.
// - VOTING toggles a collapsed-by-default glass flyout above the dock that
//   hosts the community removal votes (passed in via `votingPanel`).
// - Exposes a clear disabled-reason via `proposeDisabledReason` so users
//   never see a mysteriously locked CTA.
"use client";

import React, { useState } from "react";
import { PrimaryButton } from "@/components/ui";
import { formatEth } from "@/lib/wei";

export type BoardActionsProps = {
  /**
   * Flat per-placement submission fee in wei. Rendered in the fee line. The
   * contract charges this flat amount per propose() call.
   */
  submissionFeeWei: bigint;
  onPickImage: () => void;
  onSubmit: () => void;
  /** Items staged in the tray — SUBMIT renders only when > 0. */
  pendingCount: number;
  hasPlaced: boolean;
  submitting: boolean;
  /** If set, "PROPOSE IMAGE" is disabled with this as tooltip/sub-line. */
  proposeDisabledReason?: string | null;
  fileInputRef: React.Ref<HTMLInputElement>;
  onFileChange: React.ChangeEventHandler<HTMLInputElement>;
  /** Active community removal votes — shown as VOTING (n). */
  votingCount: number;
  /** Flyout body — the removal-vote cards + flag hint. */
  votingPanel?: React.ReactNode;
};

export function BoardActions({
  submissionFeeWei,
  onPickImage,
  onSubmit,
  pendingCount,
  hasPlaced,
  submitting,
  proposeDisabledReason,
  fileInputRef,
  onFileChange,
  votingCount,
  votingPanel,
}: BoardActionsProps) {
  const [votingOpen, setVotingOpen] = useState(false);
  const hasPending = pendingCount > 0;
  const showVoting = hasPlaced && votingPanel != null;

  return (
    <div
      className="board-dock"
      // The dock lives inside the pan/zoom canvas — swallow pointerdowns on
      // the pill/flyout padding so a click here never starts a board drag.
      onPointerDown={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        if (e.key === "Escape" && votingOpen) setVotingOpen(false);
      }}
    >
      {showVoting && votingOpen && (
        <div
          id="board-dock-voting"
          className="board-dock__flyout"
          role="region"
          aria-label="Community removal votes"
        >
          <div className="board-dock__flyout-head">
            <span className="board-dock__flyout-title">
              VOTING ({votingCount})
            </span>
            <button
              type="button"
              className="board-dock__flyout-close"
              aria-label="Close voting panel"
              onClick={() => setVotingOpen(false)}
            >
              ×
            </button>
          </div>
          {votingPanel}
        </div>
      )}

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
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={onFileChange}
          aria-label="Choose image to propose"
        />
        {hasPending && (
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
        )}
        <span
          className="board-dock__fee"
          title="Flat fee charged per placement, regardless of size"
        >
          {formatEth(submissionFeeWei)} ETH · any size
        </span>
        {showVoting && (
          <>
            <span className="board-dock__divider" aria-hidden />
            <button
              type="button"
              className="board-dock__voting-toggle"
              aria-expanded={votingOpen}
              aria-controls="board-dock-voting"
              onClick={() => setVotingOpen((v) => !v)}
            >
              VOTING ({votingCount})
            </button>
          </>
        )}
      </div>

      {proposeDisabledReason && !submitting && (
        <span id="board-propose-disabled" className="board-dock__note">
          {proposeDisabledReason}
        </span>
      )}
    </div>
  );
}
