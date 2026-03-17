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

        // Parse events and filter to active proposals
        const parsedLogs = logs.map((log) => {
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
          const submitTime = Number(args.submittedAt);
          const voteEndsAt = submitTime + VOTING_PERIOD_SECONDS;
          const timeRemaining = Math.max(0, voteEndsAt - currentTime);
          return { args, submitTime, voteEndsAt, timeRemaining };
        }).filter((p) => p.timeRemaining > 0);

        // Batch all getVotes calls into a single multicall
        let voteResults: { yes: bigint; no: bigint }[];
        if (parsedLogs.length > 0) {
          try {
            const multicallResults = await publicClient.multicall({
              contracts: parsedLogs.map((p) => ({
                address: VOTING_CONTRACT_ADDRESS,
                abi: VOTING_ABI,
                functionName: "getVotes" as const,
                args: [p.args.id] as const,
              })),
            });
            voteResults = multicallResults.map((r) => {
              if (r.status === "success") {
                const [yes, no] = r.result as [bigint, bigint];
                return { yes, no };
              }
              return { yes: 0n, no: 0n };
            });
          } catch (err) {
            debug.warn('[usePendingProposals] multicall failed, falling back to individual calls:', err);
            voteResults = await Promise.all(
              parsedLogs.map(async (p) => {
                try {
                  const [yes, no] = await publicClient.readContract({
                    address: VOTING_CONTRACT_ADDRESS,
                    abi: VOTING_ABI,
                    functionName: "getVotes",
                    args: [p.args.id],
                  });
                  return { yes, no };
                } catch {
                  return { yes: 0n, no: 0n };
                }
              })
            );
          }
        } else {
          voteResults = [];
        }

        const proposalsWithVotes = parsedLogs.map((p, i) => ({
          id: p.args.id,
          proposer: p.args.proposer,
          cid: p.args.cid,
          x: Number(p.args.x),
          y: Number(p.args.y),
          w: Number(p.args.w),
          h: Number(p.args.h),
          submittedAt: p.submitTime,
          votesYes: voteResults[i].yes,
          votesNo: voteResults[i].no,
          voteEndsAt: p.voteEndsAt,
          timeRemaining: p.timeRemaining,
        }));

        const activeProposals = proposalsWithVotes as PendingProposal[];

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

    // Refresh every 120 seconds to update vote counts and time remaining
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
