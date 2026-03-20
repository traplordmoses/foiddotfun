import { createPublicClient, http, defineChain, type Address, type PublicClient } from "viem";
import dotenv from "dotenv";
import path from "path";

// Load .env.local from foid_fun root
dotenv.config({ path: path.join(process.cwd(), ".env.local") });

export const RPC_URL = process.env.NEXT_PUBLIC_FLUENT_RPC || "https://rpc.testnet.fluent.xyz";
export const CHAIN_ID = Number(process.env.NEXT_PUBLIC_CHAIN_ID || 20994);

export const SUBGRAPH_URLS = {
  // New V1 subgraphs
  swipe: process.env.GOLDSKY_SWIPE_URL ||
    "https://api.goldsky.com/api/public/project_cmkwd7dgh0bq501z7fog65iag/subgraphs/foid-swipe-fluent-testnet/1.1.0/gn",
  prayer: process.env.GOLDSKY_PRAYER_URL ||
    "https://api.goldsky.com/api/public/project_cmkwd7dgh0bq501z7fog65iag/subgraphs/foid-prayer-fluent-testnet/1.0.0/gn",
  // Legacy loreboard subgraphs (kept for bot + backwards compat)
  board: process.env.GOLDSKY_BOARD_V1_URL ||
    "https://api.goldsky.com/api/public/project_cmkwd7dgh0bq501z7fog65iag/subgraphs/foid-loreboard-fluent-testnet/2.0.2/gn",
  voting: process.env.GOLDSKY_VOTING_URL ||
    "https://api.goldsky.com/api/public/project_cmkwd7dgh0bq501z7fog65iag/subgraphs/foid-loreboard-fluent-testnet/2.0.1/gn",
};

export const CONTRACTS = {
  prayerRegistry: "0x6FC7301fad7Ca0294152b23FD4f0467200376d65" as Address,
  prayerMirror: "0x8ff39c2a78FaF7d655e4Dab03076Cb26C97007FF" as Address,
  prayerTiers: "0x36ED105e09A881B6074250a43B2e26c0d6cfD4fb" as Address,
  streakVotingPower: "0x7a889b3d38889E45EE48bbCBc3681a889F87C03e" as Address,
  swipe: "0xddc2623Bd80B1429426e30Be3D02e52ff6f90C44" as Address,
  swipeLoreboard: "0x0000000000000000000000000000000000000000" as Address, // not deployed in v1
  foidTrest: "0x87Ea24ba4B61BbF35aD1161e11072Dc8Cf0858a6" as Address,
};

export const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || "";

const chain = defineChain({
  id: CHAIN_ID,
  name: "Fluent Testnet",
  nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: [RPC_URL] } },
});

let _client: PublicClient | null = null;
export function getClient(): PublicClient {
  if (!_client) {
    _client = createPublicClient({ chain, transport: http(RPC_URL) });
  }
  return _client;
}

export const PAIR_X_URL = process.env.PAIR_X_URL || "http://localhost:3000/api/pair-x/batch";
