'use client';

import { useCallback } from 'react';
import { useReadContract, useAccount } from 'wagmi';
import { getWalletClient } from '@/lib/viem';
import { CONTRACTS } from '@/lib/contracts/addresses';
import { SWIPE_LOREBOARD_ABI } from '@/lib/contracts/abis/swipeLoreboard';

export interface RemovalVote {
  placementId: bigint;
  startsAt: bigint;
  endsAt: bigint;
  votesFor: bigint;
  votesAgainst: bigint;
  resolved: boolean;
  removalPassed: boolean;
}

// SwipeLoreboard is not deployed in v1 — Swipe handles loreboard proposals natively.
// All read queries are disabled. Write callbacks throw early with descriptive error.
const govAddress = (CONTRACTS.SWIPE_LOREBOARD || "") as `0x${string}`;
const isDeployed = govAddress.length > 2; // more than just "0x" or ""

/** Read governance config + write actions (flag, vote, resolve) for SwipeLoreboard. */
export function useSwipeLoreboardGovernance() {
  const { address } = useAccount();

  const { data: flagFeeWei } = useReadContract({
    address: govAddress,
    abi: SWIPE_LOREBOARD_ABI,
    functionName: 'flagFeeWei',
    query: { enabled: isDeployed },
  });

  const { data: flagThreshold } = useReadContract({
    address: govAddress,
    abi: SWIPE_LOREBOARD_ABI,
    functionName: 'flagThreshold',
    query: { enabled: isDeployed },
  });

  const flagPlacement = useCallback(async (placementId: number) => {
    if (!isDeployed) throw new Error("SwipeLoreboard not deployed — flagging unavailable in v1");
    if (!address) throw new Error("Wallet not connected");
    const fee = flagFeeWei ?? BigInt(CONTRACTS.FLAG_FEE_WEI ?? "1000000000000000");

    const walletClient = await getWalletClient();
    if (!walletClient) throw new Error("No wallet client");

    return walletClient.writeContract({
      address: govAddress,
      abi: SWIPE_LOREBOARD_ABI,
      functionName: 'flagPlacement',
      args: [BigInt(placementId)],
      value: BigInt(fee),
      account: walletClient.account ?? address,
    });
  }, [address, flagFeeWei]);

  const voteOnRemoval = useCallback(async (voteId: number, support: boolean) => {
    if (!isDeployed) throw new Error("SwipeLoreboard not deployed — voting unavailable in v1");
    if (!address) throw new Error("Wallet not connected");

    const walletClient = await getWalletClient();
    if (!walletClient) throw new Error("No wallet client");

    return walletClient.writeContract({
      address: govAddress,
      abi: SWIPE_LOREBOARD_ABI,
      functionName: 'voteOnRemoval',
      args: [BigInt(voteId), support],
      account: walletClient.account ?? address,
    });
  }, [address]);

  const resolveRemovalVote = useCallback(async (voteId: number) => {
    if (!isDeployed) throw new Error("SwipeLoreboard not deployed — resolution unavailable in v1");
    if (!address) throw new Error("Wallet not connected");

    const walletClient = await getWalletClient();
    if (!walletClient) throw new Error("No wallet client");

    return walletClient.writeContract({
      address: govAddress,
      abi: SWIPE_LOREBOARD_ABI,
      functionName: 'resolveRemovalVote',
      args: [BigInt(voteId)],
      account: walletClient.account ?? address,
    });
  }, [address]);

  return {
    flagFeeWei: flagFeeWei ? BigInt(flagFeeWei as bigint) : BigInt(CONTRACTS.FLAG_FEE_WEI),
    flagThreshold: flagThreshold ? Number(flagThreshold) : 3,
    flagPlacement,
    voteOnRemoval,
    resolveRemovalVote,
  };
}

/** Read flag count for a specific placement. */
export function usePlacementFlagCount(placementId: number) {
  const { data, isLoading } = useReadContract({
    address: govAddress,
    abi: SWIPE_LOREBOARD_ABI,
    functionName: 'getFlagCount',
    args: [BigInt(placementId)],
    query: { enabled: isDeployed },
  });
  return { flagCount: data ? Number(data) : 0, isLoading };
}

/** Check if the connected wallet has flagged a placement. */
export function useHasFlaggedPlacement(placementId: number) {
  const { address } = useAccount();
  const { data } = useReadContract({
    address: govAddress,
    abi: SWIPE_LOREBOARD_ABI,
    functionName: 'hasFlagged',
    args: address ? [BigInt(placementId), address] : undefined,
    query: { enabled: isDeployed && !!address },
  });
  return !!data;
}

/** Get the active removal vote ID for a placement (0 if none). */
export function useActivePlacementVote(placementId: number) {
  const { data: voteId } = useReadContract({
    address: govAddress,
    abi: SWIPE_LOREBOARD_ABI,
    functionName: 'activeVoteForPlacement',
    args: [BigInt(placementId)],
    query: { enabled: isDeployed },
  });
  return voteId ? Number(voteId) : 0;
}

/** Read removal vote details by voteId. */
export function usePlacementRemovalVote(voteId: number) {
  const { data, isLoading } = useReadContract({
    address: govAddress,
    abi: SWIPE_LOREBOARD_ABI,
    functionName: 'getRemovalVote',
    args: [BigInt(voteId)],
    query: { enabled: isDeployed && voteId > 0 },
  });
  return { vote: data as RemovalVote | undefined, isLoading };
}

/** Check if the connected wallet has voted on a removal vote. */
export function useHasVotedOnPlacementRemoval(voteId: number) {
  const { address } = useAccount();
  const { data } = useReadContract({
    address: govAddress,
    abi: SWIPE_LOREBOARD_ABI,
    functionName: 'hasVotedOnRemoval',
    args: address ? [BigInt(voteId), address] : undefined,
    query: { enabled: isDeployed && !!address && voteId > 0 },
  });
  return !!data;
}
