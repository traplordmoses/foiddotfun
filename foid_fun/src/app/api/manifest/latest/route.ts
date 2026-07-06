import { NextResponse } from "next/server";
import { CANONICAL_ADDRESSES, getServerRpcUrl } from "@/config/canonical";

const LOREBOARD_MANIFEST_STORE_ADDRESS = CANONICAL_ADDRESSES.manifestStore;
import { ipfsToHttp } from "@/lib/ipfsUrl";
import { DEPLOY_BLOCK } from "@/lib/viem";
import {
  type LatestManifestAnchor,
  createManifestStoreClient,
  resolveLatestManifestCid,
} from "@/lib/manifestStore";
import type { BoardManifest } from "@/types/manifest";
import { safeErrorMessage } from "@/lib/apiError";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RPC_URL = getServerRpcUrl() ?? "";
const CACHE_TTL_MS = 45_000;
const CACHE_HEADERS = {
  "Cache-Control": "no-store, max-age=0, must-revalidate, proxy-revalidate",
  Pragma: "no-cache",
  Expires: "0",
};

type ManifestPayload = {
  cid: string | null;
  manifest: BoardManifest | null;
  placementsIndex: Record<string, true>;
  fetchedAt: number;
  epoch: number | null;
  sourceUsed: string | null;
  resolverDebug: LatestManifestAnchor["debug"] | null;
  error: string | null;
};

const manifestCache: {
  entry: ManifestPayload | null;
  ongoing: Promise<ManifestPayload> | null;
} = {
  entry: null,
  ongoing: null,
};

function respond(payload: ManifestPayload) {
  return NextResponse.json(payload, { headers: CACHE_HEADERS });
}

function buildPlacementsIndex(manifest: BoardManifest | null) {
  const index: Record<string, true> = {};
  if (!manifest?.placements?.length) return index;
  for (const placement of manifest.placements) {
    if (placement?.id) {
      index[placement.id] = true;
    }
  }
  return index;
}

async function fetchManifestJson(cid: string) {
  for (const url of ipfsToHttp(cid)) {
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) continue;
      return (await res.json()) as BoardManifest;
    } catch {
      // try next gateway
    }
  }
  return null;
}

async function resolveManifestFromChain(): Promise<ManifestPayload> {
  const fallback: ManifestPayload = {
    cid: null,
    manifest: null,
    placementsIndex: {},
    fetchedAt: Date.now(),
    epoch: null,
    sourceUsed: null,
    resolverDebug: null,
    error: "manifest store not configured",
  };

  if (!RPC_URL || !LOREBOARD_MANIFEST_STORE_ADDRESS) {
    return fallback;
  }

  try {
    const client = createManifestStoreClient(RPC_URL);
    const fromBlock = DEPLOY_BLOCK > 0n ? DEPLOY_BLOCK : undefined;
    const latest = await resolveLatestManifestCid({
      client,
      manifestStore: LOREBOARD_MANIFEST_STORE_ADDRESS,
      ...(fromBlock ? { fromBlock } : {}),
      strict: true,
    });

    const epoch = latest.epoch ?? null;
    const normalizedCid = latest.cid ?? null;

    if (!normalizedCid) {
      return {
        ...fallback,
        epoch,
        sourceUsed: latest.sourceUsed,
        resolverDebug: latest.debug,
        error: "manifest CID is missing",
      };
    }

    const manifestRaw = await fetchManifestJson(normalizedCid);
    if (!manifestRaw) {
      return {
        ...fallback,
        epoch,
        sourceUsed: latest.sourceUsed,
        resolverDebug: latest.debug,
        error: "failed to fetch manifest from IPFS",
      };
    }

    const placements = Array.isArray(manifestRaw.placements)
      ? manifestRaw.placements
      : [];
    const normalizedManifest: BoardManifest = {
      epoch: Number(manifestRaw.epoch ?? epoch ?? 0) || 0,
      width: manifestRaw.width,
      height: manifestRaw.height,
      cells: manifestRaw.cells,
      renderCid: manifestRaw.renderCid,
      finalizedAt: manifestRaw.finalizedAt,
      placements,
    };

    const payload: ManifestPayload = {
      cid: normalizedCid,
      manifest: normalizedManifest,
      placementsIndex: buildPlacementsIndex(normalizedManifest),
      fetchedAt: Date.now(),
      epoch,
      sourceUsed: latest.sourceUsed,
      resolverDebug: latest.debug,
      error: null,
    };

    return payload;
  } catch (error) {
    console.error("[api/manifest/latest] resolve error:", error);
    const message = safeErrorMessage(error, "manifest resolution failed");
    return {
      ...fallback,
      error: `manifest resolution failed: ${message}`,
    };
  }
}

async function loadManifestPayload() {
  if (manifestCache.entry && Date.now() - manifestCache.entry.fetchedAt < CACHE_TTL_MS) {
    return manifestCache.entry;
  }

  if (!manifestCache.ongoing) {
    manifestCache.ongoing = resolveManifestFromChain().finally(() => {
      manifestCache.ongoing = null;
    });
  }

  const payload = await manifestCache.ongoing;
  if (!payload.error) {
    manifestCache.entry = payload;
  }

  return payload;
}

export async function GET() {
  try {
    const payload = await loadManifestPayload();
    if (payload.error && manifestCache.entry) {
      return respond({
        ...manifestCache.entry,
        error: payload.error,
      });
    }
    return respond(payload);
  } catch (error) {
    console.error("[api/manifest/latest] load error:", error);
    const message = safeErrorMessage(error, "manifest load failed");
    if (manifestCache.entry) {
      return respond({
        ...manifestCache.entry,
        error: `manifest load failed: ${message}`,
      });
    }
    return respond({
      cid: null,
      manifest: null,
      placementsIndex: {},
      fetchedAt: Date.now(),
      epoch: null,
      sourceUsed: null,
      resolverDebug: null,
      error: `manifest load failed: ${message}`,
    });
  }
}
