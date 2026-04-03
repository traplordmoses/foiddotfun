import { defineChain } from "viem";

const rpc = process.env.NEXT_PUBLIC_FLUENT_RPC ?? "https://rpc.fluent.xyz";

export const fluentMainnet = defineChain({
  id: 25363,
  name: "Fluent",
  nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: { http: [rpc] },
    public: { http: [rpc] },
  },
  blockExplorers: {
    default: { name: "FluentScan", url: "https://fluentscan.xyz" },
  },
  testnet: false,
});
