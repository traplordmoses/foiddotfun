// Shared resilient RPC client for API routes.
// Includes: timeout, fallback RPC, and multicall helper.
import { createPublicClient, http, fallback } from "viem";
import { CHAIN_CONFIG, RPC_URL } from "@/lib/contracts/addresses";

const FALLBACK_RPC = "https://rpc.testnet.fluent.xyz";
const TIMEOUT_MS = 10_000;

const chain = {
  id: CHAIN_CONFIG.id,
  name: CHAIN_CONFIG.name,
  nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: [RPC_URL] } },
  contracts: {
    multicall3: {
      address: "0xcA11bde05977b3631167028862bE2a173976CA11" as `0x${string}`,
      blockCreated: 0,
    },
  },
} as const;

/** Resilient public client with timeout + fallback RPC + multicall3 */
export const rpcClient = createPublicClient({
  chain,
  transport: fallback(
    [
      http(RPC_URL, { retryCount: 2, retryDelay: 500, timeout: TIMEOUT_MS }),
      http(FALLBACK_RPC, { retryCount: 1, retryDelay: 1000, timeout: TIMEOUT_MS }),
    ],
    { rank: false },
  ),
});

export { chain as rpcChain };
