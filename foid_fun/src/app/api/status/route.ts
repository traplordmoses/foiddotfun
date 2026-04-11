// /src/app/api/status/route.ts
import { NextResponse } from "next/server";
import { currentEpoch, secondsLeftInEpoch } from "@/lib/epoch";
import { DEPLOY_BLOCK } from "@/lib/viem";
import { CANONICAL_ADDRESSES } from "@/config/canonical";

const LOREBOARD_MANIFEST_STORE_ADDRESS = CANONICAL_ADDRESSES.manifestStore;
import {
  createManifestStoreClient,
  resolveLatestManifestCid,
} from "@/lib/manifestStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const cacheHeaders = {
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
  Pragma: "no-cache",
  Expires: "0",
};

export async function GET() {
  const rpcUrl = process.env.NEXT_PUBLIC_FLUENT_RPC ?? "";
  let latestEpoch: number | null = null;
  let latestCid: string | null = null;
  let latestRoot: string | null = null;
  let sourceUsed: string = "none";
  let resolverDebug = {
    getterError: null as string | null,
    logsError: null as string | null,
    fromBlock: null as string | null,
    logCount: null as number | null,
  };

  if (rpcUrl && LOREBOARD_MANIFEST_STORE_ADDRESS) {
    const client = createManifestStoreClient(rpcUrl);
    const fromBlock = DEPLOY_BLOCK > 0n ? DEPLOY_BLOCK : undefined;
    const latest = await resolveLatestManifestCid({
      client,
      manifestStore: LOREBOARD_MANIFEST_STORE_ADDRESS,
      ...(fromBlock ? { fromBlock } : {}),
      strict: true,
    });
    latestEpoch = latest.epoch ?? null;
    latestCid = latest.cid ?? null;
    latestRoot = latest.manifestRoot ?? null;
    sourceUsed = latest.sourceUsed;
    resolverDebug = latest.debug;
  }

  return NextResponse.json(
    {
      currentEpoch: currentEpoch(),
      secondsLeft: secondsLeftInEpoch(),
      latestFinalizedEpoch: latestEpoch,
      latestFinalizedCid: latestCid,
      latestFinalizedManifestRoot: latestRoot,
      sourceUsed,
      resolverDebug,
      latestManifestCID: latestCid,
    },
    { headers: cacheHeaders }
  );
}
