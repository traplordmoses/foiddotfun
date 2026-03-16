import { getAddress, type Address } from "viem";

const DOTENV_HINT =
  "If you're using .env.local, run with DOTENV_CONFIG_PATH=.env.local.";

const DEFAULT_CHAIN_ID = 20994;
const DEFAULT_RPC_URL = "https://rpc.testnet.fluent.xyz";
const QUICKNODE_RPC_URL = "https://flashy-indulgent-knowledge.fluent-testnet.quiknode.pro/ef03557510e0b97fe678aeff63c7a9ef0181a852";

export const CANONICAL_CHAIN = {
  id: DEFAULT_CHAIN_ID,
  rpcUrl: DEFAULT_RPC_URL,
};

export const CANONICAL_ADDRESSES = {
  // Legacy loreboard contracts
  treasury: "0x4A777d8650b3FA2419377F4ffeF0EF8007151536" as Address,
  manifestStore: "0xeE469D8F9BB2Ace861AA689dE53c016871ad3D10" as Address,
  voting: "0xEbf065A7ca3917BB5e669982e8C6954cC27A7075" as Address,
  board: "0xE41B2D418C09Ea928E4F657ED2438f5D01472105" as Address,
  liveNFT: "0x4b38ad556300fadd6cdc5a9b0b1870e63c0f14e3" as Address,
  operator: "0x1a2a5E805342D5139111488C59d72832055A3e8F" as Address,
  votingPowerSource: "0xCCf0ac9c66a68FCb8c438C697EdA87D9766f1Be5" as Address,
  vmWrapper: "0x4031762fB8b5d3fcA168AA6555FfC666ED500DaD" as Address,
  vmWasm: "0xBE0ec2117F36797DEf3ab10661464265b2E4df34" as Address,

  // V1 contracts
  prayerTiers: "0x4eEeD27Bfa0734086FA65082C96DAD014c31EeDB" as Address,
  streakVotingPower: "0x68F10FC72572B433425AC036740B52AcE51Af1A6" as Address,
  foidTrest: "0xdEe866015122c9f3672E18646a172Bd8a1eb2ff1" as Address,
  swipe: "0x0e222432aC1583E47A80228fd664e90ba6f6e37C" as Address,
  swipeLoreboard: "0xfb2C1aa8E72baEA6872fae120d25Fc30246a27C6" as Address,
};

const warnOnce = (() => {
  const seen = new Set<string>();
  return (key: string, message: string) => {
    if (seen.has(key)) return;
    seen.add(key);
    console.warn(message);
  };
})();

function pickEnvKey(keys: string[]) {
  for (const key of keys) {
    const value = process.env[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return undefined;
}

function normalizeAddress(value: string, label: string): Address {
  try {
    return getAddress(value);
  } catch {
    throw new Error(
      `[contracts] ${label} invalid address: ${value}. ${DOTENV_HINT}`
    );
  }
}

export const CHAIN_ID = Number(
  pickEnvKey(["CHAIN_ID", "NEXT_PUBLIC_CHAIN_ID"]) ?? DEFAULT_CHAIN_ID
);

if (!Number.isFinite(CHAIN_ID) || CHAIN_ID <= 0) {
  throw new Error(`[config] Invalid CHAIN_ID. ${DOTENV_HINT}`);
}

export const RPC_URL =
  pickEnvKey([
    "RPC_URL",
    "NEXT_PUBLIC_FLUENT_RPC",
    "FLUENT_RPC_URL",
    "NEXT_PUBLIC_RPC_URL",
  ]) ?? QUICKNODE_RPC_URL;

/** Public RPC as fallback when QuickNode is down */
export const FALLBACK_RPC_URL = DEFAULT_RPC_URL;

if (
  !pickEnvKey([
    "RPC_URL",
    "NEXT_PUBLIC_FLUENT_RPC",
    "FLUENT_RPC_URL",
    "NEXT_PUBLIC_RPC_URL",
  ])
) {
  warnOnce(
    "RPC_URL",
    `[config] RPC URL not configured; falling back to ${DEFAULT_RPC_URL}. ${DOTENV_HINT}`
  );
}

const boardAddressEnv = pickEnvKey([
  "BOARD_ADDRESS",
  "NEXT_PUBLIC_LOREBOARD_BOARD_ADDRESS",
  "LOREBOARD_BOARD_ADDRESS",
]);

export const BOARD_ADDRESS = boardAddressEnv
  ? normalizeAddress(boardAddressEnv, "BOARD_ADDRESS")
  : CANONICAL_ADDRESSES.board;

if (!boardAddressEnv) {
  warnOnce(
    "BOARD_ADDRESS",
    `[config] BOARD_ADDRESS is not set; falling back to Fluent testnet board ${CANONICAL_ADDRESSES.board}. ${DOTENV_HINT}`
  );
}

const votingAddressEnv = pickEnvKey([
  "VOTING_ADDRESS",
  "NEXT_PUBLIC_LOREBOARD_VOTING_ADDRESS",
  "LOREBOARD_VOTING_ADDRESS",
]);

export const VOTING_ADDRESS = votingAddressEnv
  ? normalizeAddress(votingAddressEnv, "VOTING_ADDRESS")
  : CANONICAL_ADDRESSES.voting;

if (!votingAddressEnv) {
  warnOnce(
    "VOTING_ADDRESS",
    `[config] VOTING_ADDRESS is not set; falling back to Fluent testnet voting ${CANONICAL_ADDRESSES.voting}. ${DOTENV_HINT}`
  );
}

const deployBlockEnv = pickEnvKey([
  "DEPLOY_BLOCK",
  "NEXT_PUBLIC_LOREBOARD_DEPLOY_BLOCK",
  "NEXT_PUBLIC_DEPLOY_BLOCK",
  "NEXT_PUBLIC_LORE_START_BLOCK",
]);

export const DEPLOY_BLOCK = deployBlockEnv ? BigInt(deployBlockEnv) : 0n;

if (!deployBlockEnv) {
  warnOnce(
    "DEPLOY_BLOCK",
    `[config] DEPLOY_BLOCK is not configured; scans will fall back to inferred lookback. ${DOTENV_HINT}`
  );
}

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

export function requireCanonicalAddress(params: {
  label: string;
  envValue?: string | null;
  expected: Address;
  envHint: string;
}) {
  const value = params.envValue?.trim();
  if (!value || value.toLowerCase() === ZERO_ADDRESS) {
    warnOnce(
      params.label,
      `[config] ${params.label} not set; using canonical ${params.expected}.`
    );
    return params.expected;
  }
  const normalized = getAddress(value);
  if (normalized.toLowerCase() !== params.expected.toLowerCase()) {
    throw new Error(
      `[contracts] ${params.label} mismatch: expected ${params.expected}, got ${normalized}. ${DOTENV_HINT}`
    );
  }
  return normalized;
}
