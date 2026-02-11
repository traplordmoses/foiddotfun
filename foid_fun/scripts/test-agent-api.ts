/**
 * End-to-end test for the agent API pipeline:
 *   propose → vote → (finalization cron picks it up)
 *
 * Usage: npx tsx scripts/test-agent-api.ts
 */

import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import * as dotenv from "dotenv";
import { resolve } from "path";

dotenv.config({ path: resolve(__dirname, "../.env.local") });

const BASE = process.env.AGENT_API_BASE ?? "http://localhost:3000";
const RELAYER_PK = process.env.AGENT_RELAYER_PRIVATE_KEY;

if (!RELAYER_PK) {
  console.error("AGENT_RELAYER_PRIVATE_KEY not found in .env.local");
  process.exit(1);
}

const IMAGE_CID = "QmdhtNyse97NncSyoxa1hRfeHpa3M5CfyWY8YTuR8KiLrq";
const X = 128;
const Y = 128;
const W = 64;
const H = 64;

async function main() {
  // ── Step 1: Generate a fresh wallet ──
  const pk = generatePrivateKey();
  const proposer = privateKeyToAccount(pk);
  console.log("\n=== AGENT API E2E TEST ===\n");
  console.log("Proposer wallet:", proposer.address);

  // ── Step 2: Submit a proposal ──
  const proposeTs = Math.floor(Date.now() / 1000);
  const proposePayload = `${IMAGE_CID}:${X}:${Y}:${W}:${H}`;
  const proposeMsg = `foid:propose:${proposeTs}:${proposePayload}`;

  console.log("\nSigning propose message:", proposeMsg);
  const proposeSig = await proposer.signMessage({ message: proposeMsg });

  console.log("POSTing to /api/agent/propose ...");
  const proposeRes = await fetch(`${BASE}/api/agent/propose`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      wallet: proposer.address,
      imageCid: IMAGE_CID,
      x: X,
      y: Y,
      width: W,
      height: H,
      signature: proposeSig,
      timestamp: proposeTs,
    }),
  });

  const proposeJson = await proposeRes.json();
  console.log("\nPropose response:", JSON.stringify(proposeJson, null, 2));

  if (!proposeJson.success) {
    console.error("Proposal failed, aborting.");
    process.exit(1);
  }

  const proposalId: string = proposeJson.data.proposalId;
  console.log("\nProposal ID:", proposalId);

  // ── Step 3: Check the board ──
  console.log("\nGETting /api/agent/board ...");
  const boardRes = await fetch(`${BASE}/api/agent/board`);
  const boardJson = await boardRes.json();
  console.log("\nBoard response:", JSON.stringify(boardJson, null, 2));

  if (boardJson.success && boardJson.data?.proposals) {
    const found = boardJson.data.proposals.find(
      (p: { id: string }) => p.id.toLowerCase() === proposalId.toLowerCase()
    );
    console.log(
      found
        ? `\nProposal ${proposalId.slice(0, 10)}... found on board!`
        : `\nProposal NOT found on board (may need indexing time).`
    );
  }

  // ── Step 4: Vote on the proposal with the relayer wallet ──
  const relayer = privateKeyToAccount(RELAYER_PK as `0x${string}`);
  console.log("\nRelayer wallet:", relayer.address);

  const voteTs = Math.floor(Date.now() / 1000);
  const votePayload = `${proposalId}:true`;
  const voteMsg = `foid:vote:${voteTs}:${votePayload}`;

  console.log("Signing vote message:", voteMsg);
  const voteSig = await relayer.signMessage({ message: voteMsg });

  console.log("POSTing to /api/agent/vote ...");
  const voteRes = await fetch(`${BASE}/api/agent/vote`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      wallet: relayer.address,
      proposalId,
      support: true,
      signature: voteSig,
      timestamp: voteTs,
    }),
  });

  const voteJson = await voteRes.json();
  console.log("\nVote response:", JSON.stringify(voteJson, null, 2));

  // ── Done ──
  console.log("\n=== TEST COMPLETE ===");
  console.log("Pipeline: propose → vote done.");
  console.log("Next: finalization cron picks this up → manifest → /board/agents renders it.\n");
}

main().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
