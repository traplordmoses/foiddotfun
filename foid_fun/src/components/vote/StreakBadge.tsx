"use client";

import { useEffect, useRef, useState } from "react";

export function StreakBadge({ count, trigger }: { count: number; trigger: number }) {
  const [visible, setVisible] = useState(false);
  const lastTrigger = useRef(0);
  useEffect(() => {
    if (trigger <= 0 || trigger === lastTrigger.current || count < 2) return;
    lastTrigger.current = trigger;
    setVisible(true);
    const timer = setTimeout(() => setVisible(false), 850);
    return () => clearTimeout(timer);
  }, [trigger, count]);
  if (!visible || count < 2) return null;
  return (
    <div aria-hidden="true" style={{ position: "absolute", top: 8, left: "50%", transform: "translateX(-50%)", zIndex: 60, pointerEvents: "none" }}>
      <div style={{
        fontSize: count >= 5 ? 28 : 22, fontWeight: 900, color: "#fbbf24",
        textShadow: "0 0 16px rgba(251,191,36,.7),0 0 32px rgba(251,191,36,.4),0 2px 4px rgba(0,0,0,.5)",
        animation: "streak-pop 800ms cubic-bezier(0.34,1.56,0.64,1) forwards", letterSpacing: "0.05em",
      }}>x{count}</div>
    </div>
  );
}
