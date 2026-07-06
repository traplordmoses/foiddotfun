// src/components/SkyTint.tsx
// Living-wallpaper layer: a whisper-quiet color wash over the animated sky
// that tracks the visitor's local time of day. Dawn warms the horizon, dusk
// goes amber-violet, night sinks into indigo. Sits between the wallpaper
// and the app windows, never intercepts input, and drifts slowly enough
// that you only notice it if you stare.
"use client";

import { useEffect, useState } from "react";

type Sky = "dawn" | "day" | "dusk" | "night";

function skyForHour(hour: number): Sky {
  if (hour >= 5 && hour < 8) return "dawn";
  if (hour >= 8 && hour < 17) return "day";
  if (hour >= 17 && hour < 21) return "dusk";
  return "night";
}

export function SkyTint() {
  // Render nothing until mounted — time-of-day is client state, and a
  // server-guessed sky would flash-correct on hydration.
  const [sky, setSky] = useState<Sky | null>(null);

  useEffect(() => {
    const update = () => setSky(skyForHour(new Date().getHours()));
    update();
    const interval = window.setInterval(update, 10 * 60 * 1000);
    return () => window.clearInterval(interval);
  }, []);

  if (!sky) return null;

  return (
    <>
      <div className={`sky-tint sky-tint--${sky}`} aria-hidden="true" />
      <style jsx global>{`
        .sky-tint {
          position: fixed;
          inset: 0;
          z-index: 1; /* above the wallpaper canvas, below .app-viewport (z: 2) */
          pointer-events: none;
          mix-blend-mode: soft-light;
          background-size: 200% 200%;
          animation: sky-drift 120s ease-in-out infinite alternate;
          transition: opacity 3s ease;
        }
        .sky-tint--dawn {
          opacity: 0.5;
          background: linear-gradient(
            200deg,
            rgba(255, 190, 150, 0.5) 0%,
            rgba(255, 150, 180, 0.3) 40%,
            rgba(60, 90, 160, 0.2) 100%
          );
        }
        .sky-tint--day {
          opacity: 0.35;
          background: linear-gradient(
            180deg,
            rgba(170, 230, 255, 0.45) 0%,
            rgba(120, 190, 240, 0.2) 55%,
            rgba(255, 255, 255, 0.08) 100%
          );
        }
        .sky-tint--dusk {
          opacity: 0.5;
          background: linear-gradient(
            195deg,
            rgba(255, 170, 110, 0.4) 0%,
            rgba(200, 110, 200, 0.32) 45%,
            rgba(50, 40, 120, 0.3) 100%
          );
        }
        .sky-tint--night {
          opacity: 0.55;
          background: linear-gradient(
            180deg,
            rgba(20, 30, 90, 0.5) 0%,
            rgba(30, 20, 70, 0.35) 55%,
            rgba(5, 10, 40, 0.45) 100%
          );
        }
        @keyframes sky-drift {
          0% {
            background-position: 0% 0%;
          }
          100% {
            background-position: 100% 100%;
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .sky-tint {
            animation: none;
          }
        }
      `}</style>
    </>
  );
}
