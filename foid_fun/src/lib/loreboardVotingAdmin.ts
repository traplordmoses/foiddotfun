// src/lib/loreboardVotingAdmin.ts
import {
  createWalletClient,
  createPublicClient,
  defineChain,
  http,
  type WalletClient,
  type PublicClient,
  type Chain,
  type Transport,
} from "viem";
import { privateKeyToAccount, type PrivateKeyAccount } from "viem/accounts";
import {
  LOREBOARD_VOTING_ADDRESS,
  loreboardVotingAbi,
} from "@/contracts/loreboardVoting";
import { CHAIN_ID, CHAIN_NAME } from "@/config/canonical";

/* ── Lazy-init (avoids crash during Next.js build / page-data collection) ── */

type VotingWalletClient = WalletClient<Transport, Chain, PrivateKeyAccount>;
type VotingPublicClient = PublicClient<Transport, Chain>;

let _walletClient: VotingWalletClient | null = null;
let _publicClient: VotingPublicClient | null = null;

function ensureClients() {
  if (!_walletClient || !_publicClient) {
    // Server-only (called from /api/voting/bootstrap). Prefer the private
    // `FLUENT_RPC_URL`; the NEXT_PUBLIC_* vars are kept only as a
    // transitional fallback while production env is migrated.
    const rpcUrl =
      process.env.FLUENT_RPC_URL ??
      process.env.FLUENT_RPC ??
      process.env.NEXT_PUBLIC_FLUENT_RPC ??
      process.env.NEXT_PUBLIC_RPC_URL;
    if (!rpcUrl) throw new Error("Missing Fluent RPC URL");

    const pk = process.env.LOREBOARD_VOTING_ADMIN_PRIVATE_KEY as `0x${string}`;
    if (!pk) throw new Error("Missing LOREBOARD_VOTING_ADMIN_PRIVATE_KEY");

    const chain = defineChain({
      id: CHAIN_ID,
      name: CHAIN_NAME,
      nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
      rpcUrls: { default: { http: [rpcUrl] } },
    });

    const account = privateKeyToAccount(pk);
    _walletClient = createWalletClient({ account, chain, transport: http(rpcUrl) });
    _publicClient = createPublicClient({ chain, transport: http(rpcUrl) });
  }
  return { walletClient: _walletClient!, publicClient: _publicClient! };
}

/** Lazy accessor — throws at call-time (not import-time) if env vars are missing. */
export const votingAdminClient = {
  get account() { return ensureClients().walletClient.account; },
  get writeContract() { return ensureClients().walletClient.writeContract; },
} as unknown as VotingWalletClient;

export const fluentPublicClient = {
  get readContract() { return ensureClients().publicClient.readContract; },
  get waitForTransactionReceipt() { return ensureClients().publicClient.waitForTransactionReceipt; },
} as unknown as VotingPublicClient;

export async function configureEpochOnChain(
  epochId: bigint,
  startsAt: bigint,
  endsAt: bigint
) {
  const { walletClient } = ensureClients();
  return walletClient.writeContract({
    address: LOREBOARD_VOTING_ADDRESS,
    abi: loreboardVotingAbi,
    functionName: "configureEpoch",
    args: [epochId, startsAt, endsAt],
  });
}

export async function registerPendingPlacementOnChain(
  epochId: bigint,
  placementId: `0x${string}`
) {
  const { walletClient } = ensureClients();
  return walletClient.writeContract({
    address: LOREBOARD_VOTING_ADDRESS,
    abi: loreboardVotingAbi,
    functionName: "registerPendingPlacement",
    args: [epochId, placementId],
  });
}

export async function finalizeEpochOnChain(epochId: bigint) {
  const { walletClient } = ensureClients();
  return walletClient.writeContract({
    address: LOREBOARD_VOTING_ADDRESS,
    abi: loreboardVotingAbi,
    functionName: "setEpochFinalized",
    args: [epochId, true],
  });
}
