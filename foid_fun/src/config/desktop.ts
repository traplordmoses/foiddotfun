// src/config/desktop.ts
// FOID OS desktop shell switch + shell URL grammar — the single place the
// multi-window shell is gated and the ?apps= deep-link format is defined
// (docs/foid-os-multiwindow-plan.md, Stage C).
//
// Stage C flipped the default: the desktop IS the experience on lg+
// viewports. NEXT_PUBLIC_FOID_DESKTOP is now an emergency opt-OUT — set it
// to "0" to restore the launcher + standalone routes everywhere. Build-time
// constant like NEXT_PUBLIC_IS_MAINNET, so opting out makes every shell
// branch dead code again.
import { MAX_OPEN_WINDOWS, type AppId } from "@/stores/windowStore";

export const FOID_DESKTOP_ENABLED =
  process.env.NEXT_PUBLIC_FOID_DESKTOP !== "0";

/** The shell is a lg:-and-up experience — below this, one app per route
 *  forever (multi-window plan §1, mobile story). Matches the CSS gate on
 *  .foid-window-edge/.foid-window-resize and WindowFrame's drag bail. */
export const DESKTOP_MIN_WIDTH = 1024;

/** True on viewports where the shell may take over. Client-only. */
export function isDesktopViewport(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia(`(min-width: ${DESKTOP_MIN_WIDTH}px)`).matches
  );
}

/** Dock href → shell app id for every extracted app (all six routes are
 *  shell apps as of Stage C). Kept here (not in Desktop.tsx) so the Dock
 *  and route pages can answer "is this a shell app?" without importing
 *  the shell's lazy app registry into every route's bundle. */
const DESKTOP_DOCK_APPS: Readonly<Partial<Record<string, AppId>>> = {
  "/files": "files",
  "/mifoid": "mifoid",
  "/vote": "vote",
  "/about": "about",
  "/pray": "pray",
  "/board": "board",
};

/** Canonical list of app ids the shell can open — the validation registry
 *  for ?apps= deep links. Must stay in sync with Desktop.tsx's component
 *  registry (which additionally filters unknown ids before rendering). */
export const SHELL_APP_IDS: readonly AppId[] = [
  "pray",
  "board",
  "vote",
  "mifoid",
  "files",
  "about",
];

/** Returns the shell AppId for a dock href, or null when the desktop is
 *  opted out (NEXT_PUBLIC_FOID_DESKTOP=0) or the href isn't a shell app. */
export function desktopAppForHref(href: string): AppId | null {
  if (!FOID_DESKTOP_ENABLED) return null;
  return DESKTOP_DOCK_APPS[href] ?? null;
}

/* ── Shell URL grammar ──────────────────────────────────────────────────
   /?apps=pray,board&focus=board
   - `apps`: comma-separated open windows, back → front (zOrder order)
   - `focus`: the foreground app; defaults to the last `apps` entry
   App-scoped deep-link params (?debug=1, ?registry=…) ride along RAW —
   apps read them via useSearchParams/location.search exactly as they do
   on their standalone routes. (The plan sketched <appId>.<param>
   namespacing; deferred until two apps actually collide on a key — no
   pair does today.) */

/** Parse `?apps=`/`?focus=` into a validated open-order + focus target:
 *  unknown ids dropped, duplicates dropped (one-instance rule), capped at
 *  MAX_OPEN_WINDOWS, focus coerced into the list (fallback: last app). */
export function parseDesktopAppsParam(search: string): {
  apps: AppId[];
  focus: AppId | null;
} {
  const params = new URLSearchParams(search);
  const apps: AppId[] = [];
  for (const token of (params.get("apps") ?? "").split(",")) {
    const id = token.trim() as AppId;
    if (!id || !SHELL_APP_IDS.includes(id) || apps.includes(id)) continue;
    apps.push(id);
    if (apps.length >= MAX_OPEN_WINDOWS) break;
  }
  const focusRaw = (params.get("focus") ?? "").trim() as AppId;
  const focus =
    focusRaw && apps.includes(focusRaw)
      ? focusRaw
      : apps.length
        ? apps[apps.length - 1]
        : null;
  return { apps, focus };
}

/** The shell URL a standalone route hands off to: same query string with
 *  this app opened + focused, minus the ?standalone escape hatch. */
export function shellHandoffUrl(appId: AppId, search: string): string {
  const params = new URLSearchParams(search);
  params.delete("standalone");
  params.set("apps", appId);
  params.set("focus", appId);
  return `/?${params.toString()}`;
}
