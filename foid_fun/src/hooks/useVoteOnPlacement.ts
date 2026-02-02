// src/hooks/useVoteOnPlacement.ts
import { useCallback, useMemo, useState } from "react";
import { useWaitForTransactionReceipt, useWriteContract, useSwitchChain } from "wagmi";
import {
  LOREBOARD_VOTING_ADDRESS,
  loreboardVotingAbi,
  type PlacementId,
} from "@/contracts/loreboardVoting";
import { TARGET_CHAIN_ID } from "@/lib/chain";

type Epochish = number | bigint | undefined;

interface UseVoteOnPlacementParams {
  epochId?: Epochish;
  placementId?: PlacementId;
}

const isBytes32Hex = (value?: string): value is PlacementId =>
  typeof value === "string" && /^0x[0-9a-fA-F]{64}$/.test(value);

export function useVoteOnPlacement({ epochId, placementId }: UseVoteOnPlacementParams) {
  const [txHash, setTxHash] = useState<`0x${string}` | null>(null);
  const hasShortVote = useMemo(
    () =>
      Array.isArray(loreboardVotingAbi) &&
      loreboardVotingAbi.some(
        (entry) => {
          const item = entry as { type?: string; name?: string; inputs?: unknown };
          return (
            item.type === "function" &&
            item.name === "voteOnPlacement" &&
            Array.isArray(item.inputs) &&
            item.inputs.length === 2
          );
        }
      ),
    []
  );

  const { switchChainAsync } = useSwitchChain();

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
    if (!isBytes32Hex(placementId)) {
      throw new Error(
        "Missing chainId bytes32; propose response didn't include it or UI didn't persist it."
      );
    }

    const epochNumber =
      epochId === undefined
        ? undefined
        : typeof epochId === "bigint"
        ? Number(epochId)
        : epochId;
    if (epochNumber !== undefined && !Number.isFinite(epochNumber)) {
      throw new Error("Invalid epochId");
    }

    const bootstrapPayload = hasShortVote
      ? { placementId }
      : { epochId: epochNumber ?? 0, placementId };

    const bootstrapRes = await fetch("/api/voting/bootstrap", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(bootstrapPayload),
    });
    if (!bootstrapRes.ok) {
      const body = await bootstrapRes.json().catch(() => ({}));
      throw new Error(body?.error ?? "Failed to bootstrap epoch/placement");
    }

    // Switch to Fluent testnet if needed
    try {
      await switchChainAsync?.({ chainId: TARGET_CHAIN_ID });
    } catch (err) {
      console.warn("[vote] Chain switch failed or not needed:", err);
    }

    const hash = await writeContractAsync(
      hasShortVote
        ? {
            address: LOREBOARD_VOTING_ADDRESS,
            abi: loreboardVotingAbi,
            functionName: "voteOnPlacement",
            args: [placementId, support],
            chainId: TARGET_CHAIN_ID,
            gas: BigInt(200_000), // Fallback gas limit
          }
        : {
            address: LOREBOARD_VOTING_ADDRESS,
            abi: loreboardVotingAbi,
            functionName: "voteOnPlacement",
            args: [BigInt(epochNumber ?? 0), placementId, support],
            chainId: TARGET_CHAIN_ID,
            gas: BigInt(200_000), // Fallback gas limit
          }
    );
    setTxHash(hash);
    return hash;
  }, [epochId, placementId, writeContractAsync, hasShortVote, switchChainAsync]);

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
