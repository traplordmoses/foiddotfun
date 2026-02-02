#!/usr/bin/env tsx
/**
 * Cron-friendly wrapper for automatic epoch finalization
 *
 * This script:
 * 1. Checks if there are pending epochs to finalize
 * 2. Runs operatorFinalize.ts if needed
 * 3. Logs results for monitoring
 * 4. Safe to run frequently (idempotent)
 *
 * Usage:
 *   npm run auto:finalize
 *
 * Cron example (every 6 hours):
 *   0 */6 * * * cd /path/to/foid_fun && npm run auto:finalize >> logs/finalize.log 2>&1
 */

import { spawn } from "child_process";
import { createPublicClient, http } from "viem";

const RPC_URL = process.env.NEXT_PUBLIC_FLUENT_RPC || "https://rpc.testnet.fluent.xyz";

const publicClient = createPublicClient({
  transport: http(RPC_URL),
});

async function getCurrentEpoch(): Promise<number> {
  const now = Math.floor(Date.now() / 1000);
  const epochZero = parseInt(process.env.NEXT_PUBLIC_EPOCH_ZERO_UNIX || "0");
  const epochSeconds = parseInt(process.env.NEXT_PUBLIC_EPOCH_SECONDS || "86400");

  if (!epochZero || !epochSeconds) {
    throw new Error("EPOCH_ZERO_UNIX and EPOCH_SECONDS must be set");
  }

  return Math.floor((now - epochZero) / epochSeconds);
}

async function checkPendingProposals(): Promise<boolean> {
  try {
    const response = await fetch("http://localhost:3000/api/proposals");
    if (!response.ok) {
      console.log("⚠️  API not available, will try to finalize anyway");
      return true;
    }

    const data = await response.json();
    const proposals = data.proposals || [];

    // Check for expired or proposed (not finalized) proposals
    const needsFinalization = proposals.some(
      (p: any) => p.status === "expired" || p.status === "proposed"
    );

    return needsFinalization;
  } catch (error) {
    console.log("⚠️  Could not check proposals, will try to finalize anyway");
    return true;
  }
}

async function runFinalization(): Promise<void> {
  return new Promise((resolve, reject) => {
    console.log("🚀 Running operatorFinalize.ts...\n");

    const child = spawn("npx", ["tsx", "scripts/operatorFinalize.ts"], {
      stdio: "inherit",
      env: {
        ...process.env,
        SKIP_FINALIZE: "0", // Ensure finalization is enabled
      },
    });

    child.on("exit", (code) => {
      if (code === 0) {
        console.log("\n✅ Finalization completed successfully");
        resolve();
      } else {
        console.error(`\n❌ Finalization failed with code ${code}`);
        reject(new Error(`Exit code ${code}`));
      }
    });

    child.on("error", (error) => {
      console.error("\n❌ Failed to spawn process:", error);
      reject(error);
    });
  });
}

async function main() {
  const timestamp = new Date().toISOString();
  console.log("=".repeat(80));
  console.log(`🤖 Auto-Finalize Check - ${timestamp}`);
  console.log("=".repeat(80));
  console.log();

  try {
    const currentEpoch = await getCurrentEpoch();
    console.log(`📊 Current Epoch: ${currentEpoch}`);
    console.log();

    const hasPending = await checkPendingProposals();

    if (!hasPending) {
      console.log("✅ No pending proposals found - nothing to finalize");
      console.log("ℹ️  Skipping finalization to save gas");
      return;
    }

    console.log("📝 Found proposals that need finalization");
    console.log();

    await runFinalization();

    console.log();
    console.log("=".repeat(80));
    console.log("✅ Auto-finalization cycle complete");
    console.log("=".repeat(80));

  } catch (error: any) {
    console.error("\n❌ Auto-finalization failed:", error.message);
    console.error();
    console.error("=".repeat(80));
    console.error("❌ Auto-finalization cycle failed");
    console.error("=".repeat(80));
    process.exit(1);
  }
}

main();
