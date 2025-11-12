import { defineChain } from "viem";

const rpc = process.env.NEXT_PUBLIC_FLUENT_RPC!;

export const fluentTestnet = defineChain({
  id: 20994,
  name: "Fluent Testnet",
  nativeCurrency: { name: "FLU", symbol: "FLU", decimals: 18 },
  rpcUrls: {
    default: { http: [rpc] },
    public: { http: [rpc] },
  },
  blockExplorers: {
    default: { name: "FluentScan", url: "https://testnet.fluentscan.xyz" },
  },
  testnet: true,
});
