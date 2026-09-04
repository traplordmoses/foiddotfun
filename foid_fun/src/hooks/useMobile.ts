'use client';

import { useSyncExternalStore } from 'react';

interface UseMobileReturn {
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  isTouchDevice: boolean;
  isIOS: boolean;
  isAndroid: boolean;
  screenWidth: number;
  screenHeight: number;
  orientation: 'portrait' | 'landscape';
}

// Server / hydration snapshot. React renders this during hydration so the
// markup matches SSR, then re-renders once with the real client snapshot.
// (The previous hook kept this as *state* and only corrected it in an
// effect, so every desktop first paint briefly took the mobile branch.)
const SERVER_SNAPSHOT: UseMobileReturn = {
  isMobile: true,
  isTablet: false,
  isDesktop: false,
  isTouchDevice: false,
  isIOS: false,
  isAndroid: false,
  screenWidth: 375,
  screenHeight: 667,
  orientation: 'portrait',
};

function compute(): UseMobileReturn {
  const width = window.innerWidth;
  const height = window.innerHeight;
  const userAgent = navigator.userAgent.toLowerCase();
  const nav = navigator as Navigator & { msMaxTouchPoints?: number };
  return {
    isMobile: width < 768,
    isTablet: width >= 768 && width < 1024,
    isDesktop: width >= 1024,
    isTouchDevice:
      'ontouchstart' in window ||
      navigator.maxTouchPoints > 0 ||
      (nav.msMaxTouchPoints ?? 0) > 0,
    isIOS: /iphone|ipad|ipod/.test(userAgent),
    isAndroid: /android/.test(userAgent),
    screenWidth: width,
    screenHeight: height,
    orientation: height > width ? 'portrait' : 'landscape',
  };
}

function same(a: UseMobileReturn, b: UseMobileReturn): boolean {
  return (
    a.isMobile === b.isMobile &&
    a.isTablet === b.isTablet &&
    a.isDesktop === b.isDesktop &&
    a.isTouchDevice === b.isTouchDevice &&
    a.isIOS === b.isIOS &&
    a.isAndroid === b.isAndroid &&
    a.screenWidth === b.screenWidth &&
    a.screenHeight === b.screenHeight &&
    a.orientation === b.orientation
  );
}

// One shared store: a single resize listener for every consumer instead of
// one per mounted component.
let snapshot: UseMobileReturn = SERVER_SNAPSHOT;
const listeners = new Set<() => void>();
let bound = false;

function refresh() {
  const next = compute();
  if (same(next, snapshot)) return;
  snapshot = next;
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (!bound) {
    bound = true;
    window.addEventListener('resize', refresh);
    window.addEventListener('orientationchange', refresh);
  }
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): UseMobileReturn {
  if (snapshot === SERVER_SNAPSHOT && typeof window !== 'undefined') {
    snapshot = compute();
  }
  return snapshot;
}

function getServerSnapshot(): UseMobileReturn {
  return SERVER_SNAPSHOT;
}

export function useMobile(): UseMobileReturn {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
