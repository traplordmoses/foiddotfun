"use client";

import { useReadContract } from "wagmi";
import { CONTRACTS } from "@/lib/contracts/addresses";
import { PRAYER_MIRROR_ABI, PRAYER_REGISTRY_ABI } from "@/lib/contracts/abis";

export interface UserStats {
  currentStreak: number;
  longestStreak: number;
  totalPrayers: number;
  proposalsCount: number;
  votesCount: number;
  nextPrayerAt: bigint | null;
}

export function useUserStats(address: `0x${string}` | undefined) {
  // Fetch prayer stats from PrayerMirror
  const {
    data: prayerData,
    isLoading: prayerLoading,
    error: prayerError,
  } = useReadContract({
    address: CONTRACTS.PRAYER_MIRROR as `0x${string}`,
    abi: PRAYER_MIRROR_ABI,
    functionName: "get",
    args: address ? [address] : undefined,
    query: {
      enabled: !!address,
    },
  });

  // Fetch next prayer cooldown from PrayerRegistry
  const { data: nextAllowedData } = useReadContract({
    address: CONTRACTS.PRAYER_REGISTRY as `0x${string}`,
    abi: PRAYER_REGISTRY_ABI,
    functionName: "nextAllowedAt",
    args: address ? [address] : undefined,
    query: {
      enabled: !!address,
    },
  });

  // TODO: Fetch proposals count (from events or separate hook)
  // TODO: Fetch votes count (from events or separate hook)

  const stats: UserStats | null = prayerData
    ? {
        currentStreak: Number(prayerData[0] || 0n),
        longestStreak: Number(prayerData[1] || 0n),
        totalPrayers: Number(prayerData[2] || 0n),
        proposalsCount: 0, // Will be populated by event scanning
        votesCount: 0, // Will be populated by event scanning
        nextPrayerAt: (nextAllowedData as bigint) || null,
      }
    : null;

  return {
    stats,
    isLoading: prayerLoading,
    error: prayerError,
  };
}
