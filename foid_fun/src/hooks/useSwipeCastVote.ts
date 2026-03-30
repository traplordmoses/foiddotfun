// src/hooks/useSwipeCastVote.ts
// Direct on-chain voting for Swipe proposals.
// Replaces the old EIP-712 sign + SQLite + batch-finalize flow entirely.
import { useCallback, useState } from "react";
import {
  useWriteContract,
  useWaitForTransactionReceipt,
  useReadContract,
  useSwitchChain,
  useAccount,
} from "wagmi";
import { LOREBOARD_ABI } from "@/lib/contracts/abis/loreboard";
import { CONTRACTS } from "@/lib/contracts/addresses";
import { TARGET_CHAIN_ID } from "@/lib/chain";

interface UseSwipeCastVoteParams {
  proposalId: number;
}

export function useSwipeCastVote({ proposalId }: UseSwipeCastVoteParams) {
  const { address } = useAccount();
  const [txHash, setTxHash] = useState<`0x${string}` | null>(null);
  const { switchChainAsync } = useSwitchChain();
  const swipeAddress = CONTRACTS.SWIPE as `0x${string}`;

  const {
    writeContractAsync,
    isPending: isWriting,
    error: writeError,
    reset,
  } = useWriteContract();

  const {
    isLoading: isConfirming,
    isSuccess: isConfirmed,
    error: confirmError,
  } = useWaitForTransactionReceipt({
    hash: txHash ?? undefined,
  });

  // Read on-chain vote tallies
  const { data: rawFor, refetch: refetchFor } = useReadContract({
    address: swipeAddress,
    abi: LOREBOARD_ABI,
    functionName: "voteWeightFor",
    args: [BigInt(proposalId)],
    query: { enabled: !!swipeAddress },
  });

  const { data: rawAgainst, refetch: refetchAgainst } = useReadContract({
    address: swipeAddress,
    abi: LOREBOARD_ABI,
    functionName: "voteWeightAgainst",
    args: [BigInt(proposalId)],
    query: { enabled: !!swipeAddress },
  });

  // Check if current wallet has already voted
  const { data: alreadyVoted, refetch: refetchHasVoted } = useReadContract({
    address: swipeAddress,
    abi: LOREBOARD_ABI,
    functionName: "hasVoted",
    args: [BigInt(proposalId), address ?? "0x0000000000000000000000000000000000000000"],
    query: { enabled: !!swipeAddress && !!address },
  });

  const refetch = useCallback(() => {
    void refetchFor();
    void refetchAgainst();
    void refetchHasVoted();
  }, [refetchFor, refetchAgainst, refetchHasVoted]);

  const castVote = useCallback(
    async (approve: boolean) => {
      // Ensure on the right chain
      try {
        await switchChainAsync?.({ chainId: TARGET_CHAIN_ID });
      } catch {
        // already on correct chain or not needed
      }

      const hash = await writeContractAsync({
        address: swipeAddress,
        abi: LOREBOARD_ABI,
        functionName: "castVote",
        args: [BigInt(proposalId), approve],
        chainId: TARGET_CHAIN_ID,
      });

      setTxHash(hash);
      return hash;
    },
    [proposalId, swipeAddress, writeContractAsync, switchChainAsync]
  );

  const weightFor = (rawFor as bigint | undefined) ?? 0n;
  const weightAgainst = (rawAgainst as bigint | undefined) ?? 0n;
  const totalWeight = weightFor + weightAgainst;

  return {
    castVote,
    txHash,
    isWriting,
    isConfirming,
    isConfirmed,
    error: writeError || confirmError,
    reset,
    refetch,
    // Vote tallies
    weightFor,
    weightAgainst,
    totalWeight,
    forCount: Number(weightFor),
    againstCount: Number(weightAgainst),
    // User state
    hasVoted: Boolean(alreadyVoted),
  };
}
