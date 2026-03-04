"use client";

import { useCallback, useRef, useState, useEffect } from "react";

type SwipeDirection = "left" | "right" | null;
type SwipePhase = "idle" | "dragging" | "exiting" | "entered";

type UseSwipeVoteOptions = {
  threshold?: number;
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
};

type UseSwipeVoteReturn = {
  deltaX: number;
  isDragging: boolean;
  direction: SwipeDirection;
  phase: SwipePhase;
  progress: number; // 0–1 how close to threshold
  handlers: {
    onPointerDown: (e: React.PointerEvent) => void;
    onPointerMove: (e: React.PointerEvent) => void;
    onPointerUp: (e: React.PointerEvent) => void;
    onPointerCancel: (e: React.PointerEvent) => void;
  };
  style: React.CSSProperties;
};

export function useSwipeVote({
  threshold = 80,
  onSwipeLeft,
  onSwipeRight,
}: UseSwipeVoteOptions = {}): UseSwipeVoteReturn {
  const [deltaX, setDeltaX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [phase, setPhase] = useState<SwipePhase>("entered");
  const startXRef = useRef(0);
  const startYRef = useRef(0);
  const activeRef = useRef(false);
  const lockedRef = useRef(false); // true = horizontal lock confirmed
  const velocityRef = useRef(0);
  const lastXRef = useRef(0);
  const lastTimeRef = useRef(0);
  const exitDirRef = useRef<"left" | "right">("right");
  const callbackFiredRef = useRef(false);

  // Enter animation on mount
  useEffect(() => {
    setPhase("entered");
  }, []);

  const direction: SwipeDirection =
    deltaX > threshold ? "right" : deltaX < -threshold ? "left" : null;

  const progress = Math.min(1, Math.abs(deltaX) / threshold);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if (phase === "exiting") return;
    activeRef.current = true;
    lockedRef.current = false;
    callbackFiredRef.current = false;
    startXRef.current = e.clientX;
    startYRef.current = e.clientY;
    lastXRef.current = e.clientX;
    lastTimeRef.current = Date.now();
    velocityRef.current = 0;
    setIsDragging(true);
    setDeltaX(0);
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  }, [phase]);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!activeRef.current) return;

    const dx = e.clientX - startXRef.current;
    const dy = e.clientY - startYRef.current;

    // Lock direction after 10px of movement
    if (!lockedRef.current && (Math.abs(dx) > 10 || Math.abs(dy) > 10)) {
      if (Math.abs(dy) > Math.abs(dx)) {
        // Vertical scroll — release gesture
        activeRef.current = false;
        setDeltaX(0);
        setIsDragging(false);
        return;
      }
      lockedRef.current = true;
    }

    if (!lockedRef.current) return;

    // Track velocity
    const now = Date.now();
    const dt = now - lastTimeRef.current;
    if (dt > 0) {
      velocityRef.current = (e.clientX - lastXRef.current) / dt;
    }
    lastXRef.current = e.clientX;
    lastTimeRef.current = now;

    // Elastic resistance past threshold
    const raw = e.clientX - startXRef.current;
    const sign = raw >= 0 ? 1 : -1;
    const abs = Math.abs(raw);
    const dampened = abs > threshold
      ? threshold + (abs - threshold) * 0.4
      : abs;
    setDeltaX(sign * dampened);
  }, [threshold]);

  const onPointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (!activeRef.current) return;
      activeRef.current = false;

      const final = e.clientX - startXRef.current;
      const vel = velocityRef.current;
      // Swipe if past threshold OR fast enough flick (>0.5 px/ms)
      const swiped = Math.abs(final) > threshold || Math.abs(vel) > 0.5;

      if (swiped && !callbackFiredRef.current) {
        callbackFiredRef.current = true;
        const dir = (final > 0 || vel > 0.5) ? "right" : "left";
        exitDirRef.current = dir;
        setPhase("exiting");

        // Haptic feedback
        if (typeof navigator !== "undefined" && "vibrate" in navigator) {
          navigator.vibrate(15);
        }

        // Fire callback after exit animation
        setTimeout(() => {
          if (dir === "right") onSwipeRight?.();
          else onSwipeLeft?.();
          // Reset for next card
          setDeltaX(0);
          setIsDragging(false);
          setPhase("entered");
        }, 280);
      } else {
        // Snap back with spring feel
        setDeltaX(0);
        setIsDragging(false);
      }
    },
    [threshold, onSwipeLeft, onSwipeRight]
  );

  const onPointerCancel = useCallback(() => {
    activeRef.current = false;
    setDeltaX(0);
    setIsDragging(false);
  }, []);

  const rotation = deltaX * 0.08;

  let style: React.CSSProperties;

  if (phase === "exiting") {
    const flyX = exitDirRef.current === "right" ? 600 : -600;
    const flyRot = exitDirRef.current === "right" ? 25 : -25;
    style = {
      transform: `translateX(${flyX}px) rotate(${flyRot}deg) scale(0.9)`,
      opacity: 0,
      transition: "transform 0.28s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.25s ease",
      cursor: "default",
      willChange: "transform, opacity",
    };
  } else if (isDragging) {
    const lift = 1 + progress * 0.04; // subtle scale up when dragging
    style = {
      transform: `translateX(${deltaX}px) rotate(${rotation}deg) scale(${lift})`,
      transition: "none",
      cursor: "grabbing",
      willChange: "transform",
    };
  } else {
    style = {
      transform: "translateX(0) rotate(0deg) scale(1)",
      transition: "transform 0.45s cubic-bezier(0.34, 1.56, 0.64, 1)",
      cursor: "grab",
    };
  }

  return {
    deltaX,
    isDragging,
    direction,
    phase,
    progress,
    handlers: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel },
    style,
  };
}
