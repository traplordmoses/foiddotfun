'use client';

// First-visit coach mark for the mobile board. Replaces the old blocking
// "Quick Tutorial" modal that sat on top of an empty, blurred board before
// anything had rendered. This is a single line anchored above the dock,
// it never blocks the canvas, and it dismisses on the first real gesture.
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

interface GestureHintProps {
  storageKey: string;
  hints: string[];
}

const AUTO_DISMISS_MS = 9000;

export function GestureHint({ storageKey, hints }: GestureHintProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Mobile only (matches the lg:hidden breakpoint at 1024px).
    if (!window.matchMedia('(max-width: 1023px)').matches) return;
    let seen = false;
    try {
      seen = localStorage.getItem(storageKey) === 'true';
    } catch {
      seen = false;
    }
    if (seen) return;
    const show = window.setTimeout(() => setIsVisible(true), 600);
    return () => window.clearTimeout(show);
  }, [storageKey]);

  useEffect(() => {
    if (!isVisible) return;
    const dismiss = () => {
      setIsVisible(false);
      try {
        localStorage.setItem(storageKey, 'true');
      } catch {
        /* private mode */
      }
    };
    const timer = window.setTimeout(dismiss, AUTO_DISMISS_MS);
    // The first gesture on the board is the lesson landing; the hint goes.
    const opts: AddEventListenerOptions = { capture: true, passive: true, once: true };
    window.addEventListener('pointerdown', dismiss, opts);
    window.addEventListener('wheel', dismiss, opts);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('pointerdown', dismiss, opts);
      window.removeEventListener('wheel', dismiss, opts);
    };
  }, [isVisible, storageKey]);

  if (!mounted || !isVisible) return null;

  const content = (
    <div
      role="status"
      aria-live="polite"
      className="gesture-hint"
      style={{
        position: 'fixed',
        left: 12,
        right: 12,
        bottom: 'calc(92px + env(safe-area-inset-bottom, 0px))',
        zIndex: 60,
        display: 'flex',
        justifyContent: 'center',
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          maxWidth: 420,
          padding: '10px 14px',
          borderRadius: 14,
          border: '1px solid rgba(255,255,255,0.18)',
          background: 'rgba(8, 14, 30, 0.82)',
          color: 'rgba(255,255,255,0.92)',
          fontSize: 13,
          lineHeight: 1.45,
          textAlign: 'center',
          boxShadow: '0 12px 30px rgba(0, 10, 30, 0.45)',
        }}
      >
        {hints.join('  ·  ')}
      </div>
    </div>
  );

  return createPortal(content, document.body);
}
