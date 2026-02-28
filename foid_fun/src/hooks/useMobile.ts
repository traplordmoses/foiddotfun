'use client';

import { useEffect, useState } from 'react';

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

export function useMobile(): UseMobileReturn {
  const [isClient, setIsClient] = useState(false);
  // Always use safe SSR fallback for initial state to avoid hydration mismatch
  const [state, setState] = useState<UseMobileReturn>({
    isMobile: true,
    isTablet: false,
    isDesktop: false,
    isTouchDevice: false,
    isIOS: false,
    isAndroid: false,
    screenWidth: 375,
    screenHeight: 667,
    orientation: 'portrait',
  });

  useEffect(() => {
    setIsClient(true);

    const checkDevice = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      const userAgent = navigator.userAgent.toLowerCase();

      // Device type detection
      const isMobile = width < 768;
      const isTablet = width >= 768 && width < 1024;
      const isDesktop = width >= 1024;

      // Touch detection
      const isTouchDevice =
        'ontouchstart' in window ||
        navigator.maxTouchPoints > 0 ||
        (navigator as any).msMaxTouchPoints > 0;

      // OS detection
      const isIOS = /iphone|ipad|ipod/.test(userAgent);
      const isAndroid = /android/.test(userAgent);

      // Orientation
      const orientation = height > width ? 'portrait' : 'landscape';

      setState({
        isMobile,
        isTablet,
        isDesktop,
        isTouchDevice,
        isIOS,
        isAndroid,
        screenWidth: width,
        screenHeight: height,
        orientation,
      });
    };

    // Initial check
    checkDevice();

    // Listen for resize and orientation changes
    window.addEventListener('resize', checkDevice);
    window.addEventListener('orientationchange', checkDevice);

    return () => {
      window.removeEventListener('resize', checkDevice);
      window.removeEventListener('orientationchange', checkDevice);
    };
  }, []);

  return state;
}
