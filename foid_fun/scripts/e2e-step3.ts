import dotenv from "dotenv";
import {
  createPublicClient,
  createWalletClient,
  decodeEventLog,
  defineChain,
  http,
  toHex,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import boardAbi from "../src/abi/LoreboardBoardV2.json" assert { type: "json" };
import votingAbi from "../src/abi/loreboardVoting.json" assert { type: "json" };
import treasuryAbi from "../src/abi/LoreBoardTreasury.json" assert { type: "json" };
import { rectCells } from "../src/lib/grid";
import { ipfsToHttp } from "../src/lib/ipfsUrl";
import { CANONICAL_ADDRESSES, CANONICAL_CHAIN, requireCanonicalAddress } from "../src/config/canonical";
import { normalizePk, requireEnv, resolveFirst, resolveRpcUrl } from "./lib/env";

type Address = `0x${string}`;

dotenv.config({ path: process.env.DOTENV_CONFIG_PATH || ".env.local" });
dotenv.config();

const rpc = resolveRpcUrl(process.env);
const treasuryAddress = resolveFirst(process.env, [
  "NEXT_PUBLIC_LOREBOARD_ADDRESS",
  "TREASURY_ADDRESS",
]) as Address | undefined;
const boardAddress = resolveFirst(process.env, [
  "NEXT_PUBLIC_LOREBOARD_BOARD_ADDRESS",
  "LOREBOARD_BOARD_ADDRESS",
]) as Address | undefined;
const votingAddress = resolveFirst(process.env, [
  "NEXT_PUBLIC_LOREBOARD_VOTING_ADDRESS",
  "LOREBOARD_VOTING_ADDRESS",
]) as Address | undefined;
const manifestStoreAddress = resolveFirst(process.env, [
  "NEXT_PUBLIC_LOREBOARD_MANIFEST_STORE_ADDRESS",
  "NEXT_PUBLIC_LOREBOARD_ANCHOR",
  "NEXT_PUBLIC_MANIFEST_STORE",
  "NEXT_PUBLIC_MANIFEST_STORE_ADDRESS",
]) as Address | undefined;

const proposerPk =
  process.env.E2E_PROPOSER_PK || process.env.VOTER1_PK || process.env.OPERATOR_PK || "";
const voterPks = [
  process.env.VOTER1_PK,
  process.env.VOTER2_PK,
  process.env.VOTER3_PK,
].filter(Boolean) as string[];
const operatorPk = process.env.OPERATOR_PK || "";
const allowFinalize = process.env.E2E_ALLOW_FINALIZE === "1";

const rectWidth = Number(process.env.E2E_RECT_W ?? 1);
const rectHeight = Number(process.env.E2E_RECT_H ?? 1);
const rectPad = Number(process.env.E2E_RECT_PAD ?? 1);

const chain = defineChain({
  id: CANONICAL_CHAIN.id,
  name: CANONICAL_CHAIN.chainName,
  nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: [rpc || ""] } },
});

function nowUnix(): number {
  return Math.floor(Date.now() / 1000);
}

function normalizeCid(cid: string): string {
  if (cid.startsWith("ipfs://")) return cid;
  return `ipfs://${cid}`;
}

async function loadLatestPlacements(
  publicClient: ReturnType<typeof createPublicClient>,
  manifestStore?: Address
) {
  if (!manifestStore) return { cid: "", placements: [] as any[] };
  const latest = (await publicClient.readContract({
    address: manifestStore,
    abi: [
      {
        type: "function",
        name: "latest",
        stateMutability: "view",
        inputs: [],
        outputs: [
          { name: "", type: "uint256" },
          { name: "", type: "bytes32" },
          { name: "", type: "string" },
        ],
      },
    ],
    functionName: "latest",
    args: [],
  })) as readonly [bigint, Hex, string];

  const cid = String(latest[2] || "");
  if (!cid) return { cid: "", placements: [] as any[] };

  const urls = ipfsToHttp(cid);
  for (const url of urls) {
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) continue;
      const json = await res.json();
      const placements = Array.isArray(json?.placements) ? json.placements : [];
      return { cid, placements };
    } catch {
      continue;
    }
  }
  return { cid, placements: [] as any[] };
}

async function waitTx(
  publicClient: ReturnType<typeof createPublicClient>,
  hash: Hex,
  label: string
) {
  console.log(`${label} tx:`, hash);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  console.log(`${label} status:`, receipt.status);
  return receipt;
}

async function main() {
  requireEnv(
    "NEXT_PUBLIC_FLUENT_RPC/FLUENT_RPC_URL/NEXT_PUBLIC_RPC_URL/RPC_URL",
    rpc
  );
  const treasury = requireCanonicalAddress({
    label: "LOREBOARD_ADDRESS",
    envValue: treasuryAddress,
    expected: CANONICAL_ADDRESSES.treasury,
    envHint: "NEXT_PUBLIC_LOREBOARD_ADDRESS or TREASURY_ADDRESS",
  });
  const board = requireCanonicalAddress({
    label: "LOREBOARD_BOARD_ADDRESS",
    envValue: boardAddress,
    expected: CANONICAL_ADDRESSES.board,
    envHint: "NEXT_PUBLIC_LOREBOARD_BOARD_ADDRESS or LOREBOARD_BOARD_ADDRESS",
  });
  const voting = requireCanonicalAddress({
    label: "LOREBOARD_VOTING_ADDRESS",
    envValue: votingAddress,
    expected: CANONICAL_ADDRESSES.voting,
    envHint: "NEXT_PUBLIC_LOREBOARD_VOTING_ADDRESS or LOREBOARD_VOTING_ADDRESS",
  });
  const manifestStore = manifestStoreAddress
    ? requireCanonicalAddress({
        label: "LOREBOARD_MANIFEST_STORE_ADDRESS",
        envValue: manifestStoreAddress,
        expected: CANONICAL_ADDRESSES.manifestStore,
        envHint:
          "NEXT_PUBLIC_LOREBOARD_MANIFEST_STORE_ADDRESS or NEXT_PUBLIC_LOREBOARD_ANCHOR",
      })
    : undefined;
  requireEnv("E2E_PROPOSER_PK or VOTER1_PK or OPERATOR_PK", proposerPk);
  if (voterPks.length < 3) {
    throw new Error("Set VOTER1_PK, VOTER2_PK, VOTER3_PK");
  }
  if (allowFinalize) {
    requireEnv("OPERATOR_PK (for finalize)", operatorPk);
  }

  const proposerAccount = privateKeyToAccount(normalizePk(proposerPk));
  const voterAccounts = voterPks.map((pk) => privateKeyToAccount(normalizePk(pk)));
  const operatorAccount =
    allowFinalize && operatorPk ? privateKeyToAccount(normalizePk(operatorPk)) : null;

  const publicClient = createPublicClient({
    chain,
    transport: http(rpc),
  });

  const proposerWallet = createWalletClient({
    chain,
    transport: http(rpc),
    account: proposerAccount,
  });

  const voterWallets = voterAccounts.map((account) =>
    createWalletClient({
      chain,
      transport: http(rpc),
      account,
    })
  );

  const operatorWallet = operatorAccount
    ? createWalletClient({
        chain,
        transport: http(rpc),
        account: operatorAccount,
      })
    : null;

  const { cid: latestManifestCid, placements } = await loadLatestPlacements(
    publicClient,
    manifestStore
  );
  const maxX =
    placements.length === 0
      ? 0
      : placements.reduce((acc: number, pl: any) => {
          const r = pl?.rect;
          if (!r) return acc;
          const x = Number(r.x ?? 0);
          const w = Number(r.w ?? 0);
          return Math.max(acc, x + w);
        }, 0);

  const rect = {
    x: maxX + rectPad,
    y: 0,
    w: rectWidth,
    h: rectHeight,
  };
  const cells = rectCells(rect);
  console.log(
    "latest manifest:",
    latestManifestCid || "none",
    "maxX:",
    maxX,
    "rect:",
    rect
  );

  const cid =
    process.env.E2E_CID ||
    "bafkreihrgiy5b5sxw3i2d4zh7xazq2owntv5ygpwvpcawhxgldx6o5xq2u";
  const cidString = normalizeCid(cid);
  const cidBytes = new TextEncoder().encode(cidString);

  const baseFee = (await publicClient.readContract({
    address: treasury,
    abi: treasuryAbi as any,
    functionName: "baseFeePerCellWei",
    args: [],
  })) as bigint;

  const bidPerCellWei = process.env.E2E_BID_PER_CELL_WEI
    ? BigInt(process.env.E2E_BID_PER_CELL_WEI)
    : baseFee + 1n;
  const value = bidPerCellWei * BigInt(cells);

  console.log("== E2E Step 3 (BoardV2/VotingV2) ==");
  console.log("proposer:", proposerAccount.address);
  console.log("cid:", cidString);
  console.log("baseFeePerCellWei:", baseFee.toString());
  console.log("bidPerCellWei:", bidPerCellWei.toString());

  console.log("\n-- proposePlacement");
  const proposeHash = await proposerWallet.writeContract({
    address: board,
    abi: boardAbi as any,
    functionName: "proposePlacement",
    args: [
      rect.x,
      rect.y,
      rect.w,
      rect.h,
      bidPerCellWei,
      toHex(cidBytes),
    ],
    value,
  });
  const receipt = await waitTx(publicClient, proposeHash, "propose");
  const proposeLog = receipt.logs.find(
    (log) => log.address.toLowerCase() === board.toLowerCase()
  );
  if (!proposeLog) throw new Error("PlacementProposed event not found");

  const decoded = decodeEventLog({
    abi: boardAbi as any,
    data: proposeLog.data,
    topics: proposeLog.topics,
    eventName: "PlacementProposed",
  }) as any;

  const placementId = decoded?.args?.id as Hex | undefined;
  const eventEpoch = decoded?.args?.epoch as number | undefined;
  if (!placementId) throw new Error("PlacementProposed missing id");

  console.log("placementId:", placementId);
  console.log("event epoch:", eventEpoch ?? "unknown");

  const meta = (await publicClient.readContract({
    address: voting,
    abi: votingAbi as any,
    functionName: "getPlacementMeta",
    args: [placementId],
  })) as readonly [bigint, bigint, number, boolean];
  const voteEndsAt = Number(meta[1]);
  const epochId = meta[2];
  const exists = meta[3];
  if (!exists) throw new Error("Voting placement not registered");

  console.log("voteEndsAt:", voteEndsAt);
  console.log("epochId:", epochId);

  console.log("\n-- voteOnPlacement (3 voters)");
  for (let i = 0; i < voterWallets.length; i += 1) {
    const voter = voterWallets[i];
    const [yesBefore, noBefore] = (await publicClient.readContract({
      address: voting,
      abi: votingAbi as any,
      functionName: "getPlacementVotes",
      args: [BigInt(epochId), placementId],
    })) as readonly [bigint, bigint];

    try {
      const voteHash = await voter.writeContract({
        address: voting,
        abi: votingAbi as any,
        functionName: "voteOnPlacement",
        args: [placementId, true],
      });
      await waitTx(publicClient, voteHash, `vote#${i + 1}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.log(`vote#${i + 1} failed:`, message.split("\n")[0]);
    }

    const [yesVotes, noVotes] = (await publicClient.readContract({
      address: voting,
      abi: votingAbi as any,
      functionName: "getPlacementVotes",
      args: [BigInt(epochId), placementId],
    })) as readonly [bigint, bigint];

    console.log(
      `voter ${i + 1}: yes=${yesVotes.toString()} no=${noVotes.toString()} (was ${yesBefore.toString()}/${noBefore.toString()})`
    );
  }

  const [yesVotes, noVotes] = (await publicClient.readContract({
    address: voting,
    abi: votingAbi as any,
    functionName: "getPlacementVotes",
    args: [BigInt(epochId), placementId],
  })) as readonly [bigint, bigint];

  const meetsQuorum = (await publicClient.readContract({
    address: voting,
    abi: votingAbi as any,
    functionName: "meetsQuorum",
    args: [BigInt(epochId), placementId],
  })) as boolean;

  const passesMajority = (await publicClient.readContract({
    address: voting,
    abi: votingAbi as any,
    functionName: "passesMajority51",
    args: [BigInt(epochId), placementId],
  })) as boolean;

  console.log("\n-- voting status");
  console.log("votes yes/no:", yesVotes.toString(), "/", noVotes.toString());
  console.log("meetsQuorum:", meetsQuorum);
  console.log("passesMajority51:", passesMajority);

  if (yesVotes <= 0n) {
    throw new Error("Unexpected vote counts");
  }

  if (allowFinalize) {
    console.log("\n-- finalize epoch (via BoardV2)");
    const nowSec = nowUnix();
    if (nowSec <= voteEndsAt) {
      console.log(
        `skip finalize: vote window active (now=${nowSec} <= voteEndsAt=${voteEndsAt})`
      );
    } else {
      const epochState = (await publicClient.readContract({
        address: voting,
        abi: votingAbi as any,
        functionName: "epochs",
        args: [BigInt(epochId)],
      })) as boolean;
      if (epochState) {
        console.log("epoch already finalized");
      } else if (!operatorWallet) {
        throw new Error("Missing OPERATOR_PK for finalize");
      } else {
        const finalizeHash = await operatorWallet.writeContract({
          address: board,
          abi: boardAbi as any,
          functionName: "finalizeEpochInVoting",
          args: [BigInt(epochId)],
        });
        await waitTx(publicClient, finalizeHash, "finalizeEpochInVoting");
      }
    }
  }

  console.log("\nOK: E2E step 3 complete");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
