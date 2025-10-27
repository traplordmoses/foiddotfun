"use client";
import { useRef } from "react";

export default function ParallaxTilt({
  children,
  max = 6,        // deg
  scale = 1.01,
  className = "",
}: {
  children: React.ReactNode;
  max?: number;
  scale?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  const onMove = (e: React.MouseEvent) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    const rx = (+py * max).toFixed(2);
    const ry = (-px * max).toFixed(2);
    el.style.transform = `perspective(800px) rotateX(${rx}deg) rotateY(${ry}deg) scale(${scale})`;
  };

  const reset = () => {
    const el = ref.current;
    if (el) el.style.transform = "perspective(800px) rotateX(0) rotateY(0) scale(1)";
  };

  return (
    <div
      ref={ref}
      onMouseMove={onMove}
      onMouseLeave={reset}
      className={`transition-transform duration-150 will-change-transform ${className}`}
    >
      {children}
    </div>
  );
}
