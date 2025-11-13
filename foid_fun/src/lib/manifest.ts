import { parseAbiItem } from "viem";
import { publicClient, TREASURY, DEPLOY_BLOCK } from "@/lib/viem";

export type NormalizedPlacement = {
  id: string;
  owner: string;
  cid: string;
  x: number;
  y: number;
  w: number;
  h: number;
  cells: number;
};

export type LatestManifestResponse = {
  epoch: number | null;
  manifestCID: string | null;
  manifest: {
    placements: NormalizedPlacement[];
  } | null;
};

const ProposedEvt = parseAbiItem(
  "event ProposedEvt(bytes32 indexed id, address indexed bidder, uint32 epoch, (int32 x,int32 y,int32 w,int32 h) rect, uint96 bidPerCellWei, uint32 cells, bytes32 cidHash, uint256 value)"
);

export async function loadLatestFinalized() {
  const endpoint =
    typeof window === "undefined"
      ? buildAbsoluteUrl("/api/manifest/latest")
      : "/api/manifest/latest";
  try {
    const res = await fetch(endpoint, { cache: "no-store" });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data?.manifestCID) return null;
    return {
      epoch: data.epoch ?? null,
      manifestCID: data.manifestCID as string,
    };
  } catch {
    return null;
  }
}

export async function loadCidMap() {
  const latest = await publicClient.getBlockNumber();
  const logs = await publicClient.getLogs({
    address: TREASURY,
    fromBlock: DEPLOY_BLOCK,
    toBlock: latest,
    events: [ProposedEvt],
    strict: false,
  });
  const map = new Map<string, { cidHash: `0x${string}` }>();
  for (const l of logs) {
    const a: any = (l as any).args;
    map.set(a.id.toLowerCase(), { cidHash: a.cidHash });
  }
  return map;
}

function buildAbsoluteUrl(path: string) {
  const fromEnv =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXTAUTH_URL ||
    process.env.VERCEL_URL ||
    "";
  if (fromEnv) {
    const hasProtocol = fromEnv.startsWith("http://") || fromEnv.startsWith("https://");
    const origin = hasProtocol ? fromEnv : `https://${fromEnv}`;
    return `${origin.replace(/\/$/, "")}${path}`;
  }
  return `http://localhost:3000${path}`;
}

/**
 * Simple client helper used by /board to load the latest epoch.
 * This runs in the browser and calls the Next.js API route.
 */
export async function getLatestNormalized(): Promise<LatestManifestResponse> {
  const res = await fetch("/api/manifest/latest", { cache: "no-store" });
  if (!res.ok) {
    throw new Error("Failed to load latest manifest");
  }
  return res.json();
}
