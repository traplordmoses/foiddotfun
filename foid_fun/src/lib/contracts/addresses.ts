// Import canonical addresses and config as single source of truth.
// All contract addresses flow from canonical.ts → here → components/hooks.
// Override any address via NEXT_PUBLIC_* env vars; falls back to canonical.
import {
  CANONICAL_ADDRESSES,
  CHAIN_ID,
  RPC_URL as CANONICAL_RPC_URL,
  DEPLOY_BLOCK as CANONICAL_DEPLOY_BLOCK,
} from "@/config/canonical";

// Trim env vars to prevent trailing-space address errors from Vercel dashboard
const env = (key: string) => process.env[key]?.trim();

export const CONTRACTS = {
  // ── Prayer (pre-existing, unchanged across deploys) ──
  PRAYER_REGISTRY: env("NEXT_PUBLIC_PRAYER_REGISTRY") ?? CANONICAL_ADDRESSES.prayerRegistry,
  PRAYER_MIRROR: env("NEXT_PUBLIC_PRAYER_MIRROR") ?? CANONICAL_ADDRESSES.prayerMirror,

  // ── FOID v1: Swipe + Gallery + Tiers ──
  FOID_TREST: env("NEXT_PUBLIC_FOID_TREST") ?? CANONICAL_ADDRESSES.foidTrest,
  SWIPE: env("NEXT_PUBLIC_SWIPE") ?? CANONICAL_ADDRESSES.swipe,
  STREAK_VOTING_POWER: env("NEXT_PUBLIC_STREAK_VOTING_POWER") ?? CANONICAL_ADDRESSES.streakVotingPower,
  PRAYER_TIERS: env("NEXT_PUBLIC_PRAYER_TIERS") ?? CANONICAL_ADDRESSES.prayerTiers,
  ENGRAVE: env("NEXT_PUBLIC_ENGRAVE_ADDRESS") ?? CANONICAL_ADDRESSES.engrave,

  // ── SwipeLoreboard: deployed — flag/removal governance for board placements ──
  SWIPE_LOREBOARD: env("NEXT_PUBLIC_SWIPE_LOREBOARD") ?? CANONICAL_ADDRESSES.swipeLoreboard,

  // ── FoidTrestGovernance: not deployed yet — governance is post-launch ──
  FOID_TREST_GOVERNANCE: "",

  // ── Legacy loreboard contracts (read-only, used by bot + subgraph) ──
  LOREBOARD_BOARD: env("NEXT_PUBLIC_LOREBOARD_BOARD") ?? CANONICAL_ADDRESSES.board,
  LOREBOARD_TREASURY: env("NEXT_PUBLIC_LOREBOARD_TREASURY") ?? CANONICAL_ADDRESSES.treasury,
  LOREBOARD_VOTING: env("NEXT_PUBLIC_LOREBOARD_VOTING") ?? CANONICAL_ADDRESSES.voting,
  LOREBOARD_MANIFEST_STORE: env("NEXT_PUBLIC_LOREBOARD_MANIFEST_STORE") ?? CANONICAL_ADDRESSES.manifestStore,
  LOREBOARD_LIVE_NFT: env("NEXT_PUBLIC_LOREBOARD_LIVE_NFT") ?? CANONICAL_ADDRESSES.liveNFT,
  VOTING_POWER: env("NEXT_PUBLIC_VOTING_POWER") ?? CANONICAL_ADDRESSES.votingPowerSource,

  // ── Fee config ──
  PLACEMENT_FEE_WEI: env("NEXT_PUBLIC_PLACEMENT_FEE_WEI") ?? "1000000000000000",       // 0.001 ETH
  SWIPE_SUBMISSION_FEE: env("NEXT_PUBLIC_SWIPE_SUBMISSION_FEE") ?? "1000000000000000",   // 0.001 ETH
  FLAG_FEE_WEI: env("NEXT_PUBLIC_FLAG_FEE_WEI") ?? "1000000000000000",                   // 0.001 ETH
  MIFOID_MINT_FEE: env("NEXT_PUBLIC_MIFOID_MINT_FEE") ?? "10000000000000000",            // 0.01 ETH
  DUEL_SUBMISSION_FEE: env("NEXT_PUBLIC_DUEL_SUBMISSION_FEE") ?? "1000000000000000",      // 0.001 ETH (legacy)
} as const;

export const CHAIN_CONFIG = {
  id: CHAIN_ID,
  name: process.env.NEXT_PUBLIC_CHAIN_NAME ?? "Fluent",
  rpcUrl: CANONICAL_RPC_URL,
  blockExplorer: process.env.NEXT_PUBLIC_BLOCK_EXPLORER ?? "https://testnet.fluentscan.xyz",
} as const;

export const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL ?? CHAIN_CONFIG.rpcUrl;

// Use canonical deploy block
export const DEPLOY_BLOCK: bigint = CANONICAL_DEPLOY_BLOCK;
