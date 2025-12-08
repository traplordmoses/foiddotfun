import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
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
const envEpochHint = Number(
  process.env.NEXT_PUBLIC_FINALIZED_EPOCH_HINT ??
    process.env.FINALIZED_EPOCH_HINT ??
    0
);
const envCidHint =
  process.env.NEXT_PUBLIC_FINALIZED_MANIFEST_CID_HINT ??
  process.env.FINALIZED_MANIFEST_CID_HINT ??
  "";

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

const PERSIST_PATH = path.join(process.cwd(), ".next-cache", "manifest-latest.json");

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

function loadPersistedLatest(): { epoch: number | null; cid: string | null; placements: any[] } {
  try {
    const raw = fs.readFileSync(PERSIST_PATH, "utf8");
    const parsed = JSON.parse(raw);
    const latestEpoch =
      typeof parsed?.latestEpoch === "number" && Number.isFinite(parsed.latestEpoch)
        ? parsed.latestEpoch
        : null;
    const list: any[] = Array.isArray(parsed?.byEpoch) ? parsed.byEpoch : [];
    const best = list.reduce(
      (acc, cur) => (cur?.epoch != null && cur.epoch >= (acc?.epoch ?? -1) ? cur : acc),
      null as any
    );
    const epoch =
      typeof best?.epoch === "number" && Number.isFinite(best.epoch)
        ? best.epoch
        : latestEpoch;
    const cid = typeof best?.cid === "string" && best.cid ? best.cid.replace(/^ipfs:\/\//, "") : null;
    const placements = Array.isArray(best?.placements) ? best.placements : [];
    return { epoch, cid, placements };
  } catch {
    return { epoch: null, cid: null, placements: [] };
  }
}

function persistLatestToDisk(epoch: number, cid: string, placements: any[]) {
  if (!Number.isFinite(epoch) || !cid) return;
  try {
    const dir = path.dirname(PERSIST_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    let parsed: any = {};
    try {
      const raw = fs.readFileSync(PERSIST_PATH, "utf8");
      parsed = JSON.parse(raw);
    } catch {
      /* file might not exist yet */
    }

    const byEpochArr: any[] = Array.isArray(parsed?.byEpoch) ? parsed.byEpoch : [];
    const normalizedCid = cid.replace(/^ipfs:\/\//, "");
    const record = {
      epoch,
      placements: Array.isArray(placements) ? placements : [],
      finalizedAt: Date.now(),
      cid: normalizedCid,
    };

    const existingIdx = byEpochArr.findIndex((r) => r?.epoch === epoch);
    if (existingIdx >= 0) {
      byEpochArr[existingIdx] = {
        ...byEpochArr[existingIdx],
        ...record,
        placements: record.placements,
      };
    } else {
      byEpochArr.push(record);
    }

    const latestEpoch =
      typeof parsed?.latestEpoch === "number" && Number.isFinite(parsed.latestEpoch)
        ? Math.max(parsed.latestEpoch, epoch)
        : epoch;

    fs.writeFileSync(
      PERSIST_PATH,
      JSON.stringify({ latestEpoch, byEpoch: byEpochArr }, null, 2),
      "utf8"
    );
  } catch (err) {
    console.warn("[/api/manifest/latest] persistLatestToDisk failed", err);
  }
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
    const persisted = loadPersistedLatest();
    const cached = manifestForEpoch("latest");

    let bestEpoch: number | null = null;
    let bestCid: string | null = null;
    let bestPlacements: any[] | null = null;

    const consider = (e: any, c: any, placements?: any[]) => {
      if (typeof c !== "string" || !c) return;
      const epochNum = Number(e);
      if (!Number.isFinite(epochNum)) return;
      if (bestEpoch == null || epochNum > bestEpoch) {
        bestEpoch = epochNum;
        bestCid = c.replace(/^ipfs:\/\//, "");
        bestPlacements = placements ?? null;
      }
    };

    // persisted cache (survives restart)
    consider(persisted.epoch, persisted.cid, persisted.placements);

    // optional cache from _store (used as a fallback or for dev/epoch 0)
    consider(cached?.epoch, cached?.cid, cached?.manifest?.placements);

    // scan Finalized events on-chain (authoritative source)
    const latestBlock = await client.getBlockNumber();
    const fromBlock = deployBlock > latestBlock ? 0n : deployBlock;
    const last = await findLatestLog(
      treasury,
      FINALIZED_EVENT,
      fromBlock,
      latestBlock
    );

    if (last) {
      const args = last?.args ?? {};
      const epochRaw = args.epoch;
      const cid = args.manifestCID;

      const onchainEpoch = Number(epochRaw ?? 0);
      const onchainCid = String(cid ?? "");

      consider(onchainEpoch, onchainCid);
    }

    // some deployments emit Finalized on the anchor/store contract instead of the treasury
    if (manifestStore) {
      const anchoredFinalized = await findLatestLog(
        manifestStore,
        FINALIZED_EVENT,
        fromBlock,
        latestBlock
      );
      if (anchoredFinalized) {
        const args = anchoredFinalized?.args ?? {};
        const epochRaw = args.epoch;
        const cid = args.manifestCID ?? args.manifestCid;
        const storeEpoch = Number(epochRaw ?? 0);
        const storeCid = String(cid ?? "");
        consider(storeEpoch, storeCid);
      }
    }

    // fallback: check ManifestAnchored on optional manifest store contract
    if (manifestStore) {
      const anchored = await findLatestLog(
        manifestStore,
        MANIFEST_ANCHORED_EVENT,
        fromBlock,
        latestBlock
      );
      if (anchored) {
        const args = anchored?.args ?? {};
        const epochRaw = args.epoch;
        const cid = args.manifestCid ?? args.manifestCID;
        const anchorEpoch = Number(epochRaw ?? 0);
        const anchorCid = String(cid ?? "");
        consider(anchorEpoch, anchorCid);
      }
    }

    // optional explicit probe tx override (attempt whenever provided)
    if (probeTx) {
      const probe = await decodeFromProbeTx();
      if (probe) consider(probe.epoch, probe.manifestCID);
    }

    // optional explicit env hint (failsafe)
    if (envCidHint && Number.isFinite(envEpochHint)) {
      consider(envEpochHint, envCidHint);
    }

    if (!bestCid) {
      return NextResponse.json(
        { error: "No finalized manifest found on-chain yet" },
        { status: 404 }
      );
    }

    const manifestCIDStr = bestCid;
    let placements =
      bestPlacements != null
        ? normalizePlacements({ placements: bestPlacements }, manifestCIDStr)
        : [];

    if (!placements.length) {
      const manifestRaw = await fetchManifest(manifestCIDStr);
      placements = manifestRaw
        ? normalizePlacements(manifestRaw, manifestCIDStr)
        : [];
    }

    if (bestEpoch != null && bestCid) {
      const placementsForPersist =
        placements.length > 0 ? placements : bestPlacements ?? [];
      persistLatestToDisk(bestEpoch, bestCid, placementsForPersist);
    }

    return NextResponse.json({
      epoch: bestEpoch,
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
