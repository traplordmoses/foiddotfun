"use client";

// src/apps/finderChrome.tsx
// Finder chrome shared by FILES.EXE and ABOUT.EXE (both render the .files-*
// anatomy in src/app/files/files.css):
//   - a collapsible sidebar: it follows the window (inline when there is
//     room, hidden on a narrow window) until the toolbar toggle pins it open
//     or closed. Pinned open on a narrow window it is a drawer over the
//     files, and picking a place closes it again.
//   - one tap to open on touch screens. A phone has no double tap, and a
//     selection highlight alone reads as "nothing happened". Mouse keeps
//     Finder's select, then double-click to open.

import { useCallback, useEffect, useRef, useState, type PointerEvent } from "react";

/** At or below this window width the sidebar is a drawer, hidden until
 *  opened. Matches `@container foid-window (max-width: 620px)` in files.css. */
export const FINDER_NARROW_MAX = 620;

type Pin = "open" | "closed" | null;

export function useFinderSidebar() {
  const shellRef = useRef<HTMLDivElement | null>(null);
  const [pin, setPin] = useState<Pin>(null);
  const [narrow, setNarrow] = useState(false);

  useEffect(() => {
    const shell = shellRef.current;
    if (!shell || typeof ResizeObserver === "undefined") return;
    // The container queries measure the window frame, so measure it too.
    const frame = (shell.closest(".vista-window") as HTMLElement | null) ?? shell;
    const update = () => setNarrow(frame.clientWidth <= FINDER_NARROW_MAX);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(frame);
    return () => observer.disconnect();
  }, []);

  const shown = pin ? pin === "open" : !narrow;
  const drawerOpen = narrow && pin === "open";

  const toggle = useCallback(() => setPin(shown ? "closed" : "open"), [shown]);
  const close = useCallback(() => setPin(narrow ? null : "closed"), [narrow]);
  /** Picking a place in the drawer closes it. */
  const afterNavigate = useCallback(() => {
    if (narrow) setPin(null);
  }, [narrow]);

  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPin(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [drawerOpen]);

  return {
    shellRef,
    shellClass: pin ? ` files-shell--sidebar-${pin}` : "",
    shown,
    drawerOpen,
    toggle,
    close,
    afterNavigate,
  };
}

/** Remembers how the last press started, so a click handler can open on a
 *  finger tap and only select on a mouse click. */
export function useTapToOpen() {
  const pointerType = useRef<string>("mouse");
  const onPointerDown = useCallback((e: PointerEvent) => {
    pointerType.current = e.pointerType;
  }, []);
  const tapped = useCallback(() => pointerType.current === "touch" || pointerType.current === "pen", []);
  return { onPointerDown, tapped };
}

export function FinderSidebarToggle({
  shown,
  onToggle,
  controls,
}: {
  shown: boolean;
  onToggle: () => void;
  controls: string;
}) {
  return (
    <button
      type="button"
      className={`files-navbtn files-sidebar-toggle${shown ? " files-sidebar-toggle--on" : ""}`}
      aria-label={shown ? "Hide sidebar" : "Show sidebar"}
      title={shown ? "Hide sidebar" : "Show sidebar"}
      aria-expanded={shown}
      aria-controls={controls}
      onClick={onToggle}
    >
      <svg
        width={14}
        height={14}
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.4}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <rect x="1.75" y="2.75" width="12.5" height="10.5" rx="2" />
        <path d="M6 2.75v10.5" />
        <path d="M3.4 5.4h1.1M3.4 7.6h1.1" />
      </svg>
    </button>
  );
}
