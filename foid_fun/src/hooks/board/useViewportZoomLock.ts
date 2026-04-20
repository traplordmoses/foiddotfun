// /src/hooks/board/useViewportZoomLock.ts
// Intercepts pinch-to-zoom, Ctrl+wheel, and double-tap-to-zoom on the
// board so canvas gestures don't accidentally zoom the whole page.
//
// We deliberately do NOT rewrite the viewport meta. user-scalable=no and
// maximum-scale=1 trip WCAG 2.2 AA (axe rule meta-viewport) and block
// users who rely on browser zoom. The JS handlers below cover the actual
// gestures we care about without taking that capability away.
"use client";

import { useEffect } from "react";

export function useViewportZoomLock() {
  useEffect(() => {
    // Safari gesture events (pinch-to-zoom on trackpad/touch).
    const preventGesture = (e: Event) => e.preventDefault();
    document.addEventListener("gesturestart", preventGesture, { passive: false });
    document.addEventListener("gesturechange", preventGesture, { passive: false });

    // Chrome/Firefox trackpad pinch (reported as Ctrl+wheel).
    const preventCtrlWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) e.preventDefault();
    };
    document.addEventListener("wheel", preventCtrlWheel, { passive: false });

    // Double-tap-to-zoom on the whole page (iOS).
    let lastTap = 0;
    const preventDoubleTapZoom = (e: TouchEvent) => {
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
  }, []);
}
