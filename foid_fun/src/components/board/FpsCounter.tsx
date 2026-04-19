// /src/components/board/FpsCounter.tsx
// Tiny rAF-based FPS meter for the board HUD. Auto-unmounts after
// `durationMs` so it only appears briefly around a placement event.
"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
  /** Duration to stay mounted before signaling done. Default 10s. */
  durationMs?: number;
  /** Called when the timer elapses. Caller is responsible for unmounting. */
  onDone?: () => void;
};

export function FpsCounter({ durationMs = 10_000, onDone }: Props) {
  const [fps, setFps] = useState(0);
  const rafRef = useRef(0);
  useEffect(() => {
    let last = performance.now();
    let frames = 0;
    let acc = 0;
    const tick = (now: number) => {
      frames++;
      acc += now - last;
      last = now;
      if (acc >= 500) {
        setFps(Math.round((frames / acc) * 1000));
        acc = 0;
        frames = 0;
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    const kill = window.setTimeout(() => {
      onDone?.();
    }, durationMs);
    return () => {
      cancelAnimationFrame(rafRef.current);
      window.clearTimeout(kill);
    };
  }, [durationMs, onDone]);

  return (
    <div
      aria-hidden="true"
      style={{
        position: "absolute",
        bottom: 12,
        right: 12,
        padding: "4px 8px",
        background: "rgba(0, 0, 0, 0.7)",
        border: "1px solid rgba(116, 255, 235, 0.4)",
        borderRadius: 6,
        color: fps >= 55 ? "#74ffeb" : fps >= 30 ? "#fbbf24" : "#f472b6",
        fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
        fontSize: 11,
        letterSpacing: 1,
        zIndex: 200,
      }}
    >
      {fps} fps
    </div>
  );
}
