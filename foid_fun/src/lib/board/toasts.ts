// /src/lib/board/toasts.ts
// Thin wrappers around `react-hot-toast` for the board's submit pipeline.
//
// Key behavior: each toast is keyed by the item id so that state transitions
// (uploading → signing → confirmed) REPLACE the existing toast rather than
// stacking a new one. react-hot-toast does this for us when we pass `{ id }`.
//
// Why this exists:
//   - Before Phase 3, status text went into a chat-shaped log in the sidebar.
//     That's fine for debugging but terrible for "did my upload finish?".
//   - Contextual toasts land in the corner of the viewport for a few seconds
//     and auto-dismiss. They're the standard interaction vocabulary users
//     already know from every other dApp.
import toast from "react-hot-toast";
import React from "react";
import { BLOCK_EXPLORER_URL } from "@/lib/contracts";

const TOAST_DURATION = {
  info: 2_400,
  success: 5_000,
  error: 7_000,
} as const;

function toastId(itemId: string): string {
  return `board-item-${itemId}`;
}

/** Loading-spinner toast: "uploading image.png..." */
export function toastUploading(itemId: string, name: string): string {
  return toast.loading(`Uploading ${name}...`, { id: toastId(itemId) });
}

/** Loading-spinner toast: "sign in wallet — image.png" */
export function toastSigning(itemId: string, name: string): string {
  return toast.loading(`Sign in wallet → ${name}`, { id: toastId(itemId) });
}

/** Success toast with Etherscan link, replaces prior loading toast for this item. */
export function toastConfirmed(
  itemId: string,
  name: string,
  txHash: string | undefined
): void {
  if (!txHash) {
    toast.success(`${name} engraved ✓`, {
      id: toastId(itemId),
      duration: TOAST_DURATION.success,
    });
    return;
  }
  toast.success(
    () =>
      React.createElement(
        "span",
        null,
        `${name} engraved ✓ `,
        React.createElement(
          "a",
          {
            href: `${BLOCK_EXPLORER_URL}/tx/${txHash}`,
            target: "_blank",
            rel: "noopener noreferrer",
            style: { textDecoration: "underline", color: "#74ffeb" },
          },
          `${txHash.slice(0, 8)}...`
        )
      ),
    { id: toastId(itemId), duration: TOAST_DURATION.success }
  );
}

/** Failure toast with retry hint. */
export function toastFailed(
  itemId: string,
  name: string,
  detail?: string
): void {
  toast.error(detail ? `${name}: ${detail}` : `${name} failed`, {
    id: toastId(itemId),
    duration: TOAST_DURATION.error,
  });
}

/** Info toast (user-rejection or "kept in tray"). */
export function toastInfo(itemId: string, message: string): void {
  toast(message, {
    id: toastId(itemId),
    icon: "ℹ️",
    duration: TOAST_DURATION.info,
  });
}

/** General-purpose batch-level toast (not keyed to an item). */
export function toastBatch(
  message: string,
  variant: "info" | "success" | "error" = "info"
): void {
  if (variant === "success") {
    toast.success(message, { duration: TOAST_DURATION.success });
  } else if (variant === "error") {
    toast.error(message, { duration: TOAST_DURATION.error });
  } else {
    toast(message, { duration: TOAST_DURATION.info });
  }
}

/** Dismiss any toast we created for this item (e.g. if user removes it from tray). */
export function dismissItemToast(itemId: string): void {
  toast.dismiss(toastId(itemId));
}
