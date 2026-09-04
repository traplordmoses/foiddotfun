// src/lib/api.ts
import type { Rect } from "@/lib/grid";

function asJson<T = unknown>(res: Response): Promise<T> {
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json() as Promise<T>;
}

// NOTE: matches your /api/status (epoch, secondsLeft, latestManifestCID)
export async function getStatus() {
  const res = await fetch("/api/status", { cache: "no-store" });
  if (!res.ok) throw new Error("status failed");
  return asJson<{
    epoch: number;
    secondsLeft: number;
    latestManifestCID: string | null;
  }>(res);
}

export async function getManifest(
  epoch: number | "latest"
): Promise<{
  epoch: number | null;
  manifestCID: string | null;
  manifest: { placements: unknown[] } | null;
}> {
  const url =
    epoch === "latest"
      ? "/api/manifest"
      : `/api/manifest?epoch=${encodeURIComponent(String(epoch))}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to load manifest");
  return res.json();
}

export type ProposalSummary = {
  id: string;
  chainId?: `0x${string}`;
  placementId?: `0x${string}`;
  owner: string;
  bidder?: string;
  cid: string;
  name: string;
  mime: "image/png" | "image/jpeg";
  rect: Rect;
  x?: number;
  y?: number;
  w?: number;
  h?: number;
  cells: number;
  bidPerCellWei: string;
  epochId?: number;
  yes: number; // Legacy field name
  no: number; // Legacy field name
  yesVotes?: number; // New field name from API
  noVotes?: number; // New field name from API
  voters: number;
  percentYes: number; // 0..1
  status: "proposed" | "accepted" | "rejected" | "expired" | "voting" | "canonized";
  epochSubmitted: number;
  voteEndsAtEpoch: number;
  registeredAt?: number;
  voteEndsAt?: number;
  voteEndsAtSec?: number;
  secondsLeft: number;
  timeRemaining?: number;
  isVotable?: boolean;
  width?: number;
  height?: number;
};

export type PendingPlacementWire = {
  emitter: string;
  blockNumber: string | null;
  logIndex: string | null;
  epochId: string;
  placementId: `0x${string}` | "";
  voteEndsAt: string | null;
};

export type PendingBoardPlacement = {
  placementId: `0x${string}` | "";
  bidder: `0x${string}` | "";
  epoch: number;
  rect: Rect;
  cells: number;
  bidPerCellWei: string;
  cidHash?: `0x${string}`;
  blockNumber: string | null;
  logIndex: string | null;
};

export type PendingRenderableSample = {
  pending: PendingPlacementWire;
  placement: PendingBoardPlacement;
};

export type ListProposalsDebug = {
  lastError?: string | null;
  epoch?: number | null;
  latestBlock?: number;
  fromBlock?: number;
  rangesScanned?: number;
  pendingEvents?: PendingPlacementWire[];
  pendingLogCount?: number;
  boardLogCount?: number;
  boardEventsCount?: number;
  joinedRenderableCount?: number;
  joinedCount?: number;
  pendingActiveCount: number;
  missingBoardPayload: string[];
  samplePending: PendingPlacementWire[];
  sampleJoined: PendingRenderableSample[];
  pendingEpochIdsSample?: number[];
  boardEpochsSample?: number[];
  proxyUrlUsed?: string | null;
};

export type ListProposalsResponse = {
  proposals: ProposalSummary[];
  debug?: ListProposalsDebug;
};

export async function listProposals(): Promise<ListProposalsResponse> {
  const res = await fetch("/api/proposals", { cache: "no-store" });
  if (!res.ok) throw new Error("proposals failed");
  return asJson<ListProposalsResponse>(res);
}
