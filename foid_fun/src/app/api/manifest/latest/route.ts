export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import type { AbiEvent } from "viem";
import {
  createPublicClient,
  defineChain,
  http,
  parseAbiItem,
  decodeFunctionData,
  getFunctionSelector,
} from "viem";

const rpc = process.env.NEXT_PUBLIC_FLUENT_RPC!;
const treasury = process.env.NEXT_PUBLIC_LOREBOARD_ADDRESS as `0x${string}`;
const deployBlockEnv =
  process.env.NEXT_PUBLIC_LOREBOARD_DEPLOY_BLOCK ??
  process.env.NEXT_PUBLIC_DEPLOY_BLOCK;
const probeTx =
  (process.env.NEXT_PUBLIC_FINALIZE_PROBE_TX ||
    process.env.PROBE_TX) as `0x${string}` | undefined;

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

const FINALIZE_FN = [
  {
    type: "function",
    name: "finalizeEpoch",
    stateMutability: "nonpayable",
    inputs: [
      { name: "epoch", type: "uint32" },
      { name: "manifestRoot", type: "bytes32" },
      { name: "manifestCID", type: "string" },
      { name: "acceptedIds", type: "bytes32[]" },
      { name: "rejectedIds", type: "bytes32[]" },
    ],
    outputs: [],
  },
] as const;
const FINALIZE_SELECTOR = getFunctionSelector(
  "finalizeEpoch(uint32,bytes32,string,bytes32[],bytes32[])"
);

async function fetchManifest(cid: string) {
  // Accept both "ipfs://<cid>" and plain "<cid>"
  const cidClean = cid.replace(/^ipfs:\/\//, "");
  // Try a couple of gateways
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

type RawLog = Awaited<ReturnType<typeof client.getLogs>>[number];

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
) {
  if (toBlock < fromBlock) return [] as FinalizedLog[];
  const logsAll: FinalizedLog[] = [];
  let cursor = fromBlock;
  while (cursor <= toBlock) {
    const chunkTo = cursor + step > toBlock ? toBlock : cursor + step;
    const logsRaw = await client.getLogs({
      address: treasury,
      event: FINALIZED,
      fromBlock: cursor,
      toBlock: chunkTo,
    });
    const filtered = logsRaw.filter(isFinalizedLog);
    if (filtered.length) logsAll.push(...(filtered as FinalizedLog[]));
    if (chunkTo === toBlock) break;
    cursor = chunkTo + 1n;
  }
  return logsAll;
}

async function decodeFromProbeTx() {
  if (!probeTx) return null;
  try {
    const tx = await client.getTransaction({ hash: probeTx });
    if (!tx?.input) return null;
    if (tx.to?.toLowerCase() !== treasury.toLowerCase()) return null;
    if (!tx.input.startsWith(FINALIZE_SELECTOR)) return null;
    const decoded = decodeFunctionData({
      abi: FINALIZE_FN,
      data: tx.input,
    });
    if (decoded.functionName !== "finalizeEpoch") return null;
    const [epochRaw, , manifestCID] = decoded.args;
    const epoch = Number(epochRaw ?? 0);
    const manifestCIDStr = String(manifestCID ?? "");
    if (!manifestCIDStr) return null;
    return { epoch, manifestCID: manifestCIDStr };
  } catch (err) {
    console.warn("[/api/manifest/latest] probe decode failed", err);
    return null;
  }
}

function normalizePlacements(manifest: any, manifestCIDDefault = "") {
  // Handle manifests that expose either placements (final output) or winners (operator script input)
  const rows = manifest?.placements ?? manifest?.winners ?? [];

  return rows.map((p: any) => {
    const rect = p.rect ?? p;
    const cidRaw =
      p.cid ??
      manifest.cid ??
      manifest.manifestCID ??
      manifestCIDDefault ??
      "";

    return {
      id: String(p.id),
      owner: p.owner ? String(p.owner) : "0x",
      cid: String(cidRaw).replace(/^ipfs:\/\//, ""),
      x: Number(rect.x ?? 0),
      y: Number(rect.y ?? 0),
      w: Number(rect.w ?? 0),
      h: Number(rect.h ?? 0),
      cells: Number(p.cells ?? rect.cells ?? 1),
    };
  });
}

export async function GET() {
  try {
    // Pull all Finalized logs since deploy; take the latest
    const latestBlock = await client.getBlockNumber();
    const logs = await getFinalizedLogs(deployBlock, latestBlock);

    let epoch: number | null = null;
    let manifestCID: string | null = null;

    if (logs.length) {
      const last = logs[logs.length - 1];
      const { epoch: epochRaw, manifestCID: cid } = last.args;
      epoch = Number(epochRaw ?? 0n);
      manifestCID = String(cid ?? "");
    } else {
      const probe = await decodeFromProbeTx();
      if (probe) {
        epoch = probe.epoch;
        manifestCID = probe.manifestCID;
      }
    }

    if (!manifestCID) {
      return NextResponse.json({
        epoch: null,
        manifestCID: null,
        manifest: null,
      });
    }

    const manifestCIDStr = manifestCID;
    const manifestRaw = await fetchManifest(manifestCIDStr);
    const placements = manifestRaw
      ? normalizePlacements(manifestRaw, manifestCIDStr)
      : [];

    return NextResponse.json({
      epoch,
      manifestCID: manifestCIDStr,
      manifest: { placements },
    });
  } catch (err) {
    console.error("[/api/manifest/latest] error", err);
    return NextResponse.json(
      { error: "failed to load latest manifest" },
      { status: 500 }
    );
  }
}
