// src/app/api/operator/finalize/route.ts
import {
  createPublicClient,
  createWalletClient,
  defineChain,
  http,
  keccak256,
  stringToHex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { FINALIZED_EVENT } from "@/lib/events";
import { ipfsToHttp } from "@/lib/ipfsUrl";
import { NextRequest, NextResponse } from "next/server";
import { currentEpoch } from "@/lib/epoch";
import {
  getStore,
  listAccepted,
  listProposals,
  replaceAccepted,
  setLatestManifest,
  gcProposals,
  saveManifestForEpoch,
  type Placement,
  type Proposal,
} from "../../_store";
import { hasOverlap } from "@/lib/grid";
import { uploadJSON } from "@/lib/ipfs";
import { ProposalStore } from "@/lib/proposalStore";

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

const deployBlockEnv =
  process.env.NEXT_PUBLIC_LOREBOARD_DEPLOY_BLOCK ??
  process.env.NEXT_PUBLIC_DEPLOY_BLOCK;

if (!deployBlockEnv) {
  throw new Error(
    "NEXT_PUBLIC_LOREBOARD_DEPLOY_BLOCK (or NEXT_PUBLIC_DEPLOY_BLOCK) is required"
  );
}

const deployBlock = BigInt(deployBlockEnv);

type RawLog = Awaited<ReturnType<typeof publicClient.getLogs>>[number];

type FinalizedLog = RawLog & {
  args: {
    epoch: bigint;
    manifestCID: string;
  };
};

function isFinalizedLog(log: RawLog): log is FinalizedLog {
  const args = (log as any)?.args;
  return typeof args?.epoch === "bigint" && typeof args?.manifestCID === "string";
}

async function getFinalizedLogs(
  fromBlock: bigint,
  toBlock: bigint,
  step = 90_000n
): Promise<FinalizedLog[]> {
  if (toBlock < fromBlock) return [];
  const logsAll: FinalizedLog[] = [];
  let cursor = fromBlock;
  while (cursor <= toBlock) {
    const chunkTo = cursor + step > toBlock ? toBlock : cursor + step;
    const logsRaw = (await publicClient.getLogs({
      address: treasury,
      event: FINALIZED_EVENT,
      fromBlock: cursor,
      toBlock: chunkTo,
    })) as RawLog[];
    const filtered = logsRaw.filter(isFinalizedLog);
    if (filtered.length) logsAll.push(...filtered);
    if (chunkTo === toBlock) break;
    cursor = chunkTo + 1n;
  }
  return logsAll;
}

async function fetchManifestFromCid(cid: string) {
  const urls = ipfsToHttp(cid);
  for (const u of urls) {
    try {
      const res = await fetch(u, { cache: "no-store" });
      if (res.ok) return await res.json();
    } catch {
      /* ignore */
    }
  }
  return null;
}

function coerceRect(raw: any) {
  const src = raw?.rect ?? raw ?? {};
  const x = Number(src.x ?? 0);
  const y = Number(src.y ?? 0);
  const w = Number(src.w ?? src.width ?? 0);
  const h = Number(src.h ?? src.height ?? 0);
  return { x, y, w, h };
}

function normalizeManifestPlacements(manifest: any): Placement[] {
  const rows = manifest?.placements ?? manifest?.winners ?? [];
  return rows.map((p: any): Placement => {
    const rect = coerceRect(p);
    return {
      id: String(p.id ?? ""),
      owner: String(p.owner ?? ""),
      cid: String(
        p.cid ?? manifest?.cid ?? manifest?.manifestCID ?? ""
      ),
      name: String(p.name ?? p.filename ?? ""),
      mime: (p.mime ?? "image/png") as "image/png" | "image/jpeg",
      rect,
      cells: Number(p.cells ?? 1),
      bidPerCellWei: String(p.bidPerCellWei ?? "0"),
      width: Number(p.width ?? rect.w ?? 0),
      height: Number(p.height ?? rect.h ?? 0),
    };
  });
}

async function loadBaseBoardFromOnchain() {
  const latestBlock = await publicClient.getBlockNumber();
  const logs = await getFinalizedLogs(deployBlock, latestBlock);

  if (!logs.length) {
    console.log("[finalize] no Finalized logs on-chain yet");
    return { basePlacements: [] as Placement[], latestEpoch: null };
  }

  const byId = new Map<string, Placement>();

  for (const log of logs) {
    const manifestCID = log.args.manifestCID;
    const epoch = Number(log.args.epoch);
    console.log("[finalize] replaying manifest", {
      epoch,
      manifestCID,
      blockNumber: log.blockNumber?.toString(),
    });

    const manifestRaw = await fetchManifestFromCid(manifestCID);
    if (!manifestRaw) {
      console.warn(
        "[finalize] failed to fetch manifest for epoch",
        epoch,
        "CID",
        manifestCID
      );
      continue;
    }

    const placements = normalizeManifestPlacements(manifestRaw);
    console.log("[finalize] manifest placements", {
      epoch,
      count: placements.length,
      ids: placements.map((p) => p.id),
    });

    for (const placement of placements) {
      byId.set(placement.id, placement);
    }
  }

  const latestEpoch = Number(logs[logs.length - 1].args.epoch);
  const basePlacements = Array.from(byId.values());
  console.log("[finalize] reconstructed base board from logs", {
    latestEpoch,
    count: basePlacements.length,
    ids: basePlacements.map((p) => p.id),
  });

  return { basePlacements, latestEpoch };
}

/* ---------- Helpers (same as old finalize) ---------- */

function canPlaceWithoutOverlap(a: Proposal, accepted: Placement[]) {
  // Once something is on the board it's permanent – any overlap is forbidden
  return !accepted.some((pl) => hasOverlap(a.rect, [pl.rect]));
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

  // --- Seed base board from full on-chain history (replaying manifests) ---
  const { basePlacements } = await loadBaseBoardFromOnchain();

  let nextAccepted: Placement[];
  if (basePlacements.length) {
    nextAccepted = basePlacements.map(clonePlacement);
    console.log("[finalize] basePlacements from full on-chain replay", {
      count: nextAccepted.length,
      ids: nextAccepted.map((p) => p.id),
    });
  } else {
    const acceptedSnapshot = listAccepted().map(clonePlacement);
    nextAccepted = acceptedSnapshot;
    console.log("[finalize] basePlacements from accepted store fallback", {
      count: nextAccepted.length,
      ids: nextAccepted.map((p) => p.id),
    });
  }

  const winners: Proposal[] = [];
  const rejectedDueToOverlap: string[] = [];

  for (const proposal of sorted) {
    // 1) Must not overlap anything already finalized on the board
    if (!canPlaceWithoutOverlap(proposal, nextAccepted)) {
      proposal.status = "rejected";
      rejectedDueToOverlap.push(proposal.id);
      continue;
    }

    // 2) Must not overlap any other winner in this same finalize run
    if (winners.some((w) => hasOverlap(proposal.rect, [w.rect]))) {
      proposal.status = "rejected";
      rejectedDueToOverlap.push(proposal.id);
      continue;
    }

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

  // Merge winners into the working board state
  nextAccepted = [...nextAccepted, ...added];

  console.log("[finalize] nextAccepted before manifest upload", {
    epoch,
    count: nextAccepted.length,
    ids: nextAccepted.map((p) => p.id),
  });

  const manifestPlacements: Placement[] = nextAccepted.map(clonePlacement);
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
    rejectedDueToOverlap,
    txHash,
    status: receipt.status,
  });
}
