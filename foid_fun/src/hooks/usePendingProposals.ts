// hooks/usePendingProposals.ts
// FIXED VERSION - Uses event-based querying instead of non-existent contract method

import { useEffect, useState } from "react";
import { usePublicClient } from "wagmi";
import { CHAIN_ID, CANONICAL_ADDRESSES } from "@/config/canonical";
import { debug } from "@/lib/debug";

const LOREBOARD_V2_ADDRESS = CANONICAL_ADDRESSES.board as `0x${string}`;
const VOTING_CONTRACT_ADDRESS = CANONICAL_ADDRESSES.voting as `0x${string}`;

// ABI for voting contract
const VOTING_ABI = [
  {
    name: "getVotes",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "proposalId", type: "bytes32" }],
    outputs: [
      { name: "yes", type: "uint256" },
      { name: "no", type: "uint256" },
    ],
  },
] as const;

export interface PendingProposal {
  id: string;
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

const VOTING_PERIOD_SECONDS = 72 * 60 * 60; // 72 hours

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
        return;
      }

      try {
        debug.log("[usePendingProposals] 📡 Loading pending proposals from events...");

        // Get current timestamp for filtering
        const currentTime = Math.floor(Date.now() / 1000);
        const votingPeriodStart = currentTime - VOTING_PERIOD_SECONDS;

        // Get recent block range
        const latestBlock = await publicClient.getBlockNumber();
        const blocksToSearch = BigInt(Math.floor(VOTING_PERIOD_SECONDS / 2)); // ~2s block time
        const fromBlock = latestBlock > blocksToSearch ? latestBlock - blocksToSearch : 0n;

        debug.log(`[usePendingProposals] Searching blocks ${fromBlock} to ${latestBlock}`);

        // Fetch PlacementProposed events
        const logs = await publicClient.getLogs({
          address: LOREBOARD_V2_ADDRESS,
          event: {
            type: 'event',
            name: 'PlacementProposed',
            inputs: [
              { name: 'id', type: 'bytes32', indexed: true },
              { name: 'proposer', type: 'address', indexed: true },
              { name: 'cid', type: 'string', indexed: false },
              { name: 'x', type: 'int256', indexed: false },
              { name: 'y', type: 'int256', indexed: false },
              { name: 'w', type: 'uint256', indexed: false },
              { name: 'h', type: 'uint256', indexed: false },
              { name: 'submittedAt', type: 'uint256', indexed: false },
            ],
          },
          fromBlock,
          toBlock: latestBlock,
        });

        debug.log(`[usePendingProposals] Found ${logs.length} PlacementProposed events`);

        if (!alive) return;

        // Parse events and check voting status
        const proposalsWithVotes = await Promise.all(
          logs.map(async (log) => {
            try {
              const args = log.args as {
                id: `0x${string}`;
                proposer: `0x${string}`;
                cid: string;
                x: bigint;
                y: bigint;
                w: bigint;
                h: bigint;
                submittedAt: bigint;
              };

              // Fetch vote counts
              const [yes, no] = await publicClient.readContract({
                address: VOTING_CONTRACT_ADDRESS,
                abi: VOTING_ABI,
                functionName: "getVotes",
                args: [args.id],
              });

              const submitTime = Number(args.submittedAt);
              const voteEndsAt = submitTime + VOTING_PERIOD_SECONDS;
              const timeRemaining = Math.max(0, voteEndsAt - currentTime);

              // Only include if still in voting period
              if (timeRemaining > 0) {
                return {
                  id: args.id,
                  proposer: args.proposer,
                  cid: args.cid,
                  x: Number(args.x),
                  y: Number(args.y),
                  w: Number(args.w),
                  h: Number(args.h),
                  submittedAt: submitTime,
                  votesYes: yes,
                  votesNo: no,
                  voteEndsAt,
                  timeRemaining,
                };
              }
              return null;
            } catch (err) {
              debug.warn('[usePendingProposals] Failed to process proposal:', err);
              return null;
            }
          })
        );

        // Filter out expired proposals and errors
        const activeProposals = proposalsWithVotes.filter(Boolean) as PendingProposal[];

        if (alive) {
          setProposals(activeProposals);
          setError(null);
          debug.log(`[usePendingProposals] ✅ Loaded ${activeProposals.length} active proposals`);
        }
      } catch (err) {
        debug.error("[usePendingProposals] ❌ Error:", err);
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

    // Refresh every 30 seconds to update vote counts and time remaining
    intervalId = setInterval(() => {
      void loadProposals();
    }, 30000);

    return () => {
      alive = false;
      if (intervalId) clearInterval(intervalId);
    };
  }, [publicClient]);

  return { proposals, loading, error };
}
