import { createPublicClient, http, type Hex, type PublicClient } from "viem";
import { fluentTestnet } from "@/lib/chains/fluentTestnet";
import { loreBoardManifestStoreAbi } from "@/abi/loreBoardManifestStore";
import { MANIFEST_ANCHORED_EVENT } from "@/lib/events";

export type LatestManifestSource =
  | "manifestStore-getter"
  | "log-scan"
  | "store-fallback"
  | "none";

export type LatestManifestDebug = {
  getterError: string | null;
  logsError: string | null;
  fromBlock: string | null;
  logCount: number | null;
};

export type LatestManifestAnchor = {
  epoch: number | null;
  cid: string | null;
  manifestRoot: Hex | null;
  sourceUsed: LatestManifestSource;
  debug: LatestManifestDebug;
};

export function createManifestStoreClient(rpcUrl: string) {
  return createPublicClient({
    chain: fluentTestnet,
    transport: http(rpcUrl),
  });
}

export function normalizeManifestCid(raw?: string | null) {
  const normalized = String(raw ?? "").replace(/^ipfs:\/\//, "").trim();
  return normalized.length ? normalized : null;
}

export function normalizeManifestRoot(raw?: string | null): Hex | null {
  const normalized = String(raw ?? "").trim();
  if (!normalized || normalized === "0x") return null;
  if (/^0x0+$/i.test(normalized)) return null;
  return normalized as Hex;
}

type ResolveOptions = {
  client: PublicClient;
  manifestStore: `0x${string}`;
  fromBlock?: bigint;
  fallback?: { epoch: number; cid: string } | null;
  strict?: boolean;
};

export async function resolveLatestManifestCid({
  client,
  manifestStore,
  fromBlock,
  fallback,
  strict = false,
}: ResolveOptions): Promise<LatestManifestAnchor> {
  const debug: LatestManifestDebug = {
    getterError: null,
    logsError: null,
    fromBlock: null,
    logCount: null,
  };

  let epoch: number | null = null;
  let cid: string | null = null;
  let manifestRoot: Hex | null = null;
  let sourceUsed: LatestManifestSource = "none";

  try {
    const latest = await client.readContract({
      address: manifestStore,
      abi: loreBoardManifestStoreAbi,
      functionName: "latest",
    });
    const [rawEpoch, rawRoot, rawCid] = latest as readonly [
      bigint | number,
      `0x${string}`,
      string
    ];
    epoch = Number(rawEpoch ?? 0) || null;
    manifestRoot = normalizeManifestRoot(rawRoot);
    cid = normalizeManifestCid(rawCid);
    if (epoch && cid && manifestRoot) {
      return {
        epoch,
        cid,
        manifestRoot,
        sourceUsed: "manifestStore-getter",
        debug,
      };
    }
    sourceUsed = "manifestStore-getter";
  } catch (err) {
    debug.getterError = err instanceof Error ? err.message : String(err);
  }

  try {
    const latestBlock = await client.getBlockNumber();
    const windowSize = 250_000n;
    const defaultFromBlock = latestBlock > windowSize ? latestBlock - windowSize : 1n;
    const resolvedFromBlock = fromBlock ?? defaultFromBlock;
    debug.fromBlock = resolvedFromBlock.toString();
    const logs = await client.getLogs({
      address: manifestStore,
      events: [MANIFEST_ANCHORED_EVENT],
      fromBlock: resolvedFromBlock,
      toBlock: latestBlock,
    });
    debug.logCount = logs.length;

    if (logs.length) {
      const sorted = logs.slice().sort((a, b) => {
        const blockA = a.blockNumber ?? 0n;
        const blockB = b.blockNumber ?? 0n;
        if (blockA !== blockB) return blockA > blockB ? -1 : 1;
        const idxA = a.logIndex ?? 0n;
        const idxB = b.logIndex ?? 0n;
        if (idxA === idxB) return 0;
        return idxA > idxB ? -1 : 1;
      });
      const latestLog = sorted[0]!;
      const args = (latestLog as { args?: Record<string, unknown> }).args ?? {};
      epoch = Number(args.epoch ?? 0) || null;
      cid = normalizeManifestCid(String(args.manifestCid ?? args.manifestCID ?? ""));
      manifestRoot = normalizeManifestRoot(String(args.manifestRoot ?? args.root ?? ""));
      if (epoch && cid) {
        return {
          epoch,
          cid,
          manifestRoot,
          sourceUsed: "log-scan",
          debug,
        };
      }
      sourceUsed = "log-scan";
    }
  } catch (err) {
    debug.logsError = err instanceof Error ? err.message : String(err);
  }

  if (!strict && fallback?.cid && Number.isFinite(fallback.epoch)) {
    const fallbackCid = normalizeManifestCid(fallback.cid);
    const fallbackEpoch = Number(fallback.epoch) || null;
    if (fallbackCid && fallbackEpoch) {
      return {
        epoch: fallbackEpoch,
        cid: fallbackCid,
        manifestRoot: null,
        sourceUsed: "store-fallback",
        debug,
      };
    }
  }

  return {
    epoch: null,
    cid: null,
    manifestRoot: null,
    sourceUsed,
    debug,
  };
}
