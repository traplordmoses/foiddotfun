import { NextResponse } from "next/server";
import {
  createPublicClient,
  defineChain,
  http,
  decodeFunctionData,
  getFunctionSelector,
} from "viem";
import { manifestForEpoch } from "../../_store";
import { FINALIZED_EVENT, MANIFEST_ANCHORED_EVENT } from "@/lib/events";
import { ipfsToHttp } from "@/lib/ipfsUrl";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// --- Env + clients ---------------------------------------------------------

const rpc = process.env.NEXT_PUBLIC_FLUENT_RPC!;
const treasury = process.env
  .NEXT_PUBLIC_LOREBOARD_ADDRESS as `0x${string}`;
const manifestStore =
  (process.env.NEXT_PUBLIC_LOREBOARD_ANCHOR ||
    process.env.NEXT_PUBLIC_MANIFEST_STORE ||
    process.env.NEXT_PUBLIC_MANIFEST_STORE_ADDRESS) as `0x${string}` | undefined;
const deployBlockEnv =
  process.env.NEXT_PUBLIC_LOREBOARD_DEPLOY_BLOCK ??
  process.env.NEXT_PUBLIC_DEPLOY_BLOCK;
const probeTx =
  (process.env.NEXT_PUBLIC_FINALIZE_PROBE_TX ||
    process.env.PROBE_TX) as `0x${string}` | undefined;

if (!rpc) {
  throw new Error("NEXT_PUBLIC_FLUENT_RPC is required");
}
if (!treasury) {
  throw new Error("NEXT_PUBLIC_LOREBOARD_ADDRESS is required");
}
if (!deployBlockEnv) {
  throw new Error(
    "NEXT_PUBLIC_LOREBOARD_DEPLOY_BLOCK (or NEXT_PUBLIC_DEPLOY_BLOCK) is required"
  );
}

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

// --- ABI pieces ------------------------------------------------------------

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

// --- Helpers ---------------------------------------------------------------

async function fetchManifest(cid: string) {
  const urls = ipfsToHttp(cid);
  for (const u of urls) {
    try {
      const res = await fetch(u, { cache: "no-store" });
      if (res.ok) return await res.json();
    } catch {
      // ignore and try next gateway
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

function flattenPlacements(rows: any[] | undefined) {
  if (!Array.isArray(rows)) return [];
  return rows.map((p: any) => {
    const rect = coerceRect(p);
    return {
      ...p,
      cid: String(p.cid ?? "").replace(/^ipfs:\/\//, ""),
      rect,
      x: rect.x,
      y: rect.y,
      w: rect.w,
      h: rect.h,
      cells: Number(p.cells ?? 1),
    };
  });
}

/**
 * Scan Finalized events from `fromBlock` to `toBlock` in chunks.
 * We keep typings loose here (`any`) to avoid viem/TS inference drama.
 */
async function findLatestLog(
  address: `0x${string}`,
  event: any,
  fromBlock: bigint,
  toBlock: bigint,
  step = 80_000n
): Promise<any | null> {
  if (toBlock < fromBlock) return null;
  let end = toBlock;

  const fetchChunk = async (
    start: bigint,
    stop: bigint,
    curStep: bigint
  ): Promise<any[]> => {
    try {
      const logsRaw: any[] = await client.getLogs({
        address,
        event,
        fromBlock: start,
        toBlock: stop,
        strict: false,
      });
      return logsRaw;
    } catch (err: any) {
      const msg = String(err?.message ?? "");
      if (
        msg.includes("max block range") ||
        msg.includes("exceeds max block range")
      ) {
        const nextStep = curStep > 10_000n ? curStep / 2n : 0n;
        if (nextStep === 0n) throw err;
        const nextStop = start + nextStep - 1n;
        return fetchChunk(start, nextStop, nextStep);
      }
      throw err;
    }
  };

  // Walk backwards in chunks until we find at least one Finalized event.
  while (end >= fromBlock) {
    const start = end - step + 1n < fromBlock ? fromBlock : end - step + 1n;
    const logsRaw = await fetchChunk(start, end, step);

    const filtered = logsRaw.filter((log: any) => {
      const args = log?.args;
      return (
        args &&
        (typeof args.epoch === "bigint" || typeof args.epoch === "number") &&
        typeof args.manifestCID === "string"
      );
    });

    if (filtered.length) {
      return filtered[filtered.length - 1];
    }

    if (start === fromBlock) break;
    end = start - 1n;
  }

  return null;
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
  const enriched = rows.map((p: any) => ({
    ...p,
    cid:
      p.cid ??
      manifest?.cid ??
      manifest?.manifestCID ??
      manifestCIDDefault ??
      "",
  }));
  return flattenPlacements(enriched);
}

// --- Route -----------------------------------------------------------------

export async function GET() {
  try {
    // optional cache from _store (used only as a fallback)
    const cached = manifestForEpoch("latest");
    let epoch: number | null = null;
    let manifestCID: string | null = null;

    // scan Finalized events on-chain (authoritative source)
    const latestBlock = await client.getBlockNumber();
    const last = await findLatestLog(
      treasury,
      FINALIZED_EVENT,
      deployBlock,
      latestBlock
    );

    if (last) {
      const args = last?.args ?? {};
      const epochRaw = args.epoch;
      const cid = args.manifestCID;

      const onchainEpoch = Number(epochRaw ?? 0);
      const onchainCid = String(cid ?? "");

      if (!Number.isNaN(onchainEpoch) && onchainCid) {
        if (epoch == null || onchainEpoch > epoch) {
          epoch = onchainEpoch;
          manifestCID = onchainCid;
        }
      }
    }

    // fallback: check ManifestAnchored on optional manifest store contract
    if (epoch == null && manifestStore) {
      const anchored = await findLatestLog(
        manifestStore,
        MANIFEST_ANCHORED_EVENT,
        deployBlock,
        latestBlock
      );
      if (anchored) {
        const args = anchored?.args ?? {};
        const epochRaw = args.epoch;
        const cid = args.manifestCid ?? args.manifestCID;
        const anchorEpoch = Number(epochRaw ?? 0);
        const anchorCid = String(cid ?? "");
        if (!Number.isNaN(anchorEpoch) && anchorCid) {
          epoch = anchorEpoch;
          manifestCID = anchorCid;
        }
      }
    }

    // optional explicit probe tx override (only if ahead of on-chain logs)
    const enableProbeFallback =
      process.env.ENABLE_PROBE_TX === "1" || process.env.ENABLE_PROBE_TX === "true";
    if (enableProbeFallback) {
      const probe = await decodeFromProbeTx();
      if (probe) {
        if (epoch == null || probe.epoch > epoch) {
          epoch = probe.epoch;
          manifestCID = probe.manifestCID;
        }
      }
    }

    // last-resort fallback to in-memory cache if it has a non-zero epoch
    if ((!manifestCID || epoch == null) && cached?.cid && cached.epoch > 0) {
      epoch = cached.epoch;
      manifestCID = cached.cid;
    }

    if (!manifestCID) {
      return NextResponse.json(
        { error: "No finalized manifest found on-chain yet" },
        { status: 404 }
      );
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
