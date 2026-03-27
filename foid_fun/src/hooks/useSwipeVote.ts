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
  deltaY: number;
  isDragging: boolean;
  direction: SwipeDirection;
  phase: SwipePhase;
  progress: number;
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
  const [deltaY, setDeltaY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [phase, setPhase] = useState<SwipePhase>("entered");
  const startXRef = useRef(0);
  const startYRef = useRef(0);
  const activeRef = useRef(false);
  const lockedRef = useRef(false);
  const velocityRef = useRef({ x: 0, y: 0 });
  const lastPosRef = useRef({ x: 0, y: 0, t: 0 });
  const exitDirRef = useRef<"left" | "right">("right");
  const exitVelRef = useRef({ x: 0, y: 0 });
  const callbackFiredRef = useRef(false);

  useEffect(() => {
    setPhase("entered");
  }, []);

  const direction: SwipeDirection =
    deltaX > threshold * 0.6 ? "right" : deltaX < -threshold * 0.6 ? "left" : null;

  const progress = Math.min(1, Math.abs(deltaX) / threshold);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if (phase === "exiting") return;
    activeRef.current = true;
    lockedRef.current = false;
    callbackFiredRef.current = false;
    startXRef.current = e.clientX;
    startYRef.current = e.clientY;
    lastPosRef.current = { x: e.clientX, y: e.clientY, t: Date.now() };
    velocityRef.current = { x: 0, y: 0 };
    setIsDragging(true);
    setDeltaX(0);
    setDeltaY(0);
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  }, [phase]);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!activeRef.current) return;

    const dx = e.clientX - startXRef.current;
    const dy = e.clientY - startYRef.current;

    // Lock direction after 8px
    if (!lockedRef.current && (Math.abs(dx) > 8 || Math.abs(dy) > 8)) {
      if (Math.abs(dy) > Math.abs(dx) * 1.5) {
        activeRef.current = false;
        setDeltaX(0);
        setDeltaY(0);
        setIsDragging(false);
        return;
      }
      lockedRef.current = true;
    }

    if (!lockedRef.current) return;

    // Track velocity (smoothed over last 2 frames)
    const now = Date.now();
    const dt = Math.max(1, now - lastPosRef.current.t);
    const vx = (e.clientX - lastPosRef.current.x) / dt;
    const vy = (e.clientY - lastPosRef.current.y) / dt;
    velocityRef.current = {
      x: velocityRef.current.x * 0.4 + vx * 0.6,
      y: velocityRef.current.y * 0.4 + vy * 0.6,
    };
    lastPosRef.current = { x: e.clientX, y: e.clientY, t: now };

    setDeltaX(dx);
    setDeltaY(dy * 0.4); // dampen vertical
  }, []);

  const onPointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (!activeRef.current) return;
      activeRef.current = false;

      const final = e.clientX - startXRef.current;
      const vel = velocityRef.current;
      // Swipe if past threshold OR fast flick (>0.6 px/ms)
      const swiped = Math.abs(final) > threshold || Math.abs(vel.x) > 0.6;

      if (swiped && !callbackFiredRef.current) {
        callbackFiredRef.current = true;
        const dir = (final > 0 || vel.x > 0.3) ? "right" : "left";
        exitDirRef.current = dir;
        exitVelRef.current = { ...vel };
        setPhase("exiting");

        // Haptic
        if (typeof navigator !== "undefined" && "vibrate" in navigator) {
          navigator.vibrate(20);
        }

        // Fire callback after exit animation
        setTimeout(() => {
          if (dir === "right") onSwipeRight?.();
          else onSwipeLeft?.();
          setDeltaX(0);
          setDeltaY(0);
          setIsDragging(false);
          setPhase("entered");
        }, 350);
      } else {
        // Spring back
        setDeltaX(0);
        setDeltaY(0);
        setIsDragging(false);
      }
    },
    [threshold, onSwipeLeft, onSwipeRight]
  );

  const onPointerCancel = useCallback(() => {
    activeRef.current = false;
    setDeltaX(0);
    setDeltaY(0);
    setIsDragging(false);
  }, []);

  // Rotation pivots from bottom of card — like holding a card at the bottom
  // Proportional to horizontal offset (more offset = more rotation)
  const rotation = deltaX * 0.12;
  // Slight Y-axis tilt for 3D depth feel
  const tiltY = deltaX * 0.02;

  let style: React.CSSProperties;

  if (phase === "exiting") {
    const vel = exitVelRef.current;
    const dir = exitDirRef.current;
    // Fly in the direction of drag with momentum
    const flyX = dir === "right" ? Math.max(800, 400 + Math.abs(vel.x) * 600) : Math.min(-800, -400 - Math.abs(vel.x) * 600);
    const flyY = vel.y * 200;
    const flyRot = dir === "right" ? 30 + Math.abs(vel.x) * 15 : -30 - Math.abs(vel.x) * 15;
    style = {
      transform: `perspective(1200px) translateX(${flyX}px) translateY(${flyY}px) rotate(${flyRot}deg) scale(0.8)`,
      opacity: 0,
      transition: "transform 0.35s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s ease",
      cursor: "default",
      willChange: "transform, opacity",
      transformOrigin: "center 80%",
    };
  } else if (isDragging) {
    const lift = 1 + progress * 0.06;
    const shadowBlur = 20 + progress * 40;
    const shadowSpread = progress * 10;
    style = {
      transform: `perspective(1200px) translateX(${deltaX}px) translateY(${deltaY}px) rotate(${rotation}deg) rotateY(${tiltY}deg) scale(${lift})`,
      transition: "none",
      cursor: "grabbing",
      willChange: "transform",
      transformOrigin: "center 80%",
      boxShadow: `0 ${10 + progress * 20}px ${shadowBlur}px ${shadowSpread}px rgba(0,0,0,0.4)`,
    };
  } else {
    style = {
      transform: "perspective(1200px) translateX(0) translateY(0) rotate(0deg) rotateY(0deg) scale(1)",
      transition: "transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.5s ease",
      cursor: "grab",
      transformOrigin: "center 80%",
      boxShadow: "0 8px 24px 0 rgba(0,0,0,0.25)",
    };
  }

  return {
    deltaX,
    deltaY,
    isDragging,
    direction,
    phase,
    progress,
    handlers: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel },
    style,
  };
}
