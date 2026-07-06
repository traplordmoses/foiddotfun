// src/stores/windowStore.ts
// FOID OS window state, two generations side by side:
//
//   1. Legacy singleton (useWindowStore) — one window per ROUTE (the current
//      page's .exe). WindowFrame's controls and the dock's restore round-trip
//      read/write it. Unchanged so every un-migrated route behaves exactly
//      as production while the shell rolls out; it retires when the last
//      route app is extracted (plan Stage B/C).
//
//   2. windowStore v2 (useWindowStoreV2) — the multi-window desktop shell's
//      keyed map (docs/foid-os-multiwindow-plan.md §3). One window per app
//      (AppId keys the map directly — founder decision #3), z-order as an
//      ordered array (daedalOS stackOrder, inverted: focused = tail), and a
//      generous safety cap on concurrent windows (founder decision #2).
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

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

/* ============================================================================
   windowStore v2 — the desktop shell's keyed window map (Stage A).
   ============================================================================ */

export type AppId =
  | "home"
  | "pray"
  | "board"
  | "vote"
  | "mifoid"
  | "files"
  | "about"
  | "gallery";

export type OSWindowState = {
  id: AppId;
  status: "open" | "minimized";
  maximized: boolean;
  /** Desktop-relative position (initialized to a cascade slot on open). */
  pos: WindowPos;
  /** User-resized dims; null = the app's registry default sizing. */
  size: WindowSize | null;
  /** Deep-link params handed to the app instance on open (never persisted). */
  params?: Record<string, string>;
  openedAt: number;
  lastFocusedAt: number;
};

type WindowStoreV2 = {
  windows: Partial<Record<AppId, OSWindowState>>;
  /** Back → front. Focused app = zOrder[zOrder.length - 1]. */
  zOrder: AppId[];
  /** "Show desktop" memory: the ids that were open when minimizeAll ran,
   *  so the next Home click restores exactly that set (zOrder is left
   *  untouched, so the previous front window comes back focused).
   *  Session-only — never persisted. */
  showDesktopStash: AppId[] | null;

  /** Create (or restore) a window, then focus it. One instance per app. */
  open: (id: AppId, params?: Record<string, string>) => void;
  /** Red orb: remove the window entirely — app state is discarded. */
  close: (id: AppId) => void;
  /** Bring to front (zOrder tail); restores if minimized. */
  focus: (id: AppId) => void;
  /** Amber orb: park in the dock. Focus falls to the next open window. */
  minimize: (id: AppId) => void;
  /** Un-minimize + focus (dock tile click). Alias of focus. */
  restore: (id: AppId) => void;
  /** HOME dock tile, "show desktop": genie every open window to the dock,
   *  remembering the set for the return trip. No-op when nothing is open. */
  minimizeAll: () => void;
  /** HOME again with everything parked: bring back the stashed set (or
   *  every minimized window when there's no stash, e.g. the user parked
   *  them one by one). Clears the stash. */
  restoreAll: () => void;
  toggleMaximize: (id: AppId) => void;
  setPos: (id: AppId, pos: WindowPos) => void;
  setSize: (id: AppId, size: WindowSize | null) => void;
};

/** Windows live in --foid-z-raised space: base 10, +1 per stack position.
 *  Even a full desktop stays below the dock (--foid-z-nav: 40) and every
 *  overlay/modal tier. */
export const WINDOW_Z_BASE = 10;

/** Founder decision #2: no hard product limit, but a generous engineering
 *  guard on concurrent windows (each one pays a backdrop-filter). */
export const MAX_OPEN_WINDOWS = 6;

/** Spawn cascade — successive windows open offset down-right so a fresh
 *  stack reads as a stack, not a pile of identical frames. */
const CASCADE = { x0: 48, y0: 18, dx: 44, dy: 36 };

/** Persist storage that no-ops on the server / in node tests, so the
 *  persist middleware never warns about unavailable storage. */
const windowStorage = () =>
  typeof window === "undefined"
    ? {
        getItem: () => null,
        setItem: () => undefined,
        removeItem: () => undefined,
      }
    : window.localStorage;

export const useWindowStoreV2 = create<WindowStoreV2>()(
  persist(
    (set, get) => ({
      windows: {},
      zOrder: [],
      showDesktopStash: null,

      open: (id, params) => {
        const s = get();
        const existing = s.windows[id];
        if (existing) {
          // One instance per app: re-open = restore + focus (+ fresh params).
          if (params) {
            set({ windows: { ...s.windows, [id]: { ...existing, params } } });
          }
          get().focus(id);
          return;
        }
        if (Object.keys(s.windows).length >= MAX_OPEN_WINDOWS) return;
        const slot = s.zOrder.length % MAX_OPEN_WINDOWS;
        const now = Date.now();
        const win: OSWindowState = {
          id,
          status: "open",
          maximized: false,
          pos: {
            x: CASCADE.x0 + slot * CASCADE.dx,
            y: CASCADE.y0 + slot * CASCADE.dy,
          },
          size: null,
          params,
          openedAt: now,
          lastFocusedAt: now,
        };
        set({ windows: { ...s.windows, [id]: win }, zOrder: [...s.zOrder, id] });
      },

      close: (id) =>
        set((s) => {
          if (!s.windows[id]) return s;
          const windows = { ...s.windows };
          delete windows[id];
          return { windows, zOrder: s.zOrder.filter((x) => x !== id) };
        }),

      focus: (id) =>
        set((s) => {
          const win = s.windows[id];
          if (!win) return s;
          const atTop = s.zOrder[s.zOrder.length - 1] === id;
          if (atTop && win.status === "open") return s; // no-op: already foreground
          return {
            windows: {
              ...s.windows,
              [id]: { ...win, status: "open", lastFocusedAt: Date.now() },
            },
            zOrder: atTop ? s.zOrder : [...s.zOrder.filter((x) => x !== id), id],
          };
        }),

      minimize: (id) =>
        set((s) => {
          const win = s.windows[id];
          if (!win || win.status === "minimized") return s;
          return {
            windows: { ...s.windows, [id]: { ...win, status: "minimized" } },
          };
        }),

      restore: (id) => get().focus(id),

      minimizeAll: () =>
        set((s) => {
          const openIds = s.zOrder.filter(
            (id) => s.windows[id]?.status === "open",
          );
          if (!openIds.length) return s;
          const windows = { ...s.windows };
          for (const id of openIds) {
            windows[id] = { ...windows[id]!, status: "minimized" };
          }
          return { windows, showDesktopStash: openIds };
        }),

      restoreAll: () =>
        set((s) => {
          // Stash entries may have been closed while parked — drop them.
          const stashed = (s.showDesktopStash ?? []).filter(
            (id) => s.windows[id],
          );
          const ids = stashed.length
            ? stashed
            : s.zOrder.filter((id) => s.windows[id]?.status === "minimized");
          if (!ids.length) {
            return s.showDesktopStash ? { showDesktopStash: null } : s;
          }
          const now = Date.now();
          const windows = { ...s.windows };
          for (const id of ids) {
            windows[id] = {
              ...windows[id]!,
              status: "open",
              lastFocusedAt: now,
            };
          }
          // zOrder untouched: the pre-minimize front window is still the
          // tail among the restored set, so it comes back focused.
          return { windows, showDesktopStash: null };
        }),

      toggleMaximize: (id) =>
        set((s) => {
          const win = s.windows[id];
          if (!win) return s;
          return {
            windows: {
              ...s.windows,
              [id]: { ...win, maximized: !win.maximized, status: "open" },
            },
          };
        }),

      setPos: (id, pos) =>
        set((s) => {
          const win = s.windows[id];
          if (!win) return s;
          return { windows: { ...s.windows, [id]: { ...win, pos } } };
        }),

      setSize: (id, size) =>
        set((s) => {
          const win = s.windows[id];
          if (!win) return s;
          return { windows: { ...s.windows, [id]: { ...win, size } } };
        }),
    }),
    {
      name: "foid-os-windows-v2",
      version: 1,
      storage: createJSONStorage(windowStorage),
      // Layout only — geometry + stacking survive a reload; deep-link params
      // never do. Hydration is deferred (skipHydration) so SSR markup and the
      // dock's first client render agree on an empty desktop; <Desktop/>
      // rehydrates on mount via hydrateWindowStore().
      skipHydration: true,
      partialize: (s) => ({
        zOrder: s.zOrder,
        windows: Object.fromEntries(
          Object.entries(s.windows).map(([id, win]) => [
            id,
            win ? { ...win, params: undefined } : win,
          ]),
        ) as WindowStoreV2["windows"],
      }),
    },
  ),
);

/** Restore the persisted desktop layout — called by <Desktop/> on mount.
 *  Skipped when this session already opened windows (e.g. a dock tile was
 *  clicked from a route before visiting /): the live session wins. */
export function hydrateWindowStore() {
  if (Object.keys(useWindowStoreV2.getState().windows).length === 0) {
    void useWindowStoreV2.persist.rehydrate();
  }
}

/** The foreground app: the topmost zOrder entry that isn't minimized. */
export function focusedAppId(
  s: Pick<WindowStoreV2, "windows" | "zOrder">,
): AppId | undefined {
  for (let i = s.zOrder.length - 1; i >= 0; i--) {
    const id = s.zOrder[i];
    if (s.windows[id]?.status === "open") return id;
  }
  return undefined;
}
