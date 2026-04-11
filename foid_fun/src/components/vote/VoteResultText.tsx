"use client";

import { useEffect, useRef, useState } from "react";
import type { SwipeDirection } from "@/types/vote";

export function VoteResultText({ direction, trigger }: { direction: SwipeDirection; trigger: number }) {
  const [active, setActive] = useState(false);
  const [dir, setDir] = useState<SwipeDirection>(null);
  const lastTrigger = useRef(0);
  useEffect(() => {
    if (trigger <= 0 || trigger === lastTrigger.current || !direction) return;
    lastTrigger.current = trigger;
    setDir(direction);
    setActive(true);
    const t = setTimeout(() => setActive(false), 600);
    return () => clearTimeout(t);
  }, [trigger, direction]);
  if (!active || !dir) return null;
  const text = dir === "right" ? "APPROVED" : dir === "left" ? "REJECTED" : "SKIPPED";
  const color = dir === "right" ? "#22c55e" : dir === "left" ? "#ef4444" : "#a78bfa";
  return (
    <div aria-hidden="true" style={{ position: "absolute", inset: 0, zIndex: 55, pointerEvents: "none", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <span style={{
        fontSize: "clamp(32px,8vw,56px)", fontWeight: 900, color, letterSpacing: "0.12em", textTransform: "uppercase",
        textShadow: `0 0 40px ${color}80,0 0 80px ${color}40`,
        animation: "vote-result-text 600ms ease-out forwards",
      }}>{text}</span>
    </div>
  );
}
