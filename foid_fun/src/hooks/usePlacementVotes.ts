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
    functionName: "getPlacementVotes",
    args: [epochId, placementId],
    query: {
      enabled,
    },
  });

  const { data: meetsQuorum } = useReadContract({
    address: LOREBOARD_VOTING_ADDRESS,
    abi: loreboardVotingAbi,
    functionName: "meetsQuorum",
    args: [epochId, placementId],
    query: {
      enabled,
    },
  });

  const { data: passesMajority51 } = useReadContract({
    address: LOREBOARD_VOTING_ADDRESS,
    abi: loreboardVotingAbi,
    functionName: "passesMajority51",
    args: [epochId, placementId],
    query: {
      enabled,
    },
  });

  const [yes, no] = (data ?? [0n, 0n]) as readonly [bigint, bigint];
  const total = yes + no;
  const pctYes = total === 0n ? 0 : Number(yes) / Number(total);

  return {
    yes,
    no,
    total,
    pctYes,
    meetsQuorum: Boolean(meetsQuorum),
    passesMajority51: Boolean(passesMajority51),
    isLoading,
    isError,
    refetch,
  };
}
