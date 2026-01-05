// /src/app/api/status/route.ts
import { NextResponse } from "next/server";
import { currentEpoch, secondsLeftInEpoch } from "@/lib/epoch";
import { manifestForEpoch } from "../_store";
import { DEPLOY_BLOCK } from "@/lib/viem";
import { LOREBOARD_MANIFEST_STORE_ADDRESS } from "@/config/contracts";
import {
  createManifestStoreClient,
  normalizeManifestCid,
  resolveLatestManifestCid,
} from "@/lib/manifestStore";

export async function GET() {
  const rpcUrl = process.env.NEXT_PUBLIC_FLUENT_RPC ?? "";
  const fallback = manifestForEpoch("latest");

  let latestCid: string | null = null;

  if (rpcUrl && LOREBOARD_MANIFEST_STORE_ADDRESS) {
    const client = createManifestStoreClient(rpcUrl);
    const latest = await resolveLatestManifestCid({
      client,
      manifestStore: LOREBOARD_MANIFEST_STORE_ADDRESS,
      fromBlock: DEPLOY_BLOCK,
      fallback: fallback
        ? { epoch: fallback.epoch, cid: fallback.cid }
        : null,
    });
    latestCid = latest.cid ?? null;
  } else if (fallback?.cid) {
    latestCid = normalizeManifestCid(fallback.cid);
  }

  return NextResponse.json({
    epoch: currentEpoch(),
    secondsLeft: secondsLeftInEpoch(),
    latestManifestCID: latestCid,
  });
}
