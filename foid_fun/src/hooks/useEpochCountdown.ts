"use client";

import { useEffect, useMemo, useState } from "react";

export type EpochInfo = { enabled: boolean; index: number; remainingMs: number };

const EPOCH_BASE_SEC = 32 * 12;
const n = (v?: string) => (v && Number.isFinite(+v) ? +v : 0);

function compute(nowMs: number, startUnix: number, lenSec: number): EpochInfo {
  const nowSec = Math.floor(nowMs / 1000);
  const idx = Math.floor(Math.max(0, nowSec - startUnix) / lenSec);
  const nextEndSec = startUnix + (idx + 1) * lenSec;
  return { enabled: true, index: idx, remainingMs: Math.max(0, (nextEndSec - nowSec) * 1000) };
}

// Server must NEVER enable epochs (prevents “ #0” SSR text)
export function getEpochInfo(nowMs: number): EpochInfo {
  if (typeof window === "undefined") return { enabled: false, index: 0, remainingMs: 0 };

  const startUnix = n(process.env.NEXT_PUBLIC_EPOCH_START_UNIX);
  let lenSec = n(process.env.NEXT_PUBLIC_EPOCH_LENGTH_SEC);
  const k = n(process.env.NEXT_PUBLIC_EPOCH_K);
  if (!lenSec && k) lenSec = k * EPOCH_BASE_SEC;

  if (startUnix > 0 && lenSec > 0) return compute(nowMs, startUnix, lenSec);

  // client-only fallback so you see a clock even w/o envs
  const nowSec = Math.floor(nowMs / 1000);
  return compute(nowMs, nowSec - 60, 900);
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
