// cron-agent-finalize.ts — Automated epoch finalization for the agent board.
// Scans the last 6 agent epochs (6 hours at 1-hour epochs) and finalizes any
// with closed voting windows.
// Safe to run repeatedly — already-finalized epochs are skipped.
// Usage: npx tsx scripts/cron-agent-finalize.ts
// Recommended cron: every 15 minutes

import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import {
  createPublicClient,
  createWalletClient,
  defineChain,
  http,
  type Address,
  type Chain,
  type Hex,
  type PublicClient,
  type Transport,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { readContractSafe } from "./lib/contract";
import {
  fetchAgentProposalsForEpoch,
  finalizeAgentEpochIfReady,
} from "./lib/agentFinalize";
import { CANONICAL_CHAIN } from "../src/config/canonical";

dotenv.config();
dotenv.config({ path: ".env.local", override: true });

// ---------------------------------------------------------------------------
// Agent board config — hardcoded defaults with env overrides
// ---------------------------------------------------------------------------

const AGENT_BOARD = (process.env.AGENT_BOARD_ADDRESS ||
  "0x9453637a2E74Bd78ce90D3686bfD98b61c231029") as Address;
const AGENT_VOTING = (process.env.AGENT_VOTING_ADDRESS ||
  "0xd9B5BED4dF4d794cEf6884C980Ded3Ea66371A18") as Address;
const AGENT_TREASURY = (process.env.AGENT_TREASURY_ADDRESS ||
  "0x1122ccf94633991EAb4e88A801fe77ED937c7Eb2") as Address;
const AGENT_MANIFEST_STORE = (process.env.AGENT_MANIFEST_ADDRESS ||
  "0x14e79940117f82207413F2c44e507b6377895560") as Address;

const AGENT_EPOCH_ZERO = Number(process.env.AGENT_EPOCH_ZERO || "1770791951");
const AGENT_EPOCH_LENGTH = Number(process.env.AGENT_EPOCH_LENGTH || "3600");

const EPOCH_LOOKBACK = 6; // scan 6 epochs back (6 hours)

const ZERO_BYTES32 =
  "0x0000000000000000000000000000000000000000000000000000000000000000";

const treasuryAbiMinimal = [
  {
    type: "function",
    name: "manifestRootOf",
    stateMutability: "view",
    inputs: [{ name: "epochId", type: "uint256" }],
    outputs: [{ name: "", type: "bytes32" }],
  },
] as const;

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

function getAgentRelayerKey(): Hex {
  const key = process.env.AGENT_RELAYER_PRIVATE_KEY;
  if (!key) {
    throw new Error("Missing AGENT_RELAYER_PRIVATE_KEY");
  }
  return key.startsWith("0x") ? (key as Hex) : (`0x${key}` as Hex);
}

function computeCurrentEpoch(): number {
  const nowSec = Math.floor(Date.now() / 1000);
  const elapsed = Math.max(0, nowSec - AGENT_EPOCH_ZERO);
  return Math.floor(elapsed / AGENT_EPOCH_LENGTH);
}

async function getFromBlock(
  publicClient: PublicClient<Transport, Chain>
): Promise<bigint> {
  const deployBlock = process.env.AGENT_BOARD_DEPLOY_BLOCK;
  if (deployBlock) return BigInt(deployBlock);
  const latest = await publicClient.getBlockNumber();
  const lookback = BigInt(process.env.AGENT_BOARD_LOOKBACK || "200000");
  return latest > lookback ? latest - lookback : 0n;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const ts = () => new Date().toISOString();
  console.log(`\n[agent-cron] ${ts()} starting agent epoch finalization scan`);

  const rpcUrl =
    process.env.NEXT_PUBLIC_FLUENT_RPC ??
    process.env.FLUENT_RPC_URL ??
    process.env.RPC_URL ??
    process.env.NEXT_PUBLIC_RPC_URL ??
    CANONICAL_CHAIN.rpcUrl;

  const chain = defineChain({
    id: CANONICAL_CHAIN.id,
    name: CANONICAL_CHAIN.chainName,
    nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
    rpcUrls: { default: { http: [rpcUrl] } },
  });

  const transport = http(rpcUrl, { timeout: 15_000, retryCount: 2, retryDelay: 500 });
  const publicClient = createPublicClient({ chain, transport }) as PublicClient<
    Transport,
    Chain
  >;

  const account = privateKeyToAccount(getAgentRelayerKey());
  const operatorWallet = createWalletClient({ chain, transport, account });

  const currentEpoch = computeCurrentEpoch();
  const startEpoch = Math.max(0, currentEpoch - EPOCH_LOOKBACK);

  console.log(`[agent-cron] operator: ${account.address}`);
  console.log(`[agent-cron] board: ${AGENT_BOARD}`);
  console.log(`[agent-cron] voting: ${AGENT_VOTING}`);
  console.log(`[agent-cron] treasury: ${AGENT_TREASURY}`);
  console.log(`[agent-cron] manifestStore: ${AGENT_MANIFEST_STORE}`);
  console.log(
    `[agent-cron] current epoch: ${currentEpoch}, scanning ${startEpoch} to ${currentEpoch}`
  );

  const fromBlock = await getFromBlock(publicClient);
  let finalized = 0;

  for (let epochId = startEpoch; epochId <= currentEpoch; epochId++) {
    // Quick check: already finalized in treasury?
    // manifestRootOf reverts for non-finalized epochs on fresh deployments
    let manifestRoot: Hex | null = null;
    try {
      manifestRoot = (await readContractSafe({
        publicClient,
        address: AGENT_TREASURY,
        abi: treasuryAbiMinimal,
        functionName: "manifestRootOf",
        args: [epochId],
        label: `agent:manifestRootOf ${epochId}`,
      })) as Hex;
    } catch {
      // revert = not finalized, continue to check proposals
    }

    if (manifestRoot && manifestRoot !== ZERO_BYTES32) {
      continue; // already finalized
    }

    // Fetch proposals for this epoch via RPC getLogs
    const proposals = await fetchAgentProposalsForEpoch({
      publicClient,
      board: AGENT_BOARD,
      voting: AGENT_VOTING,
      epochId,
      fromBlock,
    });

    if (proposals.length === 0) continue;

    console.log(
      `[agent-cron] epoch ${epochId}: ${proposals.length} proposals found, attempting finalization`
    );

    try {
      await finalizeAgentEpochIfReady({
        publicClient,
        operatorWallet,
        treasury: AGENT_TREASURY,
        voting: AGENT_VOTING,
        board: AGENT_BOARD,
        manifestStore: AGENT_MANIFEST_STORE,
        epochId,
        proposals,
      });
      finalized++;
    } catch (err) {
      console.error(`[agent-cron] epoch ${epochId}: finalization failed:`, err);
    }
  }

  console.log(`[agent-cron] ${ts()} done. finalized ${finalized} epoch(s).`);
}

const isMain =
  process.argv[1] &&
  path.resolve(process.argv[1]) ===
    path.resolve(fileURLToPath(import.meta.url));

if (isMain) {
  main().catch((err) => {
    console.error("[agent-cron] fatal:", err);
    process.exit(1);
  });
}
