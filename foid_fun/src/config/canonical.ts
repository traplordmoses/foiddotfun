import { getAddress, type Address } from "viem";

const DOTENV_HINT =
  "If you're using .env.local, run with DOTENV_CONFIG_PATH=.env.local.";

export const IS_MAINNET = process.env.NEXT_PUBLIC_IS_MAINNET === 'true';

const DEFAULT_CHAIN_ID = IS_MAINNET ? 25363 : 20994;
const DEFAULT_RPC_URL = IS_MAINNET
  ? "https://rpc.fluent.xyz"
  : "https://rpc.testnet.fluent.xyz";
const DEFAULT_BLOCK_EXPLORER = IS_MAINNET
  ? "https://fluentscan.xyz"
  : "https://testnet.fluentscan.xyz";
const DEFAULT_CHAIN_NAME = IS_MAINNET ? "Fluent" : "Fluent Testnet";

export const CANONICAL_CHAIN = {
  id: DEFAULT_CHAIN_ID,
  rpcUrl: DEFAULT_RPC_URL,
  blockExplorer: DEFAULT_BLOCK_EXPLORER,
  chainName: DEFAULT_CHAIN_NAME,
};

export const CANONICAL_ADDRESSES = {
  // Legacy loreboard contracts (checksummed via getAddress)
  treasury: getAddress("0x4A777d8650b3FA2419377F4ffeF0EF8007151536"),
  manifestStore: getAddress("0xeE469D8F9BB2Ace861AA689dE53c016871ad3D10"),
  voting: getAddress("0xEbf065A7ca3917BB5e669982e8C6954cC27A7075"),
  board: getAddress("0xE41B2D418C09Ea928E4F657ED2438f5D01472105"),
  liveNFT: getAddress("0x4b38ad556300fadd6cdc5a9b0b1870e63c0f14e3"),
  operator: getAddress("0x1a2a5E805342D5139111488C59d72832055A3e8F"),
  votingPowerSource: getAddress("0xCCf0ac9c66a68FCb8c438C697EdA87D9766f1Be5"),
  vmWrapper: getAddress("0x4031762fB8b5d3fcA168AA6555FfC666ED500DaD"),
  vmWasm: getAddress("0xBE0ec2117F36797DEf3ab10661464265b2E4df34"),

  // V1 contracts (multisig-owned, deployed 2026-03-20 / 2026-03-26)
  prayerTiers: getAddress("0x36ED105e09A881B6074250a43B2e26c0d6cfD4fb"),
  streakVotingPower: getAddress("0x7a889b3d38889E45EE48bbCBc3681a889F87C03e"),
  foidTrest: getAddress("0x87Ea24ba4B61BbF35aD1161e11072Dc8Cf0858a6"),
  swipe: getAddress("0xF9b72062A7e5933692CcBd247d70a9cdB40E0eC7"),  // Loreboard (replaces legacy Swipe v2 at 0x60A865...)
  loreboard: getAddress("0xF9b72062A7e5933692CcBd247d70a9cdB40E0eC7"),
  loreboardLiveNFT: getAddress("0x9E17B30a41546E854778d91d6Ef0C0D982d49012"),
  swipeLoreboard: getAddress("0x3782BaD8ADa3BD8C98729d4516F600317F3aC362"),
  multisig: getAddress("0x2379955b597d2a7fc9dbD918306aa59c43eBF6Ed"),

  // Standalone contracts
  engrave: getAddress("0xe73f5f91159c2d84b1a66badf701d5312213b66a"),
  prayerRegistry: getAddress("0x6FC7301fad7Ca0294152b23FD4f0467200376d65"),
  prayerMirror: getAddress("0x8ff39c2a78FaF7d655e4Dab03076Cb26C97007FF"),
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
  ]) ?? DEFAULT_RPC_URL;

/** Public RPC as fallback when QuickNode is down */
export const FALLBACK_RPC_URL = DEFAULT_RPC_URL;

export const BLOCK_EXPLORER =
  pickEnvKey(["NEXT_PUBLIC_BLOCK_EXPLORER"]) ?? DEFAULT_BLOCK_EXPLORER;

export const CHAIN_NAME =
  pickEnvKey(["NEXT_PUBLIC_CHAIN_NAME"]) ?? DEFAULT_CHAIN_NAME;

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
