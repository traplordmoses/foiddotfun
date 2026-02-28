"use client";

import { useCallback, useRef, useState } from "react";

type SwipeDirection = "left" | "right" | null;

type UseSwipeVoteOptions = {
  threshold?: number;
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
};

type UseSwipeVoteReturn = {
  deltaX: number;
  isDragging: boolean;
  direction: SwipeDirection;
  handlers: {
    onPointerDown: (e: React.PointerEvent) => void;
    onPointerMove: (e: React.PointerEvent) => void;
    onPointerUp: (e: React.PointerEvent) => void;
    onPointerCancel: (e: React.PointerEvent) => void;
  };
  style: React.CSSProperties;
};

export function useSwipeVote({
  threshold = 100,
  onSwipeLeft,
  onSwipeRight,
}: UseSwipeVoteOptions = {}): UseSwipeVoteReturn {
  const [deltaX, setDeltaX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const startXRef = useRef(0);
  const activeRef = useRef(false);

  const direction: SwipeDirection =
    deltaX > threshold ? "right" : deltaX < -threshold ? "left" : null;

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    activeRef.current = true;
    startXRef.current = e.clientX;
    setIsDragging(true);
    setDeltaX(0);
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!activeRef.current) return;
    setDeltaX(e.clientX - startXRef.current);
  }, []);

  const onPointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (!activeRef.current) return;
      activeRef.current = false;
      const final = e.clientX - startXRef.current;

      if (Math.abs(final) > threshold) {
        if (final > 0) onSwipeRight?.();
        else onSwipeLeft?.();
      }

      setDeltaX(0);
      setIsDragging(false);
    },
    [threshold, onSwipeLeft, onSwipeRight]
  );

  const onPointerCancel = useCallback(() => {
    activeRef.current = false;
    setDeltaX(0);
    setIsDragging(false);
  }, []);

  const rotation = deltaX * 0.05;
  const style: React.CSSProperties = isDragging
    ? {
        transform: `translateX(${deltaX}px) rotate(${rotation}deg)`,
        transition: "none",
        cursor: "grabbing",
      }
    : {
        transform: "translateX(0) rotate(0deg)",
        transition: "transform 0.3s ease",
        cursor: "grab",
      };

  return {
    deltaX,
    isDragging,
    direction,
    handlers: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel },
    style,
  };
}
