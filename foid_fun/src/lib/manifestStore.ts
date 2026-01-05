import { createPublicClient, http, type PublicClient } from "viem";
import { fluentTestnet } from "@/lib/chains/fluentTestnet";
import { loreBoardManifestStoreAbi } from "@/abi/loreBoardManifestStore";
import { MANIFEST_ANCHORED_EVENT } from "@/lib/events";

export type LatestManifestSource = "getter" | "logs" | "none" | "store";

export type LatestManifestAnchor = {
  epoch: number | null;
  cid: string | null;
  source: LatestManifestSource;
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

type ResolveOptions = {
  client: PublicClient;
  manifestStore: `0x${string}`;
  fromBlock?: bigint;
  fallback?: { epoch: number; cid: string } | null;
};

export async function resolveLatestManifestCid({
  client,
  manifestStore,
  fromBlock,
  fallback,
}: ResolveOptions): Promise<LatestManifestAnchor> {
  let epoch: number | null = null;
  let cid: string | null = null;
  let source: LatestManifestSource = "none";

  try {
    const latest = await client.readContract({
      address: manifestStore,
      abi: loreBoardManifestStoreAbi,
      functionName: "latest",
    });
    const [rawEpoch, , rawCid] = latest as readonly [
      bigint | number,
      `0x${string}`,
      string
    ];
    epoch = Number(rawEpoch ?? 0) || null;
    cid = normalizeManifestCid(rawCid);
    if (epoch && cid) {
      return { epoch, cid, source: "getter" };
    }
    source = "getter";
  } catch {
    /* ignore and fall back to logs */
  }

  try {
    const latestBlock = await client.getBlockNumber();
    const logs = await client.getLogs({
      address: manifestStore,
      events: [MANIFEST_ANCHORED_EVENT],
      fromBlock: fromBlock ?? 0n,
      toBlock: latestBlock,
    });

    if (logs.length) {
      const sorted = logs.slice().sort((a, b) => {
        const blockA = a.blockNumber ?? 0n;
        const blockB = b.blockNumber ?? 0n;
        if (blockA === blockB) {
          const idxA = a.logIndex ?? 0n;
          const idxB = b.logIndex ?? 0n;
          if (idxA === idxB) return 0;
          return idxA < idxB ? -1 : 1;
        }
        return blockA < blockB ? -1 : 1;
      });
      const last = sorted[sorted.length - 1]!;
      const args: any = last.args ?? {};
      epoch = Number(args.epoch ?? 0) || null;
      cid = normalizeManifestCid(args.manifestCid ?? args.manifestCID ?? "");
      if (epoch && cid) {
        return { epoch, cid, source: "logs" };
      }
      source = "logs";
    }
  } catch {
    /* ignore and fall back to store */
  }

  if (fallback?.cid && Number.isFinite(fallback.epoch)) {
    const fallbackCid = normalizeManifestCid(fallback.cid);
    const fallbackEpoch = Number(fallback.epoch) || null;
    if (fallbackCid && fallbackEpoch) {
      return { epoch: fallbackEpoch, cid: fallbackCid, source: "store" };
    }
  }

  return { epoch: null, cid: null, source };
}
