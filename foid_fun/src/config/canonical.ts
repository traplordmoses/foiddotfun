import { getAddress, type Address } from "viem";

const DOTENV_HINT =
  "If you're using .env.local, run with DOTENV_CONFIG_PATH=.env.local.";

export const CANONICAL_CHAIN = {
  id: 20994,
  rpcUrl: "https://rpc.testnet.fluent.xyz",
};

export const CANONICAL_ADDRESSES = {
  treasury: "0x4A777d8650b3FA2419377F4ffeF0EF8007151536" as Address,
  manifestStore: "0xeE469D8F9BB2Ace861AA689dE53c016871ad3D10" as Address,
  voting: "0xEbf065A7ca3917BB5e669982e8C6954cC27A7075" as Address,
  board: "0xE41B2D418C09Ea928E4F657ED2438f5D01472105" as Address,
  operator: "0x1a2a5E805342D5139111488C59d72832055A3e8F" as Address,
  votingPowerSource: "0xCCf0ac9c66a68FCb8c438C697EdA87D9766f1Be5" as Address,
  vmWrapper: "0x4031762fB8b5d3fcA168AA6555FfC666ED500DaD" as Address,
  vmWasm: "0xBE0ec2117F36797DEf3ab10661464265b2E4df34" as Address,
};

export function requireCanonicalAddress(params: {
  label: string;
  envValue?: string | null;
  expected: Address;
  envHint: string;
}) {
  const value = params.envValue?.trim();
  if (!value) {
    throw new Error(`Missing ${params.envHint}. ${DOTENV_HINT}`);
  }
  const normalized = getAddress(value);
  if (normalized.toLowerCase() !== params.expected.toLowerCase()) {
    throw new Error(
      `[contracts] ${params.label} mismatch: expected ${params.expected}, got ${normalized}. ${DOTENV_HINT}`
    );
  }
  return normalized;
}
