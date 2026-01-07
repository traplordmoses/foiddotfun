import "dotenv/config";
import path from "path";
import { fileURLToPath } from "url";
import {
  createPublicClient,
  createWalletClient,
  defineChain,
  http,
  hexToString,
  encodePacked,
  keccak256,
  stringToHex,
  type Abi,
  type AbiEvent,
  type Address,
  type Chain,
  type Hex,
  type PublicClient,
  type Transport,
  type WalletClient,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import treasuryAbi from "../src/abi/LoreBoardTreasury.json" assert { type: "json" };
import boardAbi from "../src/abi/LoreboardBoardV1.json" assert { type: "json" };
import { loreBoardManifestStoreAbi } from "../src/abi/loreBoardManifestStore";
import { ipfsToHttp } from "../src/lib/ipfsUrl";
import { uploadJSON } from "../src/lib/ipfs";
import { resolveLatestManifestCid } from "../src/lib/manifestStore";

type Rect = { x: number; y: number; w: number; h: number };

type Placement = {
  id: string;
  owner: string;
  cid: string;
  name: string;
  mime: "image/png" | "image/jpeg";
  rect: Rect;
  cells: number;
  bidPerCellWei: string;
  width: number;
  height: number;
  cidHash?: string;
};

type ChainProposal = {
  id: Hex;
  bidder: Address;
  epoch: number;
  rect: Rect;
  bidPerCellWei: bigint;
  cells: number;
  cidHash: Hex;
};

type ManifestPayload = {
  manifest: {
    epoch: number;
    finalizedAt: number;
    placements: Placement[];
    placementsRoot: Hex;
  };
  manifestJson: string;
  manifestRoot: Hex;
  placementsRoot: Hex;
};

const getPlacementProposedEvent = (abi: Abi): AbiEvent => {
  const event = abi.find(
    (item) => item.type === "event" && item.name === "PlacementProposed"
  );
  if (!event) {
    throw new Error("Missing PlacementProposed event in LoreboardBoardV1 ABI");
  }
  return event as AbiEvent;
};

const PLACEMENT_PROPOSED_EVENT = getPlacementProposedEvent(boardAbi as Abi);

const votingV2Abi = [
  {
    type: "function",
    name: "epochAt",
    stateMutability: "view",
    inputs: [{ name: "t", type: "uint64" }],
    outputs: [{ name: "", type: "uint32" }],
  },
  {
    type: "function",
    name: "voteWindowSeconds",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint32" }],
  },
  {
    type: "function",
    name: "getPlacementMeta",
    stateMutability: "view",
    inputs: [{ name: "placementId", type: "bytes32" }],
    outputs: [
      { name: "registeredAt", type: "uint64" },
      { name: "voteEndsAt", type: "uint64" },
      { name: "epochId", type: "uint32" },
      { name: "exists", type: "bool" },
    ],
  },
  {
    type: "function",
    name: "getPlacementVotes",
    stateMutability: "view",
    inputs: [
      { name: "epochId", type: "uint256" },
      { name: "placementId", type: "bytes32" },
    ],
    outputs: [
      { name: "yesWeight", type: "uint256" },
      { name: "noWeight", type: "uint256" },
    ],
  },
  {
    type: "function",
    name: "isPendingPlacement",
    stateMutability: "view",
    inputs: [
      { name: "epochId", type: "uint256" },
      { name: "placementId", type: "bytes32" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "epochs",
    stateMutability: "view",
    inputs: [{ name: "epochId", type: "uint256" }],
    outputs: [{ name: "finalized", type: "bool" }],
  },
  {
    type: "function",
    name: "passesMajority51",
    stateMutability: "view",
    inputs: [
      { name: "epochId", type: "uint256" },
      { name: "placementId", type: "bytes32" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "meetsQuorum",
    stateMutability: "view",
    inputs: [
      { name: "epochId", type: "uint256" },
      { name: "placementId", type: "bytes32" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "boardAdmin",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
  {
    type: "function",
    name: "setEpochFinalized",
    stateMutability: "nonpayable",
    inputs: [
      { name: "epochId", type: "uint256" },
      { name: "finalized_", type: "bool" },
    ],
    outputs: [],
  },
] as const;

const ZERO_BYTES32 = "0x0000000000000000000000000000000000000000000000000000000000000000";

function computePlacementId(
  bidder: Address,
  epoch: bigint,
  cidHash: Hex,
  r: Rect
): Hex {
  return keccak256(
    encodePacked(
      ["address", "uint256", "bytes32", "int32", "int32", "uint32", "uint32"],
      [bidder, epoch, cidHash, r.x, r.y, r.w, r.h]
    )
  );
}

const toBytes32Id = (value: string): Hex => {
  if (value.startsWith("0x") && value.length === 66) {
    return value as Hex;
  }
  return keccak256(stringToHex(value)) as Hex;
};

const fakeRootFromIds = (ids: Hex[]): Hex => {
  const concat = (`0x${ids.map((id) => id.slice(2)).join("")}` || "0x") as Hex;
  return keccak256(concat) as Hex;
};

const clonePlacement = (p: Placement): Placement => ({
  ...p,
  rect: { ...p.rect },
});

export function buildManifestPayload(params: {
  epoch: number;
  placements: Placement[];
  finalizedAt: number;
}): ManifestPayload {
  const placementsRoot = fakeRootFromIds(
    params.placements.map((placement) => toBytes32Id(placement.id))
  );
  const manifest = {
    epoch: params.epoch,
    finalizedAt: params.finalizedAt,
    placements: params.placements.map(clonePlacement),
    placementsRoot,
  };
  const manifestJson = JSON.stringify(manifest);
  const manifestRoot = keccak256(stringToHex(manifestJson)) as Hex;
  return { manifest, manifestJson, manifestRoot, placementsRoot };
}

function requireEnv(name: string, value?: string | null) {
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

function normalizePk(value?: string | null) {
  if (!value) return null;
  return value.startsWith("0x") ? (value as Hex) : (`0x${value}` as Hex);
}

function ensureIpfsPrefix(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  return trimmed.startsWith("ipfs://") ? trimmed : `ipfs://${trimmed}`;
}

function parseEpochOverride(args: string[]) {
  const envEpoch = process.env.EPOCH;
  if (envEpoch) {
    const parsed = Number(envEpoch);
    if (Number.isFinite(parsed)) return Math.floor(parsed);
  }

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (!arg) continue;
    if (arg === "--") continue;
    if (arg === "--epoch" && args[i + 1]) {
      const parsed = Number(args[i + 1]);
      if (Number.isFinite(parsed)) return Math.floor(parsed);
    }
    if (arg.startsWith("--epoch=")) {
      const parsed = Number(arg.split("=", 2)[1]);
      if (Number.isFinite(parsed)) return Math.floor(parsed);
    }
  }

  if (args[0]) {
    const parsed = Number(args[0]);
    if (Number.isFinite(parsed)) return Math.floor(parsed);
  }

  return null;
}

function coerceRect(raw: any): Rect {
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
      cid: String(p.cid ?? manifest?.cid ?? manifest?.manifestCID ?? ""),
      name: String(p.name ?? p.filename ?? ""),
      mime: (p.mime ?? "image/png") as "image/png" | "image/jpeg",
      rect,
      cells: Number(p.cells ?? 1),
      bidPerCellWei: String(p.bidPerCellWei ?? "0"),
      width: Number(p.width ?? rect.w ?? 0),
      height: Number(p.height ?? rect.h ?? 0),
      cidHash: p.cidHash ? String(p.cidHash) : undefined,
    };
  });
}

async function fetchManifestFromCid(cid: string) {
  const urls = ipfsToHttp(cid);
  for (const url of urls) {
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (res.ok) return await res.json();
    } catch {
      // ignore and try next
    }
  }
  return null;
}

async function loadBasePlacements(params: {
  publicClient: PublicClient<Transport, Chain>;
  manifestStore: Address;
  deployBlock: bigint;
}) {
  const latest = await resolveLatestManifestCid({
    client: params.publicClient,
    manifestStore: params.manifestStore,
    fromBlock: params.deployBlock,
  });
  if (!latest.cid) {
    return {
      placements: [] as Placement[],
      latestEpoch: null as number | null,
      source: "none" as const,
    };
  }

  const cid = latest.cid.replace(/^ipfs:\/\//, "");
  const manifestRaw = await fetchManifestFromCid(cid);
  if (!manifestRaw) {
    return {
      placements: [] as Placement[],
      latestEpoch: latest.epoch ?? null,
      source: "missing-manifest" as const,
    };
  }

  return {
    placements: normalizeManifestPlacements(manifestRaw),
    latestEpoch: latest.epoch ?? null,
    source: "manifest-store" as const,
  };
}

function resolveLogRange(latest: bigint, deployBlock: bigint, lookback?: bigint) {
  if (lookback && lookback > 0n) {
    const fromBlock = latest > lookback ? latest - lookback : 0n;
    return { fromBlock, toBlock: latest };
  }
  return { fromBlock: deployBlock, toBlock: latest };
}

async function fetchProposalsForEpoch(params: {
  publicClient: ReturnType<typeof createPublicClient>;
  board: Address;
  epochId: number;
  deployBlock: bigint;
  lookbackBlocks?: bigint;
}) {
  const latest = await params.publicClient.getBlockNumber();
  const { fromBlock, toBlock } = resolveLogRange(
    latest,
    params.deployBlock,
    params.lookbackBlocks
  );

  const logs = await params.publicClient.getLogs({
    address: params.board,
    event: PLACEMENT_PROPOSED_EVENT,
    fromBlock,
    toBlock,
  });

  const proposals = new Map<string, ChainProposal>();

  for (const log of logs) {
    const args: any = log.args ?? {};
    const epoch = Number(args.epoch ?? 0);
    if (epoch !== params.epochId) continue;

    const rect = coerceRect({
      x: args.x,
      y: args.y,
      w: args.w,
      h: args.h,
    });
    const id = args.id as Hex | undefined;
    const bidder = (args.bidder ?? "") as Address;
    const cidHash = args.cidHash as Hex;
    const bidPerCellWei = BigInt(args.bidPerCellWei ?? 0);
    const cells = Number(args.cells ?? 0);

    if (!id || !bidder) continue;

    const computedId = computePlacementId(
      bidder,
      BigInt(epoch),
      cidHash,
      rect
    );
    if (computedId.toLowerCase() !== id.toLowerCase()) {
      console.warn(
        `[warn] placementId mismatch for epoch ${epoch}: log=${id} computed=${computedId}`
      );
    }

    if (!proposals.has(id.toLowerCase())) {
      proposals.set(id.toLowerCase(), {
        id,
        bidder,
        epoch,
        rect,
        bidPerCellWei,
        cells,
        cidHash,
      });
    }
  }

  return Array.from(proposals.values()).sort((a, b) =>
    a.id.toLowerCase().localeCompare(b.id.toLowerCase())
  );
}

function asPlacement(proposal: ChainProposal, cid: string): Placement {
  return {
    id: proposal.id,
    owner: proposal.bidder,
    cid: ensureIpfsPrefix(cid),
    name: "",
    mime: "image/png",
    rect: proposal.rect,
    cells: proposal.cells,
    bidPerCellWei: proposal.bidPerCellWei.toString(),
    width: proposal.rect.w,
    height: proposal.rect.h,
    cidHash: proposal.cidHash,
  };
}

async function fetchCidForPlacement(params: {
  publicClient: PublicClient<Transport, Chain>;
  board: Address;
  placementId: Hex;
}) {
  const cidBytes = (await params.publicClient.readContract({
    address: params.board,
    abi: boardAbi,
    functionName: "cidOf",
    args: [params.placementId],
  })) as Hex;

  if (!cidBytes || cidBytes === "0x") return "";
  try {
    return hexToString(cidBytes);
  } catch {
    return "";
  }
}

async function resolveEpochId(params: {
  publicClient: PublicClient<Transport, Chain>;
  voting: Address;
  overrideEpochId: number | null;
}) {
  if (params.overrideEpochId !== null) return params.overrideEpochId;
  const nowSec = Math.floor(Date.now() / 1000);
  const epochAtNow =
    (await params.publicClient.readContract({
      address: params.voting,
      abi: votingV2Abi,
      functionName: "epochAt",
      args: [BigInt(nowSec)],
    })) as unknown as bigint;
  const finalizable = Number(epochAtNow) - 1;
  return finalizable >= 0 ? finalizable : null;
}

async function summarizeEpoch(params: {
  publicClient: PublicClient<Transport, Chain>;
  voting: Address;
  board: Address;
  treasury: Address;
  epochId: number;
  proposals: ChainProposal[];
}) {
  const voteWindowSeconds = Number(
    await params.publicClient.readContract({
      address: params.voting,
      abi: votingV2Abi,
      functionName: "voteWindowSeconds",
    })
  );

  const votingFinalized =
    (await params.publicClient.readContract({
      address: params.voting,
      abi: votingV2Abi,
      functionName: "epochs",
      args: [BigInt(params.epochId)],
    })) as boolean;

  const treasuryRoot =
    (await params.publicClient.readContract({
      address: params.treasury,
      abi: treasuryAbi,
      functionName: "manifestRootOf",
      args: [params.epochId],
    })) as Hex;
  const treasuryFinalized = treasuryRoot && treasuryRoot !== ZERO_BYTES32;

  if (!params.proposals.length) {
    console.log(
      `[sync] epoch=${params.epochId} proposals=0 registered=0 pending=0 meetsQuorum=0 passesMajority51=0 votingFinalized=${votingFinalized} treasuryFinalized=${treasuryFinalized} voteWindowSeconds=${voteWindowSeconds}`
    );
    return;
  }

  let withCid = 0;
  let registered = 0;
  let pending = 0;
  let meetsQuorum = 0;
  let passes = 0;
  let withVotes = 0;

  for (const proposal of params.proposals) {
    const cid = await fetchCidForPlacement({
      publicClient: params.publicClient,
      board: params.board,
      placementId: proposal.id,
    });
    if (cid) withCid += 1;

    const meta =
      (await params.publicClient.readContract({
        address: params.voting,
        abi: votingV2Abi,
        functionName: "getPlacementMeta",
        args: [proposal.id],
      })) as readonly [bigint, bigint, number, boolean];
    const placementEpochId = meta[2];
    const exists = meta[3];
    if (exists) registered += 1;
    if (placementEpochId !== params.epochId) {
      console.warn(
        `[warn] placement ${proposal.id} meta epoch=${placementEpochId} does not match event epoch=${params.epochId}`
      );
    }

    const isPending =
      (await params.publicClient.readContract({
        address: params.voting,
        abi: votingV2Abi,
        functionName: "isPendingPlacement",
        args: [BigInt(params.epochId), proposal.id],
      })) as boolean;
    if (isPending) pending += 1;

    const votes =
      (await params.publicClient.readContract({
        address: params.voting,
        abi: votingV2Abi,
        functionName: "getPlacementVotes",
        args: [BigInt(params.epochId), proposal.id],
      })) as readonly [bigint, bigint];
    if (votes[0] + votes[1] > 0n) withVotes += 1;

    const hasQuorum =
      (await params.publicClient.readContract({
        address: params.voting,
        abi: votingV2Abi,
        functionName: "meetsQuorum",
        args: [BigInt(params.epochId), proposal.id],
      })) as boolean;
    if (hasQuorum) meetsQuorum += 1;

    const passed =
      (await params.publicClient.readContract({
        address: params.voting,
        abi: votingV2Abi,
        functionName: "passesMajority51",
        args: [BigInt(params.epochId), proposal.id],
      })) as boolean;
    if (passed) passes += 1;
  }

  console.log(
    `[sync] epoch=${params.epochId} proposals=${params.proposals.length} registered=${registered} pending=${pending} withCid=${withCid} withVotes=${withVotes} meetsQuorum=${meetsQuorum} passesMajority51=${passes} votingFinalized=${votingFinalized} treasuryFinalized=${treasuryFinalized} voteWindowSeconds=${voteWindowSeconds}`
  );
}

async function finalizeEpochIfReady(params: {
  publicClient: PublicClient<Transport, Chain>;
  operatorWallet: WalletClient<Transport, Chain> | null;
  adminWallet: WalletClient<Transport, Chain> | null;
  treasury: Address;
  voting: Address;
  board: Address;
  manifestStore: Address;
  epochId: number;
  proposals: ChainProposal[];
  deployBlock: bigint;
  dryRun: boolean;
}) {
  const votingFinalized =
    (await params.publicClient.readContract({
      address: params.voting,
      abi: votingV2Abi,
      functionName: "epochs",
      args: [BigInt(params.epochId)],
    })) as boolean;
  if (votingFinalized) {
    console.log(
      `[finalize] voting already finalized epoch ${params.epochId}; nothing to do`
    );
    return;
  }

  const manifestRootOnChain =
    (await params.publicClient.readContract({
      address: params.treasury,
      abi: treasuryAbi,
      functionName: "manifestRootOf",
      args: [params.epochId],
    })) as Hex;
  if (manifestRootOnChain && manifestRootOnChain !== ZERO_BYTES32) {
    console.log(
      `[finalize] treasury already finalized epoch ${params.epochId} (root=${manifestRootOnChain})`
    );
    return;
  }

  if (!params.proposals.length) {
    console.log(
      `[finalize] no proposals found for epoch ${params.epochId}; skipping`
    );
    return;
  }

  const nowSec = Math.floor(Date.now() / 1000);
  const accepted: ChainProposal[] = [];
  const rejected: ChainProposal[] = [];

  for (const proposal of params.proposals) {
    const meta =
      (await params.publicClient.readContract({
        address: params.voting,
        abi: votingV2Abi,
        functionName: "getPlacementMeta",
        args: [proposal.id],
      })) as readonly [bigint, bigint, number, boolean];
    const voteEndsAt = Number(meta[1]);
    const placementEpochId = meta[2];
    const exists = meta[3];
    if (!exists) continue;
    if (placementEpochId !== params.epochId) {
      console.warn(
        `[warn] placement ${proposal.id} meta epoch=${placementEpochId} does not match event epoch=${params.epochId}`
      );
      continue;
    }
    if (voteEndsAt >= nowSec) continue;

    const isPending =
      (await params.publicClient.readContract({
        address: params.voting,
        abi: votingV2Abi,
        functionName: "isPendingPlacement",
        args: [BigInt(params.epochId), proposal.id],
      })) as boolean;
    if (!isPending) continue;

    const passed = (await params.publicClient.readContract({
      address: params.voting,
      abi: votingV2Abi,
      functionName: "passesMajority51",
      args: [BigInt(params.epochId), proposal.id],
    })) as boolean;
    if (passed) accepted.push(proposal);
    else rejected.push(proposal);
  }

  if (!accepted.length && !rejected.length) {
    console.log(
      `[finalize] no finalizable placements found for epoch ${params.epochId}; skipping`
    );
    return;
  }

  accepted.sort((a, b) => a.id.toLowerCase().localeCompare(b.id.toLowerCase()));
  rejected.sort((a, b) => a.id.toLowerCase().localeCompare(b.id.toLowerCase()));

  console.log(
    `[finalize] proposals=${params.proposals.length} accepted=${accepted.length} rejected=${rejected.length}`
  );

  const base = await loadBasePlacements({
    publicClient: params.publicClient,
    manifestStore: params.manifestStore,
    deployBlock: params.deployBlock,
  });

  const baseIds = new Set(base.placements.map((p) => p.id.toLowerCase()));
  const acceptedPlacements: Placement[] = [];
  for (const proposal of accepted) {
    const cid = await fetchCidForPlacement({
      publicClient: params.publicClient,
      board: params.board,
      placementId: proposal.id,
    });
    if (!cid) {
      console.warn(`[warn] missing cid for placement ${proposal.id}`);
    }
    const placement = asPlacement(proposal, cid);
    if (!baseIds.has(placement.id.toLowerCase())) {
      acceptedPlacements.push(placement);
    }
  }
  const orderedAccepted = acceptedPlacements.sort((a, b) =>
    a.id.toLowerCase().localeCompare(b.id.toLowerCase())
  );

  const mergedPlacements = [
    ...base.placements.map(clonePlacement),
    ...orderedAccepted.map(clonePlacement),
  ];
  const sortedPlacements = mergedPlacements.sort((a, b) =>
    a.id.toLowerCase().localeCompare(b.id.toLowerCase())
  );

  const manifestPayload = buildManifestPayload({
    epoch: params.epochId,
    placements: sortedPlacements,
    finalizedAt: nowSec,
  });

  if (params.dryRun) {
    console.log("[finalize] DRY_RUN: would upload manifest + finalize epoch", {
      epoch: params.epochId,
      placements: mergedPlacements.length,
      accepted: accepted.length,
      rejected: rejected.length,
      manifestRoot: manifestPayload.manifestRoot,
    });
    return;
  }

  if (!params.operatorWallet) throw new Error("Missing OPERATOR_KEY");

  const cid = await uploadJSON(
    `loreboard-epoch-${params.epochId}.manifest.json`,
    manifestPayload.manifest
  );

  const acceptedIds = accepted.map((p) => p.id);
  const rejectedIds = rejected.map((p) => p.id);

  const finalizeTx = await params.operatorWallet.writeContract({
    address: params.treasury,
    abi: treasuryAbi,
    functionName: "finalizeEpoch",
    args: [
      params.epochId,
      manifestPayload.manifestRoot,
      cid,
      acceptedIds,
      rejectedIds,
    ],
    chain: params.operatorWallet.chain,
    account: params.operatorWallet.account!,
  });
  console.log("[finalize] finalizeEpoch tx:", finalizeTx);
  await params.publicClient.waitForTransactionReceipt({ hash: finalizeTx });

  const anchorTx = await params.operatorWallet.writeContract({
    address: params.manifestStore,
    abi: loreBoardManifestStoreAbi,
    functionName: "anchor",
    args: [params.epochId, manifestPayload.manifestRoot, cid],
    chain: params.operatorWallet.chain,
    account: params.operatorWallet.account!,
  });
  console.log("[finalize] manifest anchor tx:", anchorTx);
  await params.publicClient.waitForTransactionReceipt({ hash: anchorTx });

  const boardAdmin =
    (await params.publicClient.readContract({
      address: params.voting,
      abi: votingV2Abi,
      functionName: "boardAdmin",
    })) as Address;

  if (boardAdmin.toLowerCase() === params.board.toLowerCase()) {
    console.warn(
      "[finalize] VotingV2 boardAdmin is BoardV1; finalize voting via the Board contract or an admin hook"
    );
    return;
  }

  const operatorAddress = params.operatorWallet?.account?.address?.toLowerCase();
  const adminAddress = params.adminWallet?.account?.address?.toLowerCase();
  const boardAdminLower = boardAdmin.toLowerCase();
  const canUseOperator = operatorAddress && operatorAddress === boardAdminLower;
  const canUseAdmin = adminAddress && adminAddress === boardAdminLower;
  const finalizeWallet = canUseOperator
    ? params.operatorWallet
    : canUseAdmin
      ? params.adminWallet
      : null;

  if (!finalizeWallet) {
    console.warn(
      "[finalize] skipping votingV2.setEpochFinalized (no authorized wallet)"
    );
    return;
  }

  const finalizeVotingTx = await finalizeWallet.writeContract({
    address: params.voting,
    abi: votingV2Abi,
    functionName: "setEpochFinalized",
    args: [BigInt(params.epochId), true],
    chain: finalizeWallet.chain,
    account: finalizeWallet.account!,
  });
  console.log("[finalize] setEpochFinalized tx:", finalizeVotingTx);
  await params.publicClient.waitForTransactionReceipt({
    hash: finalizeVotingTx,
  });
}

async function main() {
  const command = process.argv[2] ?? "run";
  if (!["sync", "finalize", "run"].includes(command)) {
    throw new Error(
      "Usage: tsx scripts/loreboard-worker.ts <sync|finalize|run> [--epoch N|N]"
    );
  }

  const dryRun = process.env.DRY_RUN === "1";

  const rpc = requireEnv(
    "NEXT_PUBLIC_FLUENT_RPC or FLUENT_RPC_URL",
    process.env.NEXT_PUBLIC_FLUENT_RPC ?? process.env.FLUENT_RPC_URL
  );
  const treasury = requireEnv(
    "NEXT_PUBLIC_LOREBOARD_ADDRESS",
    process.env.NEXT_PUBLIC_LOREBOARD_ADDRESS ??
      "0x4A777d8650b3FA2419377F4ffeF0EF8007151536"
  ) as Address;
  const board = requireEnv(
    "NEXT_PUBLIC_LOREBOARD_BOARD_ADDRESS or LOREBOARD_BOARD_ADDRESS",
    process.env.NEXT_PUBLIC_LOREBOARD_BOARD_ADDRESS ??
      process.env.LOREBOARD_BOARD_ADDRESS ??
      "0x16e1bB93fed8446AE4C62235F3892dB3d2306013"
  ) as Address;
  const voting = requireEnv(
    "NEXT_PUBLIC_LOREBOARD_VOTING_ADDRESS or LOREBOARD_VOTING_ADDRESS",
    process.env.NEXT_PUBLIC_LOREBOARD_VOTING_ADDRESS ??
      process.env.LOREBOARD_VOTING_ADDRESS ??
      "0x6044C6d511DAf29B611E7134b79716Ead9d1e68e"
  ) as Address;

  const manifestStoreEnv =
    process.env.NEXT_PUBLIC_LOREBOARD_MANIFEST_STORE_ADDRESS ||
    process.env.NEXT_PUBLIC_LOREBOARD_ANCHOR ||
    process.env.NEXT_PUBLIC_MANIFEST_STORE ||
    process.env.NEXT_PUBLIC_MANIFEST_STORE_ADDRESS ||
    "";

  const manifestStore = manifestStoreEnv
    ? (manifestStoreEnv as Address)
    : null;

  const deployBlockEnv =
    process.env.NEXT_PUBLIC_LOREBOARD_DEPLOY_BLOCK ??
    process.env.NEXT_PUBLIC_DEPLOY_BLOCK ??
    "0";
  const deployBlock = BigInt(deployBlockEnv);
  const lookbackBlocks = process.env.LOOKBACK_BLOCKS
    ? BigInt(process.env.LOOKBACK_BLOCKS)
    : undefined;

  const adminKey = normalizePk(process.env.LOREBOARD_VOTING_ADMIN_PRIVATE_KEY);
  const operatorKey = normalizePk(
    process.env.OPERATOR_KEY ?? process.env.OPERATOR_PK
  );

  const chain = defineChain({
    id: 20994,
    name: "Fluent Testnet",
    nativeCurrency: { name: "FLU", symbol: "FLU", decimals: 18 },
    rpcUrls: { default: { http: [rpc] } },
  });

  const transport = http(rpc);
  const publicClient: PublicClient<Transport, Chain> = createPublicClient({
    chain,
    transport,
  });
  const adminWallet: WalletClient<Transport, Chain> | null = adminKey
    ? createWalletClient({
        chain,
        transport,
        account: privateKeyToAccount(adminKey),
      })
    : null;
  const operatorWallet: WalletClient<Transport, Chain> | null = operatorKey
    ? createWalletClient({
        chain,
        transport,
        account: privateKeyToAccount(operatorKey),
      })
    : null;

  const epochOverride = parseEpochOverride(process.argv.slice(3));
  const epochId = await resolveEpochId({
    publicClient,
    voting,
    overrideEpochId: epochOverride,
  });
  if (epochId === null) {
    console.warn("[worker] no finalizable epoch available yet");
    return;
  }
  const proposals = await fetchProposalsForEpoch({
    publicClient,
    board,
    epochId,
    deployBlock,
    lookbackBlocks,
  });

  console.log(
    `[worker] command=${command} epoch=${epochId} proposals=${proposals.length} dryRun=${dryRun}`
  );

  if (command === "sync" || command === "run") {
    await summarizeEpoch({
      publicClient,
      voting,
      board,
      treasury,
      epochId,
      proposals,
    });
  }

  if (command === "finalize" || command === "run") {
    if (!manifestStore) {
      throw new Error(
        "Missing manifest store address (NEXT_PUBLIC_LOREBOARD_MANIFEST_STORE_ADDRESS)"
      );
    }
    if (!dryRun && !operatorWallet) {
      throw new Error("Missing OPERATOR_KEY");
    }
    await finalizeEpochIfReady({
      publicClient,
      operatorWallet,
      adminWallet,
      treasury,
      voting,
      board,
      manifestStore,
      epochId,
      proposals,
      deployBlock,
      dryRun,
    });
  }
}

const isMain =
  process.argv[1] &&
  path.resolve(process.argv[1]) ===
    path.resolve(fileURLToPath(import.meta.url));

if (isMain) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
