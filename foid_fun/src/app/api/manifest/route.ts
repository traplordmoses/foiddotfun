import { NextRequest, NextResponse } from "next/server";
import type { AbiEvent } from "viem";
import { createPublicClient, defineChain, http, parseAbiItem } from "viem";

const rpc = process.env.NEXT_PUBLIC_FLUENT_RPC!;
const treasury = process.env.NEXT_PUBLIC_LOREBOARD_ADDRESS as `0x${string}`;
const deployBlockEnv =
  process.env.NEXT_PUBLIC_LOREBOARD_DEPLOY_BLOCK ??
  process.env.NEXT_PUBLIC_DEPLOY_BLOCK;

if (!rpc) throw new Error("NEXT_PUBLIC_FLUENT_RPC is required");
if (!treasury) throw new Error("NEXT_PUBLIC_LOREBOARD_ADDRESS is required");
if (!deployBlockEnv)
  throw new Error(
    "NEXT_PUBLIC_LOREBOARD_DEPLOY_BLOCK (or NEXT_PUBLIC_DEPLOY_BLOCK) is required"
  );

const deployBlock = BigInt(deployBlockEnv);

const fluentTestnet = defineChain({
  id: 20994,
  name: "Fluent Testnet",
  nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: [rpc] } },
});

const client = createPublicClient({
  chain: fluentTestnet,
  transport: http(rpc),
});

// event Finalized(uint32 epoch, bytes32 manifestHash, string manifestCID);
const FINALIZED = parseAbiItem(
  "event Finalized(uint32 epoch, bytes32 manifestHash, string manifestCID)"
) as AbiEvent;

type FinalizedLog = {
  args: {
    epoch: bigint;
    manifestCID: string;
  };
};

async function getFinalizedLogs(
  fromBlock: bigint,
  toBlock: bigint,
  step = 90_000n
) {
  if (toBlock < fromBlock) return [] as FinalizedLog[];
  const logsAll: FinalizedLog[] = [];
  let cursor = fromBlock;
  while (cursor <= toBlock) {
    const chunkTo = cursor + step > toBlock ? toBlock : cursor + step;
    const logs = (await client.getLogs({
      address: treasury,
      event: FINALIZED,
      fromBlock: cursor,
      toBlock: chunkTo,
    })) as FinalizedLog[];
    if (logs.length) logsAll.push(...logs);
    if (chunkTo === toBlock) break;
    cursor = chunkTo + 1n;
  }
  return logsAll;
}

async function fetchManifest(cid: string) {
  const cidClean = cid.replace(/^ipfs:\/\//, "");
  const urls = [
    `https://cloudflare-ipfs.com/ipfs/${cidClean}`,
    `https://ipfs.io/ipfs/${cidClean}`,
  ];
  for (const u of urls) {
    try {
      const res = await fetch(u, { cache: "no-store" });
      if (res.ok) return await res.json();
    } catch {
      /* noop */
    }
  }
  return null;
}

function normalizePlacements(manifest: any) {
  const placementsRaw = manifest?.placements ?? [];
  return placementsRaw.map((p: any) => ({
    id: String(p.id),
    owner: p.owner ? String(p.owner) : "0x",
    cid: String(p.cid ?? "").replace(/^ipfs:\/\//, ""),
    x: Number(p.x ?? 0),
    y: Number(p.y ?? 0),
    w: Number(p.w ?? 0),
    h: Number(p.h ?? 0),
    cells: Number(p.cells ?? 1),
  }));
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const epochParam = url.searchParams.get("epoch");
    if (!epochParam) {
      return NextResponse.json(
        { error: "epoch is required" },
        { status: 400 }
      );
    }
    const targetEpoch = epochParam === "latest" ? null : Number(epochParam);

    const latestBlock = await client.getBlockNumber();
    const logs = await getFinalizedLogs(deployBlock, latestBlock);

    if (!logs.length) {
      return NextResponse.json({
        epoch: null,
        manifestCID: null,
        manifest: null,
      });
    }

    let hit = null as (typeof logs)[number] | null;

    if (targetEpoch == null) {
      hit = logs[logs.length - 1];
    } else {
      hit =
        logs.find((l) => Number(l.args.epoch ?? -1n) === targetEpoch) ?? null;
    }

    if (!hit) {
      return NextResponse.json({
        epoch: targetEpoch,
        manifestCID: null,
        manifest: null,
      });
    }

    const epoch = Number(hit.args.epoch ?? 0n);
    const manifestCID = String(hit.args.manifestCID ?? "");
    const manifest = await fetchManifest(manifestCID);
    const placements = manifest ? normalizePlacements(manifest) : [];

    return NextResponse.json({
      epoch,
      manifestCID,
      manifest: { placements },
    });
  } catch (err) {
    console.error("[/api/manifest] error", err);
    return NextResponse.json(
      { error: "failed to load manifest" },
      { status: 500 }
    );
  }
}
