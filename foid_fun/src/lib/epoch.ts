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

export function readInt(v: string | undefined): number {
  if (v == null) return 0;
  const s = String(v).trim();
  if (!s) return 0;
  const n = parseInt(s, 10);
  return Number.isFinite(n) ? n : 0;
}

export function resolveEpochConfig() {
  const zeroUnix =
    readInt(process.env.NEXT_PUBLIC_EPOCH_ZERO_UNIX) ||
    readInt(process.env.NEXT_PUBLIC_EPOCH_START_UNIX);

  const epochSec =
    readInt(process.env.NEXT_PUBLIC_EPOCH_SECONDS) ||
    readInt(process.env.NEXT_PUBLIC_EPOCH_LENGTH_SEC);

  const enabled = zeroUnix > 0 && epochSec > 0;
  return { enabled, zeroUnix, epochSec };
}

export const EPOCH_ZERO_UNIX = resolveEpochConfig().zeroUnix;
export const EPOCH_SECONDS = resolveEpochConfig().epochSec;
export const VOTE_WINDOW_SECONDS = (() => {
  const value = readInt(process.env.NEXT_PUBLIC_VOTE_WINDOW_SECONDS);
  return value > 0 ? value : 259200;
})();

/**
 * Pure function: safe on server & client.
 * Reads envs:
 *  - NEXT_PUBLIC_EPOCH_ZERO_UNIX (or NEXT_PUBLIC_EPOCH_START_UNIX)
 *  - NEXT_PUBLIC_EPOCH_SECONDS (or NEXT_PUBLIC_EPOCH_LENGTH_SEC)
 *  - NEXT_PUBLIC_EPOCH_K  (multiplier of 6.4 minutes)
 */
export function epochInfo(nowMs = Date.now()): EpochInfo {
  const { enabled, zeroUnix, epochSec } = resolveEpochConfig();
  if (!enabled) {
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

  const nowSec = Math.floor(nowMs / 1000);
  return compute(nowSec, zeroUnix, epochSec, true);
}

export function getEpochInfo(nowMs: number): EpochInfo {
  return epochInfo(nowMs);
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
  return epochInfo().index;
}

export function secondsLeftInEpoch(): number {
  return epochInfo().secondsLeft;
}

export function voteWindowEpochs(): number {
  const { epochSec } = resolveEpochConfig();
  if (epochSec <= 0) return 1;
  return Math.max(1, Math.ceil(VOTE_WINDOW_SECONDS / epochSec));
}
