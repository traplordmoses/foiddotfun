"use client";

import { useEffect, useState } from "react";

/**
 * Returns a human-readable countdown string for a UNIX timestamp (seconds).
 * Updates every 30 s while time remains; returns "ended" once past.
 */
export function useCountdown(votingEndsAt: number): string {
  const [remaining, setRemaining] = useState("");

  useEffect(() => {
    const tick = () => {
      const diff = votingEndsAt - Math.floor(Date.now() / 1000);
      if (diff <= 0) {
        setRemaining("ended");
        return;
      }
      const h = Math.floor(diff / 3600);
      const m = Math.floor((diff % 3600) / 60);
      setRemaining(h > 0 ? `${h}h ${m}m left` : `${m}m left`);
    };
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, [votingEndsAt]);

  return remaining;
}
