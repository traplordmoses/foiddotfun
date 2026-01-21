// src/app/api/operator/finalize/route.ts
import {
  createPublicClient,
  createWalletClient,
  defineChain,
  http,
  keccak256,
  stringToHex,
} from "viem";
import type { Abi } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { FINALIZED_EVENT } from "@/lib/events";
import { ipfsToHttp } from "@/lib/ipfsUrl";
import { NextRequest, NextResponse } from "next/server";
import { currentEpoch } from "@/lib/epoch";
import { loreBoardManifestStoreAbi } from "@/abi/loreBoardManifestStore";
import {
  listAccepted,
  listProposals,
  replaceAccepted,
  setLatestManifest,
  gcProposals,
  saveManifestForEpoch,
  type Placement,
  type Proposal,
} from "../../_store";
import { loadLatestFinalized } from "@/lib/manifest";
import { hasOverlap } from "@/lib/grid";
import { uploadJSON } from "@/lib/ipfs";
import { ProposalStore } from "@/lib/proposalStore";
import { sortCandidatesByTieBreak } from "@/lib/winnerSelection";
import {
  LOREBOARD_VOTING_ADDRESS,
  loreboardVotingAbi,
} from "@/contracts/loreboardVoting";
import { CANONICAL_ADDRESSES, requireCanonicalAddress } from "@/config/canonical";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* ---------- ENV & chain clients ---------- */

const loreBoardManifestStoreAbiTyped = loreBoardManifestStoreAbi as Abi;

const getRuntimeConfig = () => {
  const rpc = process.env.NEXT_PUBLIC_FLUENT_RPC;
  const treasuryEnv = process.env.NEXT_PUBLIC_LOREBOARD_ADDRESS;
  const operatorPk = process.env.OPERATOR_PK;
  const manifestStoreEnv =
    (process.env.NEXT_PUBLIC_LOREBOARD_MANIFEST_STORE_ADDRESS ||
      process.env.NEXT_PUBLIC_LOREBOARD_ANCHOR ||
      process.env.NEXT_PUBLIC_MANIFEST_STORE ||
      process.env.NEXT_PUBLIC_MANIFEST_STORE_ADDRESS) as `0x${string}` | undefined;
  const loreboardVmEnv =
    process.env.NEXT_PUBLIC_LOREBOARD_VM_ADDRESS as `0x${string}` | undefined;

  if (!rpc) {
    throw new Error(
      "NEXT_PUBLIC_FLUENT_RPC is required. If you're using .env.local, run with DOTENV_CONFIG_PATH=.env.local."
    );
  }
  if (!operatorPk) {
    throw new Error(
      "OPERATOR_PK is required. If you're using .env.local, run with DOTENV_CONFIG_PATH=.env.local."
    );
  }

  const treasury = requireCanonicalAddress({
    label: "NEXT_PUBLIC_LOREBOARD_ADDRESS",
    envValue: treasuryEnv,
    expected: CANONICAL_ADDRESSES.treasury,
    envHint: "NEXT_PUBLIC_LOREBOARD_ADDRESS",
  });
  const manifestStore = requireCanonicalAddress({
    label: "NEXT_PUBLIC_LOREBOARD_MANIFEST_STORE_ADDRESS",
    envValue: manifestStoreEnv,
    expected: CANONICAL_ADDRESSES.manifestStore,
    envHint:
      "NEXT_PUBLIC_LOREBOARD_MANIFEST_STORE_ADDRESS (or NEXT_PUBLIC_LOREBOARD_ANCHOR/NEXT_PUBLIC_MANIFEST_STORE)",
  });
  const loreboardVm = loreboardVmEnv
    ? requireCanonicalAddress({
        label: "NEXT_PUBLIC_LOREBOARD_VM_ADDRESS",
        envValue: loreboardVmEnv,
        expected: CANONICAL_ADDRESSES.vmWrapper,
        envHint: "NEXT_PUBLIC_LOREBOARD_VM_ADDRESS",
      })
    : undefined;

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
      "NEXT_PUBLIC_LOREBOARD_DEPLOY_BLOCK (or NEXT_PUBLIC_DEPLOY_BLOCK) is required. If you're using .env.local, run with DOTENV_CONFIG_PATH=.env.local."
    );
  }

  const deployBlock = BigInt(deployBlockEnv);

  return {
    publicClient,
    wallet,
    treasury,
    manifestStore,
    loreboardVm,
    deployBlock,
  };
};

type RuntimeConfig = ReturnType<typeof getRuntimeConfig>;
type PublicClientType = RuntimeConfig["publicClient"];

type RawLog = Awaited<ReturnType<PublicClientType["getLogs"]>>[number];

type FinalizedLog = RawLog & {
  args: {
    epoch: bigint;
    manifestCID: string;
  };
};

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null;
}

function isFinalizedLog(log: RawLog): log is FinalizedLog {
  const args = (log as { args?: unknown })?.args;
  if (!isRecord(args)) return false;
  return typeof args.epoch === "bigint" && typeof args.manifestCID === "string";
}

async function getFinalizedLogs(
  publicClient: PublicClientType,
  treasury: `0x${string}`,
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

function coerceRect(raw: unknown) {
  const src = isRecord(raw) ? raw : {};
  const rect = isRecord(src.rect) ? src.rect : src;
  const x = Number(rect.x ?? 0);
  const y = Number(rect.y ?? 0);
  const w = Number(rect.w ?? rect.width ?? 0);
  const h = Number(rect.h ?? rect.height ?? 0);
  return { x, y, w, h };
}

function normalizeManifestPlacements(manifest: unknown): Placement[] {
  const manifestRecord = isRecord(manifest) ? manifest : {};
  const rows = Array.isArray(manifestRecord.placements)
    ? manifestRecord.placements
    : Array.isArray(manifestRecord.winners)
    ? manifestRecord.winners
    : [];

  return rows.map((row): Placement => {
    const placement = isRecord(row) ? row : {};
    const rect = coerceRect(placement);
    const mime =
      placement.mime === "image/jpeg" ? "image/jpeg" : "image/png";
    return {
      id: String(placement.id ?? ""),
      owner: String(placement.owner ?? ""),
      cid: String(
        placement.cid ?? manifestRecord.cid ?? manifestRecord.manifestCID ?? ""
      ),
      name: String(placement.name ?? placement.filename ?? ""),
      mime,
      rect,
      cells: Number(placement.cells ?? 1),
      bidPerCellWei: String(placement.bidPerCellWei ?? "0"),
      width: Number(placement.width ?? rect.w ?? 0),
      height: Number(placement.height ?? rect.h ?? 0),
    };
  });
}

type BaseBoardSource = "manifest-store" | "logs" | "none";

async function loadBaseBoardFromOnchain() {
  const { publicClient, treasury, deployBlock } = getRuntimeConfig();
  const latestFromStore = await loadLatestFinalized();
  if (latestFromStore?.manifestCID) {
    const cid = latestFromStore.manifestCID.replace(/^ipfs:\/\//, "");
    const manifestRaw = await fetchManifestFromCid(cid);
    if (manifestRaw) {
      const placements = normalizeManifestPlacements(manifestRaw);
      console.log("[finalize] base placements from manifest store", {
        epoch: latestFromStore.epoch,
        cid,
        count: placements.length,
      });
      return {
        basePlacements: placements,
        latestEpoch: latestFromStore.epoch ?? null,
        source: "manifest-store" as BaseBoardSource,
      };
    }
    console.warn("[finalize] failed to load manifest from store CID", cid);
  }

  const latestBlock = await publicClient.getBlockNumber();
  const logs = await getFinalizedLogs(
    publicClient,
    treasury,
    deployBlock,
    latestBlock
  );

  if (!logs.length) {
    console.log(
      "[finalize] no Finalized logs on-chain yet and no manifest fallback – defaulting to empty board"
    );
    return { basePlacements: [] as Placement[], latestEpoch: null, source: "none" };
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

  return { basePlacements, latestEpoch, source: "logs" as BaseBoardSource };
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
  },
] as const satisfies Abi;

const loreboardVmAbi = [
  {
    type: "function",
    name: "selectWinners",
    stateMutability: "view",
    inputs: [
      {
        name: "base",
        type: "tuple[]",
        components: [
          { name: "id", type: "bytes32" },
          {
            name: "rect",
            type: "tuple",
            components: [
              { name: "x", type: "int32" },
              { name: "y", type: "int32" },
              { name: "w", type: "int32" },
              { name: "h", type: "int32" },
            ],
          },
          { name: "bidPerCellWei", type: "uint256" },
        ],
      },
      {
        name: "candidates",
        type: "tuple[]",
        components: [
          { name: "id", type: "bytes32" },
          {
            name: "rect",
            type: "tuple",
            components: [
              { name: "x", type: "int32" },
              { name: "y", type: "int32" },
              { name: "w", type: "int32" },
              { name: "h", type: "int32" },
            ],
          },
          { name: "bidPerCellWei", type: "uint256" },
        ],
      },
    ],
    outputs: [
      { name: "accepted", type: "bytes32[]" },
      { name: "rejected", type: "bytes32[]" },
    ],
  },
] as const satisfies Abi;

type Hex32 = `0x${string}`;

const clonePlacement = (p: Placement): Placement => ({
  ...p,
  rect: { ...p.rect },
});

const toBytes32Id = (value: string): Hex32 => {
  if (value.startsWith("0x") && value.length === 66) {
    return value as Hex32;
  }
  return keccak256(stringToHex(value)) as Hex32;
};

const fakeRootFromIds = (ids: Hex32[]): Hex32 => {
  const concat = (`0x${ids.map((id) => id.slice(2)).join("")}` || "0x") as Hex32;
  return keccak256(concat) as Hex32;
};

/* ---------- POST /api/operator/finalize ---------- */

export async function POST(req: NextRequest) {
  const { publicClient, wallet, treasury, manifestStore, loreboardVm } =
    getRuntimeConfig();
  let body: unknown = null;
  try {
    body = await req.json();
  } catch {
    body = null;
  }

  const url = new URL(req.url);
  const force = url.searchParams.get("force") === "1";
  const bodyRecord = isRecord(body) ? body : {};
  const epoch =
    typeof bodyRecord.epoch === "number" && !Number.isNaN(bodyRecord.epoch)
      ? bodyRecord.epoch
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

  const passed: Proposal[] = [];
  const epochBigInt = BigInt(epoch);
  const minTotalWeightQuorum = force
    ? 0n
    : ((await publicClient.readContract({
        address: LOREBOARD_VOTING_ADDRESS,
        abi: loreboardVotingAbi,
        functionName: "minTotalWeightQuorum",
        args: [],
      })) as bigint);

  for (const candidate of candidates) {
    if (force) {
      passed.push(candidate);
      continue;
    }

    const chainId = (ProposalStore.get(candidate.id)?.id ?? candidate.id) as Hex32;
    const [yes, no] = (await publicClient.readContract({
      address: LOREBOARD_VOTING_ADDRESS,
      abi: loreboardVotingAbi,
      functionName: "getPlacementVotes",
      args: [epochBigInt, chainId],
    })) as readonly [bigint, bigint];

    const total = yes + no;
    if (total < minTotalWeightQuorum) continue;

    const passesMajority = (await publicClient.readContract({
      address: LOREBOARD_VOTING_ADDRESS,
      abi: loreboardVotingAbi,
      functionName: "passesMajority51",
      args: [epochBigInt, chainId],
    })) as boolean;

    if (!passesMajority) continue;
    passed.push(candidate);
  }

  if (!passed.length && !force) {
    return NextResponse.json(
      { error: "No proposals passed quorum/threshold", epoch },
      { status: 400 }
    );
  }

  const sorted = sortCandidatesByTieBreak(passed);

  // --- Seed base board from the latest anchored manifest (logs as backup) ---
  const { basePlacements, source: baseSource } = await loadBaseBoardFromOnchain();

  let nextAccepted: Placement[];
  if (basePlacements.length) {
    nextAccepted = basePlacements.map(clonePlacement);
    console.log("[finalize] basePlacements seeded", {
      source: baseSource,
      count: nextAccepted.length,
      ids: nextAccepted.map((p) => p.id),
    });
  } else {
    const acceptedSnapshot = listAccepted().map(clonePlacement);
    nextAccepted = acceptedSnapshot;
    console.log("[finalize] basePlacements from accepted store fallback", {
      source: baseSource,
      count: nextAccepted.length,
      ids: nextAccepted.map((p) => p.id),
    });
  }

  const winners: Proposal[] = [];
  const rejectedDueToOverlap: string[] = [];

  let usedVm = false;

  if (loreboardVm) {
    try {
      const baseInputs = nextAccepted.map((placement) => ({
        id: toBytes32Id(placement.id),
        rect: {
          x: placement.rect.x,
          y: placement.rect.y,
          w: placement.rect.w,
          h: placement.rect.h,
        },
        bidPerCellWei: BigInt(placement.bidPerCellWei ?? "0"),
      }));

      const candidateInputs = sorted.map((proposal) => {
        const stored = ProposalStore.get(proposal.id);
        const chainId = (stored?.id ?? proposal.id) as Hex32;
        return {
          id: chainId,
          rect: {
            x: proposal.rect.x,
            y: proposal.rect.y,
            w: proposal.rect.w,
            h: proposal.rect.h,
          },
          bidPerCellWei: BigInt(proposal.bidPerCellWei),
        };
      });

      const [acceptedIds, rejectedIds] = (await publicClient.readContract({
        address: loreboardVm,
        abi: loreboardVmAbi,
        functionName: "selectWinners",
        args: [baseInputs, candidateInputs],
      })) as readonly [Hex32[], Hex32[]];

      console.log("[finalize] loreboard VM mode enabled", {
        enabled: Boolean(loreboardVm),
        accepted: acceptedIds.length,
        rejected: rejectedIds.length,
        address: loreboardVm,
      });

      const byChainId = new Map<string, Proposal>();
      for (const proposal of sorted) {
        const stored = ProposalStore.get(proposal.id);
        const chainId = (stored?.id ?? proposal.id) as Hex32;
        byChainId.set(chainId.toLowerCase(), proposal);
      }

      const decided = new Set<string>();

      for (const chainId of acceptedIds) {
        const key = chainId.toLowerCase();
        decided.add(key);
        const proposal = byChainId.get(key);
        if (!proposal) continue;
        proposal.status = "accepted";
        winners.push(proposal);
      }

      for (const chainId of rejectedIds) {
        const key = chainId.toLowerCase();
        if (decided.has(key)) continue;
        decided.add(key);
        const proposal = byChainId.get(key);
        if (!proposal) continue;
        proposal.status = "rejected";
        rejectedDueToOverlap.push(proposal.id);
      }

      for (const proposal of sorted) {
        const stored = ProposalStore.get(proposal.id);
        const chainId = (stored?.id ?? proposal.id) as Hex32;
        const key = chainId.toLowerCase();
        if (decided.has(key)) continue;
        decided.add(key);
        proposal.status = "rejected";
        rejectedDueToOverlap.push(proposal.id);
      }

      usedVm = true;
    } catch (error) {
      console.warn(
        "[finalize] loreboard VM selection failed, falling back to JS",
        error
      );
    }
  }

  if (!usedVm) {
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
  const placementsRoot = fakeRootFromIds(
    manifestPlacements.map((placement) => toBytes32Id(placement.id))
  );
  const manifest = {
    epoch,
    finalizedAt: Date.now(),
    placements: manifestPlacements,
    placementsRoot,
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
    abi: finalizeAbi,
    functionName: "finalizeEpoch",
    args: [epoch, manifestRoot, cid!, acceptedIds, rejectedIds],
  });

  const receipt = await publicClient.waitForTransactionReceipt({
    hash: txHash,
  });

  if (receipt.status !== "success") {
    return NextResponse.json(
      {
        epoch,
        manifestCID: cid,
        manifestRoot,
        winners: acceptedIds,
        rejectedDueToOverlap,
        txHash,
        status: receipt.status,
        error: "finalizeEpoch reverted",
      },
      { status: 500 }
    );
  }

  const anchorTx = await wallet.writeContract({
    address: manifestStore,
    abi: loreBoardManifestStoreAbiTyped,
    functionName: "anchor",
    args: [epoch, manifestRoot, cid],
  });

  const anchorReceipt = await publicClient.waitForTransactionReceipt({
    hash: anchorTx,
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
    anchorTx,
    anchorStatus: anchorReceipt.status,
  });
}
