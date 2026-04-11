"use client";

import { useEffect, useRef, useState } from "react";
import type { SwipeDirection } from "@/types/vote";

export function SwipeParticles({ direction, trigger }: { direction: SwipeDirection; trigger: number }) {
  const [particles, setParticles] = useState<{ id: number; angle: number; dist: number; color: string; size: number; square: boolean; delay: number }[]>([]);
  const lastTrigger = useRef(0);

  useEffect(() => {
    if (trigger <= 0 || trigger === lastTrigger.current || !direction) return;
    lastTrigger.current = trigger;
    const colors = direction === "right"
      ? ["#22c55e","#06b6d4","#34d399","#10b981","#6ee7b7","#2dd4bf"]
      : direction === "left"
      ? ["#ef4444","#f87171","#dc2626","#fb923c","#f43f5e","#e11d48"]
      : ["#a78bfa","#8b5cf6","#c084fc","#7c3aed","#a855f7","#6d28d9"];
    const count = 20 + Math.floor(Math.random() * 6);
    const baseAngle = direction === "up" ? -Math.PI / 2 : 0;
    const spread = direction === "up" ? Math.PI * 0.6 : Math.PI * 2;
    setParticles(Array.from({ length: count }, (_, i) => ({
      id: i,
      angle: baseAngle + (spread * i) / count + (Math.random() - 0.5) * 0.5,
      dist: 80 + Math.random() * 140,
      color: colors[Math.floor(Math.random() * colors.length)],
      size: 4 + Math.random() * 4,
      square: Math.random() > 0.65,
      delay: Math.random() < 0.4 ? Math.random() * 80 : 0,
    })));
    const timer = setTimeout(() => setParticles([]), 700);
    return () => clearTimeout(timer);
  }, [trigger, direction]);

  if (particles.length === 0) return null;
  return (
    <div aria-hidden="true" style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 50, overflow: "hidden" }}>
      <div style={{ position: "absolute", top: "50%", left: "50%", width: 0, height: 0 }}>
        {particles.map((p) => (
          <div key={p.id} style={{
            position: "absolute", width: p.size, height: p.size,
            borderRadius: p.square ? "2px" : "50%", backgroundColor: p.color,
            boxShadow: `0 0 8px ${p.color}`,
            "--px": `${Math.cos(p.angle) * p.dist}px`,
            "--py": `${Math.sin(p.angle) * p.dist}px`,
            animation: "swipe-particle 550ms cubic-bezier(0.25,0.46,0.45,0.94) forwards",
            animationDelay: `${p.delay}ms`, opacity: 0,
          } as React.CSSProperties} />
        ))}
      </div>
    </div>
  );
}
