// /src/lib/epoch.ts

export type EpochInfo = {
  enabled: boolean;
  index: number;        // epochId
  remainingMs: number;  // ms until end of current epoch
  secondsLeft: number;  // convenience
  endsAtSec: number;    // unix seconds when this epoch ends
  lengthSec: number;    // epoch length
  startUnix: number;    // configured epoch 0 start
};

// 32 slots × 12s = 384s ≈ 6.4 minutes
export const EPOCH_BASE_SEC = 32 * 12;

function readNum(v: string | undefined): number {
  if (v == null) return 0;
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : 0;
}

function resolveEpochZeroUnix(): number {
  return (
    readNum(process.env.NEXT_PUBLIC_EPOCH_ZERO_UNIX) ||
    readNum(process.env.NEXT_PUBLIC_EPOCH_START_UNIX)
  );
}

function resolveEpochSeconds(): number {
  const direct = readNum(process.env.NEXT_PUBLIC_EPOCH_SECONDS);
  if (direct) return direct;
  const legacy = readNum(process.env.NEXT_PUBLIC_EPOCH_LENGTH_SEC);
  if (legacy) return legacy;
  const k = readNum(process.env.NEXT_PUBLIC_EPOCH_K);
  return k ? k * EPOCH_BASE_SEC : 0;
}

export const EPOCH_ZERO_UNIX = resolveEpochZeroUnix();
export const EPOCH_SECONDS = resolveEpochSeconds();
export const VOTE_WINDOW_SECONDS = (() => {
  const value = readNum(process.env.NEXT_PUBLIC_VOTE_WINDOW_SECONDS);
  return value > 0 ? value : 259200;
})();

/**
 * Pure function: safe on server & client.
 * Reads envs:
 *  - NEXT_PUBLIC_EPOCH_ZERO_UNIX (or NEXT_PUBLIC_EPOCH_START_UNIX)
 *  - NEXT_PUBLIC_EPOCH_SECONDS (or NEXT_PUBLIC_EPOCH_LENGTH_SEC)
 *  - NEXT_PUBLIC_EPOCH_K  (multiplier of 6.4 minutes)
 */
export function getEpochInfo(nowMs: number): EpochInfo {
  const nowSec = Math.floor(nowMs / 1000);
  const envEnabled = EPOCH_ZERO_UNIX > 0 && EPOCH_SECONDS > 0;

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

  return compute(nowSec, EPOCH_ZERO_UNIX, EPOCH_SECONDS, true);
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

export function nowUnix(): number {
  return Math.floor(Date.now() / 1000);
}

export function currentEpoch(): number {
  return getEpochInfo(Date.now()).index;
}

export function secondsLeftInEpoch(): number {
  return getEpochInfo(Date.now()).secondsLeft;
}

export function voteWindowEpochs(): number {
  if (EPOCH_SECONDS <= 0) return 1;
  return Math.max(1, Math.ceil(VOTE_WINDOW_SECONDS / EPOCH_SECONDS));
}
