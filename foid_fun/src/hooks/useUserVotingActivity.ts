"use client";

import { useEffect, useRef, useState } from "react";
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

export function useUserVotingActivity(address: `0x${string}` | undefined) {
  const [voteHistory, setVoteHistory] = useState<VoteHistory | null>(null);
  const [votesThisEpoch, setVotesThisEpoch] = useState(0);
  const [isHistoryLoading, setIsHistoryLoading] = useState(true);
  const [isEpochLoading, setIsEpochLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: currentEpochData } = useReadContract({
    address: CONTRACTS.LOREBOARD_VOTING as `0x${string}`,
    abi: LOREBOARD_VOTING_ABI,
    functionName: "epochAt",
    args: [BigInt(Math.floor(Date.now() / 1000))],
  });

  const currentEpoch = currentEpochData ? Number(currentEpochData) : 0;

  const lastHistoryFetch = useRef(0);
  const historyInterval = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    lastHistoryFetch.current = 0;
    if (historyInterval.current) {
      clearInterval(historyInterval.current);
      historyInterval.current = null;
    }

    if (!address) {
      setVoteHistory(null);
      setIsHistoryLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;

    const fetchHistory = async () => {
      const now = Date.now();
      if (lastHistoryFetch.current && now - lastHistoryFetch.current < 15000) {
        return;
      }

      try {
        setIsHistoryLoading(true);
        console.debug("[votes] fetching", { address, currentEpoch });
        const res = await fetch(`/api/votes?address=${address}`, { cache: "no-store" });
        const json = await res.json();
        if (cancelled) return;

        const normalizedRecent: VoteRecord[] = (json.recentVotes ?? []).map((vote: any) => ({
          id: vote.id,
          epochId: Number(vote.epochId ?? 0),
          placementId: vote.placementId ?? "",
          support: Boolean(vote.support),
          weight: String(vote.weight ?? "0"),
          blockNumber: vote.blockNumber != null ? Number(vote.blockNumber) : null,
          txHash: vote.txHash ?? null,
          contractId: vote.contractId ?? null,
          timestamp: vote.timestamp != null ? Number(vote.timestamp) : null,
        }));

        const votesByEpoch: Record<string, number> = {};
        const epochSource = json.votesByEpoch ?? {};
        Object.entries(epochSource).forEach(([key, value]) => {
          votesByEpoch[key] = Number(value ?? 0);
        });
        if (!Object.keys(votesByEpoch).length) {
          normalizedRecent.forEach((vote) => {
            const key = String(vote.epochId);
            votesByEpoch[key] = (votesByEpoch[key] ?? 0) + 1;
          });
        }

        setVoteHistory({
          totalVotes: Number(json.totalVotes ?? normalizedRecent.length ?? 0),
          votesByEpoch,
          recentVotes: normalizedRecent,
        });
        setError(json.debug?.errors ? String(json.debug.errors) : null);
        lastHistoryFetch.current = now;
      } catch (e) {
        console.warn("[votes] history fetch failed:", e);
        if (!cancelled) {
          setError(e instanceof Error ? e.message : String(e));
          setVoteHistory(null);
        }
      } finally {
        if (!cancelled) {
          setIsHistoryLoading(false);
        }
      }
    };

    fetchHistory();
    historyInterval.current = setInterval(fetchHistory, 15000);

    return () => {
      cancelled = true;
      if (historyInterval.current) {
        clearInterval(historyInterval.current);
        historyInterval.current = null;
      }
    };
  }, [address, currentEpoch]);

  useEffect(() => {
    if (!address) {
      setVotesThisEpoch(0);
      setIsEpochLoading(false);
      return;
    }

    let cancelled = false;
    setIsEpochLoading(true);

    const fetchEpochCount = async () => {
      try {
        console.debug("[votes] fetching", { address, currentEpoch });
        const res = await fetch(`/api/votes?address=${address}&epoch=${currentEpoch}`, {
          cache: "no-store",
        });
        const json = await res.json();
        if (cancelled) return;
        const count = Number(json.votes?.length ?? json.count ?? 0);
        setVotesThisEpoch(count);
      } catch (e) {
        console.warn("[votes] epoch fetch failed:", e);
        if (!cancelled) {
          setVotesThisEpoch(0);
        }
      } finally {
        if (!cancelled) {
          setIsEpochLoading(false);
        }
      }
    };

    fetchEpochCount();
    return () => {
      cancelled = true;
    };
  }, [address, currentEpoch]);

  return {
    votesThisEpoch,
    currentEpoch,
    isLoading: isHistoryLoading || isEpochLoading,
    totalVotes: voteHistory?.totalVotes ?? 0,
    recentVotes: voteHistory?.recentVotes ?? [],
    error,
  };
}
