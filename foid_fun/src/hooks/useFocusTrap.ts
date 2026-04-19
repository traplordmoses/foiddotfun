// src/hooks/useFocusTrap.ts
// Shared focus-trap + restore hook. Extracted from the inline pattern in
// BatchReviewModal so PaintEditor, PlacementModal, and PlacementCelebration
// behave identically for keyboard + screen-reader users:
//   - On mount, the previously-focused element is remembered.
//   - On mount, focus is moved to `initialFocus?.current` if provided, else
//     the first focusable descendant of `containerRef`.
//   - While mounted, Tab / Shift+Tab wrap inside the container.
//   - On unmount, focus is restored to the previously-focused element.
//
// WCAG 2.2 SC 2.4.3 (Focus Order), SC 2.1.2 (No Keyboard Trap — our trap is
// scoped to an open dialog and releases on unmount, which is the
// dialog-specific exception the guideline allows).
"use client";

import { useEffect, type RefObject } from "react";

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export type UseFocusTrapOptions = {
  /** When false, the trap is inert. Default true. */
  active?: boolean;
  /**
   * Element to receive focus on mount. If omitted, the first focusable
   * descendant of `containerRef` is used.
   */
  initialFocus?: RefObject<HTMLElement | null>;
  /**
   * Called when the user presses Escape inside the trap. Omit for dialogs
   * that use an explicit Cancel button only.
   */
  onEscape?: () => void;
};

export function useFocusTrap(
  containerRef: RefObject<HTMLElement | null>,
  { active = true, initialFocus, onEscape }: UseFocusTrapOptions = {},
) {
  useEffect(() => {
    if (!active) return;
    const container = containerRef.current;
    if (!container) return;

    // Remember where focus was so we can restore it on unmount. This matters
    // for keyboard users returning to the trigger button — without restore
    // they land on <body>, losing their spot in the reading order.
    const previouslyFocused = document.activeElement as HTMLElement | null;

    // Move focus in on the next tick so the element is actually present in
    // the DOM (some dialogs render async children).
    const focusTarget =
      initialFocus?.current ??
      container.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
    focusTarget?.focus?.();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && onEscape) {
        e.preventDefault();
        onEscape();
        return;
      }
      if (e.key !== "Tab") return;
      const focusable = container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      // Restore focus only if it's still inside the trap (the user may have
      // already moved it elsewhere by the time we unmount).
      if (container.contains(document.activeElement)) {
        previouslyFocused?.focus?.();
      }
    };
    // We deliberately don't include initialFocus / onEscape in deps — they
    // come from refs/callbacks the caller should keep stable. Re-binding the
    // trap on every render would re-focus and re-break the Escape handler.
  }, [active, containerRef, initialFocus, onEscape]);
}
