// /src/components/board/BatchReviewModal.tsx
// Dry-run preview shown BEFORE the user signs. Single source of truth for
// the fee breakdown — before this modal existed, fees appeared in four
// different places (the ETH/CELL chip, the ghost label, the pending badge,
// and the pricing line) and could drift out of sync.
//
// Dialog chrome (backdrop, slab panel, Escape, focus trap, scroll lock)
// comes from the shared <Modal/> primitive; this file only owns the fee
// review content.
"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Modal } from "@/components/ui";
import { formatEth } from "@/lib/wei";
import { rectCells, type Rect } from "@/lib/grid";
import { estimateBatchGas, type GasEstimateResult } from "@/lib/board/gasEstimate";

export type BatchReviewItem = {
  id: string;
  name: string;
  previewUrl: string;
  rect: Rect;
};

export type BatchReviewModalProps = {
  items: BatchReviewItem[];
  address: `0x${string}` | undefined;
  /** Per-placement submission fee in wei. */
  submissionFeeWei: bigint;
  /** Voting window (seconds). Shown as "72h" etc. */
  votingWindowSeconds: number;
  /** Approval threshold bps (5100 = 51%). */
  approvalThresholdBps: number;
  onConfirm: () => void;
  onCancel: () => void;
};

function formatWindow(seconds: number): string {
  const hours = Math.round(seconds / 3600);
  if (hours >= 24) return `${Math.round(hours / 24)}d`;
  return `${hours}h`;
}

export function BatchReviewModal({
  items,
  address,
  submissionFeeWei,
  votingWindowSeconds,
  approvalThresholdBps,
  onConfirm,
  onCancel,
}: BatchReviewModalProps) {
  const totalCells = items.reduce((sum, it) => sum + rectCells(it.rect), 0);
  const totalFeeWei = submissionFeeWei * BigInt(items.length);

  const [gas, setGas] = useState<GasEstimateResult | null>(null);
  const [gasError, setGasError] = useState(false);

  // Content-based stable key so the estimate doesn't re-run every parent
  // render (items is a new array every time). We only re-estimate when the
  // set of items, their rects, or the fee actually change.
  const itemsKey = useMemo(
    () =>
      items
        .map((it) => `${it.id}:${it.rect.x},${it.rect.y},${it.rect.w},${it.rect.h}`)
        .join("|"),
    [items]
  );
  const itemsRef = useRef(items);
  itemsRef.current = items;

  // Estimate gas when the content-key changes. We don't block the modal on
  // this — the user can still confirm without the estimate if RPC is slow.
  useEffect(() => {
    const currentItems = itemsRef.current;
    if (!address || currentItems.length === 0) return;
    let alive = true;
    setGas(null);
    setGasError(false);
    estimateBatchGas({
      address,
      items: currentItems.map((it) => ({ id: it.id, rect: it.rect })),
      submissionFeeWei,
    })
      .then((res) => {
        if (alive) setGas(res);
      })
      .catch(() => {
        if (alive) setGasError(true);
      });
    return () => {
      alive = false;
    };
  }, [address, itemsKey, submissionFeeWei]);

  const totalWithGasWei = gas ? totalFeeWei + gas.totalGasCostWei : totalFeeWei;

  // Primary CTA receives focus on open (via Modal's initialFocusRef) so
  // keyboard users can review fees and confirm without tabbing.
  const confirmBtnRef = useRef<HTMLButtonElement>(null);

  return (
    <Modal
      open
      onClose={onCancel}
      label="Ready to engrave — review fees"
      variant="slab"
      maxWidth={460}
      initialFocusRef={confirmBtnRef}
    >
      <header className="brm-header">
        <h2 id="brm-title" className="brm-title">
          READY TO ENGRAVE
        </h2>
        <p className="brm-sub">
          {items.length} placement{items.length === 1 ? "" : "s"} · {totalCells}{" "}
          cell{totalCells === 1 ? "" : "s"}
        </p>
      </header>

      <ul className="brm-items" role="list">
        {items.map((it) => {
          const cells = rectCells(it.rect);
          return (
            <li key={it.id} className="brm-item">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={it.previewUrl}
                alt={it.name}
                className="brm-thumb"
                draggable={false}
              />
              <div className="brm-item-meta">
                <span className="brm-item-name" title={it.name}>
                  {it.name}
                </span>
                <span className="brm-item-sub">
                  {it.rect.w}×{it.rect.h} · {cells} cell{cells === 1 ? "" : "s"}
                </span>
              </div>
              <span className="brm-item-fee">{formatEth(submissionFeeWei)}</span>
            </li>
          );
        })}
      </ul>

      <dl className="brm-summary">
        <div className="brm-row">
          <dt>Placement fee</dt>
          <dd>
            {formatEth(totalFeeWei)} ETH
            <span className="brm-row-sub">
              {formatEth(submissionFeeWei)} × {items.length}
            </span>
          </dd>
        </div>
        <div className="brm-row">
          <dt>Estimated gas</dt>
          <dd>
            {gas ? (
              <>
                ~{parseFloat(gas.totalGasCostEth).toFixed(5)} ETH
                {gas.partial && (
                  <span className="brm-row-sub brm-warn">partial estimate</span>
                )}
              </>
            ) : gasError ? (
              <span className="brm-row-sub brm-warn">unavailable</span>
            ) : (
              <span className="brm-row-sub">estimating...</span>
            )}
          </dd>
        </div>
        <div className="brm-row brm-row--total">
          <dt>Total</dt>
          <dd>~{formatEth(totalWithGasWei)} ETH</dd>
        </div>
      </dl>

      <div className="brm-rules">
        <span>Voting window: {formatWindow(votingWindowSeconds)}</span>
        <span>·</span>
        <span>Approval threshold: {(approvalThresholdBps / 100).toFixed(0)}%</span>
      </div>

      <footer className="brm-actions">
        <button
          type="button"
          className="brm-btn brm-btn--ghost"
          onClick={onCancel}
        >
          CANCEL
        </button>
        <button
          type="button"
          className="brm-btn brm-btn--primary"
          onClick={onConfirm}
          disabled={!address}
          ref={confirmBtnRef}
          // Shift+Enter anywhere inside the button (and by extension, while
          // it has focus — which is the default since mount) confirms. This
          // lets keyboard users skip the extra click after reviewing fees.
          // WCAG 2.1.1 (Keyboard).
          onKeyDown={(e) => {
            if (e.key === "Enter" && e.shiftKey && !e.currentTarget.disabled) {
              e.preventDefault();
              onConfirm();
            }
          }}
          aria-keyshortcuts="Shift+Enter"
          title="Shift+Enter to confirm"
        >
          SIGN &amp; ENGRAVE
        </button>
      </footer>

      <style jsx>{`
        .brm-header {
          text-align: center;
          border-bottom: 1px solid rgba(116, 255, 235, 0.12);
          padding-bottom: 14px;
          margin-bottom: 14px;
        }
        .brm-title {
          margin: 0;
          font-size: 18px;
          letter-spacing: 0.24em;
          color: var(--foid-accent);
          font-weight: 700;
          text-shadow: 0 0 16px rgba(116, 255, 235, 0.2);
        }
        .brm-sub {
          margin: 6px 0 0;
          font-size: 11px;
          letter-spacing: 0.08em;
          color: rgba(255, 255, 255, 0.55);
          text-transform: uppercase;
        }

        .brm-items {
          list-style: none;
          margin: 0 0 16px;
          padding: 0;
          display: flex;
          flex-direction: column;
          gap: 8px;
          max-height: 240px;
          overflow-y: auto;
        }
        .brm-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 8px;
          border-radius: 10px;
          border: 1px solid rgba(255, 255, 255, 0.06);
          background: rgba(255, 255, 255, 0.03);
        }
        .brm-thumb {
          width: 44px;
          height: 44px;
          border-radius: var(--foid-radius-sm);
          object-fit: cover;
          flex-shrink: 0;
          border: 1px solid rgba(116, 255, 235, 0.2);
        }
        .brm-item-meta {
          flex: 1;
          min-width: 0;
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        .brm-item-name {
          font-size: 12px;
          color: rgba(255, 255, 255, 0.9);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .brm-item-sub {
          font-size: 10px;
          letter-spacing: 0.06em;
          color: rgba(255, 255, 255, 0.5);
          text-transform: uppercase;
        }
        .brm-item-fee {
          font-size: 11px;
          letter-spacing: 0.06em;
          color: rgba(116, 255, 235, 0.85);
          font-variant-numeric: tabular-nums;
        }

        .brm-summary {
          margin: 0 0 14px;
          padding: 12px;
          border-radius: 10px;
          background: rgba(116, 255, 235, 0.04);
          border: 1px solid rgba(116, 255, 235, 0.12);
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .brm-row {
          display: flex;
          justify-content: space-between;
          align-items: baseline;
          gap: 12px;
          font-size: 12px;
        }
        .brm-row dt {
          color: rgba(255, 255, 255, 0.6);
          letter-spacing: 0.06em;
          text-transform: uppercase;
          font-size: 10px;
        }
        .brm-row dd {
          margin: 0;
          color: rgba(255, 255, 255, 0.92);
          font-variant-numeric: tabular-nums;
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 2px;
        }
        .brm-row-sub {
          font-size: 9px;
          color: rgba(255, 255, 255, 0.45);
          letter-spacing: 0.04em;
        }
        .brm-warn {
          color: rgba(255, 184, 0, 0.75);
        }
        .brm-row--total {
          padding-top: 8px;
          border-top: 1px solid rgba(116, 255, 235, 0.15);
        }
        .brm-row--total dt {
          color: rgba(116, 255, 235, 0.9);
          font-weight: 700;
        }
        .brm-row--total dd {
          color: var(--foid-accent);
          font-size: 14px;
          font-weight: 700;
        }

        .brm-rules {
          text-align: center;
          font-size: 10px;
          letter-spacing: 0.08em;
          color: rgba(255, 255, 255, 0.4);
          text-transform: uppercase;
          margin-bottom: 16px;
          display: flex;
          justify-content: center;
          gap: 8px;
          flex-wrap: wrap;
        }

        .brm-actions {
          display: flex;
          gap: 10px;
        }
        .brm-btn {
          flex: 1;
          padding: 12px;
          border-radius: var(--foid-radius-md);
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 0.18em;
          cursor: pointer;
          transition: background var(--foid-motion-fast), border-color var(--foid-motion-fast), transform 80ms;
          font-family: inherit;
        }
        .brm-btn:active {
          transform: scale(0.98);
        }
        .brm-btn--ghost {
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.12);
          color: rgba(255, 255, 255, 0.65);
        }
        .brm-btn--ghost:hover {
          background: rgba(255, 255, 255, 0.08);
          border-color: rgba(255, 255, 255, 0.18);
        }
        .brm-btn--primary {
          background:
            linear-gradient(180deg, rgba(116, 255, 235, 0.22), rgba(116, 255, 235, 0.06) 60%),
            rgba(6, 14, 28, 0.9);
          border: 1px solid rgba(116, 255, 235, 0.45);
          color: var(--tone-info-text);
          box-shadow: 0 0 24px rgba(116, 255, 235, 0.12);
        }
        .brm-btn--primary:hover:not(:disabled) {
          background:
            linear-gradient(180deg, rgba(116, 255, 235, 0.35), rgba(116, 255, 235, 0.12) 60%),
            rgba(6, 14, 28, 0.95);
          box-shadow: 0 0 32px rgba(116, 255, 235, 0.22);
        }
        .brm-btn--primary:disabled {
          opacity: 0.45;
          cursor: not-allowed;
        }
      `}</style>
    </Modal>
  );
}
