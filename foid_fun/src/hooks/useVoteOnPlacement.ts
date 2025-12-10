// src/hooks/useVoteOnPlacement.ts
import { useCallback, useState } from "react";
import { useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import {
  LOREBOARD_VOTING_ADDRESS,
  loreboardVotingAbi,
  type PlacementId,
} from "@/contracts/loreboardVoting";

type Epochish = number | bigint | undefined;

interface UseVoteOnPlacementParams {
  epochId?: Epochish;
  placementId?: PlacementId;
}

export function useVoteOnPlacement({ epochId, placementId }: UseVoteOnPlacementParams) {
  const [txHash, setTxHash] = useState<`0x${string}` | null>(null);

  const {
    writeContractAsync,
    isPending: isWriting,
    error: writeError,
  } = useWriteContract();

  const {
    isLoading: isConfirming,
    isSuccess: isConfirmed,
    error: confirmError,
  } = useWaitForTransactionReceipt({
    hash: txHash ?? undefined,
  });

  const voteOnChain = useCallback(async () => {
    if (epochId === undefined || !placementId) {
      throw new Error("Missing epochId or placementId");
    }

    const epochNumber = typeof epochId === "bigint" ? Number(epochId) : epochId;
    if (!Number.isFinite(epochNumber)) {
      throw new Error("Invalid epochId");
    }

    const bootstrapRes = await fetch("/api/voting/bootstrap", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ epochId: epochNumber, placementId }),
    });
    if (!bootstrapRes.ok) {
      const body = await bootstrapRes.json().catch(() => ({}));
      throw new Error(body?.error ?? "Failed to bootstrap epoch/placement");
    }

    const hash = await writeContractAsync({
      address: LOREBOARD_VOTING_ADDRESS,
      abi: loreboardVotingAbi,
      functionName: "voteOnPlacement",
      args: [BigInt(epochNumber), placementId],
    });
    setTxHash(hash);
    return hash;
  }, [epochId, placementId, writeContractAsync]);

  return {
    vote: voteOnChain,
    voteOnChain,
    txHash,
    isWriting,
    isConfirming,
    isConfirmed,
    error: writeError || confirmError,
  };
}
