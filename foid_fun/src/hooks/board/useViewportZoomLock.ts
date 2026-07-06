// /src/hooks/board/useViewportZoomLock.ts
// Intercepts pinch-to-zoom, Ctrl+wheel, and double-tap-to-zoom on the
// board so canvas gestures don't accidentally zoom the whole page.
//
// We deliberately do NOT rewrite the viewport meta. user-scalable=no and
// maximum-scale=1 trip WCAG 2.2 AA (axe rule meta-viewport) and block
// users who rely on browser zoom. The JS handlers below cover the actual
// gestures we care about without taking that capability away.
"use client";

import { useEffect, type RefObject } from "react";

/**
 * @param scopeRef Optional containment scope. When provided, preventDefault
 *   only fires for events originating INSIDE that element — required in the
 *   desktop shell, where the board is one window among several and must not
 *   hijack pinch/Ctrl+wheel over the wallpaper or a neighboring window.
 *   When omitted (the standalone /board route), the lock is page-wide,
 *   exactly the historical behavior.
 */
export function useViewportZoomLock(scopeRef?: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const inScope = (e: Event): boolean => {
      if (!scopeRef) return true;
      const el = scopeRef.current;
      const target = e.target as Node | null;
      return !!(el && target && el.contains(target));
    };

    // Safari gesture events (pinch-to-zoom on trackpad/touch).
    const preventGesture = (e: Event) => {
      if (inScope(e)) e.preventDefault();
    };
    document.addEventListener("gesturestart", preventGesture, { passive: false });
    document.addEventListener("gesturechange", preventGesture, { passive: false });

    // Chrome/Firefox trackpad pinch (reported as Ctrl+wheel).
    const preventCtrlWheel = (e: WheelEvent) => {
      if ((e.ctrlKey || e.metaKey) && inScope(e)) e.preventDefault();
    };
    document.addEventListener("wheel", preventCtrlWheel, { passive: false });

    // Double-tap-to-zoom on the whole page (iOS). Scoped mode only tracks
    // taps inside the canvas, so a double-tap on another window is free to
    // do whatever the browser wants.
    let lastTap = 0;
    const preventDoubleTapZoom = (e: TouchEvent) => {
      if (!inScope(e)) return;
      const now = Date.now();
      if (now - lastTap < 300) e.preventDefault();
      lastTap = now;
    };
    document.addEventListener("touchend", preventDoubleTapZoom, { passive: false });

    return () => {
      document.removeEventListener("gesturestart", preventGesture);
      document.removeEventListener("gesturechange", preventGesture);
      document.removeEventListener("wheel", preventCtrlWheel);
      document.removeEventListener("touchend", preventDoubleTapZoom);
    };
  }, [scopeRef]);
}
