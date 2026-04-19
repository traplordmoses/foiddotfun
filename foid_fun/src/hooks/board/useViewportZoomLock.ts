// /src/hooks/board/useViewportZoomLock.ts
// Locks page-level browser zoom so that pinch-to-zoom, Ctrl+wheel, and
// double-tap-to-zoom don't accidentally zoom the whole page instead of the
// board canvas. Designed for full-bleed canvas pages.
"use client";

import { useEffect } from "react";

const LOCKED_VIEWPORT =
  "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no";

export function useViewportZoomLock() {
  useEffect(() => {
    // 1) Lock every existing viewport meta, and keep them locked via a
    //    MutationObserver — Next.js may re-render <head> and reset them.
    const allMetas = document.querySelectorAll('meta[name="viewport"]');
    const originals = Array.from(allMetas).map((m) => m.getAttribute("content") ?? "");

    const lockMetas = () =>
      allMetas.forEach((m) => m.setAttribute("content", LOCKED_VIEWPORT));
    lockMetas();

    const observer = new MutationObserver((mutations) => {
      for (const mut of mutations) {
        if (
          mut.type === "attributes" &&
          (mut.target as Element).getAttribute?.("name") === "viewport" &&
          (mut.target as Element).getAttribute("content") !== LOCKED_VIEWPORT
        ) {
          (mut.target as Element).setAttribute("content", LOCKED_VIEWPORT);
        }
      }
    });
    allMetas.forEach((m) =>
      observer.observe(m, { attributes: true, attributeFilter: ["content"] })
    );

    // 2) Safari gesture events (pinch-to-zoom on trackpad/touch).
    const preventGesture = (e: Event) => e.preventDefault();
    document.addEventListener("gesturestart", preventGesture, { passive: false });
    document.addEventListener("gesturechange", preventGesture, { passive: false });

    // 3) Chrome/Firefox trackpad pinch (reported as Ctrl+wheel).
    const preventCtrlWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) e.preventDefault();
    };
    document.addEventListener("wheel", preventCtrlWheel, { passive: false });

    // 4) Double-tap-to-zoom on the whole page (iOS).
    let lastTap = 0;
    const preventDoubleTapZoom = (e: TouchEvent) => {
      const now = Date.now();
      if (now - lastTap < 300) e.preventDefault();
      lastTap = now;
    };
    document.addEventListener("touchend", preventDoubleTapZoom, { passive: false });

    return () => {
      observer.disconnect();
      allMetas.forEach((m, i) => m.setAttribute("content", originals[i]));
      document.removeEventListener("gesturestart", preventGesture);
      document.removeEventListener("gesturechange", preventGesture);
      document.removeEventListener("wheel", preventCtrlWheel);
      document.removeEventListener("touchend", preventDoubleTapZoom);
    };
  }, []);
}
