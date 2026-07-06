// /src/app/api/propose/route.ts
import { NextResponse } from "next/server";
import { rectCells, hasOverlap, type Rect } from "@/lib/grid";
import { currentEpoch, EPOCH_SECONDS, VOTE_WINDOW_SECONDS } from "@/lib/epoch";
import { addProposal, listAccepted, type Proposal } from "../_store";
import { ProposalStore, type StoredProposal } from "@/lib/proposalStore";
import { keccak256, stringToHex, verifyMessage } from "viem";
import { ipfsToHttp } from "@/lib/ipfsUrl";
import { checkRateLimit, recordAction } from "../agent/_lib/rateLimit";
import {
  buildProposeSignMessage,
  BOARD_SIG_MAX_AGE_MS,
  BOARD_SIG_MAX_FUTURE_SKEW_MS,
} from "@/lib/boardAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_CELLS = Number(process.env.NEXT_PUBLIC_MAX_CELLS_PER_RECT ?? 400);
const ETH_ADDRESS_PATTERN = /^0x[0-9a-fA-F]{40}$/;
const SIGNATURE_RE = /^0x[a-fA-F0-9]+$/;

type ProposeReq = {
  id?: string;
  owner: string;
  cid: string;
  cidHash?: `0x${string}`;
  name?: string;
  mime?: "image/png" | "image/jpeg";
  rect: Rect;
  width?: number;
  height?: number;
  bidPerCellWei: string; // total bid per cell
  // EIP-191 proof the caller controls `owner`. Covers cid, rect, bid +
  // timestamp — see buildProposeSignMessage.
  signature: string;
  timestamp: number;
};

function uid() {
  return Math.random().toString(36).slice(2);
}

export async function POST(req: Request) {
  let body: ProposeReq;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }

  const { owner, cid, rect, bidPerCellWei, name, mime, width, height, signature, timestamp } = body ?? {};
  if (!owner || !cid || !rect || !bidPerCellWei) {
    return NextResponse.json({ error: "missing fields" }, { status: 400 });
  }

  if (!ETH_ADDRESS_PATTERN.test(owner)) {
    return NextResponse.json({ error: "invalid owner address" }, { status: 400 });
  }

  // Require EIP-191 proof of ownership over the exact proposal fields (image,
  // rect, bid). Without this, `owner` is spoofable — anyone could submit
  // bid-bearing proposals attributed to any wallet.
  if (!signature || typeof signature !== "string" || !SIGNATURE_RE.test(signature)) {
    return NextResponse.json({ error: "missing signature" }, { status: 401 });
  }
  const ts = Number(timestamp);
  if (!Number.isInteger(ts)) {
    return NextResponse.json({ error: "missing timestamp" }, { status: 400 });
  }
  if (Date.now() - ts > BOARD_SIG_MAX_AGE_MS) {
    return NextResponse.json({ error: "signature expired" }, { status: 401 });
  }
  if (ts - Date.now() > BOARD_SIG_MAX_FUTURE_SKEW_MS) {
    return NextResponse.json({ error: "timestamp in the future" }, { status: 401 });
  }

  let sigValid = false;
  try {
    sigValid = await verifyMessage({
      address: owner as `0x${string}`,
      message: buildProposeSignMessage({
        owner,
        cid,
        rect,
        bidPerCellWei: String(bidPerCellWei),
        timestamp: ts,
      }),
      signature: signature as `0x${string}`,
    });
  } catch {
    sigValid = false;
  }
  if (!sigValid) {
    return NextResponse.json({ error: "signature does not match owner" }, { status: 401 });
  }

  // Rate limit by owner wallet
  const rl = checkRateLimit(owner, "propose");
  if (!rl.ok) {
    return NextResponse.json({ error: rl.error }, { status: 429 });
  }

  const cells = rectCells(rect);
  if (cells <= 0 || cells > MAX_CELLS) {
    return NextResponse.json({ error: `cells out of bounds (<= ${MAX_CELLS})` }, { status: 400 });
  }
  if (mime && mime !== "image/png" && mime !== "image/jpeg") {
    return NextResponse.json({ error: "unsupported mime" }, { status: 400 });
  }

  // Optional pre-check: if overlapping accepted, require strictly higher bid.
  const accepted = listAccepted();
  const overlaps = accepted.filter((pl) => hasOverlap(rect, [pl.rect]));
  if (overlaps.length) {
    const myBid = BigInt(bidPerCellWei);
    const needsHigher = overlaps.some((pl) => myBid <= BigInt(pl.bidPerCellWei));
    if (needsHigher) {
      const minReq = overlaps.reduce(
        (mx, pl) => (BigInt(pl.bidPerCellWei) > mx ? BigInt(pl.bidPerCellWei) : mx),
        0n
      );
      return NextResponse.json(
        { error: "bid too low to displace accepted item(s)", requireGreaterThanWei: (minReq).toString() },
        { status: 409 }
      );
    }
  }

  const nowEpoch = currentEpoch();
  const secondsPerEpoch = EPOCH_SECONDS > 0 ? EPOCH_SECONDS : 0;
  const voteWindowSeconds = VOTE_WINDOW_SECONDS > 0 ? VOTE_WINDOW_SECONDS : 259200;
  const windowEpochs =
    secondsPerEpoch > 0 ? Math.max(1, Math.ceil(voteWindowSeconds / secondsPerEpoch)) : 1;
  const voteEndsAtEpoch = nowEpoch + windowEpochs;

  const generatedId = body.id ?? uid();
  const normalizedId = generatedId.startsWith("0x")
    ? (generatedId as `0x${string}`)
    : (keccak256(stringToHex(generatedId)) as `0x${string}`);
  const p = addProposal({
    id: generatedId,
    owner,
    cid,
    name: name ?? "",
    mime: (mime ?? "image/png") as "image/png" | "image/jpeg",
    rect,
    cells,
    bidPerCellWei: String(bidPerCellWei),
    width,
    height,
    epochSubmitted: nowEpoch,
    voteEndsAtEpoch,
    chainId: normalizedId,
  } as Omit<Proposal, "yes" | "no" | "voters" | "status" | "createdAt">);
  const normalizedCid = cid.replace(/^ipfs:\/\//, "");
  let cidHash = body.cidHash;
  if (!cidHash || cidHash === "0x") {
    cidHash = (await fetchCidHash(normalizedCid)) ?? ("0x" as `0x${string}`);
  }

  const stored: StoredProposal = {
    id: normalizedId,
    owner: owner as `0x${string}`,
    cid: normalizedCid,
    cidHash,
    rect,
    name: name ?? "",
    mime: (mime ?? "image/png") as "image/png" | "image/jpeg",
    epoch: nowEpoch,
    bidPerCellWei: String(bidPerCellWei),
  };
  ProposalStore.upsert(stored);
  recordAction(owner, "propose");

  return NextResponse.json({
    ok: true,
    id: p.id,
    chainId: normalizedId,
    epochSubmitted: p.epochSubmitted,
    voteEndsAtEpoch: p.voteEndsAtEpoch,
  });
}

const CID_PATTERN = /^(Qm[1-9A-HJ-NP-Za-km-z]{44}|b[a-z2-7]{58,})$/;
const FETCH_TIMEOUT_MS = 30_000;
const MAX_RESPONSE_BYTES = 10 * 1024 * 1024; // 10 MB

async function fetchCidHash(cid: string): Promise<`0x${string}` | null> {
  const normalized = cid.replace(/^ipfs:\/\//, "").trim();
  if (!normalized) return null;

  // Validate CID format before fetching
  if (!CID_PATTERN.test(normalized)) return null;

  const urls = ipfsToHttp(normalized);
  for (const url of urls) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeout);

      if (!res.ok) continue;

      // Check Content-Length if available
      const contentLength = res.headers.get("content-length");
      if (contentLength && parseInt(contentLength, 10) > MAX_RESPONSE_BYTES) continue;

      const bytes = new Uint8Array(await res.arrayBuffer());
      if (bytes.byteLength > MAX_RESPONSE_BYTES) continue;

      return keccak256(bytes);
    } catch {
      // continue to next gateway
    }
  }
  return null;
}
