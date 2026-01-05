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

const isBytes32Hex = (value?: string): value is PlacementId =>
  typeof value === "string" && /^0x[0-9a-fA-F]{64}$/.test(value);

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

  const voteOnChain = useCallback(async (support: boolean) => {
    if (epochId === undefined || !isBytes32Hex(placementId)) {
      throw new Error(
        "Missing chainId bytes32 or epochId; propose response didn't include it or UI didn't persist it."
      );
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
      args: [BigInt(epochNumber), placementId, support],
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
