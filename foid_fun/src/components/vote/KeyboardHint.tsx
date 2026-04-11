"use client";

import { useCallback, useEffect, useState } from "react";

export function KeyboardHint() {
  const [visible, setVisible] = useState(false);
  const [manualToggle, setManualToggle] = useState(false);

  useEffect(() => {
    const key = "foid-kbd-hint-seen";
    if (typeof window === "undefined") return;
    if ("ontouchstart" in window) return;
    if (localStorage.getItem(key)) return;
    setVisible(true);
    localStorage.setItem(key, "1");
    const t = setTimeout(() => setVisible(false), 4000);
    return () => clearTimeout(t);
  }, []);

  const toggle = useCallback(() => {
    setManualToggle((prev) => !prev);
  }, []);

  const showHints = visible || manualToggle;

  return (
    <>
      {/* Toggle button — always visible on desktop */}
      {typeof window !== "undefined" && !("ontouchstart" in (typeof window !== "undefined" ? window : {})) && (
        <button
          onClick={toggle}
          aria-label="Toggle keyboard shortcuts"
          className="fixed bottom-8 right-8 z-40 w-8 h-8 flex items-center justify-center rounded-full border border-white/10 bg-neutral-900/60 text-white/40 hover:text-white/70 hover:bg-neutral-800/80 transition text-xs font-bold"
        >
          ?
        </button>
      )}
      {showHints && (
        <div
          className="fixed bottom-[52px] right-8 z-40 rounded-xl border border-white/10 bg-neutral-900/80 backdrop-blur-md px-4 py-3 text-[11px] text-white/50 space-y-1"
          style={{ animation: !manualToggle ? "kbd-fade 4s ease-in forwards" : undefined }}
          role="complementary"
          aria-label="Keyboard shortcuts"
        >
          <div className="text-white/70 font-semibold mb-1">Keyboard shortcuts</div>
          <div><kbd className="bg-white/10 rounded px-1 font-mono">&larr;</kbd> <kbd className="bg-white/10 rounded px-1 font-mono">&rarr;</kbd> Vote</div>
          <div><kbd className="bg-white/10 rounded px-1 font-mono">Space</kbd> Skip</div>
          <div><kbd className="bg-white/10 rounded px-1 font-mono">Z</kbd> Undo</div>
          <div><kbd className="bg-white/10 rounded px-1 font-mono">Enter</kbd> Details</div>
        </div>
      )}
    </>
  );
}
