// /src/lib/epoch.ts

export type EpochInfo = {
  enabled: boolean;
  index: number;        // epochId
  remainingMs: number;  // ms until end of current epoch
  secondsLeft: number;  // convenience
  endsAtSec: number;    // unix seconds when this epoch ends
  lengthSec: number;    // epoch length
  startUnix: number;    // configured (or fallback) epoch 0 start
};

// 32 slots × 12s = 384s ≈ 6.4 minutes
export const EPOCH_BASE_SEC = 32 * 12;

function readNum(v: string | undefined): number {
  if (v == null) return 0;
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Pure function: safe on server & client.
 * Reads envs:
 *  - NEXT_PUBLIC_EPOCH_START_UNIX
 *  - NEXT_PUBLIC_EPOCH_LENGTH_SEC (or)
 *  - NEXT_PUBLIC_EPOCH_K  (multiplier of 6.4 minutes)
 *
 * Dev fallback (no envs in browser): 15-minute rolling epochs aligned to boundaries.
 */
export function getEpochInfo(nowMs: number): EpochInfo {
  const startUnix = readNum(process.env.NEXT_PUBLIC_EPOCH_START_UNIX);
  let lengthSec = readNum(process.env.NEXT_PUBLIC_EPOCH_LENGTH_SEC);
  const k = readNum(process.env.NEXT_PUBLIC_EPOCH_K);
  if (!lengthSec && k) lengthSec = k * EPOCH_BASE_SEC;

  const envEnabled = startUnix > 0 && lengthSec > 0;
  const nowSec = Math.floor(nowMs / 1000);

  // Fallback: align to clean 15-minute boundaries so the timer looks real.
  if (!envEnabled && typeof window !== "undefined") {
    const fallbackLen = 15 * 60; // 900
    const fallbackStart = Math.floor(nowSec / fallbackLen) * fallbackLen; // boundary
    return compute(nowSec, fallbackStart, fallbackLen, true);
  }

  if (!envEnabled) {
    return {
      enabled: false,
      index: 0,
      remainingMs: 0,
      secondsLeft: 0,
      endsAtSec: 0,
      lengthSec: 0,
      startUnix: 0,
    };
  }

  return compute(nowSec, startUnix, lengthSec, true);
}

function compute(
  nowSec: number,
  startUnix: number,
  lengthSec: number,
  enabled: boolean
): EpochInfo {
  const elapsedSec = Math.max(0, nowSec - startUnix);
  const index = Math.floor(elapsedSec / lengthSec);
  const endsAtSec = startUnix + (index + 1) * lengthSec;
  const secondsLeft = Math.max(0, endsAtSec - nowSec);
  const remainingMs = secondsLeft * 1000;
  return { enabled, index, remainingMs, secondsLeft, endsAtSec, lengthSec, startUnix };
}

// ---------------------------------------------------------------------------
// Lightweight helpers used by server + client for the referendum flow.
// ---------------------------------------------------------------------------

export const EPOCH_SECONDS = Number(process.env.NEXT_PUBLIC_EPOCH_SECONDS ?? 3600);
export const EPOCH_ZERO_UNIX = Number(process.env.NEXT_PUBLIC_EPOCH_ZERO_UNIX ?? 1730937600);

export function nowUnix(): number {
  return Math.floor(Date.now() / 1000);
}

export function currentEpoch(): number {
  const delta = Math.max(0, nowUnix() - EPOCH_ZERO_UNIX);
  return Math.floor(delta / EPOCH_SECONDS);
}

export function secondsLeftInEpoch(): number {
  const delta = Math.max(0, nowUnix() - EPOCH_ZERO_UNIX);
  const s = EPOCH_SECONDS - (delta % EPOCH_SECONDS);
  return s === EPOCH_SECONDS ? 0 : s;
}
