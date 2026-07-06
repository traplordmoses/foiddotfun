// src/config/desktop.ts
// FOID OS desktop shell flag — the single place the multi-window shell is
// gated (docs/foid-os-multiwindow-plan.md, Stage A). Env-driven like
// NEXT_PUBLIC_IS_MAINNET: build-time constant, so with the flag off every
// desktop branch is dead code and the site behaves exactly as production.
import type { AppId } from "@/stores/windowStore";

export const FOID_DESKTOP_ENABLED =
  process.env.NEXT_PUBLIC_FOID_DESKTOP === "1";

/** Dock href → shell app id, for the apps that have been extracted into
 *  desktop windows (Stage A: FILES + MIFOID). Unmigrated dock items keep
 *  navigating their routes. Kept here (not in Desktop.tsx) so the Dock can
 *  answer "is this a shell app?" without importing the shell's lazy app
 *  registry into every route's bundle. */
const DESKTOP_DOCK_APPS: Readonly<Partial<Record<string, AppId>>> = {
  "/files": "files",
  "/mifoid": "mifoid",
};

/** Returns the shell AppId for a dock href, or null when the desktop flag
 *  is off / the app hasn't been migrated yet. */
export function desktopAppForHref(href: string): AppId | null {
  if (!FOID_DESKTOP_ENABLED) return null;
  return DESKTOP_DOCK_APPS[href] ?? null;
}
