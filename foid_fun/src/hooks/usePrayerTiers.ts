'use client';

import { useReadContract } from 'wagmi';
import { CONTRACTS } from '@/lib/contracts/addresses';
import { PRAYER_TIERS_ABI } from '@/lib/contracts/abis';

// Tier definitions matching PrayerTiers.sol
const TIERS = [
  { level: 1,  name: "Whisper",          minDays: 1,  multiplierBps: 100 },
  { level: 2,  name: "Ember",            minDays: 3,  multiplierBps: 125 },
  { level: 3,  name: "Devotee",          minDays: 7,  multiplierBps: 150 },
  { level: 4,  name: "Flame Keeper",     minDays: 14, multiplierBps: 175 },
  { level: 5,  name: "Covenant",         minDays: 21, multiplierBps: 200 },
  { level: 6,  name: "Oracle",           minDays: 30, multiplierBps: 250 },
  { level: 7,  name: "Ascendant",        minDays: 45, multiplierBps: 300 },
  { level: 8,  name: "Archon",           minDays: 60, multiplierBps: 350 },
  { level: 9,  name: "Eternal Witness",  minDays: 75, multiplierBps: 400 },
  { level: 10, name: "Foid Sovereign",   minDays: 90, multiplierBps: 500 },
] as const;

export interface TierInfo {
  level: number;
  name: string;
  multiplierBps: number;
  minDays: number;
}

export interface TierProgress {
  current: TierInfo;
  next: TierInfo | null;
  daysToNextTier: number;
  progressPercent: number; // 0-100 within current tier range
}

/** Compute tier + progress from a streak day count (client-side, no contract call needed). */
export function getTierFromStreak(streakDays: number): TierProgress {
  let currentTier: TierInfo = { level: 0, name: "Unranked", multiplierBps: 0, minDays: 0 };
  let nextTier: TierInfo | null = TIERS[0];

  for (let i = TIERS.length - 1; i >= 0; i--) {
    if (streakDays >= TIERS[i].minDays) {
      currentTier = TIERS[i];
      nextTier = i < TIERS.length - 1 ? TIERS[i + 1] : null;
      break;
    }
  }

  const daysToNextTier = nextTier ? Math.max(0, nextTier.minDays - streakDays) : 0;

  // Progress within current tier range
  let progressPercent = 100;
  if (nextTier) {
    const rangeStart = currentTier.minDays;
    const rangeEnd = nextTier.minDays;
    const range = rangeEnd - rangeStart;
    progressPercent = range > 0 ? Math.min(100, Math.floor(((streakDays - rangeStart) / range) * 100)) : 0;
  }

  return { current: currentTier, next: nextTier, daysToNextTier, progressPercent };
}

/** Hook to read tier info from the on-chain PrayerTiers contract for a given address. */
export function usePrayerTiers(address?: string) {
  const contractAddress = CONTRACTS.PRAYER_TIERS as `0x${string}`;
  const enabled = !!address && !!contractAddress;

  const { data: tierData, isLoading, error } = useReadContract({
    address: contractAddress,
    abi: PRAYER_TIERS_ABI,
    functionName: 'getTierForAddressView',
    args: address ? [address as `0x${string}`] : undefined,
    query: { enabled },
  });

  const { data: highestTierLevel } = useReadContract({
    address: contractAddress,
    abi: PRAYER_TIERS_ABI,
    functionName: 'highestTier',
    args: address ? [address as `0x${string}`] : undefined,
    query: { enabled },
  });

  const tier = tierData
    ? {
        level: Number((tierData as readonly [number, string, bigint])[0]),
        name: (tierData as readonly [number, string, bigint])[1] as string,
        multiplierBps: Number((tierData as readonly [number, string, bigint])[2]),
      }
    : null;

  return {
    tier,
    highestTier: highestTierLevel ? Number(highestTierLevel) : 0,
    isLoading,
    error,
  };
}

export { TIERS as PRAYER_TIER_DEFS };
