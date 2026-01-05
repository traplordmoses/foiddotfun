import { NextResponse } from "next/server";
import { LOREBOARD_MANIFEST_STORE_ADDRESS } from "@/config/contracts";
import { ipfsToHttp } from "@/lib/ipfsUrl";
import { DEPLOY_BLOCK } from "@/lib/viem";
import { manifestForEpoch } from "@/app/api/_store";
import {
  type LatestManifestAnchor,
  createManifestStoreClient,
  normalizeManifestCid,
  resolveLatestManifestCid,
} from "@/lib/manifestStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const rpcUrl = process.env.NEXT_PUBLIC_FLUENT_RPC ?? "";

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
    const fallback = manifestForEpoch("latest");
    let latest: LatestManifestAnchor = { epoch: null, cid: null, source: "none" };

    if (rpcUrl && LOREBOARD_MANIFEST_STORE_ADDRESS) {
      const client = createManifestStoreClient(rpcUrl);
      latest = await resolveLatestManifestCid({
        client,
        manifestStore: LOREBOARD_MANIFEST_STORE_ADDRESS,
        fromBlock: DEPLOY_BLOCK,
        fallback: fallback
          ? { epoch: fallback.epoch, cid: fallback.cid }
          : null,
      });
    } else if (fallback?.cid) {
      latest = {
        epoch: fallback.epoch,
        cid: normalizeManifestCid(fallback.cid),
        source: "store",
      };
    }

    const epochNum = latest.epoch ?? 0;
    const normalizedCid = latest.cid ?? null;

    if (process.env.NODE_ENV !== "production") {
      console.log("[/api/manifest/latest] resolved", {
        manifestStoreAddr: LOREBOARD_MANIFEST_STORE_ADDRESS ?? null,
        sourceUsed: latest.source,
        epoch: epochNum,
        cid: normalizedCid,
      });
    }

    if (!normalizedCid || epochNum === 0) {
      return NextResponse.json({
        epoch: 0,
        cid: null,
        manifestCID: null,
        count: 0,
        manifest: null,
      });
    }

    const manifestRaw = await fetchManifest(normalizedCid);
    if (!manifestRaw) {
      return NextResponse.json(
        { error: "failed to fetch manifest from IPFS" },
        { status: 502 }
      );
    }

    const placements =
      manifestRaw?.placements ?? manifestRaw?.winners ?? [];
    const manifest =
      manifestRaw && !manifestRaw.placements
        ? { ...manifestRaw, placements }
        : manifestRaw;

    return NextResponse.json({
      epoch: epochNum,
      cid: normalizedCid,
      manifestCID: normalizedCid,
      count: Array.isArray(placements) ? placements.length : 0,
      manifest,
    });
  } catch (err) {
    console.error("[/api/manifest/latest] error", err);
    return NextResponse.json(
      { error: "failed to load latest manifest" },
      { status: 500 }
    );
  }
}
