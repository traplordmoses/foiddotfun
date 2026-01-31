"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useReadContract } from "wagmi";
import { CONTRACTS } from "@/lib/contracts/addresses";
import { LOREBOARD_VOTING_ABI } from "@/lib/contracts/abis";

export type VoteRecord = {
  id: string;
  epochId: number;
  placementId: string;
  support: boolean;
  weight: string;
  blockNumber: number | null;
  txHash: string | null;
  contractId: string | null;
  timestamp: number | null;
};

type VoteHistory = {
  totalVotes: number;
  votesByEpoch: Record<string, number>;
  recentVotes: VoteRecord[];
};

type UseUserVotingActivityOptions = {
  enabled?: boolean;
};

export function useUserVotingActivity(
  address: `0x${string}` | undefined,
  options: UseUserVotingActivityOptions = {}
) {
  const [voteHistory, setVoteHistory] = useState<VoteHistory | null>(null);
  const [votesThisEpoch, setVotesThisEpoch] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasFetched, setHasFetched] = useState(false);

  const { data: currentEpochData } = useReadContract({
    address: CONTRACTS.LOREBOARD_VOTING as `0x${string}`,
    abi: LOREBOARD_VOTING_ABI,
    functionName: "epochAt",
    args: [BigInt(Math.floor(Date.now() / 1000))],
  });

  const currentEpoch = currentEpochData ? Number(currentEpochData) : 0;

  const controllerRef = useRef<AbortController | null>(null);
  const fetchKeyRef = useRef<string | null>(null);
  const { enabled = true } = options;

  const normalizeRecentVotes = (payload: unknown): VoteRecord[] => {
    const recentVotes = payload && typeof payload === "object" && "recentVotes" in payload ? payload.recentVotes : [];
    return (Array.isArray(recentVotes) ? recentVotes : []).map((vote: unknown) => ({
      id: (vote as Record<string, unknown>).id as string,
      epochId: Number((vote as Record<string, unknown>).epochId ?? 0),
      placementId: (vote as Record<string, unknown>).placementId as string ?? "",
      support: Boolean((vote as Record<string, unknown>).support),
      weight: String((vote as Record<string, unknown>).weight ?? "0"),
      blockNumber: (vote as Record<string, unknown>).blockNumber != null ? Number((vote as Record<string, unknown>).blockNumber) : null,
      txHash: (vote as Record<string, unknown>).txHash as string ?? null,
      contractId: (vote as Record<string, unknown>).contractId as string ?? null,
      timestamp: (vote as Record<string, unknown>).timestamp != null ? Number((vote as Record<string, unknown>).timestamp) : null,
    }));
  };

  const ensureVotesByEpoch = (json: unknown, recent: VoteRecord[]) => {
    const votesByEpoch: Record<string, number> = {};
    const epochSource = json && typeof json === "object" && "votesByEpoch" in json && typeof json.votesByEpoch === "object" ? json.votesByEpoch : {};
    Object.entries(epochSource as Record<string, unknown>).forEach(([key, value]) => {
      votesByEpoch[key] = Number(value ?? 0);
    });
    if (!Object.keys(votesByEpoch).length) {
      recent.forEach((vote) => {
        const key = String(vote.epochId);
        votesByEpoch[key] = (votesByEpoch[key] ?? 0) + 1;
      });
    }
    return votesByEpoch;
  };

  const fetchVotes = useCallback(async () => {
    if (!address) {
      return;
    }
    setHasFetched(true);

    // Use currentEpoch if available, otherwise use 0 as fallback
    const epochToFetch = currentEpoch || 0;

    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setIsLoading(true);
    setError(null);

    try {
      const [historyRes, epochRes] = await Promise.all([
        fetch(`/api/votes?address=${address}`, {
          cache: "no-store",
          signal: controller.signal,
        }),
        fetch(`/api/votes?address=${address}&epoch=${epochToFetch}`, {
          cache: "no-store",
          signal: controller.signal,
        }),
      ]);

      if (!historyRes.ok) {
        throw new Error(`votes (history) ${historyRes.status}`);
      }
      if (!epochRes.ok) {
        throw new Error(`votes (epoch) ${epochRes.status}`);
      }

      const historyJson = await historyRes.json();
      const epochJson = await epochRes.json();
      if (controller.signal.aborted) return;

      const normalizedRecent = normalizeRecentVotes(historyJson);
      const votesByEpoch = ensureVotesByEpoch(historyJson, normalizedRecent);

      setVoteHistory({
        totalVotes: Number(historyJson.totalVotes ?? normalizedRecent.length ?? 0),
        votesByEpoch,
        recentVotes: normalizedRecent,
      });

      const epochCount = Number(epochJson.votes?.length ?? epochJson.count ?? 0);
      setVotesThisEpoch(epochCount);
    } catch (err) {
      if (controller.signal.aborted) return;
      console.warn("[votes] fetch failed:", err);
      setVoteHistory(null);
      setVotesThisEpoch(0);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      if (!controller.signal.aborted) {
        setIsLoading(false);
      }
    }
  }, [address, currentEpoch]);

  useEffect(() => {
    if (!enabled) {
      controllerRef.current?.abort();
      fetchKeyRef.current = null;
      setHasFetched(false);
      setIsLoading(false);
      return;
    }

    if (!address) {
      setVoteHistory(null);
      setVotesThisEpoch(0);
      setError(null);
      fetchKeyRef.current = null;
      return;
    }

    const key = `${address}-${currentEpoch || 0}`;
    if (fetchKeyRef.current === key) {
      return;
    }

    fetchKeyRef.current = key;
    void fetchVotes();

    return () => {
      controllerRef.current?.abort();
    };
  }, [address, currentEpoch, enabled, fetchVotes]);

  useEffect(() => {
    setHasFetched(false);
  }, [address]);

  return {
    votesThisEpoch,
    currentEpoch,
    isLoading,
    totalVotes: voteHistory?.totalVotes ?? 0,
    recentVotes: voteHistory?.recentVotes ?? [],
    error,
    refresh: fetchVotes,
    hasFetched,
  };
}
