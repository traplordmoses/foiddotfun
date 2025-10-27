import WrappedFoidAbi from '@/abis/WrappedFoid.json';
import BridgeRouterAbi from '@/abis/BridgeRouter.json';
import AttestorRegistryAbi from '@/abis/AttestorRegistry.json';

export const WFOID_ADDRESS = process.env.NEXT_PUBLIC_WFOID as `0x${string}`;
export const ROUTER_ADDRESS = process.env.NEXT_PUBLIC_ROUTER as `0x${string}`;
export const REGISTRY_ADDRESS = process.env.NEXT_PUBLIC_REGISTRY as `0x${string}`;

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

export type WrappedFoidAbiType = typeof WrappedFoidAbi;
export type BridgeRouterAbiType = typeof BridgeRouterAbi;
export type AttestorRegistryAbiType = typeof AttestorRegistryAbi;