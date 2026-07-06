"use client";

// src/components/os/useDesktopHandoff.ts
// Stage C: routes are entry points, not homes. On desktop-eligible
// viewports an app route (/pray, /board, …) hands off to the shell —
// router.replace("/?apps=<id>&focus=<id>" + the route's own query) — so
// deep links open the desktop with that app focused. `replace` keeps the
// back button sane: back leaves the desktop for wherever the visitor came
// from, never bounces through the old route.
//
// The handoff is deliberately client-side: the route still server-renders
// its full standalone markup (SEO/unfurls keep working, curl gets a real
// page), and that same standalone presentation stays reachable forever at
// ?standalone=1 — which is also exactly what mobile (<1024px) always gets.
//
// Decision is taken once, on mount: resizing a phone-width tab wider
// mid-visit doesn't yank the page away (same posture as the window
// chrome's own drag gate).
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  FOID_DESKTOP_ENABLED,
  isDesktopViewport,
  shellHandoffUrl,
} from "@/config/desktop";
import type { AppId } from "@/stores/windowStore";

/** True once this route is handing off to the desktop shell — callers
 *  render null (the wallpaper carries the transition). Always false with
 *  the desktop opted out, under 1024px, and at ?standalone=1. */
export function useDesktopHandoff(appId: AppId): boolean {
  const router = useRouter();
  const [handedOff, setHandedOff] = useState(false);

  useEffect(() => {
    if (!FOID_DESKTOP_ENABLED) return;
    if (!isDesktopViewport()) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("standalone") === "1") return;
    setHandedOff(true);
    router.replace(shellHandoffUrl(appId, window.location.search));
  }, [appId, router]);

  return handedOff;
}
