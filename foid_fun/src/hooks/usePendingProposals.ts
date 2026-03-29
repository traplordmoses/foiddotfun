// hooks/usePendingProposals.ts
// Queries LoreboardProposed events from the Swipe contract to find
// active voting proposals with their board coordinates.

import { useEffect, useState } from "react";
import { usePublicClient } from "wagmi";
import { CHAIN_ID, CANONICAL_ADDRESSES } from "@/config/canonical";
import { debug } from "@/lib/debug";

// The Swipe contract emits LoreboardProposed events with rect coordinates.
const SWIPE_ADDRESS = CANONICAL_ADDRESSES.swipe as `0x${string}`;

const LOREBOARD_PROPOSED_EVENT = {
  type: "event" as const,
  name: "LoreboardProposed" as const,
  inputs: [
    { name: "proposalId", type: "uint256" as const, indexed: true, internalType: "uint256" as const },
    { name: "proposer", type: "address" as const, indexed: true, internalType: "address" as const },
    { name: "ipfsCid", type: "string" as const, indexed: false, internalType: "string" as const },
    { name: "x", type: "int32" as const, indexed: false, internalType: "int32" as const },
    { name: "y", type: "int32" as const, indexed: false, internalType: "int32" as const },
    { name: "w", type: "uint32" as const, indexed: false, internalType: "uint32" as const },
    { name: "h", type: "uint32" as const, indexed: false, internalType: "uint32" as const },
    { name: "votingEndsAt", type: "uint64" as const, indexed: false, internalType: "uint64" as const },
  ],
};

export interface PendingProposal {
  id: string;
  proposalId: number;
  proposer: string;
  cid: string;
  x: number;
  y: number;
  w: number;
  h: number;
  submittedAt: number;
  votesYes: bigint;
  votesNo: bigint;
  voteEndsAt: number;
  timeRemaining: number;
}

// Default voting window — used as fallback for block range calculation
const DEFAULT_VOTING_WINDOW = 259200; // 72 hours

export function usePendingProposals() {
  const [proposals, setProposals] = useState<PendingProposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const publicClient = usePublicClient({ chainId: CHAIN_ID });

  useEffect(() => {
    let alive = true;
    let intervalId: NodeJS.Timeout | null = null;

    const loadProposals = async () => {
      if (!publicClient) {
        debug.log("[usePendingProposals] No public client");
        setLoading(false);
        return;
      }

      if (!SWIPE_ADDRESS) {
        debug.log("[usePendingProposals] No Swipe contract address");
        setLoading(false);
        return;
      }

      try {
        debug.log("[usePendingProposals] Loading LoreboardProposed events from Swipe contract...");

        const currentTime = Math.floor(Date.now() / 1000);

        // Search enough blocks to cover the voting window (~2s block time)
        const latestBlock = await publicClient.getBlockNumber();
        const blocksToSearch = BigInt(Math.floor(DEFAULT_VOTING_WINDOW / 2));
        const fromBlock = latestBlock > blocksToSearch ? latestBlock - blocksToSearch : 0n;

        debug.log(`[usePendingProposals] Searching blocks ${fromBlock} to ${latestBlock} on Swipe ${SWIPE_ADDRESS}`);

        // Fetch LoreboardProposed events from the Swipe contract
        const logs = await publicClient.getLogs({
          address: SWIPE_ADDRESS,
          event: LOREBOARD_PROPOSED_EVENT,
          fromBlock,
          toBlock: latestBlock,
        });

        debug.log(`[usePendingProposals] Found ${logs.length} LoreboardProposed events`);

        if (!alive) return;

        // Parse events and filter to active proposals (voting not ended)
        const activeLogs = logs
          .map((log) => {
            const args = log.args as {
              proposalId: bigint;
              proposer: `0x${string}`;
              ipfsCid: string;
              x: number;
              y: number;
              w: number;
              h: number;
              votingEndsAt: bigint;
            };
            const voteEndsAt = Number(args.votingEndsAt);
            const timeRemaining = Math.max(0, voteEndsAt - currentTime);
            return { args, voteEndsAt, timeRemaining, blockNumber: log.blockNumber };
          })
          .filter((p) => p.timeRemaining > 0);

        debug.log(`[usePendingProposals] ${activeLogs.length} active (voting not ended)`);

        // Also check which proposals are finalized via /api/swipe/proposals
        // to exclude finalized ones
        let finalizedIds = new Set<number>();
        try {
          const res = await fetch("/api/swipe/proposals");
          if (res.ok) {
            const data = await res.json();
            const swipeProposals = data.proposals ?? [];
            for (const p of swipeProposals) {
              if (p.finalized) {
                finalizedIds.add(p.id);
              }
            }
          }
        } catch {
          debug.warn("[usePendingProposals] Failed to fetch finalized status, showing all active");
        }

        const nonFinalized = activeLogs.filter(
          (p) => !finalizedIds.has(Number(p.args.proposalId))
        );

        const activeProposals: PendingProposal[] = nonFinalized.map((p) => ({
          id: `0x${p.args.proposalId.toString(16).padStart(64, "0")}`,
          proposalId: Number(p.args.proposalId),
          proposer: p.args.proposer,
          cid: p.args.ipfsCid,
          x: Number(p.args.x),
          y: Number(p.args.y),
          w: Number(p.args.w),
          h: Number(p.args.h),
          submittedAt: 0, // not in the event, use 0
          votesYes: 0n,
          votesNo: 0n,
          voteEndsAt: p.voteEndsAt,
          timeRemaining: p.timeRemaining,
        }));

        if (alive) {
          setProposals(activeProposals);
          setError(null);
          debug.log(`[usePendingProposals] Loaded ${activeProposals.length} pending proposals`);
        }
      } catch (err) {
        debug.error("[usePendingProposals] Error:", err);
        if (alive) {
          setError(err instanceof Error ? err : new Error(String(err)));
        }
      } finally {
        if (alive) {
          setLoading(false);
        }
      }
    };

    loadProposals();

    // Refresh every 120 seconds
    intervalId = setInterval(() => {
      void loadProposals();
    }, 120000);

    return () => {
      alive = false;
      if (intervalId) clearInterval(intervalId);
    };
  }, [publicClient]);

  return { proposals, loading, error };
}
