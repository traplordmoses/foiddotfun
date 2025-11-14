// src/app/api/operator/finalize/route.ts
import { NextRequest, NextResponse } from "next/server";
import { currentEpoch } from "@/lib/epoch";
import {
  getStore,
  listAccepted,
  listProposals,
  replaceAccepted,
  setLatestManifest,
  gcProposals,
  getLatestManifest,
  saveManifestForEpoch,
  type Placement,
  type Proposal,
} from "../../_store";
import { hasOverlap } from "@/lib/grid";
import { uploadJSON } from "@/lib/ipfs";
import { ProposalStore } from "@/lib/proposalStore";
import {
  createPublicClient,
  createWalletClient,
  defineChain,
  http,
  keccak256,
  stringToHex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* ---------- ENV & chain clients ---------- */

const rpc = process.env.NEXT_PUBLIC_FLUENT_RPC!;
const treasuryEnv = process.env.NEXT_PUBLIC_LOREBOARD_ADDRESS;
const operatorPk = process.env.OPERATOR_PK!;

if (!rpc) throw new Error("NEXT_PUBLIC_FLUENT_RPC is required");
if (!treasuryEnv) throw new Error("NEXT_PUBLIC_LOREBOARD_ADDRESS is required");
if (!operatorPk) throw new Error("OPERATOR_PK is required");
const treasury = treasuryEnv as `0x${string}`;

const chain = defineChain({
  id: 20994,
  name: "Fluent Testnet",
  nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: [rpc] } },
});

const operatorAccount = privateKeyToAccount(
  operatorPk.startsWith("0x")
    ? (operatorPk as `0x${string}`)
    : (`0x${operatorPk}` as `0x${string}`)
);

const publicClient = createPublicClient({ chain, transport: http(rpc) });
const wallet = createWalletClient({
  chain,
  transport: http(rpc),
  account: operatorAccount,
});

/* ---------- Helpers (same as old finalize) ---------- */

function canDisplaceAccepted(a: Proposal, accepted: Placement[]) {
  const overlapping = accepted.filter((pl) => hasOverlap(a.rect, [pl.rect]));
  if (!overlapping.length) return true;
  const aBid = BigInt(a.bidPerCellWei);
  return overlapping.every((pl) => aBid > BigInt(pl.bidPerCellWei));
}

const finalizeAbi = [
  {
    type: "function",
    name: "finalizeEpoch",
    stateMutability: "nonpayable",
    inputs: [
      { name: "epoch", type: "uint32" },
      { name: "manifestRoot", type: "bytes32" },
      { name: "manifestCID", type: "string" },
      { name: "accepted", type: "bytes32[]" },
      { name: "rejected", type: "bytes32[]" },
    ],
    outputs: [],
  } as const,
];

type Hex32 = `0x${string}`;

const clonePlacement = (p: Placement): Placement => ({
  ...p,
  rect: { ...p.rect },
});

/* ---------- POST /api/operator/finalize ---------- */

export async function POST(req: NextRequest) {
  const S = getStore();

  let body: any = null;
  try {
    body = await req.json();
  } catch {
    body = null;
  }

  const url = new URL(req.url);
  const force = url.searchParams.get("force") === "1";
  const epoch =
    typeof body?.epoch === "number" && !Number.isNaN(body.epoch)
      ? body.epoch
      : currentEpoch();

  const candidates = listProposals().filter(
    (p) => p.status === "proposed" && (p.voteEndsAtEpoch <= epoch || force)
  );

  if (!candidates.length) {
    return NextResponse.json(
      { error: "No proposals ready to finalize", epoch, candidates: [] },
      { status: 200 }
    );
  }

  const passed = candidates.filter((p) => {
    if (force) return true;
    const total = p.yes + p.no;
    if (total < S.quorum) return false;
    const pctYes = total === 0 ? 0 : p.yes / total;
    return pctYes >= S.yesThreshold;
  });

  if (!passed.length && !force) {
    return NextResponse.json(
      { error: "No proposals passed quorum/threshold", epoch },
      { status: 400 }
    );
  }

  const sorted = passed.slice().sort((a, b) => {
    const bidDelta = BigInt(b.bidPerCellWei) - BigInt(a.bidPerCellWei);
    if (bidDelta !== 0n) return bidDelta > 0n ? 1 : -1;
    if (a.epochSubmitted !== b.epochSubmitted) {
      return a.epochSubmitted - b.epochSubmitted;
    }
    return a.id.localeCompare(b.id);
  });

  const latest = getLatestManifest();
  let nextAccepted = latest?.placements
    ? latest.placements.map(clonePlacement)
    : listAccepted().map(clonePlacement);
  const winners: Proposal[] = [];

  for (const proposal of sorted) {
    if (!canDisplaceAccepted(proposal, nextAccepted)) {
      proposal.status = "rejected";
      continue;
    }
    if (winners.some((w) => hasOverlap(proposal.rect, [w.rect]))) {
      proposal.status = "rejected";
      continue;
    }

    const aBid = BigInt(proposal.bidPerCellWei);
    nextAccepted = nextAccepted.filter((pl) => {
      if (!hasOverlap(pl.rect, [proposal.rect])) return true;
      return BigInt(pl.bidPerCellWei) > aBid;
    });

    winners.push(proposal);
    proposal.status = "accepted";
  }

  for (const candidate of candidates) {
    if (candidate.status === "proposed") {
      candidate.status = "rejected";
    }
  }

  const enriched = winners.map((w) => {
    const stored = ProposalStore.get(w.id);
    const placement: Placement = {
      id: w.id,
      owner: w.owner || stored?.owner || "",
      cid: w.cid || stored?.cid || "",
      name: w.name || stored?.name || stored?.filename || "",
      mime: (w.mime || stored?.mime || "image/png") as "image/png" | "image/jpeg",
      rect: w.rect,
      cells: w.cells,
      bidPerCellWei: w.bidPerCellWei,
      width: w.width || stored?.width || 0,
      height: w.height || stored?.height || 0,
    };
    const chainId = (stored?.id ?? w.id) as `0x${string}`;
    return { placement, chainId };
  });

  const added: Placement[] = enriched.map((e) => e.placement);
  const acceptedIds = enriched.map((e) => e.chainId as Hex32);

  nextAccepted = [...nextAccepted, ...added];

  const manifestPlacements = nextAccepted.map(clonePlacement);
  const manifest = {
    epoch,
    finalizedAt: Date.now(),
    placements: manifestPlacements,
  };
  const manifestJson = JSON.stringify(manifest);

  let cid: string;
  try {
    cid = await uploadJSON(`mifoid-epoch-${epoch}.manifest.json`, manifest);
    console.log("[operator/finalize] uploaded manifest:", cid);
  } catch (e) {
    console.error("[operator/finalize] uploadJSON failed:", e);
    if (process.env.NODE_ENV !== "production") {
      cid = `dev-manifest-epoch-${epoch}`;
      console.warn(
        "[operator/finalize] using DEV manifest CID fallback:",
        cid
      );
    } else {
      return NextResponse.json(
        { error: "Manifest upload failed", details: String(e) },
        { status: 500 }
      );
    }
  }

  saveManifestForEpoch(epoch, manifestPlacements, manifest.finalizedAt, cid);
  setLatestManifest(manifest, cid);

  const rejectedIds = candidates
    .filter((c) => c.status === "rejected")
    .map((c) => {
      const stored = ProposalStore.get(c.id);
      return (stored?.id ?? c.id) as Hex32;
    });

  const manifestRoot = keccak256(stringToHex(manifestJson)) as Hex32;

  const txHash = await wallet.writeContract({
    address: treasury,
    abi: finalizeAbi as any,
    functionName: "finalizeEpoch",
    args: [epoch, manifestRoot, cid!, acceptedIds, rejectedIds],
  });

  const receipt = await publicClient.waitForTransactionReceipt({
    hash: txHash,
  });

  replaceAccepted(nextAccepted.map(clonePlacement));
  gcProposals();

  return NextResponse.json({
    epoch,
    manifestCID: cid,
    manifestRoot,
    winners: acceptedIds,
    txHash,
    status: receipt.status,
  });
}
