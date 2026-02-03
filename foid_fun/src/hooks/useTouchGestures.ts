'use client';

import { useCallback, useRef } from 'react';
import type React from 'react';

interface Point {
  x: number;
  y: number;
}

interface TouchGestureConfig {
  minZoom?: number;
  maxZoom?: number;
  zoomSpeed?: number;
  panEnabled?: boolean;
  zoomEnabled?: boolean;
  onPanStart?: (point: Point) => void;
  onPan?: (delta: Point) => void;
  onPanEnd?: () => void;
  onZoomStart?: (scale: number) => void;
  onZoom?: (scale: number, center: Point) => void;
  onZoomEnd?: () => void;
  onTap?: (point: Point) => void;
  onDoubleTap?: (point: Point) => void;
  onLongPress?: (point: Point) => void;
  longPressDuration?: number;
}

interface UseTouchGesturesReturn {
  touchHandlers: {
    onTouchStart: (e: React.TouchEvent) => void;
    onTouchMove: (e: React.TouchEvent) => void;
    onTouchEnd: (e: React.TouchEvent) => void;
    onTouchCancel: (e: React.TouchEvent) => void;
  };
}

export function useTouchGestures(
  config: TouchGestureConfig = {}
): UseTouchGesturesReturn {
  const {
    minZoom = 0.05,
    maxZoom = 20,
    zoomSpeed = 0.01,
    panEnabled = true,
    zoomEnabled = true,
    onPanStart,
    onPan,
    onPanEnd,
    onZoomStart,
    onZoom,
    onZoomEnd,
    onTap,
    onDoubleTap,
    onLongPress,
    longPressDuration = 500,
  } = config;

  // State refs
  const touchesRef = useRef<React.Touch[]>([]);
  const lastTouchRef = useRef<Point>({ x: 0, y: 0 });
  const lastDistanceRef = useRef<number>(0);
  const lastCenterRef = useRef<Point>({ x: 0, y: 0 });
  const currentScaleRef = useRef<number>(1);
  const isPanningRef = useRef<boolean>(false);
  const isZoomingRef = useRef<boolean>(false);
  const lastTapRef = useRef<number>(0);
  const tapTimeoutRef = useRef<NodeJS.Timeout>();
  const longPressTimerRef = useRef<NodeJS.Timeout>();
  const hasMoved = useRef<boolean>(false);

  // Calculate distance between two touches
  const getDistance = useCallback((touch1: React.Touch, touch2: React.Touch): number => {
    const dx = touch2.clientX - touch1.clientX;
    const dy = touch2.clientY - touch1.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }, []);

  // Calculate center point between two touches
  const getCenter = useCallback((touch1: React.Touch, touch2: React.Touch): Point => {
    return {
      x: (touch1.clientX + touch2.clientX) / 2,
      y: (touch1.clientY + touch2.clientY) / 2,
    };
  }, []);

  // Handle touch start
  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      const touches = Array.from(e.touches);
      touchesRef.current = touches;

      if (touches.length === 1) {
        // Single touch - potential pan or tap
        const touch = touches[0];
        lastTouchRef.current = { x: touch.clientX, y: touch.clientY };
        hasMoved.current = false;

        if (panEnabled) {
          isPanningRef.current = true;
          onPanStart?.({ x: touch.clientX, y: touch.clientY });
        }

        // Start long press timer
        if (onLongPress) {
          clearTimeout(longPressTimerRef.current);
          longPressTimerRef.current = setTimeout(() => {
            if (!hasMoved.current) {
              onLongPress({ x: touch.clientX, y: touch.clientY });
            }
          }, longPressDuration);
        }

        // Check for double tap
        const now = Date.now();
        const timeSinceLastTap = now - lastTapRef.current;

        if (timeSinceLastTap < 300) {
          // Double tap detected
          clearTimeout(tapTimeoutRef.current);
          clearTimeout(longPressTimerRef.current);
          onDoubleTap?.({ x: touch.clientX, y: touch.clientY });
          lastTapRef.current = 0;
        } else {
          // Set timeout for single tap (only if not moved)
          lastTapRef.current = now;
        }
      } else if (touches.length === 2) {
        // Cancel long press on multi-touch
        clearTimeout(longPressTimerRef.current);
        // Two touches - enable both pan and zoom detection
        const distance = getDistance(touches[0], touches[1]);
        const center = getCenter(touches[0], touches[1]);

        lastDistanceRef.current = distance;
        lastCenterRef.current = center;
        lastTouchRef.current = center;

        isPanningRef.current = panEnabled;
        isZoomingRef.current = zoomEnabled;

        onZoomStart?.(currentScaleRef.current);
        onPanStart?.(center);
      }
    },
    [panEnabled, zoomEnabled, onPanStart, onZoomStart, onTap, onDoubleTap, onLongPress, longPressDuration, getDistance]
  );

  // Handle touch move
  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      e.preventDefault(); // Prevent scrolling

      const touches = Array.from(e.touches);
      touchesRef.current = touches;

      if (touches.length === 1 && isPanningRef.current && panEnabled) {
        // Single touch pan - ONE FINGER DRAG
        const touch = touches[0];
        const delta = {
          x: touch.clientX - lastTouchRef.current.x,
          y: touch.clientY - lastTouchRef.current.y,
        };

        // Mark as moved if moved more than 5px (to distinguish from tap)
        if (Math.abs(delta.x) > 5 || Math.abs(delta.y) > 5) {
          hasMoved.current = true;
          clearTimeout(longPressTimerRef.current);
        }

        onPan?.(delta);
        lastTouchRef.current = { x: touch.clientX, y: touch.clientY };
      } else if (touches.length === 2) {
        const distance = getDistance(touches[0], touches[1]);
        const center = getCenter(touches[0], touches[1]);

        // Two-finger pinch zoom (distance changes)
        if (isZoomingRef.current && zoomEnabled && lastDistanceRef.current > 0) {
          const scaleRatio = distance / lastDistanceRef.current;
          const newScale = currentScaleRef.current * scaleRatio;
          const clampedScale = Math.max(minZoom, Math.min(maxZoom, newScale));

          currentScaleRef.current = clampedScale;
          onZoom?.(clampedScale, center);
        }

        // Two-finger pan (center moves)
        if (isPanningRef.current && panEnabled) {
          const delta = {
            x: center.x - lastCenterRef.current.x,
            y: center.y - lastCenterRef.current.y,
          };

          onPan?.(delta);
          lastCenterRef.current = center;
        }

        lastDistanceRef.current = distance;
      }
    },
    [
      panEnabled,
      zoomEnabled,
      minZoom,
      maxZoom,
      zoomSpeed,
      onPan,
      onZoom,
      getDistance,
      getCenter,
    ]
  );

  // Handle touch end
  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      const touches = Array.from(e.touches);
      touchesRef.current = touches;

      if (touches.length === 0) {
        // All touches ended
        clearTimeout(longPressTimerRef.current);

        // Fire tap only if user didn't move
        if (!hasMoved.current && lastTapRef.current > 0) {
          const now = Date.now();
          if (now - lastTapRef.current < 300) {
            onTap?.({ x: lastTouchRef.current.x, y: lastTouchRef.current.y });
          }
        }

        if (isPanningRef.current) {
          onPanEnd?.();
          isPanningRef.current = false;
        }

        if (isZoomingRef.current) {
          onZoomEnd?.();
          isZoomingRef.current = false;
        }

        hasMoved.current = false;
      } else if (touches.length === 1 && isZoomingRef.current) {
        clearTimeout(longPressTimerRef.current);
        // Went from two touches to one - end zoom, start pan
        isZoomingRef.current = false;
        onZoomEnd?.();

        if (panEnabled) {
          const touch = touches[0];
          lastTouchRef.current = { x: touch.clientX, y: touch.clientY };
          isPanningRef.current = true;
          onPanStart?.({ x: touch.clientX, y: touch.clientY });
        }
      }
    },
    [panEnabled, onPanStart, onPanEnd, onZoomEnd]
  );

  // Handle touch cancel
  const handleTouchCancel = useCallback(
    (e: React.TouchEvent) => {
      touchesRef.current = [];
      clearTimeout(longPressTimerRef.current);

      if (isPanningRef.current) {
        onPanEnd?.();
        isPanningRef.current = false;
      }

      if (isZoomingRef.current) {
        onZoomEnd?.();
        isZoomingRef.current = false;
      }
    },
    [onPanEnd, onZoomEnd]
  );

  return {
    touchHandlers: {
      onTouchStart: handleTouchStart,
      onTouchMove: handleTouchMove,
      onTouchEnd: handleTouchEnd,
      onTouchCancel: handleTouchCancel,
    },
  };
}
