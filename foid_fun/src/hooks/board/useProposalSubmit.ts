// /src/hooks/board/useProposalSubmit.ts
// Submit pipeline as an honest state machine. Replaces the serial try/catch
// in page.tsx:815 that silently swallowed partial failures behind a cheerful
// "All proposals submitted!" status message.
//
// Per-item states:
//   queued → validating → uploading → signing → confirming → confirmed
//                                      └→ rejected (user)
//                                      └→ failed  (tx revert / upload err)
//
// Aggregate emits:
//   onItemProgress(itemId, state, detail?) — every transition
//   onItemConfirmed(...)                    — when an item lands on-chain
//   onAllDone({ confirmed, failed })        — at the end of the batch
//
// The caller decides what to do with partial failures (retry UI, toast, etc.).
"use client";

import { useCallback, useRef, useState } from "react";
import { type PendingItem } from "@/state/board";
import { type Rect, hasOverlap, isTouching, rectCells } from "@/lib/grid";
import { worldToContractRect } from "@/lib/boardSpace";
import { uploadImage } from "@/lib/ipfs";
import { normalizeCidString } from "@/lib/board";
import { parseWeb3Error, isUserRejection } from "@/lib/errors";
import { mapWithConcurrencySettled } from "@/lib/concurrency";

export type SubmitItemState =
  | "queued"
  | "validating"
  | "uploading"
  | "signing"
  | "confirmed"
  | "rejected"
  | "failed";

export type SubmitItemStatus = {
  id: string;
  name: string;
  state: SubmitItemState;
  detail?: string;
  txHash?: string;
  proposalId?: number | null;
  cid?: string;
  /**
   * For `confirmed` items, a stable data URL the consumer can hand straight
   * to the celebration. Guaranteed to survive any subsequent blob revoke
   * because it was captured before the submit loop continued.
   */
  stablePreviewUrl?: string;
};

export type SubmitBatchResult = {
  confirmed: SubmitItemStatus[];
  failed: SubmitItemStatus[];
  rejected: SubmitItemStatus[];
};

export type UseProposalSubmitInput = {
  address: `0x${string}` | undefined;
  propose: (args: {
    ipfsCid: string;
    x: number;
    y: number;
    w: number;
    h: number;
  }) => Promise<{
    txHash: string;
    receipt: unknown;
    proposalId: number | null;
  }>;
  /** Currently-pending items from the board store. */
  items: PendingItem[];
  /** Rects already occupying the board (canonized + voting). */
  occupiedRects: Rect[];
  /** Called once for every item transition — drive toasts/badges here. */
  onItemProgress?: (status: SubmitItemStatus) => void;
  /** Called once per successfully confirmed item — used to trigger celebration. */
  onItemConfirmed?: (status: SubmitItemStatus, item: PendingItem) => void;
  /** Called when the whole batch is done (success, fail, or mixed). */
  onBatchDone?: (result: SubmitBatchResult) => void;
};

export type UseProposalSubmitReturn = {
  submitting: boolean;
  submit: () => Promise<SubmitBatchResult>;
  statuses: Record<string, SubmitItemStatus>;
  /**
   * Mark an item as cancelled so the in-flight submit loop will skip it.
   *
   * Cancellation semantics (B1 hotfix):
   *  - The submit loop captures `items` in its closure at call time. Without
   *    this escape hatch, clicking × on a pending card mid-upload would still
   *    cause the loop to upload + propose it, spending the user's ETH on an
   *    item they already removed from the tray.
   *  - `cancelItem(id)` adds the id to a ref-held Set. The submit loop checks
   *    the Set at two points: (a) before the upload phase kicks off for that
   *    item, and (b) before the per-item propose() call. Either hit short-
   *    circuits to a `rejected` status with detail "removed from tray".
   *  - Callers should call `cancelItem(p.id)` BEFORE calling `removePending`
   *    — otherwise the item can leave the tray while the loop is still
   *    holding its id, and the pre-upload check will miss it.
   *  - The Set is cleared at the start of every new submit() run so stale
   *    cancellations from a previous batch don't bleed forward.
   */
  cancelItem: (id: string) => void;
};

async function getPendingBytes(p: PendingItem): Promise<ArrayBuffer> {
  if (p.file) return await p.file.arrayBuffer();
  const res = await fetch(p.previewUrl);
  if (!res.ok) throw new Error("Failed to read pending asset");
  return res.arrayBuffer();
}

/**
 * Convert a blob:/http:/data: URL into a self-contained data URL so it
 * survives any subsequent `URL.revokeObjectURL` call. The conversion is
 * synchronous to the submit loop: we block on it between confirmation and
 * emitting the `confirmed` status so that consumer callbacks (e.g. firing
 * the celebration) never see a dead blob URL.
 */
async function toStablePreviewUrl(url: string | undefined): Promise<string> {
  if (!url) return "";
  if (!url.startsWith("blob:")) return url;
  try {
    const resp = await fetch(url);
    const blob = await resp.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error ?? new Error("FileReader failed"));
      reader.readAsDataURL(blob);
    });
  } catch {
    // Fallback: return whatever we had. Better to celebrate with a possibly
    // revoked URL than to swallow the success silently.
    return url;
  }
}

export function useProposalSubmit({
  address,
  propose,
  items,
  occupiedRects,
  onItemProgress,
  onItemConfirmed,
  onBatchDone,
}: UseProposalSubmitInput): UseProposalSubmitReturn {
  const [submitting, setSubmitting] = useState(false);
  const [statuses, setStatuses] = useState<Record<string, SubmitItemStatus>>({});
  const onProgressRef = useRef(onItemProgress);
  const onConfirmedRef = useRef(onItemConfirmed);
  const onDoneRef = useRef(onBatchDone);
  onProgressRef.current = onItemProgress;
  onConfirmedRef.current = onItemConfirmed;
  onDoneRef.current = onBatchDone;

  // B1 hotfix — ids cancelled mid-submit. Ref (not state) so a re-render
  // cycle never clobbers a cancellation the submit loop hasn't read yet.
  const cancelledRef = useRef<Set<string>>(new Set());

  const cancelItem = useCallback((id: string) => {
    cancelledRef.current.add(id);
  }, []);

  const emit = useCallback((s: SubmitItemStatus) => {
    setStatuses((prev) => ({ ...prev, [s.id]: s }));
    onProgressRef.current?.(s);
  }, []);

  const submit = useCallback(async (): Promise<SubmitBatchResult> => {
    if (submitting) {
      return { confirmed: [], failed: [], rejected: [] };
    }
    if (!items.length) {
      return { confirmed: [], failed: [], rejected: [] };
    }
    if (!address) {
      throw new Error("No wallet connected");
    }

    setSubmitting(true);
    setStatuses({});
    // Fresh batch → forget any cancellations carried over from a prior run.
    cancelledRef.current = new Set();

    const confirmed: SubmitItemStatus[] = [];
    const failed: SubmitItemStatus[] = [];
    const rejected: SubmitItemStatus[] = [];

    // Sentinel used to flag upload-phase cancellations so the serial propose
    // loop below can distinguish them from real upload failures.
    const CANCELLED_SENTINEL = "__FOID_CANCELLED__";

    try {
      // ----- Phase 1: client-side validation across the whole batch -----
      const pendingRects = items.map((it) => ({ name: it.name, rect: { ...it.rect } }));

      const overlapNames: string[] = [];
      pendingRects.forEach((c, idx) => {
        const peers = pendingRects.filter((_, j) => j !== idx).map((r) => r.rect);
        if (hasOverlap(c.rect, occupiedRects) || hasOverlap(c.rect, peers)) {
          overlapNames.push(c.name);
        }
      });
      if (overlapNames.length) {
        throw new Error(`Overlap: ${overlapNames.join(", ")}`);
      }

      const notTouchingNames: string[] = [];
      pendingRects.forEach((c, idx) => {
        const peers = pendingRects.filter((_, j) => j !== idx).map((r) => r.rect);
        if (!isTouching(c.rect, [...occupiedRects, ...peers])) {
          notTouchingNames.push(c.name);
        }
      });
      if (notTouchingNames.length) {
        throw new Error(`Not touching board: ${notTouchingNames.join(", ")}`);
      }

      // ----- Phase 2a: parallel IPFS uploads (bounded concurrency = 4) -----
      //
      // Uploads are I/O bound and independent — fan them out. Each slot hits
      // /api/ipfs-upload → Pinata, which tolerates concurrent requests well.
      // Items that fail validation are skipped locally, not sent to upload.
      const validItems: PendingItem[] = [];
      for (const it of items) {
        // B1: if the user removed this card during validation (extremely
        // tight race, but possible with multi-item batches + fast clicks),
        // mark it rejected and skip.
        if (cancelledRef.current.has(it.id)) {
          const s: SubmitItemStatus = {
            id: it.id,
            name: it.name,
            state: "rejected",
            detail: "removed from tray",
          };
          emit(s);
          rejected.push(s);
          continue;
        }
        emit({ id: it.id, name: it.name, state: "validating" });
        if (!rectCells(it.rect)) {
          const s: SubmitItemStatus = {
            id: it.id,
            name: it.name,
            state: "failed",
            detail: "rect has no cells",
          };
          emit(s);
          failed.push(s);
          continue;
        }
        validItems.push(it);
      }

      const uploadResults = await mapWithConcurrencySettled(
        validItems,
        4,
        async (it) => {
          // B1: pre-upload cancel check. If the user clicked × while we were
          // queued behind another upload slot, throw the sentinel so the
          // propose loop below knows to emit "rejected" instead of "failed".
          if (cancelledRef.current.has(it.id)) {
            throw new Error(CANCELLED_SENTINEL);
          }
          emit({ id: it.id, name: it.name, state: "uploading" });
          const file =
            it.file ||
            new File([await getPendingBytes(it)], it.name, { type: it.mime });
          const cid = await uploadImage(it.name, file, it.mime);
          if (!cid) throw new Error("IPFS upload disabled");
          return { cid: normalizeCidString(cid) };
        }
      );

      // ----- Phase 2b: per-item propose(), serial -----
      //
      // Wallets don't let us batch N signatures into one prompt yet (that's
      // the EIP-5792 follow-up PR). We serialize so the user sees one popup
      // at a time and can cancel mid-batch cleanly.
      for (let i = 0; i < validItems.length; i++) {
        const it = validItems[i];
        const uploadRes = uploadResults[i];

        if (uploadRes.status === "rejected") {
          // B1: upload phase threw the cancellation sentinel. This is a
          // user-initiated removal, not a real upload failure — emit
          // rejected so toasts/log stay truthful and no ETH gets spent.
          const reason = uploadRes.reason;
          const isCancelled =
            reason instanceof Error && reason.message === CANCELLED_SENTINEL;
          if (isCancelled) {
            const s: SubmitItemStatus = {
              id: it.id,
              name: it.name,
              state: "rejected",
              detail: "removed from tray",
            };
            emit(s);
            rejected.push(s);
            continue;
          }
          const s: SubmitItemStatus = {
            id: it.id,
            name: it.name,
            state: "failed",
            detail: `Upload failed: ${parseWeb3Error(uploadRes.reason).message ?? "unknown"}`,
          };
          emit(s);
          failed.push(s);
          continue;
        }

        // B1: pre-propose cancel check. Uploads succeed quickly; the real
        // danger is the user clicking × between the upload completing and
        // the wallet popup appearing. Without this guard the sign-and-spend
        // prompt still fires for a card that's no longer in the tray.
        if (cancelledRef.current.has(it.id)) {
          const s: SubmitItemStatus = {
            id: it.id,
            name: it.name,
            state: "rejected",
            detail: "removed from tray",
          };
          emit(s);
          rejected.push(s);
          continue;
        }

        const normalizedCid = uploadRes.value.cid;
        const onChainRect = worldToContractRect(it.rect);

        emit({
          id: it.id,
          name: it.name,
          state: "signing",
          cid: normalizedCid,
        });

        let onChain: { txHash: string; proposalId: number | null };
        try {
          const result = await propose({
            ipfsCid: normalizedCid,
            x: onChainRect.x,
            y: onChainRect.y,
            w: onChainRect.w,
            h: onChainRect.h,
          });
          onChain = { txHash: result.txHash, proposalId: result.proposalId };
        } catch (err) {
          if (isUserRejection(err)) {
            const s: SubmitItemStatus = {
              id: it.id,
              name: it.name,
              state: "rejected",
              detail: "Transaction cancelled",
              cid: normalizedCid,
            };
            emit(s);
            rejected.push(s);
            // User rejected — the rest of the batch stays queued for retry.
            for (let j = i + 1; j < validItems.length; j++) {
              const rest = validItems[j];
              const restUpload = uploadResults[j];
              const queuedStatus: SubmitItemStatus = {
                id: rest.id,
                name: rest.name,
                state: "queued",
                cid:
                  restUpload.status === "fulfilled"
                    ? restUpload.value.cid
                    : undefined,
              };
              emit(queuedStatus);
            }
            break;
          }
          const s: SubmitItemStatus = {
            id: it.id,
            name: it.name,
            state: "failed",
            detail: parseWeb3Error(err).message ?? "Transaction failed",
            cid: normalizedCid,
          };
          emit(s);
          failed.push(s);
          continue;
        }

        // Capture a stable preview URL BEFORE advancing — this closes the
        // race where a downstream `clearBoardState()` could revoke the blob
        // URL while an async consumer callback (e.g. the celebration) was
        // still mid-fetch. See audit note P0-1.
        const stablePreviewUrl = await toStablePreviewUrl(it.previewUrl);

        const confirmedStatus: SubmitItemStatus = {
          id: it.id,
          name: it.name,
          state: "confirmed",
          cid: normalizedCid,
          txHash: onChain.txHash,
          proposalId: onChain.proposalId,
          stablePreviewUrl,
        };
        emit(confirmedStatus);
        confirmed.push(confirmedStatus);
        onConfirmedRef.current?.(confirmedStatus, it);
      }

      const result = { confirmed, failed, rejected };
      onDoneRef.current?.(result);
      return result;
    } finally {
      setSubmitting(false);
    }
  }, [address, items, occupiedRects, propose, submitting, emit]);

  return { submitting, submit, statuses, cancelItem };
}
