import { NextResponse } from "next/server";
import { LOREBOARD_MANIFEST_STORE_ADDRESS } from "@/config/contracts";
import { ipfsToHttp } from "@/lib/ipfsUrl";
import { DEPLOY_BLOCK } from "@/lib/viem";
import { currentEpoch } from "@/lib/epoch";
import {
  type LatestManifestAnchor,
  createManifestStoreClient,
  resolveLatestManifestCid,
} from "@/lib/manifestStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const rpcUrl = process.env.NEXT_PUBLIC_FLUENT_RPC ?? "";
const cacheHeaders = {
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
  Pragma: "no-cache",
  Expires: "0",
};

function respond(payload: unknown, status = 200) {
  return NextResponse.json(payload, { status, headers: cacheHeaders });
}

async function fetchManifest(cid: string) {
  const urls = ipfsToHttp(cid);
  for (const url of urls) {
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (res.ok) return await res.json();
    } catch {
      /* ignore and try the next gateway */
    }
  }
  return null;
}

export async function GET() {
  try {
    let latest: LatestManifestAnchor = {
      epoch: null,
      cid: null,
      manifestRoot: null,
      sourceUsed: "none",
      debug: {
        getterError: null,
        logsError: null,
        fromBlock: null,
        logCount: null,
      },
    };

    if (rpcUrl && LOREBOARD_MANIFEST_STORE_ADDRESS) {
      const client = createManifestStoreClient(rpcUrl);
      const fromBlock = DEPLOY_BLOCK > 0n ? DEPLOY_BLOCK : undefined;
      latest = await resolveLatestManifestCid({
        client,
        manifestStore: LOREBOARD_MANIFEST_STORE_ADDRESS,
        ...(fromBlock ? { fromBlock } : {}),
        strict: true,
      });
    }

    const epochNum = latest.epoch ?? null;
    const normalizedCid = latest.cid ?? null;
    const normalizedRoot = latest.manifestRoot ?? null;

    if (process.env.NODE_ENV !== "production") {
      console.log("[/api/manifest/latest] resolved", {
        manifestStoreAddr: LOREBOARD_MANIFEST_STORE_ADDRESS ?? null,
        sourceUsed: latest.sourceUsed,
        epoch: epochNum ?? 0,
        cid: normalizedCid,
        manifestRoot: normalizedRoot,
      });
    }

    if (!normalizedCid || !epochNum) {
      return respond({
        currentEpoch: currentEpoch(),
        latestFinalizedEpoch: null,
        latestFinalizedCid: null,
        latestFinalizedManifestRoot: null,
        sourceUsed: latest.sourceUsed,
        resolverDebug: latest.debug,
        epoch: 0,
        cid: null,
        manifestCID: null,
        count: 0,
        manifest: null,
      });
    }

    const manifestRaw = await fetchManifest(normalizedCid);
    if (!manifestRaw) {
      return respond(
        { error: "failed to fetch manifest from IPFS" },
        502
      );
    }

    const placements =
      manifestRaw?.placements ?? manifestRaw?.winners ?? [];
    const manifest =
      manifestRaw && !manifestRaw.placements
        ? { ...manifestRaw, placements }
        : manifestRaw;

    return respond({
      currentEpoch: currentEpoch(),
      latestFinalizedEpoch: epochNum,
      latestFinalizedCid: normalizedCid,
      latestFinalizedManifestRoot: normalizedRoot,
      sourceUsed: latest.sourceUsed,
      resolverDebug: latest.debug,
      epoch: epochNum,
      cid: normalizedCid,
      manifestCID: normalizedCid,
      count: Array.isArray(placements) ? placements.length : 0,
      manifest,
    });
  } catch (err) {
    console.error("[/api/manifest/latest] error", err);
    return respond(
      { error: "failed to load latest manifest" },
      500
    );
  }
}
