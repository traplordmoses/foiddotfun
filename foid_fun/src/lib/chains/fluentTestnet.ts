import { defineChain } from "viem";
import { CANONICAL_CHAIN } from "@/config/canonical";

// Use the public Fluent RPC as the chain's advertised URL. The private
// RPC must never be bundled to the client — client code reaches the
// private endpoint through the `/api/rpc` proxy (wired in providers.tsx).
const rpc = CANONICAL_CHAIN.rpcUrl;

export const fluentTestnet = defineChain({
  id: 20994,
  name: "Fluent Testnet",
  nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: { http: [rpc] },
    public: { http: [rpc] },
  },
  blockExplorers: {
    default: { name: "FluentScan", url: CANONICAL_CHAIN.blockExplorer },
  },
  contracts: {
    multicall3: {
      address: "0xcA11bde05977b3631167028862bE2a173976CA11",
      blockCreated: 0,
    },
  },
  testnet: true,
});
