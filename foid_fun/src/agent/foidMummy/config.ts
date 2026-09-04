import { createPublicClient, http, defineChain, type PublicClient } from "viem";
import dotenv from "dotenv";
import path from "path";
import {
  RPC_URL as CANONICAL_RPC,
  CHAIN_ID as CANONICAL_CHAIN_ID,
  CHAIN_NAME as CANONICAL_CHAIN_NAME,
  CANONICAL_ADDRESSES,
  IS_MAINNET,
  getServerRpcUrl,
} from "@/config/canonical";

// Load .env.local from foid_fun root
dotenv.config({ path: path.join(process.cwd(), ".env.local") });

// Agent is server-only; use the private RPC when available.
export const RPC_URL = getServerRpcUrl() ?? CANONICAL_RPC;
export const CHAIN_ID = Number(process.env.NEXT_PUBLIC_CHAIN_ID || CANONICAL_CHAIN_ID);

const DEFAULT_LOREBOARD_SUBGRAPH = IS_MAINNET
  ? "" // No mainnet subgraph yet
  : "https://api.goldsky.com/api/public/project_cmkwd7dgh0bq501z7fog65iag/subgraphs/foid-loreboard-fluent-testnet/1.0.0/gn";

const DEFAULT_PRAYER_SUBGRAPH = IS_MAINNET
  ? "" // No mainnet subgraph yet
  : "https://api.goldsky.com/api/public/project_cmkwd7dgh0bq501z7fog65iag/subgraphs/foid-prayer-tiers-fluent-testnet/1.0.0/gn";

export const SUBGRAPH_URLS = {
  loreboard: process.env.GOLDSKY_LOREBOARD_URL || DEFAULT_LOREBOARD_SUBGRAPH,
  prayerTiers: process.env.GOLDSKY_PRAYER_TIERS_URL || DEFAULT_PRAYER_SUBGRAPH,
};

export const CONTRACTS = {
  loreboard: CANONICAL_ADDRESSES.loreboard,
  prayerRegistry: CANONICAL_ADDRESSES.prayerRegistry,
  prayerMirror: CANONICAL_ADDRESSES.prayerMirror,
  prayerTiers: CANONICAL_ADDRESSES.prayerTiers,
  streakVotingPower: CANONICAL_ADDRESSES.streakVotingPower,
  swipe: CANONICAL_ADDRESSES.swipe,
  swipeLoreboard: CANONICAL_ADDRESSES.swipeLoreboard,
  foidTrest: CANONICAL_ADDRESSES.foidTrest,
};

export const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || "";

const chain = defineChain({
  id: CHAIN_ID,
  name: CANONICAL_CHAIN_NAME,
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
