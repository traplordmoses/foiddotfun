"use client";

import { useReadContract, usePublicClient } from "wagmi";
import { useEffect, useState } from "react";
import { parseAbiItem, type Address } from "viem";
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
  const client = usePublicClient();
  const [proposalsCount, setProposalsCount] = useState(0);
  const [votesCount, setVotesCount] = useState(0);

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

  // Fetch proposals + votes count from Swipe contract events
  useEffect(() => {
    if (!address || !client) return;

    const swipeAddress = CONTRACTS.SWIPE as Address;

    async function fetchCounts() {
      try {
        // Count Proposed events where user is the proposer (indexed param)
        const proposedLogs = await client!.getLogs({
          address: swipeAddress,
          event: parseAbiItem(
            "event Proposed(uint256 indexed proposalId, address indexed proposer, string ipfsCid, uint256 votingEndsAt)"
          ),
          args: { proposer: address as Address },
          fromBlock: 21984763n,
          toBlock: "latest",
        });
        setProposalsCount(proposedLogs.length);
      } catch {
        // Swipe contract may not support this event shape — fallback to 0
        setProposalsCount(0);
      }

      try {
        // Count votes from SQLite via API (EIP-712 votes aren't onchain events)
        const res = await fetch(`/api/swipe/vote?voter=${address}&count=true`);
        if (res.ok) {
          const data = await res.json();
          setVotesCount(data.count ?? 0);
        }
      } catch {
        setVotesCount(0);
      }
    }

    void fetchCounts();
  }, [address, client]);

  const stats: UserStats | null = prayerData
    ? {
        currentStreak: Number(prayerData[0] || 0n),
        longestStreak: Number(prayerData[1] || 0n),
        totalPrayers: Number(prayerData[2] || 0n),
        proposalsCount,
        votesCount,
        nextPrayerAt: (nextAllowedData as bigint) || null,
      }
    : null;

  return {
    stats,
    isLoading: prayerLoading,
    error: prayerError,
  };
}
