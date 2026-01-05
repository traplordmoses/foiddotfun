import dotenv from "dotenv";
import {
  createPublicClient,
  createWalletClient,
  defineChain,
  decodeEventLog,
  decodeFunctionData,
  encodePacked,
  http,
  keccak256,
  stringToHex,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import treasuryAbi from "../src/abi/LoreBoardTreasury.json";
import votingAbi from "../src/abi/loreboardVoting.json";
import { loreBoardManifestStoreAbi } from "../src/abi/loreBoardManifestStore";
import { ipfsToHttp } from "../src/lib/ipfsUrl";
import { rectCells } from "../src/lib/grid";

type Address = `0x${string}`;

dotenv.config({ path: ".env.local" });
dotenv.config();

const rpc = process.env.NEXT_PUBLIC_FLUENT_RPC;
const treasuryAddress = process.env.NEXT_PUBLIC_LOREBOARD_ADDRESS as
  | Address
  | undefined;
const votingAddress = (process.env.NEXT_PUBLIC_LOREBOARD_VOTING_ADDRESS ||
  process.env.LOREBOARD_VOTING_ADDRESS) as Address | undefined;
const manifestStoreAddress = (process.env.NEXT_PUBLIC_LOREBOARD_MANIFEST_STORE_ADDRESS ||
  process.env.NEXT_PUBLIC_LOREBOARD_ANCHOR ||
  process.env.NEXT_PUBLIC_MANIFEST_STORE ||
  process.env.NEXT_PUBLIC_MANIFEST_STORE_ADDRESS) as Address | undefined;

const proposerPk = process.env.E2E_PROPOSER_PK || process.env.VOTER1_PK || "";
const voterPks = [
  process.env.VOTER1_PK,
  process.env.VOTER2_PK,
  process.env.VOTER3_PK,
].filter(Boolean) as string[];
const votingAdminPk =
  process.env.LOREBOARD_VOTING_ADMIN_PRIVATE_KEY || process.env.OPERATOR_PK || "";
const operatorPk = process.env.OPERATOR_PK || "";

const operatorBaseUrl =
  process.env.OPERATOR_BASE_URL ||
  process.env.NEXT_PUBLIC_SITE_URL ||
  "http://localhost:3000";
const finalizeMode =
  (process.env.E2E_FINALIZE_MODE || "operator").toLowerCase();
const finalizeForce = process.env.E2E_FORCE_FINALIZE === "1";

const epochZeroUnix = Number(process.env.NEXT_PUBLIC_EPOCH_ZERO_UNIX ?? 1730937600);
const epochSeconds = Number(process.env.NEXT_PUBLIC_EPOCH_SECONDS ?? 3600);
const voteWindowEpochs = Number(process.env.NEXT_PUBLIC_VOTE_WINDOW_EPOCHS ?? 2);
const rectWidth = Number(process.env.E2E_RECT_W ?? 1);
const rectHeight = Number(process.env.E2E_RECT_H ?? 1);
const rectPad = Number(process.env.E2E_RECT_PAD ?? 1);

const chain = defineChain({
  id: 20994,
  name: "Fluent Testnet",
  nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: [rpc || ""] } },
});

function requireEnv<T>(label: string, value: T | undefined | null): T {
  if (value == null || value === "") {
    throw new Error(`Missing ${label}`);
  }
  return value as T;
}

function normalizePk(pk: string): Hex {
  return (pk.startsWith("0x") ? pk : `0x${pk}`) as Hex;
}

function nowUnix(): number {
  return Math.floor(Date.now() / 1000);
}

function currentEpoch(): number {
  const delta = Math.max(0, nowUnix() - epochZeroUnix);
  return Math.floor(delta / epochSeconds);
}

function toI32(n: number): number {
  return Number(BigInt.asIntN(32, BigInt(n)));
}

function toU32(n: number): number {
  return Number(BigInt.asUintN(32, BigInt(n)));
}

function fakeRoot(ids: Hex[]): Hex {
  const concat = (`0x${ids.map((x) => x.slice(2)).join("")}` || "0x") as Hex;
  return keccak256(concat);
}

async function loadLatestPlacements(
  publicClient: ReturnType<typeof createPublicClient>,
  manifestStore: Address
) {
  const latest = (await publicClient.readContract({
    address: manifestStore,
    abi: loreBoardManifestStoreAbi as any,
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
  requireEnv("NEXT_PUBLIC_FLUENT_RPC", rpc);
  requireEnv("NEXT_PUBLIC_LOREBOARD_ADDRESS", treasuryAddress);
  requireEnv(
    "NEXT_PUBLIC_LOREBOARD_VOTING_ADDRESS/LOREBOARD_VOTING_ADDRESS",
    votingAddress
  );
  requireEnv("NEXT_PUBLIC_LOREBOARD_MANIFEST_STORE_ADDRESS", manifestStoreAddress);
  requireEnv("E2E_PROPOSER_PK or VOTER1_PK", proposerPk);
  requireEnv(
    "LOREBOARD_VOTING_ADMIN_PRIVATE_KEY or OPERATOR_PK",
    votingAdminPk
  );
  if (voterPks.length < 3) {
    throw new Error("Set VOTER1_PK, VOTER2_PK, VOTER3_PK");
  }

  const proposerAccount = privateKeyToAccount(normalizePk(proposerPk));
  const voterAccounts = voterPks.map((pk) => privateKeyToAccount(normalizePk(pk)));
  const votingAdminAccount = privateKeyToAccount(normalizePk(votingAdminPk));
  const operatorAccount = operatorPk ? privateKeyToAccount(normalizePk(operatorPk)) : null;

  const publicClient = createPublicClient({
    chain,
    transport: http(rpc),
  });

  const proposerWallet = createWalletClient({
    chain,
    transport: http(rpc),
    account: proposerAccount,
  });

  const votingAdminWallet = createWalletClient({
    chain,
    transport: http(rpc),
    account: votingAdminAccount,
  });

  const voterWallets = voterAccounts.map((account) =>
    createWalletClient({
      chain,
      transport: http(rpc),
      account,
    })
  );

  const epoch =
    Number.isFinite(Number(process.env.E2E_EPOCH)) && process.env.E2E_EPOCH
      ? Number(process.env.E2E_EPOCH)
      : currentEpoch() + voteWindowEpochs;

  const { cid: latestManifestCid, placements } = await loadLatestPlacements(
    publicClient,
    manifestStoreAddress!
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

  const cidHashEnv = process.env.E2E_CID_HASH;
  const cidHash = cidHashEnv
    ? ((cidHashEnv.startsWith("0x") ? cidHashEnv : `0x${cidHashEnv}`) as Hex)
    : keccak256(stringToHex(cid));

  const placementId = keccak256(
    encodePacked(
      ["address", "uint32", "bytes32", "int32", "int32", "int32", "int32"],
      [
        proposerAccount.address,
        toU32(epoch),
        cidHash,
        toI32(rect.x),
        toI32(rect.y),
        toI32(rect.w),
        toI32(rect.h),
      ]
    )
  );

  console.log("== E2E Step 3 ==");
  console.log("epoch:", epoch);
  console.log("proposer:", proposerAccount.address);
  console.log("placementId:", placementId);
  console.log("cid:", cid);

  const baseFee = (await publicClient.readContract({
    address: treasuryAddress!,
    abi: treasuryAbi as any,
    functionName: "baseFeePerCellWei",
    args: [],
  })) as bigint;

  const bidPerCellWei = process.env.E2E_BID_PER_CELL_WEI
    ? BigInt(process.env.E2E_BID_PER_CELL_WEI)
    : baseFee + 1n;
  const value = bidPerCellWei * BigInt(cells);

  const startTreasuryBalance = (await publicClient.readContract({
    address: treasuryAddress!,
    abi: treasuryAbi as any,
    functionName: "treasuryBalance",
    args: [],
  })) as bigint;

  console.log("baseFeePerCellWei:", baseFee.toString());
  console.log("bidPerCellWei:", bidPerCellWei.toString());
  console.log("treasuryBalance(before):", startTreasuryBalance.toString());

  console.log("\n-- proposePlacement");
  let didPropose = false;
  const seenProposal = (await publicClient.readContract({
    address: treasuryAddress!,
    abi: treasuryAbi as any,
    functionName: "seenProposal",
    args: [placementId],
  })) as boolean;

  if (seenProposal) {
    console.log("proposal already seen; skipping proposePlacement");
  } else {
    const proposeHash = await proposerWallet.writeContract({
      address: treasuryAddress!,
      abi: treasuryAbi as any,
      functionName: "proposePlacement",
      args: [
        {
          id: placementId,
          bidder: proposerAccount.address,
          rect: {
            x: toI32(rect.x),
            y: toI32(rect.y),
            w: toI32(rect.w),
            h: toI32(rect.h),
          },
          cells: toU32(cells),
          bidPerCellWei,
          cidHash,
          epoch: toU32(epoch),
        },
      ],
      value,
    });
    const receipt = await waitTx(publicClient, proposeHash, "propose");
    const proposedEventAbi = (treasuryAbi as any[]).find(
      (entry) => entry.type === "event" && entry.name === "ProposedEvt"
    );
    if (!proposedEventAbi) {
      throw new Error("Missing ProposedEvt in treasury ABI");
    }
    const proposedLog = receipt.logs.find(
      (log) => log.address.toLowerCase() === treasuryAddress!.toLowerCase()
    );
    if (proposedLog) {
      const decoded = decodeEventLog({
        abi: [proposedEventAbi],
        data: proposedLog.data,
        topics: proposedLog.topics,
      }) as any;
      const emittedId = decoded?.args?.id as Hex | undefined;
      if (!emittedId) {
        throw new Error("ProposedEvt missing id");
      }
      if (emittedId.toLowerCase() !== placementId.toLowerCase()) {
        throw new Error(
          `ID mismatch: emitted ${emittedId} vs expected ${placementId}`
        );
      }
    }
    didPropose = true;
  }

  console.log("\n-- configureEpoch (if needed)");
  const [startsAt, endsAt, finalized] = (await publicClient.readContract({
    address: votingAddress!,
    abi: votingAbi as any,
    functionName: "getEpochConfig",
    args: [BigInt(epoch)],
  })) as readonly [bigint, bigint, boolean];

  if (startsAt === 0n && endsAt === 0n && !finalized) {
    const now = BigInt(nowUnix());
    const start = now - 60n;
    const end = now + 3n * 24n * 60n * 60n;
    const cfgHash = await votingAdminWallet.writeContract({
      address: votingAddress!,
      abi: votingAbi as any,
      functionName: "configureEpoch",
      args: [BigInt(epoch), start, end],
    });
    await waitTx(publicClient, cfgHash, "configureEpoch");
  } else {
    console.log("epoch already configured");
  }

  console.log("\n-- registerPendingPlacement");
  const seenAfter = (await publicClient.readContract({
    address: treasuryAddress!,
    abi: treasuryAbi as any,
    functionName: "seenProposal",
    args: [placementId],
  })) as boolean;
  const escrow = (await publicClient.readContract({
    address: treasuryAddress!,
    abi: treasuryAbi as any,
    functionName: "escrow",
    args: [placementId],
  })) as bigint;
  console.log("seenProposal:", seenAfter, "escrow:", escrow.toString());
  if (!seenAfter || escrow === 0n) {
    throw new Error("Proposal not escrowed; ID mismatch likely");
  }

  const alreadyPending = (await publicClient.readContract({
    address: votingAddress!,
    abi: votingAbi as any,
    functionName: "isPendingPlacement",
    args: [BigInt(epoch), placementId],
  })) as boolean;

  if (alreadyPending) {
    console.log("already pending; skipping registerPendingPlacement");
  } else {
    const registerHash = await votingAdminWallet.writeContract({
      address: votingAddress!,
      abi: votingAbi as any,
      functionName: "registerPendingPlacement",
      args: [BigInt(epoch), placementId],
    });
    await waitTx(publicClient, registerHash, "registerPending");
  }

  console.log("\n-- voteOnPlacement (3 voters)");
  for (let i = 0; i < voterWallets.length; i += 1) {
    const voter = voterWallets[i];
    const [yesBefore, noBefore] = (await publicClient.readContract({
      address: votingAddress!,
      abi: votingAbi as any,
      functionName: "getPlacementVotes",
      args: [BigInt(epoch), placementId],
    })) as readonly [bigint, bigint];

    try {
      const voteHash = await voter.writeContract({
        address: votingAddress!,
        abi: votingAbi as any,
        functionName: "voteOnPlacement",
        args: [BigInt(epoch), placementId, true],
      });
      await waitTx(publicClient, voteHash, `vote#${i + 1}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.log(`vote#${i + 1} failed:`, message.split("\n")[0]);
    }

    const [yesVotes, noVotes] = (await publicClient.readContract({
      address: votingAddress!,
      abi: votingAbi as any,
      functionName: "getPlacementVotes",
      args: [BigInt(epoch), placementId],
    })) as readonly [bigint, bigint];

    console.log(
      `voter ${i + 1}: yes=${yesVotes.toString()} no=${noVotes.toString()} (was ${yesBefore.toString()}/${noBefore.toString()})`
    );
  }

  console.log("\n-- finalize + anchor");
  let finalizedCid = cid;
  let manifestRoot: Hex | null = null;
  let finalizeTxHash: Hex | null = null;

  if (finalizeMode === "direct") {
    if (!operatorAccount) {
      throw new Error("OPERATOR_PK required for E2E_FINALIZE_MODE=direct");
    }
    const operatorWallet = createWalletClient({
      chain,
      transport: http(rpc),
      account: operatorAccount,
    });

    manifestRoot = fakeRoot([placementId]);
    const finalizeSig = (treasuryAbi as any[]).find(
      (entry) => entry.type === "function" && entry.name === "finalizeEpoch"
    );
    const cidIsString = finalizeSig?.inputs?.some(
      (input: any) =>
        typeof input?.name === "string" &&
        input.name.includes("manifestCID") &&
        input.type === "string"
    );

    const finalizeArgs = cidIsString
      ? ([BigInt(epoch), manifestRoot, cid, [placementId], []] as const)
      : ([
          BigInt(epoch),
          manifestRoot,
          new TextEncoder().encode(cid),
          [placementId],
          [],
        ] as const);

    const finalizeHash = await operatorWallet.writeContract({
      address: treasuryAddress!,
      abi: treasuryAbi as any,
      functionName: "finalizeEpoch",
      args: finalizeArgs,
    });
    await waitTx(publicClient, finalizeHash, "finalizeEpoch");
    finalizeTxHash = finalizeHash;

    const anchorHash = await operatorWallet.writeContract({
      address: manifestStoreAddress!,
      abi: loreBoardManifestStoreAbi as any,
      functionName: "anchor",
      args: [epoch, manifestRoot, cid],
    });
    await waitTx(publicClient, anchorHash, "anchor");
  } else {
    const proposalsUrl = new URL("/api/proposals", operatorBaseUrl);
    const finalizeUrl = new URL(
      `/api/operator/finalize?force=${finalizeForce ? "1" : "0"}`,
      operatorBaseUrl
    );

    const proposalRes = await fetch(proposalsUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: placementId,
        owner: proposerAccount.address,
        cid,
        rect,
        bidPerCellWei: bidPerCellWei.toString(),
        cells,
        width: rect.w,
        height: rect.h,
        mime: "image/png",
        name: "e2e-step3",
      }),
    });

    const proposalJson = await proposalRes.json();
    if (!proposalRes.ok || proposalJson?.error) {
      throw new Error(
        `POST /api/proposals failed: ${proposalRes.status} ${JSON.stringify(proposalJson)}`
      );
    }
    console.log("seeded operator store:", proposalJson?.proposal?.id ?? "ok");

    const finalizeRes = await fetch(finalizeUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ epoch }),
    });
    const finalizeJson = await finalizeRes.json();
    if (!finalizeRes.ok || finalizeJson?.error) {
      if (
        finalizeJson?.error === "No proposals ready to finalize" &&
        !finalizeForce
      ) {
        console.log(
          "No proposals ready: voteEndsAtEpoch not reached. Re-run with E2E_FORCE_FINALIZE=1 or set E2E_EPOCH >= voteEndsAtEpoch."
        );
      }
      throw new Error(
        `POST /api/operator/finalize failed: ${finalizeRes.status} ${JSON.stringify(finalizeJson)}`
      );
    }
    console.log("finalize response:", {
      epoch: finalizeJson?.epoch,
      winners: finalizeJson?.winners,
      rejectedDueToOverlap: finalizeJson?.rejectedDueToOverlap,
      txHash: finalizeJson?.txHash,
      status: finalizeJson?.status,
      anchorTx: finalizeJson?.anchorTx,
    });
    finalizedCid = String(finalizeJson?.manifestCID || cid);
    if (finalizeJson?.txHash) {
      finalizeTxHash = finalizeJson.txHash as Hex;
    }
    console.log("operator finalize:", finalizeJson?.txHash ?? "ok");
  }

  console.log("\n-- verify");
  const [yes, no] = (await publicClient.readContract({
    address: votingAddress!,
    abi: votingAbi as any,
    functionName: "getPlacementVotes",
    args: [BigInt(epoch), placementId],
  })) as readonly [bigint, bigint];

  const meetsQuorum = (await publicClient.readContract({
    address: votingAddress!,
    abi: votingAbi as any,
    functionName: "meetsQuorum",
    args: [BigInt(epoch), placementId],
  })) as boolean;

  const passesMajority = (await publicClient.readContract({
    address: votingAddress!,
    abi: votingAbi as any,
    functionName: "passesMajority51",
    args: [BigInt(epoch), placementId],
  })) as boolean;

  const accepted = (await publicClient.readContract({
    address: treasuryAddress!,
    abi: treasuryAbi as any,
    functionName: "accepted",
    args: [placementId],
  })) as boolean;

  const endTreasuryBalance = (await publicClient.readContract({
    address: treasuryAddress!,
    abi: treasuryAbi as any,
    functionName: "treasuryBalance",
    args: [],
  })) as bigint;

  const latest = (await publicClient.readContract({
    address: manifestStoreAddress!,
    abi: loreBoardManifestStoreAbi as any,
    functionName: "latest",
    args: [],
  })) as readonly [bigint, Hex, string];

  const latestCid = String(latest[2]);
  const cleanedLatestCid = latestCid.replace(/^ipfs:\/\//, "");
  const cleanedFinalCid = finalizedCid.replace(/^ipfs:\/\//, "");

  if (finalizeTxHash) {
    const finalizeTx = await publicClient.getTransaction({ hash: finalizeTxHash });
    const decoded = decodeFunctionData({
      abi: treasuryAbi as any,
      data: finalizeTx.input,
    }) as any;
    if (decoded?.functionName === "finalizeEpoch") {
      const args = Array.isArray(decoded.args) ? decoded.args : [];
      const acceptedIds = (args[3] || []) as Hex[];
      const rejectedIds = (args[4] || []) as Hex[];
      const inAccepted = acceptedIds.some(
        (id) => id.toLowerCase() === placementId.toLowerCase()
      );
      const inRejected = rejectedIds.some(
        (id) => id.toLowerCase() === placementId.toLowerCase()
      );
      console.log(
        "finalizeEpoch includes id:",
        inAccepted ? "accepted" : inRejected ? "rejected" : "missing"
      );
      if (!inAccepted && !inRejected) {
        throw new Error(
          "Operator finalized different ids; proposal store or ID scheme mismatch"
        );
      }
    }
  } else {
    console.log("finalize tx hash missing; skipping calldata decode");
  }

  console.log("votes yes/no:", yes.toString(), "/", no.toString());
  console.log("meetsQuorum:", meetsQuorum);
  console.log("passesMajority51:", passesMajority);
  console.log("treasury.accepted:", accepted);
  console.log(
    "treasuryBalance(after):",
    endTreasuryBalance.toString(),
    "delta:",
    (endTreasuryBalance - startTreasuryBalance).toString()
  );
  console.log("manifestStore.latest CID:", latestCid);

  if (yes !== 3n || no !== 0n) {
    throw new Error("Unexpected vote counts");
  }
  if (!meetsQuorum || !passesMajority) {
    throw new Error("Quorum/majority check failed");
  }
  if (!accepted) {
    throw new Error("Placement not accepted");
  }
  const expectedIncrease = didPropose ? value : 0n;
  if (endTreasuryBalance < startTreasuryBalance + expectedIncrease) {
    throw new Error("Treasury balance did not increase as expected");
  }
  if (cleanedLatestCid !== cleanedFinalCid) {
    throw new Error("Manifest store latest CID mismatch");
  }

  console.log("\nOK: E2E step 3 complete");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
