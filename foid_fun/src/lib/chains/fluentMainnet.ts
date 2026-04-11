import { defineChain } from "viem";
import { CANONICAL_CHAIN } from "@/config/canonical";

const rpc = process.env.NEXT_PUBLIC_FLUENT_RPC ?? CANONICAL_CHAIN.rpcUrl;

export const fluentMainnet = defineChain({
  id: 25363,
  name: "Fluent",
  nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: { http: [rpc] },
    public: { http: [rpc] },
  },
  blockExplorers: {
    default: { name: "FluentScan", url: CANONICAL_CHAIN.blockExplorer },
  },
  testnet: false,
});
