// src/hooks/usePlacementVotes.ts
import { useMemo } from "react";
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
  const hasPlacementMeta = useMemo(
    () =>
      Array.isArray(loreboardVotingAbi) &&
      loreboardVotingAbi.some(
        (entry) => {
          const item = entry as { type?: string; name?: string };
          return item.type === "function" && item.name === "getPlacementMeta";
        }
      ),
    []
  );

  const { data: placementMeta } = useReadContract({
    address: LOREBOARD_VOTING_ADDRESS,
    abi: loreboardVotingAbi,
    functionName: "getPlacementMeta",
    args: [placementId],
    query: {
      enabled: enabled && hasPlacementMeta,
    },
  });

  const derivedEpochId = useMemo(() => {
    if (!placementMeta || !Array.isArray(placementMeta)) return epochId;
    const epochFromMeta = placementMeta[2];
    if (typeof epochFromMeta === "bigint") return epochFromMeta;
    if (typeof epochFromMeta === "number") return BigInt(epochFromMeta);
    return epochId;
  }, [epochId, placementMeta]);

  const { data, isLoading, isError, refetch } = useReadContract({
    address: LOREBOARD_VOTING_ADDRESS,
    abi: loreboardVotingAbi,
    functionName: "getPlacementVotes",
    args: [derivedEpochId, placementId],
    query: {
      enabled,
    },
  });

  const { data: meetsQuorum } = useReadContract({
    address: LOREBOARD_VOTING_ADDRESS,
    abi: loreboardVotingAbi,
    functionName: "meetsQuorum",
    args: [derivedEpochId, placementId],
    query: {
      enabled,
    },
  });

  const { data: passesMajority51 } = useReadContract({
    address: LOREBOARD_VOTING_ADDRESS,
    abi: loreboardVotingAbi,
    functionName: "passesMajority51",
    args: [derivedEpochId, placementId],
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
