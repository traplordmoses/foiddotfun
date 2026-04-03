import type { Chain } from "viem";
import { IS_MAINNET } from "@/config/canonical";
import { fluentTestnet } from "@/lib/chains/fluentTestnet";
import { fluentMainnet } from "@/lib/chains/fluentMainnet";

export const TARGET_CHAIN: Chain = IS_MAINNET ? fluentMainnet : fluentTestnet;
export const TARGET_CHAIN_ID = TARGET_CHAIN.id;

export default TARGET_CHAIN;
