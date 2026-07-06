// src/stores/windowStore.ts
// FOID OS window state — one window per route (the current page's .exe).
// The titlebar controls, dock, and frame controller all read/write here so
// minimize/restore round-trips work across components.
//
// Stage 1 of the window manager: a single managed window. When apps are
// extracted into a desktop shell (multi-window), this becomes a keyed map.
import { create } from "zustand";

export type WindowPos = { x: number; y: number };
export type WindowSize = { w: number; h: number };

type WindowStore = {
  /** Hidden to the dock. The wallpaper (and dock) are all that remain. */
  minimized: boolean;
  /** Filling the viewport (minus dock clearance). */
  maximized: boolean;
  /** Drag offset from the window's natural (centered) position. */
  pos: WindowPos;
  /** User-resized dimensions; null = the page's own default sizing. */
  size: WindowSize | null;
  minimize: () => void;
  restore: () => void;
  toggleMaximize: () => void;
  setPos: (pos: WindowPos) => void;
  setSize: (size: WindowSize | null) => void;
  /** Route change = a fresh window: forget drag/resize/minimize state. */
  resetForRoute: () => void;
};

export const useWindowStore = create<WindowStore>((set) => ({
  minimized: false,
  maximized: false,
  pos: { x: 0, y: 0 },
  size: null,
  minimize: () => set({ minimized: true }),
  restore: () => set({ minimized: false }),
  toggleMaximize: () =>
    set((s) => ({ maximized: !s.maximized, minimized: false })),
  setPos: (pos) => set({ pos }),
  setSize: (size) => set({ size }),
  resetForRoute: () =>
    set({ minimized: false, maximized: false, pos: { x: 0, y: 0 }, size: null }),
}));
