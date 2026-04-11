#!/usr/bin/env tsx
/**
 * Sync LoreboardLiveNFT to latest finalized epoch
 * Anyone can call this - it's permissionless!
 */

import { createPublicClient, createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { LOREBOARD_LIVE_NFT_ABI } from "@/lib/contracts/abis";
import { CANONICAL_ADDRESSES } from "@/config/canonical";

const RPC_URL = process.env.NEXT_PUBLIC_FLUENT_RPC || "https://rpc.testnet.fluent.xyz";
const OPERATOR_PK = process.env.OPERATOR_PK;

if (!OPERATOR_PK) {
  console.error("❌ OPERATOR_PK not set in environment");
  process.exit(1);
}

const account = privateKeyToAccount(OPERATOR_PK as `0x${string}`);

const publicClient = createPublicClient({
  transport: http(RPC_URL),
});

const walletClient = createWalletClient({
  account,
  transport: http(RPC_URL),
});

async function syncNFT() {
  console.log("🔄 Syncing LoreboardLiveNFT to latest epoch...");
  console.log("NFT Address:", CANONICAL_ADDRESSES.loreboardLiveNFT);
  console.log("Caller:", account.address);

  try {
    // Read current state
    const [currentEpoch, currentCID] = await Promise.all([
      publicClient.readContract({
        address: CANONICAL_ADDRESSES.loreboardLiveNFT as `0x${string}`,
        abi: LOREBOARD_LIVE_NFT_ABI,
        functionName: "liveEpoch",
      }),
      publicClient.readContract({
        address: CANONICAL_ADDRESSES.loreboardLiveNFT as `0x${string}`,
        abi: LOREBOARD_LIVE_NFT_ABI,
        functionName: "liveManifestCID",
      }),
    ]);

    console.log("\n📊 Current NFT state:");
    console.log("  Epoch:", currentEpoch.toString());
    console.log("  Manifest CID:", currentCID || "(empty)");

    // Call syncLatest
    console.log("\n🚀 Calling syncLatest()...");

    const hash = await walletClient.writeContract({
      address: CANONICAL_ADDRESSES.loreboardLiveNFT as `0x${string}`,
      abi: LOREBOARD_LIVE_NFT_ABI,
      functionName: "syncLatest",
      chain: {
        id: 20994,
        name: "Fluent Testnet",
        nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
        rpcUrls: {
          default: { http: [RPC_URL] },
          public: { http: [RPC_URL] },
        },
      },
    });

    console.log("✅ Transaction sent:", hash);
    console.log("⏳ Waiting for confirmation...");

    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    console.log("✅ Transaction confirmed! Block:", receipt.blockNumber);

    // Read updated state
    const [newEpoch, newCID] = await Promise.all([
      publicClient.readContract({
        address: CANONICAL_ADDRESSES.loreboardLiveNFT as `0x${string}`,
        abi: LOREBOARD_LIVE_NFT_ABI,
        functionName: "liveEpoch",
      }),
      publicClient.readContract({
        address: CANONICAL_ADDRESSES.loreboardLiveNFT as `0x${string}`,
        abi: LOREBOARD_LIVE_NFT_ABI,
        functionName: "liveManifestCID",
      }),
    ]);

    console.log("\n🎉 Updated NFT state:");
    console.log("  Epoch:", newEpoch.toString());
    console.log("  Manifest CID:", newCID);

    if (newEpoch > currentEpoch) {
      console.log("\n✅ NFT successfully synced from epoch", currentEpoch.toString(), "to", newEpoch.toString());
    } else {
      console.log("\nℹ️  NFT was already up to date");
    }

  } catch (error: any) {
    console.error("\n❌ Error syncing NFT:", error.message);

    if (error.message.includes("EpochNotFinalized")) {
      console.log("ℹ️  The latest epoch in ManifestStore hasn't been finalized in Treasury yet");
    } else if (error.message.includes("RootMismatch")) {
      console.log("⚠️  Manifest root mismatch between Treasury and ManifestStore");
    }

    process.exit(1);
  }
}

syncNFT();
