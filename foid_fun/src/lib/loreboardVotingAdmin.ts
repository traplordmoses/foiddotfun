// src/lib/loreboardVotingAdmin.ts
import { createWalletClient, createPublicClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import {
  LOREBOARD_VOTING_ADDRESS,
  loreboardVotingAbi,
} from "@/contracts/loreboardVoting";

const RPC_URL =
  process.env.FLUENT_RPC_URL ??
  process.env.FLUENT_RPC ??
  process.env.NEXT_PUBLIC_FLUENT_RPC ??
  process.env.NEXT_PUBLIC_RPC_URL;

if (!RPC_URL) {
  throw new Error("Missing Fluent RPC URL");
}

const fluentTestnet = {
  id: 20994,
  name: "Fluent Testnet",
  nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: [RPC_URL] } },
} as const;

const pk = process.env.LOREBOARD_VOTING_ADMIN_PRIVATE_KEY as `0x${string}`;
if (!pk) {
  throw new Error("Missing LOREBOARD_VOTING_ADMIN_PRIVATE_KEY");
}

const account = privateKeyToAccount(pk);

export const votingAdminClient = createWalletClient({
  account,
  chain: fluentTestnet,
  transport: http(RPC_URL),
});

export const fluentPublicClient = createPublicClient({
  chain: fluentTestnet,
  transport: http(RPC_URL),
});

export async function configureEpochOnChain(
  epochId: bigint,
  startsAt: bigint,
  endsAt: bigint
) {
  return votingAdminClient.writeContract({
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
  return votingAdminClient.writeContract({
    address: LOREBOARD_VOTING_ADDRESS,
    abi: loreboardVotingAbi,
    functionName: "registerPendingPlacement",
    args: [epochId, placementId],
  });
}

export async function finalizeEpochOnChain(epochId: bigint) {
  return votingAdminClient.writeContract({
    address: LOREBOARD_VOTING_ADDRESS,
    abi: loreboardVotingAbi,
    functionName: "setEpochFinalized",
    args: [epochId, true],
  });
}
