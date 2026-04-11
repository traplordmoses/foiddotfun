#!/usr/bin/env tsx
/**
 * Recovery script to finalize stuck epochs and release refunds
 *
 * This script:
 * 1. Finds all "expired" proposals that never got finalized
 * 2. Groups them by epoch
 * 3. Calls Treasury.finalizeEpoch() with rejectedIds to trigger refunds
 */

import { createPublicClient, createWalletClient, http, parseEther } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { LOREBOARD_TREASURY_ABI } from "@/lib/contracts/abis";
import { CONTRACTS } from "@/lib/contracts/addresses";
import { CANONICAL_CHAIN } from "../src/config/canonical";

const RPC_URL = process.env.NEXT_PUBLIC_FLUENT_RPC || CANONICAL_CHAIN.rpcUrl;
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

const FINALIZE_ABI = [
  {
    type: "function",
    name: "finalizeEpoch",
    stateMutability: "nonpayable",
    inputs: [
      { name: "epoch", type: "uint32" },
      { name: "manifestRoot", type: "bytes32" },
      { name: "manifestCID", type: "string" },
      { name: "acceptedIds", type: "bytes32[]" },
      { name: "rejectedIds", type: "bytes32[]" },
    ],
    outputs: [],
  },
] as const;

async function recoverRefunds() {
  console.log("🔍 Fetching stuck proposals from API...\n");

  // Fetch proposals from API
  const response = await fetch("http://localhost:3000/api/proposals");
  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }

  const data = await response.json();
  const proposals = data.proposals || [];

  // Find expired/proposed (not finalized) proposals
  const stuckProposals = proposals.filter(
    (p: any) => p.status === "expired" || p.status === "proposed"
  );

  if (stuckProposals.length === 0) {
    console.log("✅ No stuck proposals found!");
    return;
  }

  console.log(`Found ${stuckProposals.length} stuck proposals\n`);

  // Group by epoch
  const byEpoch: Record<number, any[]> = {};
  for (const p of stuckProposals) {
    const epoch = p.epoch || p.epochSubmitted || 0;
    if (!byEpoch[epoch]) byEpoch[epoch] = [];
    byEpoch[epoch].push(p);
  }

  console.log(`Grouped into ${Object.keys(byEpoch).length} epochs\n`);

  // Check which proposals still have escrow
  const ESCROW_ABI = [
    {
      name: "escrow",
      type: "function",
      stateMutability: "view",
      inputs: [{ name: "id", type: "bytes32" }],
      outputs: [{ name: "", type: "uint256" }],
    },
  ] as const;

  for (const [epochStr, props] of Object.entries(byEpoch)) {
    const epoch = parseInt(epochStr);
    console.log(`\n📊 Epoch ${epoch} (${props.length} proposals)`);

    const rejectedIds: `0x${string}`[] = [];
    let totalEscrow = 0n;

    for (const p of props) {
      const id = p.placementId || p.id;
      if (!id) continue;

      try {
        const escrowAmt = await publicClient.readContract({
          address: CONTRACTS.LOREBOARD_TREASURY as `0x${string}`,
          abi: ESCROW_ABI,
          functionName: "escrow",
          args: [id as `0x${string}`],
        });

        if (escrowAmt > 0n) {
          rejectedIds.push(id as `0x${string}`);
          totalEscrow += escrowAmt;
          const ethAmt = Number(escrowAmt) / 1e18;
          console.log(`  ✓ ${id.slice(0, 10)}... has ${ethAmt.toFixed(6)} ETH in escrow`);
        }
      } catch (error: any) {
        console.log(`  ⚠️  Could not check ${id.slice(0, 10)}...`);
      }
    }

    if (rejectedIds.length === 0) {
      console.log(`  ℹ️  No stuck escrow found for epoch ${epoch}`);
      continue;
    }

    const totalEth = Number(totalEscrow) / 1e18;
    console.log(`\n  💰 Total stuck: ${totalEth.toFixed(6)} ETH`);
    console.log(`  🔄 Finalizing ${rejectedIds.length} rejected proposals...\n`);

    try {
      // Call finalizeEpoch with empty accepted array and rejectedIds
      const hash = await walletClient.writeContract({
        address: CONTRACTS.LOREBOARD_TREASURY as `0x${string}`,
        abi: FINALIZE_ABI,
        functionName: "finalizeEpoch",
        args: [
          epoch,
          "0x0000000000000000000000000000000000000000000000000000000000000000", // empty manifest root
          "", // empty CID
          [], // no accepted
          rejectedIds, // all rejected
        ],
        chain: {
          id: CANONICAL_CHAIN.id,
          name: CANONICAL_CHAIN.chainName,
          nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
          rpcUrls: {
            default: { http: [RPC_URL] },
            public: { http: [RPC_URL] },
          },
        },
      });

      console.log(`  ✅ Transaction sent: ${hash}`);
      console.log(`  ⏳ Waiting for confirmation...`);

      const receipt = await publicClient.waitForTransactionReceipt({ hash });

      if (receipt.status === "success") {
        console.log(`  ✅ Epoch ${epoch} finalized! Refunds triggered.`);
        console.log(`  🔗 https://testnet.fluentscan.xyz/tx/${hash}\n`);
      } else {
        console.log(`  ❌ Transaction failed for epoch ${epoch}`);
      }
    } catch (error: any) {
      console.error(`  ❌ Error finalizing epoch ${epoch}:`, error.message);
    }
  }

  console.log("\n✅ Recovery complete! Check Treasury.claimable() for refunds.");
}

recoverRefunds().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
