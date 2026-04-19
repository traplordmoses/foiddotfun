// /src/components/board/BoardActions.tsx
// The action panel in the sidebar: propose/submit buttons + pricing info.
// Exposes a clear disabled-reason via the `disabledReason` prop so users
// never see a mysteriously locked CTA.
"use client";

import React from "react";
import { Chip, PrimaryButton, StatusDot } from "@/components/ui";
import { formatEth } from "@/lib/wei";

export type BoardActionsProps = {
  /**
   * Flat per-placement submission fee in wei. Rendered in the chip. The
   * contract charges this flat amount per propose() call.
   */
  submissionFeeWei: bigint;
  onPickImage: () => void;
  onSubmit: () => void;
  hasPending: boolean;
  hasPlaced: boolean;
  submitting: boolean;
  /** If set, "PROPOSE IMAGE" is disabled with this as tooltip/sub-line. */
  proposeDisabledReason?: string | null;
  fileInputRef: React.Ref<HTMLInputElement>;
  onFileChange: React.ChangeEventHandler<HTMLInputElement>;
};

export function BoardActions({
  submissionFeeWei,
  onPickImage,
  onSubmit,
  hasPending,
  hasPlaced,
  submitting,
  proposeDisabledReason,
  fileInputRef,
  onFileChange,
}: BoardActionsProps) {
  return (
    <div className="board-section board-section--actions">
      <div className="board-section__header">
        <StatusDot status="online" />
        <span className="board-section__title">ACTIONS</span>
        <Chip
          title="Flat fee charged per placement, regardless of size"
          icon={"\u{1F4B0}"}
          className="ml-auto"
        >
          FEE: {formatEth(submissionFeeWei)} ETH
        </Chip>
      </div>
      <div className="board-actions">
        <PrimaryButton
          onClick={onPickImage}
          label="PROPOSE IMAGE"
          variant="primary"
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
        <div className="board-actions__divider" />
        {hasPending && (
          <span className="board-actions__pending-line">ready to submit ✓</span>
        )}
        {proposeDisabledReason && !submitting && (
          <span
            id="board-propose-disabled"
            className="board-actions__pending-line"
            style={{ opacity: 0.65 }}
          >
            {proposeDisabledReason}
          </span>
        )}
        <PrimaryButton
          onClick={onSubmit}
          label={submitting ? "SUBMITTING..." : "SUBMIT PROPOSAL"}
          disabled={!hasPending || submitting}
          variant="secondary"
        />
      </div>
      <div className="board-actions__pricing">
        0.001 ETH per placement &middot; any size
      </div>
      {hasPlaced && (
        <div className="board-actions__flag-hint">
          Think a placement is inappropriate? Click it on the board to flag it and
          open a community removal vote.
        </div>
      )}
    </div>
  );
}
