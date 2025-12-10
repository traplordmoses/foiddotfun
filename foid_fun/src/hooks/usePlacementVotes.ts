// src/hooks/usePlacementVotes.ts
import { useReadContract } from "wagmi";
import {
  loreboardVotingAbi,
  LOREBOARD_VOTING_ADDRESS,
  type PlacementId,
} from "@/contracts/loreboardVoting";

interface UsePlacementVotesParams {
  epochId: bigint;
  placementId: PlacementId;
  enabled?: boolean;
}

export function usePlacementVotes({
  epochId,
  placementId,
  enabled = true,
}: UsePlacementVotesParams) {
  const { data, isLoading, isError, refetch } = useReadContract({
    address: LOREBOARD_VOTING_ADDRESS,
    abi: loreboardVotingAbi,
    functionName: "placementVotes",
    args: [epochId, placementId],
    query: {
      enabled,
    },
  });

  return {
    votes: data ?? 0n,
    isLoading,
    isError,
    refetch,
  };
}
