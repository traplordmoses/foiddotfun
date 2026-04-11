"use client";

import { useEffect, useRef, useState } from "react";
import type { SwipeDirection } from "@/types/vote";

export function GlowFlash({ direction, trigger }: { direction: SwipeDirection; trigger: number }) {
  const [active, setActive] = useState(false);
  const [dir, setDir] = useState<SwipeDirection>(null);
  const lastTrigger = useRef(0);
  useEffect(() => {
    if (trigger <= 0 || trigger === lastTrigger.current || !direction) return;
    lastTrigger.current = trigger;
    setDir(direction);
    setActive(true);
    const t = setTimeout(() => setActive(false), 300);
    return () => clearTimeout(t);
  }, [trigger, direction]);
  if (!active || !dir) return null;
  const bg = dir === "right"
    ? "radial-gradient(circle,rgba(34,197,94,.55) 0%,transparent 70%)"
    : dir === "left"
    ? "radial-gradient(circle,rgba(239,68,68,.55) 0%,transparent 70%)"
    : "radial-gradient(circle,rgba(139,92,246,.55) 0%,transparent 70%)";
  return <div aria-hidden="true" style={{ position: "absolute", inset: "-20%", zIndex: 0, pointerEvents: "none", background: bg, animation: "glow-flash 300ms ease-out forwards" }} />;
}
