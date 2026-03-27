'use client';

import { useReadContract, useAccount } from 'wagmi';
import { CONTRACTS } from '@/lib/contracts/addresses';
import { STREAK_VOTING_POWER_ABI } from '@/lib/contracts/abis/streakVotingPower';
import { usePrayerTiers } from '@/hooks/usePrayerTiers';

/**
 * Reads the connected wallet's voting power from StreakVotingPower contract.
 * Returns the raw power, a human-friendly multiplier, and the prayer tier name.
 */
export function useSwipeVotingPower() {
  const { address } = useAccount();
  const contractAddress = (CONTRACTS.STREAK_VOTING_POWER ?? '') as `0x${string}`;
  const enabled = !!address && !!contractAddress;

  const { data: rawPower, isLoading: powerLoading } = useReadContract({
    address: contractAddress,
    abi: STREAK_VOTING_POWER_ABI,
    functionName: 'votingPowerOf',
    args: address ? [address, BigInt(0)] : undefined,
    query: { enabled },
  });

  const { data: baseWeight } = useReadContract({
    address: contractAddress,
    abi: STREAK_VOTING_POWER_ABI,
    functionName: 'baseWeight',
    query: { enabled: !!contractAddress },
  });

  const { tier, isLoading: tierLoading } = usePrayerTiers(address);

  const power = rawPower != null ? Number(rawPower as bigint) : 0;
  const base = baseWeight != null ? Number(baseWeight as bigint) : 0;
  const multiplier = base > 0 && power > 0 ? power / base : power > 0 ? 1 : 0;

  return {
    votingPower: power,
    baseWeight: base,
    multiplier,
    tierName: tier?.name ?? null,
    tierLevel: tier?.level ?? 0,
    isLoading: powerLoading || tierLoading,
  };
}
