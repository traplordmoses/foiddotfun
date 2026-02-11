// Direct on-chain reads for the agent board (no Goldsky subgraph yet).
// TODO: Replace with Goldsky subgraph queries once agent board subgraph is deployed.

import type { Abi } from "viem";
import { getAgentPublicClient } from "./relayer";
import { AGENT_BOARD, AGENT_VOTING } from "@/config/agentBoard";
import BoardAbi from "@/abi/LoreboardBoardV2.json" assert { type: "json" };
import VotingAbi from "@/abi/loreboardVoting.json" assert { type: "json" };

const BoardAbiTyped = BoardAbi as Abi;
const VotingAbiTyped = VotingAbi as Abi;

const LOOKBACK = BigInt(process.env.AGENT_BOARD_LOOKBACK || "500000");

export type PlacementRow = {
  id: string;
  idParam: string;
  bidder: string;
  epoch: string;
  x: string;
  y: string;
  w: string;
  h: string;
  bidPerCellWei: string;
  cidHash: string;
};

export type VoteRecord = {
  id: string;
  epochId: string;
  placementId: string;
  voter: string;
  support: boolean;
  weight: string;
};

export type PendingRecord = {
  id: string;
  epochId: string;
  placementId: string;
  registeredAt: string;
  voteEndsAt: string;
};

export type EpochFinalizedRecord = {
  id: string;
  epochId: string;
  timestamp_: string;
};

async function getFromBlock(): Promise<bigint> {
  const deployBlock = process.env.AGENT_BOARD_DEPLOY_BLOCK;
  if (deployBlock) return BigInt(deployBlock);
  try {
    const client = getAgentPublicClient();
    const latest = await client.getBlockNumber();
    return latest > LOOKBACK ? latest - LOOKBACK : 0n;
  } catch {
    return 0n;
  }
}

export async function fetchProposals(owner?: string): Promise<PlacementRow[]> {
  const client = getAgentPublicClient();
  const fromBlock = await getFromBlock();

  try {
    const logs = await client.getContractEvents({
      address: AGENT_BOARD,
      abi: BoardAbiTyped,
      eventName: "PlacementProposed",
      fromBlock,
      toBlock: "latest",
    });

    const rows: PlacementRow[] = logs.map((log) => {
      const a = log.args as Record<string, unknown>;
      return {
        id: String(a.id ?? log.transactionHash),
        idParam: String(a.id ?? ""),
        bidder: String(a.bidder ?? ""),
        epoch: String(a.epoch ?? "0"),
        x: String(a.x ?? "0"),
        y: String(a.y ?? "0"),
        w: String(a.w ?? "0"),
        h: String(a.h ?? "0"),
        bidPerCellWei: String(a.bidPerCellWei ?? "0"),
        cidHash: String(a.cidHash ?? ""),
      };
    });

    if (owner) {
      const low = owner.toLowerCase();
      return rows.filter((r) => r.bidder.toLowerCase() === low);
    }
    return rows;
  } catch (err) {
    console.warn("[agent/goldsky] getLogs PlacementProposed failed:", err);
    return [];
  }
}

export async function fetchVotingData(): Promise<{
  pending: PendingRecord[];
  votes: VoteRecord[];
}> {
  const client = getAgentPublicClient();
  const fromBlock = await getFromBlock();

  try {
    const voteLogs = await client.getContractEvents({
      address: AGENT_VOTING,
      abi: VotingAbiTyped,
      eventName: "VoteCast",
      fromBlock,
      toBlock: "latest",
    });

    const votes: VoteRecord[] = voteLogs.map((log) => {
      const a = log.args as Record<string, unknown>;
      return {
        id: `${log.transactionHash}-${log.logIndex}`,
        epochId: String(a.epochId ?? a.epoch ?? "0"),
        placementId: String(a.placementId ?? ""),
        voter: String(a.voter ?? ""),
        support: Boolean(a.support),
        weight: String(a.weight ?? "1"),
      };
    });

    // TODO: Scan PendingPlacementRegistered events once subgraph is deployed
    return { pending: [], votes };
  } catch (err) {
    console.warn("[agent/goldsky] VoteCast event scan failed:", err);
    return { pending: [], votes: [] };
  }
}

export async function fetchVotesByVoter(voter: string): Promise<VoteRecord[]> {
  const { votes } = await fetchVotingData();
  return votes.filter((v) => v.voter.toLowerCase() === voter.toLowerCase());
}

export async function fetchEpochFinalizations(): Promise<EpochFinalizedRecord[]> {
  // TODO: Replace with EpochFinalized event scan or Goldsky subgraph
  // once agent board subgraph is deployed.
  return [];
}
