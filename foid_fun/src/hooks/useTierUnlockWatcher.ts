"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * useTierUnlockWatcher — watches a streak count and surfaces a single tier
 * unlock event when the streak crosses a milestone day that hasn't been
 * celebrated before (persisted via localStorage, wallet-scoped).
 *
 * Contract:
 *  - Returns `pendingUnlock`: the tier level to play (3..10), or null.
 *  - `clearPendingUnlock()` must be called by the caller once the cinematic
 *    has played (or been skipped). It writes the gate localStorage key and
 *    resets internal state. For tier 10 it also writes the pixel easter-egg
 *    flag.
 *  - On first observation of a streak for a given wallet (e.g. page load),
 *    the hook seeds its "previous streak" ref without firing — no retroactive
 *    play for already-at-tier users. localStorage gates survive session end.
 */

type Milestone = { level: number; day: number };

const MILESTONES: readonly Milestone[] = [
  { level: 3, day: 7 },
  { level: 4, day: 14 },
  { level: 5, day: 21 },
  { level: 6, day: 30 },
  { level: 7, day: 45 },
  { level: 8, day: 60 },
  { level: 9, day: 75 },
  { level: 10, day: 90 },
] as const;

const PIXEL_KEY = "foid_tier_10_pixel_unlocked";

function unlockKey(level: number, wallet?: string): string {
  if (wallet) return `foid_tier_unlocked_${wallet.toLowerCase()}_${level}`;
  return `foid_tier_unlocked_${level}`;
}

function readFlag(key: string): boolean {
  try {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

function writeFlag(key: string): void {
  try {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(key, "1");
  } catch {
    // private mode or blocked — swallow
  }
}

export function useTierUnlockWatcher(
  streakNumber: number,
  connected: boolean,
  walletAddress?: string,
) {
  const prevStreakRef = useRef<number | null>(null);
  const prevWalletRef = useRef<string | undefined>(undefined);
  const [pendingUnlock, setPendingUnlock] = useState<number | null>(null);

  useEffect(() => {
    if (!connected) {
      // Reset seed when the wallet disconnects so a reconnect won't replay.
      prevStreakRef.current = null;
      prevWalletRef.current = undefined;
      return;
    }

    // Wallet swap — reseed for the new wallet.
    if (prevWalletRef.current !== walletAddress) {
      prevWalletRef.current = walletAddress;
      prevStreakRef.current = null;
    }

    if (streakNumber <= 0) return;

    // Seed without firing on the first observation for this wallet.
    if (prevStreakRef.current === null) {
      prevStreakRef.current = streakNumber;
      return;
    }

    const prev = prevStreakRef.current;
    const curr = streakNumber;
    prevStreakRef.current = curr;

    if (curr <= prev) return;

    // If multiple milestones crossed in one update (rare — test path), play
    // the highest crossed tier; lower tiers are marked as played silently so
    // they don't replay in a future session.
    let toPlay: number | null = null;
    for (const m of MILESTONES) {
      if (prev < m.day && curr >= m.day) {
        const key = unlockKey(m.level, walletAddress);
        if (readFlag(key)) continue;
        if (toPlay !== null) {
          // Already have a tier queued — silently flag the earlier one.
          writeFlag(unlockKey(toPlay, walletAddress));
        }
        toPlay = m.level;
      }
    }

    if (toPlay !== null) {
      setPendingUnlock(toPlay);
    }
  }, [streakNumber, connected, walletAddress]);

  const clearPendingUnlock = useCallback(() => {
    if (pendingUnlock !== null) {
      writeFlag(unlockKey(pendingUnlock, walletAddress));
      if (pendingUnlock === 10) {
        writeFlag(PIXEL_KEY);
      }
    }
    setPendingUnlock(null);
  }, [pendingUnlock, walletAddress]);

  return { pendingUnlock, clearPendingUnlock };
}
