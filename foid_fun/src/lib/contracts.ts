import WrappedFoidAbi from "@/abis/WrappedFoid.json";
import BridgeRouterAbi from "@/abis/BridgeRouter.json";
import AttestorRegistryAbi from "@/abis/AttestorRegistry.json";
import SimpleSingleAMMAbi from "@/abis/SimpleSingleAMM.json";

const fallbackExplorer = "https://testnet.fluentscan.xyz";

export const FLUENT_CHAIN_ID =
  Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? "20994") || 20994;
export const FLUENT_CHAIN_NAME =
  process.env.NEXT_PUBLIC_CHAIN_NAME ?? "Fluent Testnet";
export const BLOCK_EXPLORER_URL = (
  process.env.NEXT_PUBLIC_BLOCK_EXPLORER || fallbackExplorer
).replace(/\/+$/, "");

export const TOKEN0_ADDRESS = process.env.NEXT_PUBLIC_TOKEN0 as `0x${string}`;
export const TOKEN1_ADDRESS = process.env.NEXT_PUBLIC_TOKEN1 as `0x${string}`;

export const WFOID_ADDRESS = TOKEN0_ADDRESS;
export const ROUTER_ADDRESS = process.env.NEXT_PUBLIC_BRIDGE as `0x${string}`;
export const REGISTRY_ADDRESS = process.env.NEXT_PUBLIC_REGISTRY as `0x${string}`;
export const AMM_ADDRESS =
  (process.env.NEXT_PUBLIC_AMM as `0x${string}`) ??
  ("0xa9D406359B3136E43B3b360Ed40b5504cAAf5b66" as const);

export const TOKEN0_METADATA = {
  name: process.env.NEXT_PUBLIC_TOKEN0_NAME ?? "Token 0",
  symbol: process.env.NEXT_PUBLIC_TOKEN0_SYMBOL ?? "TOKEN0",
} as const;

export const TOKEN1_METADATA = {
  name: process.env.NEXT_PUBLIC_TOKEN1_NAME ?? "Token 1",
  symbol: process.env.NEXT_PUBLIC_TOKEN1_SYMBOL ?? "TOKEN1",
} as const;

export const WrappedFoid = {
  address: WFOID_ADDRESS,
  abi: WrappedFoidAbi,
} as const;

export const BridgeRouter = {
  address: ROUTER_ADDRESS,
  abi: BridgeRouterAbi,
} as const;

export const AttestorRegistry = {
  address: REGISTRY_ADDRESS,
  abi: AttestorRegistryAbi,
} as const;

export const SimpleSingleAMM = {
  address: AMM_ADDRESS,
  abi: SimpleSingleAMMAbi,
} as const;

export type WrappedFoidAbiType = typeof WrappedFoidAbi;
export type BridgeRouterAbiType = typeof BridgeRouterAbi;
export type AttestorRegistryAbiType = typeof AttestorRegistryAbi;
export type SimpleSingleAMMAbiType = typeof SimpleSingleAMMAbi;
