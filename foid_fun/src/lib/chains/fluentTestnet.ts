import { defineChain } from "viem";
import { CANONICAL_CHAIN } from "@/config/canonical";

const QUICKNODE_RPC = "https://flashy-indulgent-knowledge.fluent-testnet.quiknode.pro/ef03557510e0b97fe678aeff63c7a9ef0181a852";
const rpc = process.env.NEXT_PUBLIC_FLUENT_RPC || QUICKNODE_RPC;

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
