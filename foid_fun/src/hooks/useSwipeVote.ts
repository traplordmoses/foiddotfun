"use client";

import { useCallback, useRef, useState, useEffect } from "react";

type SwipeDirection = "left" | "right" | "up" | null;
type SwipePhase = "idle" | "dragging" | "exiting" | "entered";

type UseSwipeVoteOptions = {
  threshold?: number;
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onSwipeUp?: () => void;
  /** Called on tap (pointer down+up with <6px movement). Receives click event coords. */
  onTap?: () => void;
};

type UseSwipeVoteReturn = {
  deltaX: number;
  deltaY: number;
  isDragging: boolean;
  direction: SwipeDirection;
  phase: SwipePhase;
  progress: number;
  exitDirection: SwipeDirection;
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
  onSwipeUp,
  onTap,
}: UseSwipeVoteOptions = {}): UseSwipeVoteReturn {
  const [deltaX, setDeltaX] = useState(0);
  const [deltaY, setDeltaY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [phase, setPhase] = useState<SwipePhase>("entered");
  const [exitDirection, setExitDirection] = useState<SwipeDirection>(null);
  const startXRef = useRef(0);
  const startYRef = useRef(0);
  const activeRef = useRef(false);
  const lockedRef = useRef<"horizontal" | "vertical" | false>(false);
  const velocityRef = useRef({ x: 0, y: 0 });
  const lastPosRef = useRef({ x: 0, y: 0, t: 0 });
  const exitDirRef = useRef<"left" | "right" | "up">("right");
  const exitVelRef = useRef({ x: 0, y: 0 });
  const callbackFiredRef = useRef(false);

  useEffect(() => {
    setPhase("entered");
  }, []);

  // Keyboard support: ArrowLeft/Right to vote, Space to skip, Z to undo (undo handled in page)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (phase === "exiting") return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      if (e.key === "ArrowLeft") {
        e.preventDefault();
        exitDirRef.current = "left";
        setExitDirection("left");
        callbackFiredRef.current = true;
        setPhase("exiting");
        if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate(15);
        setTimeout(() => {
          onSwipeLeft?.();
          setDeltaX(0);
          setDeltaY(0);
          setIsDragging(false);
          setPhase("entered");
        }, 280);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        exitDirRef.current = "right";
        setExitDirection("right");
        callbackFiredRef.current = true;
        setPhase("exiting");
        if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate(15);
        setTimeout(() => {
          onSwipeRight?.();
          setDeltaX(0);
          setDeltaY(0);
          setIsDragging(false);
          setPhase("entered");
        }, 280);
      } else if (e.key === " " && onSwipeUp) {
        e.preventDefault();
        exitDirRef.current = "up";
        setExitDirection("up");
        callbackFiredRef.current = true;
        setPhase("exiting");
        setTimeout(() => {
          onSwipeUp?.();
          setDeltaX(0);
          setDeltaY(0);
          setIsDragging(false);
          setPhase("entered");
        }, 280);
      } else if (e.key === "Enter") {
        e.preventDefault();
        onTap?.();
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [phase, onSwipeLeft, onSwipeRight, onSwipeUp, onTap]);

  const direction: SwipeDirection =
    deltaX > threshold * 0.6
      ? "right"
      : deltaX < -threshold * 0.6
      ? "left"
      : deltaY < -threshold * 0.6
      ? "up"
      : null;

  const progress = Math.min(
    1,
    Math.max(Math.abs(deltaX), direction === "up" ? Math.abs(deltaY) : 0) / threshold
  );

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
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
    },
    [phase]
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!activeRef.current) return;

      const dx = e.clientX - startXRef.current;
      const dy = e.clientY - startYRef.current;

      // Lock direction after 8px of movement
      if (!lockedRef.current && (Math.abs(dx) > 8 || Math.abs(dy) > 8)) {
        if (Math.abs(dy) > Math.abs(dx) * 1.5) {
          // Vertical dominant — if upward and we have an onSwipeUp handler, lock vertical
          if (dy < 0 && onSwipeUp) {
            lockedRef.current = "vertical";
          } else {
            // Downward or no skip handler — cancel gesture
            activeRef.current = false;
            setDeltaX(0);
            setDeltaY(0);
            setIsDragging(false);
            return;
          }
        } else {
          lockedRef.current = "horizontal";
        }
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

      if (lockedRef.current === "vertical") {
        // Only track upward motion
        setDeltaY(Math.min(0, dy));
        setDeltaX(dx * 0.2); // slight horizontal allowed
      } else {
        setDeltaX(dx);
        setDeltaY(dy * 0.4); // dampen vertical
      }
    },
    [onSwipeUp]
  );

  const onPointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (!activeRef.current) return;
      activeRef.current = false;

      const finalX = e.clientX - startXRef.current;
      const finalY = e.clientY - startYRef.current;
      const vel = velocityRef.current;
      const totalMovement = Math.sqrt(finalX * finalX + finalY * finalY);

      // Tap detection: minimal movement
      if (totalMovement < 6 && !lockedRef.current) {
        setIsDragging(false);
        setDeltaX(0);
        setDeltaY(0);
        onTap?.();
        return;
      }

      if (lockedRef.current === "vertical") {
        // Upward swipe check
        const swipedUp =
          (Math.abs(finalY) > threshold * 0.7 || Math.abs(vel.y) > 0.6) && finalY < 0;
        if (swipedUp && !callbackFiredRef.current && onSwipeUp) {
          callbackFiredRef.current = true;
          exitDirRef.current = "up";
          setExitDirection("up");
          exitVelRef.current = { ...vel };
          setPhase("exiting");
          setTimeout(() => {
            onSwipeUp();
            setDeltaX(0);
            setDeltaY(0);
            setIsDragging(false);
            setPhase("entered");
          }, 350);
          return;
        }
        // Not enough — spring back
        setDeltaX(0);
        setDeltaY(0);
        setIsDragging(false);
        return;
      }

      // Horizontal swipe check
      const swiped = Math.abs(finalX) > threshold || Math.abs(vel.x) > 0.6;

      if (swiped && !callbackFiredRef.current) {
        callbackFiredRef.current = true;
        const dir = finalX > 0 || vel.x > 0.3 ? "right" : "left";
        exitDirRef.current = dir;
        setExitDirection(dir);
        exitVelRef.current = { ...vel };
        setPhase("exiting");

        if (typeof navigator !== "undefined" && "vibrate" in navigator) {
          navigator.vibrate(20);
        }

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
    [threshold, onSwipeLeft, onSwipeRight, onSwipeUp, onTap]
  );

  const onPointerCancel = useCallback(() => {
    activeRef.current = false;
    setDeltaX(0);
    setDeltaY(0);
    setIsDragging(false);
  }, []);

  // Rotation pivots from bottom of card
  const rotation = deltaX * 0.12;
  const tiltY = deltaX * 0.02;

  let style: React.CSSProperties;

  if (phase === "exiting") {
    const vel = exitVelRef.current;
    const dir = exitDirRef.current;

    if (dir === "up") {
      // Fly upward and shrink
      const flyY = Math.min(-600, -400 - Math.abs(vel.y) * 400);
      style = {
        transform: `perspective(1200px) translateX(0) translateY(${flyY}px) rotate(0deg) scale(0.7)`,
        opacity: 0,
        transition: "transform 0.35s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s ease",
        cursor: "default",
        willChange: "transform, opacity",
        transformOrigin: "center 80%",
      };
    } else {
      const flyX =
        dir === "right"
          ? Math.max(800, 400 + Math.abs(vel.x) * 600)
          : Math.min(-800, -400 - Math.abs(vel.x) * 600);
      const flyY = vel.y * 200;
      const flyRot =
        dir === "right" ? 30 + Math.abs(vel.x) * 15 : -30 - Math.abs(vel.x) * 15;
      style = {
        transform: `perspective(1200px) translateX(${flyX}px) translateY(${flyY}px) rotate(${flyRot}deg) scale(0.8)`,
        opacity: 0,
        transition: "transform 0.35s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s ease",
        cursor: "default",
        willChange: "transform, opacity",
        transformOrigin: "center 80%",
      };
    }
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
      transform:
        "perspective(1200px) translateX(0) translateY(0) rotate(0deg) rotateY(0deg) scale(1)",
      transition:
        "transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.5s ease",
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
    exitDirection,
    handlers: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel },
    style,
  };
}
