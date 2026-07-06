// src/components/ui/Modal.tsx
// Shared modal primitive — window-elevation glass over a blurred backdrop,
// portaled to <body> at the modal z tier. Replaces per-page modal markup so
// every dialog shares one material, one enter animation, one focus contract.
//
//   <Modal open={open} onClose={close} label="Review proposals">
//     …content…
//   </Modal>
//
// Behavior: Escape closes, backdrop click closes (disable via
// closeOnBackdrop={false}), body scroll locks while open, focus moves into
// the dialog on open and returns to the opener on close. Animation timing
// comes from --foid-motion-* so reduced-motion flattens it automatically.
"use client";

import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export type ModalProps = {
  open: boolean;
  onClose: () => void;
  /** Accessible name for the dialog (aria-label). */
  label: string;
  children: React.ReactNode;
  /** Click on the backdrop dismisses. Default true. */
  closeOnBackdrop?: boolean;
  /** Max content width. Default 560px. */
  maxWidth?: number;
  className?: string;
};

export function Modal({
  open,
  onClose,
  label,
  children,
  closeOnBackdrop = true,
  maxWidth = 560,
  className = "",
}: ModalProps) {
  const [mounted, setMounted] = useState(false);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const openerRef = useRef<HTMLElement | null>(null);

  useEffect(() => setMounted(true), []);

  // Escape to close.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Scroll lock + focus management.
  useEffect(() => {
    if (!open) return;
    openerRef.current = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panelRef.current?.focus();
    return () => {
      document.body.style.overflow = prevOverflow;
      openerRef.current?.focus?.();
    };
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
        className={`foid-modal ${className}`.trim()}
        style={{ maxWidth }}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}
