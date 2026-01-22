import type { Chain } from "viem";
import { fluentTestnet } from "@/lib/chains/fluentTestnet";

export const TARGET_CHAIN: Chain = fluentTestnet;
export const TARGET_CHAIN_ID = TARGET_CHAIN.id;

export default TARGET_CHAIN;
