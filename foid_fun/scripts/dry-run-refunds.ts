#!/usr/bin/env tsx
/**
 * DRY RUN - Check what refunds would be recovered (no transactions)
 */

import { createPublicClient, http } from "viem";
import { CONTRACTS } from "@/lib/contracts/addresses";

const RPC_URL = process.env.NEXT_PUBLIC_FLUENT_RPC || "https://rpc.testnet.fluent.xyz";

const publicClient = createPublicClient({
  transport: http(RPC_URL),
});

const ESCROW_ABI = [
  {
    name: "escrow",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "id", type: "bytes32" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "rejected",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "id", type: "bytes32" }],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    name: "bidderOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "id", type: "bytes32" }],
    outputs: [{ name: "", type: "address" }],
  },
] as const;

async function dryRunRefunds() {
  console.log("🔍 DRY RUN - Checking for stuck refunds...\n");
  console.log("Treasury:", CONTRACTS.LOREBOARD_TREASURY);
  console.log();

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

  console.log(`Found ${stuckProposals.length} potentially stuck proposals\n`);

  // Group by epoch
  const byEpoch: Record<number, any[]> = {};
  for (const p of stuckProposals) {
    const epoch = p.epoch || p.epochSubmitted || 0;
    if (!byEpoch[epoch]) byEpoch[epoch] = [];
    byEpoch[epoch].push(p);
  }

  console.log(`Grouped into ${Object.keys(byEpoch).length} epochs\n`);
  console.log("─".repeat(80));

  let grandTotalEscrow = 0n;
  let grandTotalCount = 0;
  const affectedUsers = new Set<string>();

  for (const [epochStr, props] of Object.entries(byEpoch)) {
    const epoch = parseInt(epochStr);
    console.log(`\n📊 EPOCH ${epoch}`);
    console.log("─".repeat(80));

    const rejectedIds: string[] = [];
    let epochTotalEscrow = 0n;
    const epochUsers = new Set<string>();

    for (const p of props) {
      const id = p.placementId || p.id;
      if (!id) continue;

      try {
        const [escrowAmt, isRejected, bidder] = await Promise.all([
          publicClient.readContract({
            address: CONTRACTS.LOREBOARD_TREASURY as `0x${string}`,
            abi: ESCROW_ABI,
            functionName: "escrow",
            args: [id as `0x${string}`],
          }),
          publicClient.readContract({
            address: CONTRACTS.LOREBOARD_TREASURY as `0x${string}`,
            abi: ESCROW_ABI,
            functionName: "rejected",
            args: [id as `0x${string}`],
          }),
          publicClient.readContract({
            address: CONTRACTS.LOREBOARD_TREASURY as `0x${string}`,
            abi: ESCROW_ABI,
            functionName: "bidderOf",
            args: [id as `0x${string}`],
          }),
        ]);

        if (escrowAmt > 0n && !isRejected) {
          rejectedIds.push(id);
          epochTotalEscrow += escrowAmt;
          const ethAmt = Number(escrowAmt) / 1e18;
          epochUsers.add(bidder.toLowerCase());
          affectedUsers.add(bidder.toLowerCase());
          console.log(`  ✓ ${id.slice(0, 12)}...`);
          console.log(`    Escrow: ${ethAmt.toFixed(8)} ETH`);
          console.log(`    Bidder: ${bidder}`);
          console.log(`    Status: STUCK (rejected=false, escrow>0)`);
        } else if (escrowAmt > 0n && isRejected) {
          console.log(`  ℹ️  ${id.slice(0, 12)}... - Already marked rejected`);
        } else if (escrowAmt === 0n) {
          console.log(`  ✓ ${id.slice(0, 12)}... - Already refunded (escrow=0)`);
        }
      } catch (error: any) {
        console.log(`  ⚠️  ${id.slice(0, 12)}... - Error: ${error.message}`);
      }
    }

    if (rejectedIds.length > 0) {
      const epochTotalEth = Number(epochTotalEscrow) / 1e18;
      console.log(`\n  💰 Stuck in Epoch ${epoch}:`);
      console.log(`     ${rejectedIds.length} proposals`);
      console.log(`     ${epochTotalEth.toFixed(8)} ETH`);
      console.log(`     ${epochUsers.size} affected users`);

      grandTotalEscrow += epochTotalEscrow;
      grandTotalCount += rejectedIds.length;
    } else {
      console.log(`\n  ✅ No stuck escrow in epoch ${epoch}`);
    }
  }

  console.log("\n" + "=".repeat(80));
  console.log("📊 SUMMARY");
  console.log("=".repeat(80));

  const grandTotalEth = Number(grandTotalEscrow) / 1e18;

  console.log(`\n💰 Total Stuck: ${grandTotalEth.toFixed(8)} ETH`);
  console.log(`📝 Proposals: ${grandTotalCount}`);
  console.log(`👥 Affected Users: ${affectedUsers.size}`);

  console.log("\nAffected addresses:");
  for (const user of affectedUsers) {
    console.log(`  - ${user}`);
  }

  if (grandTotalCount > 0) {
    console.log("\n" + "=".repeat(80));
    console.log("🚀 TO RECOVER THESE FUNDS:");
    console.log("=".repeat(80));
    console.log("\nRun: npm run recover:refunds");
    console.log("\nThis will call Treasury.finalizeEpoch() for each stuck epoch,");
    console.log("which will trigger refunds (push to wallet or credit to claimable).");
    console.log("\nAfter running, check your dashboard to see claimable refunds!");
  } else {
    console.log("\n✅ All good! No stuck refunds found.");
  }
}

dryRunRefunds().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
