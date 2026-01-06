import dotenv from "dotenv";
import {
  createPublicClient,
  defineChain,
  http,
  keccak256,
  stringToHex,
  type Hex,
} from "viem";
import treasuryAbi from "../src/abi/LoreBoardTreasury.json";
import { loreBoardManifestStoreAbi } from "../src/abi/loreBoardManifestStore";
import { ipfsToHttp } from "../src/lib/ipfsUrl";

dotenv.config();
dotenv.config({ path: ".env.local" });

type Address = `0x${string}`;

const rpc =
  process.env.NEXT_PUBLIC_FLUENT_RPC ??
  process.env.FLUENT_RPC ??
  process.env.NEXT_PUBLIC_RPC ??
  "";
const treasuryAddress = process.env.NEXT_PUBLIC_LOREBOARD_ADDRESS as Address | undefined;
const manifestStoreAddress =
  (process.env.NEXT_PUBLIC_LOREBOARD_MANIFEST_STORE_ADDRESS ||
    process.env.NEXT_PUBLIC_LOREBOARD_ANCHOR ||
    process.env.NEXT_PUBLIC_MANIFEST_STORE ||
    process.env.NEXT_PUBLIC_MANIFEST_STORE_ADDRESS) as Address | undefined;

function requireEnv<T>(label: string, value: T | undefined | null): T {
  if (value == null || value === "") {
    throw new Error(`Missing ${label}`);
  }
  return value as T;
}

function normalizeCid(raw?: string | null) {
  const cleaned = String(raw ?? "").replace(/^ipfs:\/\//, "").trim();
  return cleaned.length ? cleaned : null;
}

function normalizeRoot(raw?: string | null): Hex | null {
  const cleaned = String(raw ?? "").trim();
  if (!cleaned || cleaned === "0x") return null;
  if (/^0x0+$/i.test(cleaned)) return null;
  return cleaned as Hex;
}

function toBytes32Id(value: string): Hex {
  if (value.startsWith("0x") && value.length === 66) {
    return value as Hex;
  }
  return keccak256(stringToHex(value)) as Hex;
}

function fakeRoot(ids: Hex[]): Hex {
  const concat = (`0x${ids.map((x) => x.slice(2)).join("")}` || "0x") as Hex;
  return keccak256(concat);
}

async function fetchManifestRaw(cid: string) {
  const urls = ipfsToHttp(cid);
  for (const url of urls) {
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) continue;
      const rawText = await res.text();
      const json = JSON.parse(rawText);
      return { rawText, json };
    } catch {
      /* try next gateway */
    }
  }
  return null;
}

function fail(message: string): never {
  console.error(`FAIL: ${message}`);
  process.exit(1);
}

async function main() {
  requireEnv("NEXT_PUBLIC_FLUENT_RPC", rpc);
  requireEnv("NEXT_PUBLIC_LOREBOARD_ADDRESS", treasuryAddress);
  requireEnv("NEXT_PUBLIC_LOREBOARD_MANIFEST_STORE_ADDRESS", manifestStoreAddress);

  const chain = defineChain({
    id: 20994,
    name: "Fluent Testnet",
    nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
    rpcUrls: { default: { http: [rpc] } },
  });

  const publicClient = createPublicClient({ chain, transport: http(rpc) });

  const latest = (await publicClient.readContract({
    address: manifestStoreAddress!,
    abi: loreBoardManifestStoreAbi as any,
    functionName: "latest",
    args: [],
  })) as readonly [bigint, Hex, string];

  const epoch = Number(latest[0] ?? 0) || 0;
  const manifestRoot = normalizeRoot(latest[1]);
  const cid = normalizeCid(latest[2]);

  if (!epoch || !manifestRoot || !cid) {
    fail("ManifestStore.latest returned empty epoch/root/cid");
  }

  const manifestPayload = await fetchManifestRaw(cid);
  if (!manifestPayload) {
    fail(`Failed to fetch manifest from IPFS for cid=${cid}`);
  }
  const { rawText, json: manifest } = manifestPayload;

  const placements = Array.isArray(manifest?.placements)
    ? manifest.placements
    : [];

  if (!placements.length) {
    fail("Manifest has no placements");
  }

  const manifestRootField =
    normalizeRoot(manifest?.manifestRoot) ??
    normalizeRoot(manifest?.root) ??
    normalizeRoot(manifest?.manifest_root);

  const placementIds = placements
    .map((p: any) => String(p?.id ?? ""))
    .filter((id: string) => id.length)
    .map((id: string) => toBytes32Id(id));

  if (!placementIds.length) {
    fail("Manifest placements missing ids");
  }

  const jsonRoot = keccak256(stringToHex(rawText));
  const placementsRoot = fakeRoot(placementIds);
  const expectedRoot = manifestRoot.toLowerCase();

  const matchedScheme =
    expectedRoot === jsonRoot.toLowerCase()
      ? "json"
      : expectedRoot === placementsRoot.toLowerCase()
      ? "placements"
      : null;

  if (!matchedScheme) {
    const manifestFieldRoot = manifestRootField?.toLowerCase() ?? "none";
    fail(
      `Manifest root mismatch: chain=${manifestRoot} json=${jsonRoot} placements=${placementsRoot} manifestField=${manifestFieldRoot}`
    );
  }

  const winners = Array.isArray(manifest?.winners) ? manifest.winners : [];
  const winnerIdRaw =
    winners.length > 0 ? String(winners[0]?.id ?? "") : String(placements.at(-1)?.id ?? "");

  if (!winnerIdRaw) {
    fail("Unable to determine winner id");
  }

  const winnerId = toBytes32Id(winnerIdRaw);
  const accepted = (await publicClient.readContract({
    address: treasuryAddress!,
    abi: treasuryAbi as any,
    functionName: "accepted",
    args: [winnerId],
  })) as boolean;

  if (!accepted) {
    fail(`Treasury does not accept winner id=${winnerIdRaw}`);
  }

  console.log("PASS: latest manifest verified", {
    epoch,
    cid,
    manifestRoot,
    winnerId,
    matchedScheme,
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
