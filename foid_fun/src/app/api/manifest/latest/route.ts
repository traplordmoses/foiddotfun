import { NextResponse } from "next/server";
import { createPublicClient, http } from "viem";
import { fluentTestnet } from "@/lib/chains/fluentTestnet";
import { LOREBOARD_MANIFEST_STORE_ADDRESS } from "@/config/contracts";
import { loreBoardManifestStoreAbi } from "@/abi/loreBoardManifestStore";
import { ipfsToHttp } from "@/lib/ipfsUrl";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const rpcUrl = process.env.NEXT_PUBLIC_FLUENT_RPC;

const client = createPublicClient({
  chain: fluentTestnet,
  transport: http(rpcUrl),
});

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
    if (!rpcUrl) {
      return NextResponse.json(
        { error: "NEXT_PUBLIC_FLUENT_RPC is required" },
        { status: 500 }
      );
    }
    if (!LOREBOARD_MANIFEST_STORE_ADDRESS) {
      return NextResponse.json(
        { error: "NEXT_PUBLIC_LOREBOARD_MANIFEST_STORE_ADDRESS is required or invalid" },
        { status: 500 }
      );
    }

    const latest = await client.readContract({
      address: LOREBOARD_MANIFEST_STORE_ADDRESS,
      abi: loreBoardManifestStoreAbi,
      functionName: "latest",
    });
    const [epoch, , cid] = latest as readonly [bigint | number, `0x${string}`, string];

    const epochNum = Number(epoch ?? 0);
    const normalizedCid = String(cid ?? "").replace(/^ipfs:\/\//, "");

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
