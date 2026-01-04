"use client";

import { useEffect, useMemo, useState } from "react";
import { getEpochInfo as getEpochInfoBase } from "@/lib/epoch";

export type EpochInfo = { enabled: boolean; index: number; remainingMs: number };

// Server must NEVER enable epochs (prevents “ #0” SSR text)
export function getEpochInfo(nowMs: number): EpochInfo {
  if (typeof window === "undefined") return { enabled: false, index: 0, remainingMs: 0 };

  const info = getEpochInfoBase(nowMs);
  if (!info.enabled) return { enabled: false, index: 0, remainingMs: 0 };
  return { enabled: true, index: info.index, remainingMs: info.remainingMs };
}

export function useEpochCountdown(): EpochInfo {
  const [mounted, setMounted] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => setMounted(true), []);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // First client render matches SSR (disabled), then activate
  return useMemo(() => (mounted ? getEpochInfo(now) : { enabled: false, index: 0, remainingMs: 0 }), [mounted, now]);
}
