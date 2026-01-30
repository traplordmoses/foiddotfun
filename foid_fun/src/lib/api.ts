// src/lib/api.ts
import type { PendingItem } from "@/state/board";
import type { Rect } from "@/lib/grid";
import { rectCells } from "@/lib/grid";


function asJson<T = unknown>(res: Response): Promise<T> {
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json() as Promise<T>;
}

// --------------------------
// legacy (still safe to keep)
// --------------------------
export async function placeIntent(
  item: PendingItem,
  owner: string,
  baseFeeWei: bigint
) {
  if (!item.cid) throw new Error("missing CID");

  const body = {
    id: item.id,
    owner,
    cid: item.cid,
    rect: item.rect,
    cells: rectCells(item.rect),
    feePerCellWei: baseFeeWei.toString(),
    tipPerCellWei: item.tipPerCellWei.toString(),
  };

  const res = await fetch("/api/place", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    throw new Error(e?.error ?? `place failed (${res.status})`);
  }
  return asJson<{ ok: true; epoch: number; id: string }>(res);
}

export async function finalizeEpoch(force = false) {
  const res = await fetch(`/api/finalize${force ? "?force=1" : ""}`, {
    method: "POST",
  });
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    throw new Error(e?.error ?? `finalize failed (${res.status})`);
  }
  return asJson<{ manifestCID: string | null; epoch: number }>(res);
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

export async function getMempool(epoch?: number) {
  const url = epoch == null ? "/api/mempool" : `/api/mempool?epoch=${epoch}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error("mempool failed");
  return asJson<{
    epoch: number;
    count: number;
    pendingCells: number;
    baseFeePerCellWei: string;
    intents: unknown[];
  }>(res);
}

// --------------------------
// referendum helpers (new)
// --------------------------
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

export async function proposePlacement(input: {
  id?: string;
  owner: string;
  cid: string;
  name?: string;
  mime?: "image/png" | "image/jpeg";
  rect: Rect;
  width?: number;
  height?: number;
  bidPerCellWei: string; // total bid per cell
}) {
  const res = await fetch("/api/propose", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    throw new Error(e?.error ?? `propose failed (${res.status})`);
  }
  return asJson<{
    ok: true;
    id: string;
    chainId: `0x${string}`;
    epochSubmitted: number;
    voteEndsAtEpoch: number;
  }>(res);
}

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
  console.log('[DEBUG] listProposals() called - fetching /api/proposals');
  const res = await fetch("/api/proposals", { cache: "no-store" });
  console.log('[DEBUG] listProposals() response status:', res.status, res.ok);
  if (!res.ok) {
    console.error('[DEBUG] listProposals() failed with status:', res.status);
    throw new Error("proposals failed");
  }
  const data = await asJson<ListProposalsResponse>(res);
  console.log('[DEBUG] listProposals() success:', {
    proposalsCount: data.proposals?.length || 0,
    hasDebug: !!data.debug,
    firstProposal: data.proposals?.[0] ? {
      id: data.proposals[0].id?.slice(0, 16),
      status: data.proposals[0].status,
      isVotable: data.proposals[0].isVotable
    } : null
  });
  return data;
}

export async function castVote(input: {
  proposalId: string;
  voter: string; // wallet (string) for demo
  vote: boolean; // true = yes, false = no
}) {
  const res = await fetch("/api/vote", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    throw new Error(e?.error ?? `vote failed (${res.status})`);
  }
  return asJson<{
    ok: true;
    id: string;
    yes: number;
    no: number;
    voters: number;
    percentYes: number; // 0..1
  }>(res);
}
