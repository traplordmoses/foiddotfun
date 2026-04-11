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
  { label: "wFOID", address: "0x403ECF8ba28E58CE4d1847C1C95ac54651fAB151" },
  { label: "FoidFactory", address: "0xaC8433Aa94C3E043b197C25854bAC39Ee914B8F9" },
  { label: "FoidSwap LP", address: "0xe97639fd6Ff7231ed270Ea16BD9Ba2c79f4cD2cc" },
  { label: "FoidSwap Router", address: "0xd71330e54eAA2e4248E75067F8f23bB2a6568613" },
  { label: "Prayer Registry", address: CANONICAL_ADDRESSES.prayerRegistry as `0x${string}` },
  { label: "Prayer Mirror", address: CANONICAL_ADDRESSES.prayerMirror as `0x${string}` },
  { label: "WETH", address: "0x3d38E57b5d23c3881AffB8BC0978d5E0bd96c1C6" },
] as const;
