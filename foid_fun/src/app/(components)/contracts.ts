import { CHAIN_ID, RPC_URL, BLOCK_EXPLORER, CHAIN_NAME, CANONICAL_ADDRESSES } from "@/config/canonical";

export const NETWORK_DETAILS = {
  chainName: CHAIN_NAME,
  rpcUrl: RPC_URL,
  chainId: CHAIN_ID,
  explorer: BLOCK_EXPLORER,
} as const;

export interface ContractDescriptor {
  label: string;
  address: `0x${string}`;
}

export const CONTRACT_ADDRESSES: ContractDescriptor[] = [
  { label: "wFOID", address: CANONICAL_ADDRESSES.wfoid as `0x${string}` },
  { label: "FoidFactory", address: CANONICAL_ADDRESSES.foidFactory as `0x${string}` },
  { label: "FoidSwap LP", address: CANONICAL_ADDRESSES.foidSwapLP as `0x${string}` },
  { label: "FoidSwap Router", address: CANONICAL_ADDRESSES.foidSwapRouter as `0x${string}` },
  { label: "Prayer Registry", address: CANONICAL_ADDRESSES.prayerRegistry as `0x${string}` },
  { label: "Prayer Mirror", address: CANONICAL_ADDRESSES.prayerMirror as `0x${string}` },
  { label: "WETH", address: CANONICAL_ADDRESSES.weth as `0x${string}` },
] as const;
