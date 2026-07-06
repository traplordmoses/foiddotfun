// src/components/ui/Sheet.tsx
// Shared bottom-sheet primitive — portaled to <body>, one backdrop, one
// slide-up entry, one drag-to-dismiss gesture, one focus contract. Extracted
// from PrayerJournalDrawer so every mobile sheet shares the same behavior.
//
//   <Sheet open={open} onClose={close} label="Prayer journey"
//          className="journal-sheet" backdropClassName="journal-backdrop">
//     …content…
//   </Sheet>
//
// Ownership split: Sheet owns chrome and behavior — backdrop, bottom
// positioning, slide-up/drag motion, focus trap + restore, Escape, body
// scroll lock, safe-area padding, dialog aria. Material (background, border,
// radius, shadow, z-index) comes from the caller via className /
// backdropClassName so bespoke sheets keep their pixels; the default
// backdrop reuses the modal dimmer (.foid-modal-backdrop) bottom-aligned
// via .foid-modal-backdrop--sheet.
//
// Behavior: Escape closes (`onEscape` overrides, e.g. to close an inner
// popover first), backdrop click closes, dragging down past 80px or with
// velocity > 350 dismisses, body scroll locks while open, Tab is trapped
// inside the panel, focus moves to `initialFocusRef` (or the first
// focusable) on open and returns to the opener on close. Reduced motion
// swaps the spring for a quick tween and drops the backdrop fade —
// button/Escape dismissal is unaffected.
"use client";

import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export type SheetProps = {
  open: boolean;
  onClose: () => void;
  /** Accessible name for the dialog (aria-label). */
  label: string;
  children: React.ReactNode;
  /** Max panel height. Default "82dvh". */
  maxHeight?: string;
  /** Panel class — owns the material (background, border, radius, z-index). */
  className?: string;
  /** Backdrop class. Default: the modal dimmer, bottom-aligned. */
  backdropClassName?: string;
  /** Element to focus when the sheet opens (e.g. its close button). */
  initialFocusRef?: React.RefObject<HTMLElement>;
  /** Override what Escape does (default: onClose). Lets callers close an
   *  inner layer — a popover, say — before the sheet itself. */
  onEscape?: () => void;
};

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function Sheet({
  open,
  onClose,
  label,
  children,
  maxHeight = "82dvh",
  className = "",
  backdropClassName = "foid-modal-backdrop foid-modal-backdrop--sheet",
  initialFocusRef,
  onEscape,
}: SheetProps) {
  const [mounted, setMounted] = useState(false);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  // Reduced-motion: swap the spring enter/exit for a quick tween so RM users
  // don't get the bounce, and drop the backdrop fade to match.
  const reduceMotion = useReducedMotion();
  const panelTransition = reduceMotion
    ? { duration: 0.15 }
    : { type: "spring" as const, damping: 28, stiffness: 260 };
  const backdropTransition = reduceMotion ? { duration: 0 } : { duration: 0.2 };

  useEffect(() => setMounted(true), []);

  // Esc to close — `onEscape` overrides so callers can peel inner layers
  // (popovers) before dismissing the sheet itself.
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      (onEscape ?? onClose)();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose, onEscape]);

  // Lock body scroll when open
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Focus management: on open, remember what was focused, move focus into
  // the dialog (initialFocusRef, else the first focusable), and trap Tab
  // within the panel. On close, restore focus to whatever was focused
  // before. This gives keyboard + AT users a proper modal contract: focus
  // starts inside, can't Tab out, returns home.
  useEffect(() => {
    if (!open) return;

    previouslyFocusedRef.current =
      typeof document !== "undefined"
        ? (document.activeElement as HTMLElement | null)
        : null;

    // Defer focus one frame so framer-motion has mounted the panel.
    const rafId = requestAnimationFrame(() => {
      const target =
        initialFocusRef?.current ??
        panelRef.current?.querySelector<HTMLElement>(FOCUSABLE);
      target?.focus();
    });

    const trap = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const panel = panelRef.current;
      if (!panel) return;
      const focusables = panel.querySelectorAll<HTMLElement>(FOCUSABLE);
      if (focusables.length === 0) {
        e.preventDefault();
        initialFocusRef?.current?.focus();
        return;
      }
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (e.shiftKey) {
        if (active === first || !panel.contains(active)) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (active === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener("keydown", trap);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener("keydown", trap);
      // Restore focus to whatever was focused before the sheet opened.
      const prev = previouslyFocusedRef.current;
      if (prev && typeof prev.focus === "function") {
        prev.focus();
      }
      previouslyFocusedRef.current = null;
    };
    // initialFocusRef is a ref container — reading .current at effect time
    // is the point; the ref identity itself is stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className={backdropClassName}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={backdropTransition}
            onClick={onClose}
          />
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label={label}
            className={className}
            style={{
              position: "fixed",
              left: 0,
              right: 0,
              bottom: 0,
              display: "flex",
              flexDirection: "column",
              maxHeight,
              paddingBottom: "max(env(safe-area-inset-bottom), 12px)",
              overflow: "hidden",
            }}
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={panelTransition}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={0.18}
            onDragEnd={(_, info) => {
              if (info.offset.y > 80 || info.velocity.y > 350) onClose();
            }}
          >
            {children}
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
}
