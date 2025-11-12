// src/lib/api.ts
import type { PendingItem } from "@/state/board";
import type { Rect } from "@/lib/grid";
import { rectCells } from "@/lib/grid";


function asJson<T = any>(res: Response): Promise<T> {
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

export async function getManifest(epoch: number | "latest") {
  const q = typeof epoch === "number" ? String(epoch) : "latest";
  const res = await fetch(`/api/manifest?epoch=${q}`, { cache: "no-store" });
  if (!res.ok) throw new Error("manifest not found");
  return asJson<{
    epoch: number;
    cid: string | null;
    manifest: { placements: any[] };
  }>(res);
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
    intents: any[];
  }>(res);
}

// --------------------------
// referendum helpers (new)
// --------------------------
export type ProposalSummary = {
  id: string;
  owner: string;
  cid: string;
  name: string;
  mime: "image/png" | "image/jpeg";
  rect: Rect;
  cells: number;
  bidPerCellWei: string;
  yes: number;
  no: number;
  voters: number;
  percentYes: number; // 0..1
  status: "proposed" | "accepted" | "rejected" | "expired";
  epochSubmitted: number;
  voteEndsAtEpoch: number;
  secondsLeft: number;
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
    epochSubmitted: number;
    voteEndsAtEpoch: number;
  }>(res);
}

export async function listProposals() {
  const res = await fetch("/api/proposals", { cache: "no-store" });
  if (!res.ok) throw new Error("proposals failed");
  return asJson<{ proposals: ProposalSummary[] }>(res);
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
