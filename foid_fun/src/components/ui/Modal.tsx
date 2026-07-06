// src/components/ui/Modal.tsx
// Shared modal primitive — portaled to <body> at the modal z tier, one
// backdrop, one enter animation, one focus contract. Replaces per-page
// modal scaffolding (BatchReviewModal, MobileProposeModal, …) so every
// dialog shares the same material and behavior.
//
//   <Modal open={open} onClose={close} label="Review proposals">
//     …content…
//   </Modal>
//
// Variants (both are sanctioned materials from tokens.css):
//   glass (default) — window-elevation aero glass; general dialogs
//   slab            — dark terminal slab (--foid-shadow-slab); confirm /
//                     ceremony dialogs on dark rooms (board, pray)
//
// Behavior: Escape closes, backdrop click closes (closeOnBackdrop={false}
// to disable), body scroll locks while open, Tab is trapped inside the
// dialog, focus moves to `initialFocusRef` (or the panel) on open and
// returns to the opener on close. Animation timing comes from
// --foid-motion-* so reduced-motion flattens it automatically.
"use client";

import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export type ModalVariant = "glass" | "slab";

export type ModalProps = {
  open: boolean;
  onClose: () => void;
  /** Accessible name for the dialog (aria-label). */
  label: string;
  children: React.ReactNode;
  /** Material variant. Default "glass". */
  variant?: ModalVariant;
  /** Click on the backdrop dismisses. Default true. */
  closeOnBackdrop?: boolean;
  /** Element to focus when the dialog opens (e.g. the primary CTA). */
  initialFocusRef?: React.RefObject<HTMLElement>;
  /** Max content width. Default 560px. */
  maxWidth?: number;
  className?: string;
};

const FOCUSABLE =
  'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

export function Modal({
  open,
  onClose,
  label,
  children,
  variant = "glass",
  closeOnBackdrop = true,
  initialFocusRef,
  maxWidth = 560,
  className = "",
}: ModalProps) {
  const [mounted, setMounted] = useState(false);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const openerRef = useRef<HTMLElement | null>(null);

  useEffect(() => setMounted(true), []);

  // Escape closes; Tab cycles inside the panel (focus trap).
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key !== "Tab") return;
      const panel = panelRef.current;
      if (!panel) return;
      const focusable = panel.querySelectorAll<HTMLElement>(FOCUSABLE);
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
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Scroll lock + focus management.
  useEffect(() => {
    if (!open) return;
    openerRef.current = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    (initialFocusRef?.current ?? panelRef.current)?.focus();
    return () => {
      document.body.style.overflow = prevOverflow;
      openerRef.current?.focus?.();
    };
    // initialFocusRef is a ref container — reading .current at effect time
    // is the point; the ref identity itself is stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!mounted || !open) return null;

  return createPortal(
    <div
      className="foid-modal-backdrop"
      onMouseDown={(e) => {
        if (closeOnBackdrop && e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        className={`foid-modal foid-modal--${variant} ${className}`.trim()}
        style={{ maxWidth }}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}
