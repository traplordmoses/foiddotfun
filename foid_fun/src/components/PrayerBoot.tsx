"use client";

import { useEffect, useState } from "react";

/**
 * PrayerBoot — a once-per-session arrival flourish for /pray on phones.
 *
 * /pray is server-rendered, so the terminal is already on screen by the time
 * this mounts after hydration. The old 700ms boot screen (black backdrop,
 * mommy GIF, typed title) therefore landed as a flash of black over a page
 * the visitor was already reading, and it downloaded a 140 KB animated WebP
 * to do it. Now one mint scanline sweeps down over the visible page: the
 * terminal "powers on" without hiding anything or blocking a tap.
 *
 * Runs once per session (sessionStorage key: "foid_pray_booted"), never on
 * desktop, and not at all under prefers-reduced-motion.
 */

const STORAGE_KEY = "foid_pray_booted";
// Sweep length; the element unmounts shortly after it ends.
const SWEEP_MS = 520;

export default function PrayerBoot() {
  const [active, setActive] = useState(false);

  useEffect(() => {
    // Mobile-only, matching the lg:hidden mobile tree this sits in.
    if (window.innerWidth >= 1024) return;
    try {
      if (sessionStorage.getItem(STORAGE_KEY) === "1") return;
      sessionStorage.setItem(STORAGE_KEY, "1");
    } catch {
      // private mode: play once for this page view
    }
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    setActive(true);
    const timer = window.setTimeout(() => setActive(false), SWEEP_MS + 80);
    return () => window.clearTimeout(timer);
  }, []);

  if (!active) return null;

  return (
    <div className="prayer-boot" aria-hidden="true">
      <div className="prayer-boot__scanline" />
      <style jsx>{`
        .prayer-boot {
          position: fixed;
          inset: 0;
          z-index: 9999;
          overflow: hidden;
          pointer-events: none;
        }
        .prayer-boot__scanline {
          position: absolute;
          left: 0;
          right: 0;
          top: 0;
          height: 2px;
          background: var(--foid-mint);
          box-shadow: 0 0 14px rgba(110, 234, 216, 0.6), 0 0 42px rgba(110, 234, 216, 0.22);
          opacity: 0;
          will-change: transform, opacity;
          animation: prayer-boot-sweep 520ms cubic-bezier(0.4, 0, 0.2, 1) forwards;
        }
        @keyframes prayer-boot-sweep {
          0% {
            transform: translateY(0);
            opacity: 0;
          }
          12% {
            opacity: 0.6;
          }
          85% {
            opacity: 0.6;
          }
          100% {
            transform: translateY(100vh);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
}
