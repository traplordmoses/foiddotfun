'use client';

import { useCallback } from 'react';
import { useReadContract, useAccount } from 'wagmi';
import { getWalletClient } from '@/lib/viem';
import { CONTRACTS } from '@/lib/contracts/addresses';
import { FOID_TREST_GOVERNANCE_ABI } from '@/lib/contracts/abis';

export interface RemovalVote {
  entryId: bigint;
  startsAt: bigint;
  endsAt: bigint;
  votesFor: bigint;
  votesAgainst: bigint;
  resolved: boolean;
  removalPassed: boolean;
}

// FoidTrestGovernance is not deployed in v1 — address is empty.
// All read queries are disabled (enabled: isDeployed). Write callbacks throw early.
const govAddress = (CONTRACTS.FOID_TREST_GOVERNANCE || "") as `0x${string}`;
const isDeployed = govAddress.length > 2; // more than just "0x" or ""

/** Read governance config + write actions (flag, vote, resolve). */
export function useFoidTrestGovernance() {
  const { address } = useAccount();

  const { data: flagFeeWei } = useReadContract({
    address: govAddress,
    abi: FOID_TREST_GOVERNANCE_ABI,
    functionName: 'flagFeeWei',
    query: { enabled: isDeployed },
  });

  const { data: flagThreshold } = useReadContract({
    address: govAddress,
    abi: FOID_TREST_GOVERNANCE_ABI,
    functionName: 'flagThreshold',
    query: { enabled: isDeployed },
  });

  const flagPost = useCallback(async (entryId: number) => {
    if (!isDeployed) throw new Error("FoidTrestGovernance not deployed yet");
    if (!address) throw new Error("Wallet not connected");
    const fee = flagFeeWei ?? BigInt(CONTRACTS.FLAG_FEE_WEI ?? "1000000000000000");

    const walletClient = await getWalletClient();
    if (!walletClient) throw new Error("No wallet client");

    return walletClient.writeContract({
      address: govAddress,
      abi: FOID_TREST_GOVERNANCE_ABI,
      functionName: 'flagPost',
      args: [BigInt(entryId)],
      value: BigInt(fee),
      account: walletClient.account ?? address,
    });
  }, [address, flagFeeWei]);

  const voteOnRemoval = useCallback(async (voteId: number, support: boolean) => {
    if (!isDeployed) throw new Error("FoidTrestGovernance not deployed yet");
    if (!address) throw new Error("Wallet not connected");

    const walletClient = await getWalletClient();
    if (!walletClient) throw new Error("No wallet client");

    return walletClient.writeContract({
      address: govAddress,
      abi: FOID_TREST_GOVERNANCE_ABI,
      functionName: 'voteOnRemoval',
      args: [BigInt(voteId), support],
      account: walletClient.account ?? address,
    });
  }, [address]);

  const resolveRemovalVote = useCallback(async (voteId: number) => {
    if (!isDeployed) throw new Error("FoidTrestGovernance not deployed yet");
    if (!address) throw new Error("Wallet not connected");

    const walletClient = await getWalletClient();
    if (!walletClient) throw new Error("No wallet client");

    return walletClient.writeContract({
      address: govAddress,
      abi: FOID_TREST_GOVERNANCE_ABI,
      functionName: 'resolveRemovalVote',
      args: [BigInt(voteId)],
      account: walletClient.account ?? address,
    });
  }, [address]);

  return {
    flagFeeWei: flagFeeWei ? BigInt(flagFeeWei as bigint) : BigInt(CONTRACTS.FLAG_FEE_WEI),
    flagThreshold: flagThreshold ? Number(flagThreshold) : 7,
    flagPost,
    voteOnRemoval,
    resolveRemovalVote,
  };
}

/** Read flag count for a specific entry. */
export function useFlagCount(entryId: number) {
  const { data, isLoading } = useReadContract({
    address: govAddress,
    abi: FOID_TREST_GOVERNANCE_ABI,
    functionName: 'getFlagCount',
    args: [BigInt(entryId)],
    query: { enabled: isDeployed },
  });
  return { flagCount: data ? Number(data) : 0, isLoading };
}

/** Check if the connected wallet has flagged an entry. */
export function useHasFlagged(entryId: number) {
  const { address } = useAccount();
  const { data } = useReadContract({
    address: govAddress,
    abi: FOID_TREST_GOVERNANCE_ABI,
    functionName: 'hasFlagged',
    args: address ? [BigInt(entryId), address] : undefined,
    query: { enabled: isDeployed && !!address },
  });
  return !!data;
}

/** Get the active removal vote ID for an entry (0 if none). */
export function useActiveVote(entryId: number) {
  const { data: voteId } = useReadContract({
    address: govAddress,
    abi: FOID_TREST_GOVERNANCE_ABI,
    functionName: 'activeVoteForEntry',
    args: [BigInt(entryId)],
    query: { enabled: isDeployed },
  });
  return voteId ? Number(voteId) : 0;
}

/** Read removal vote details by voteId. */
export function useRemovalVote(voteId: number) {
  const { data, isLoading } = useReadContract({
    address: govAddress,
    abi: FOID_TREST_GOVERNANCE_ABI,
    functionName: 'getVote',
    args: [BigInt(voteId)],
    query: { enabled: isDeployed && voteId > 0 },
  });
  return { vote: data as RemovalVote | undefined, isLoading };
}

/** Check if the connected wallet has voted on a removal vote. */
export function useHasVotedOnRemoval(voteId: number) {
  const { address } = useAccount();
  const { data } = useReadContract({
    address: govAddress,
    abi: FOID_TREST_GOVERNANCE_ABI,
    functionName: 'hasVotedOnRemoval',
    args: address ? [BigInt(voteId), address] : undefined,
    query: { enabled: isDeployed && !!address && voteId > 0 },
  });
  return !!data;
}
