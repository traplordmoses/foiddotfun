"use client";

import { useEffect, useState } from "react";

export function UndoPill({ visible, onUndo }: { visible: boolean; onUndo: () => void }) {
  const [show, setShow] = useState(false);
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    if (visible) {
      setShow(true);
      setExiting(false);
      const t = setTimeout(() => {
        setExiting(true);
        setTimeout(() => setShow(false), 300);
      }, 3000);
      return () => clearTimeout(t);
    } else {
      setExiting(true);
      const t = setTimeout(() => setShow(false), 300);
      return () => clearTimeout(t);
    }
  }, [visible]);

  if (!show) return null;
  return (
    <button
      onClick={() => { onUndo(); setShow(false); }}
      aria-label="Undo last vote (press Z)"
      aria-keyshortcuts="z"
      className="fixed bottom-24 left-1/2 z-50 flex items-center gap-2 rounded-full border border-white/15 bg-neutral-900/80 px-4 py-2 text-xs font-semibold text-white/70 backdrop-blur-md hover:bg-neutral-800/90 hover:text-white/90 transition-colors"
      style={{
        transform: "translateX(-50%)",
        animation: exiting ? "undo-exit 300ms ease-in forwards" : "undo-enter 300ms ease-out forwards",
        boxShadow: "0 4px 20px rgba(0,0,0,.4)",
      }}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>
      Undo <span className="text-white/30 ml-0.5">(Z)</span>
    </button>
  );
}
