import { createWalletClient, createPublicClient, http, type WalletClient, type PublicClient } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { fluentTestnet } from "@/lib/viem";
import { RPC_URL } from "@/config/canonical";

let _walletClient: WalletClient | null = null;
let _publicClient: PublicClient | null = null;

function getRelayerKey(): `0x${string}` {
  const key = process.env.AGENT_RELAYER_PRIVATE_KEY;
  if (!key) throw new Error("Missing AGENT_RELAYER_PRIVATE_KEY");
  return key.startsWith("0x") ? (key as `0x${string}`) : (`0x${key}` as `0x${string}`);
}

export function getRelayerAccount() {
  return privateKeyToAccount(getRelayerKey());
}

export function getRelayerWalletClient(): WalletClient {
  if (!_walletClient) {
    const account = getRelayerAccount();
    _walletClient = createWalletClient({
      chain: fluentTestnet,
      transport: http(RPC_URL),
      account,
    });
  }
  return _walletClient;
}

export function getAgentPublicClient(): PublicClient {
  if (!_publicClient) {
    _publicClient = createPublicClient({
      chain: fluentTestnet,
      transport: http(RPC_URL),
    });
  }
  return _publicClient;
}
