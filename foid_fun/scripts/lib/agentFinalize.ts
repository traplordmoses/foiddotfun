// scripts/lib/agentFinalize.ts
// Agent board finalization — fully isolated from the main board.
// Uses the same contract ABIs (same source code) but targets agent-specific
// contract deployments with their own manifest chain.

import type { Address, Chain, Hex, PublicClient, Transport, WalletClient, Abi } from "viem";
import treasuryAbi from "../../src/abi/LoreBoardTreasury.json" assert { type: "json" };
import boardAbi from "../../src/abi/LoreboardBoardV2.json" assert { type: "json" };
import { loreBoardManifestStoreAbi } from "../../src/abi/loreBoardManifestStore";
import { uploadJSON } from "../../src/lib/ipfs";
import { readContractSafe, waitForReceiptWithTimeout } from "./contract";
import { asPlacement, buildManifestPayload, fetchCidForPlacement } from "./manifest";
import type { ChainProposal, Placement } from "./types";

const boardAbiTyped = boardAbi as Abi;

const votingV2Abi = [
  {
    type: "function",
    name: "getPlacementMeta",
    stateMutability: "view",
    inputs: [{ name: "placementId", type: "bytes32" }],
    outputs: [
      { name: "registeredAt", type: "uint64" },
      { name: "voteEndsAt", type: "uint64" },
      { name: "epochId", type: "uint32" },
      { name: "exists", type: "bool" },
    ],
  },
  {
    type: "function",
    name: "getPlacementVotes",
    stateMutability: "view",
    inputs: [
      { name: "epochId", type: "uint256" },
      { name: "placementId", type: "bytes32" },
    ],
    outputs: [
      { name: "yesWeight", type: "uint256" },
      { name: "noWeight", type: "uint256" },
    ],
  },
  {
    type: "function",
    name: "isPendingPlacement",
    stateMutability: "view",
    inputs: [
      { name: "epochId", type: "uint256" },
      { name: "placementId", type: "bytes32" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "passesMajority51",
    stateMutability: "view",
    inputs: [
      { name: "epochId", type: "uint256" },
      { name: "placementId", type: "bytes32" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "meetsQuorum",
    stateMutability: "view",
    inputs: [
      { name: "epochId", type: "uint256" },
      { name: "placementId", type: "bytes32" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "boardAdmin",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
  {
    type: "function",
    name: "epochs",
    stateMutability: "view",
    inputs: [{ name: "epochId", type: "uint256" }],
    outputs: [{ name: "finalized", type: "bool" }],
  },
  {
    type: "function",
    name: "setEpochFinalized",
    stateMutability: "nonpayable",
    inputs: [
      { name: "epochId", type: "uint256" },
      { name: "finalized_", type: "bool" },
    ],
    outputs: [],
  },
] as const;

const boardV2Abi = [
  {
    type: "function",
    name: "operator",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
  {
    type: "function",
    name: "finalizeEpochInVoting",
    stateMutability: "nonpayable",
    inputs: [{ name: "epochId", type: "uint256" }],
    outputs: [],
  },
] as const;

const ZERO_BYTES32 =
  "0x0000000000000000000000000000000000000000000000000000000000000000" as Hex;

const IPFS_GATEWAYS = [
  "https://ipfs.io/ipfs/",
  "https://gateway.pinata.cloud/ipfs/",
  "https://cloudflare-ipfs.com/ipfs/",
];

const LOG_CHUNK_SIZE = 10_000n; // QuickNode limits eth_getLogs to 10k blocks

// Chunked getContractEvents to stay within RPC getLogs range limits
async function getContractEventsChunked(params: {
  publicClient: PublicClient<Transport, Chain>;
  address: Address;
  abi: Abi;
  eventName: string;
  fromBlock: bigint;
  toBlock: bigint;
}) {
  const allLogs: Awaited<ReturnType<typeof params.publicClient.getContractEvents>>  = [];
  let cursor = params.fromBlock;

  while (cursor <= params.toBlock) {
    const chunkEnd = cursor + LOG_CHUNK_SIZE - 1n < params.toBlock
      ? cursor + LOG_CHUNK_SIZE - 1n
      : params.toBlock;

    const logs = await params.publicClient.getContractEvents({
      address: params.address,
      abi: params.abi,
      eventName: params.eventName,
      fromBlock: cursor,
      toBlock: chunkEnd,
    });

    allLogs.push(...logs);
    cursor = chunkEnd + 1n;
  }

  return allLogs;
}

// ---------------------------------------------------------------------------
// Proposal scanning — uses RPC getLogs directly (no Blockscout/subgraph)
// ---------------------------------------------------------------------------

export async function fetchAgentProposalsForEpoch(params: {
  publicClient: PublicClient<Transport, Chain>;
  board: Address;
  voting: Address;
  epochId: number;
  fromBlock: bigint;
}): Promise<ChainProposal[]> {
  const latest = await params.publicClient.getBlockNumber();

  const logs = await getContractEventsChunked({
    publicClient: params.publicClient,
    address: params.board,
    abi: boardAbiTyped,
    eventName: "PlacementProposed",
    fromBlock: params.fromBlock,
    toBlock: latest,
  });

  const proposals = new Map<string, ChainProposal>();

  for (const log of logs) {
    const args = (log as unknown as { args: Record<string, unknown> }).args;
    const id = args.id as Hex | undefined;
    const bidder = args.bidder as Address | undefined;
    const epoch = Number(args.epoch ?? 0);
    const cidHash = (args.cidHash as Hex) ?? ZERO_BYTES32;

    if (!id || !bidder) continue;
    if (epoch !== params.epochId) continue;

    // Verify against voting contract metadata
    let meta: readonly [bigint, bigint, number, boolean] | null = null;
    try {
      meta = (await readContractSafe({
        publicClient: params.publicClient,
        address: params.voting,
        abi: votingV2Abi,
        functionName: "getPlacementMeta",
        args: [id],
        label: `agent:getPlacementMeta ${id}`,
      })) as readonly [bigint, bigint, number, boolean];
    } catch {
      // not registered in voting — skip
    }

    if (meta && !meta[3]) continue; // exists == false
    if (meta && Number(meta[2]) !== params.epochId) continue; // wrong epoch

    const idKey = id.toLowerCase();
    if (!proposals.has(idKey)) {
      proposals.set(idKey, {
        id,
        bidder,
        epoch,
        rect: {
          x: Number(args.x ?? 0),
          y: Number(args.y ?? 0),
          w: Number(args.w ?? 0),
          h: Number(args.h ?? 0),
        },
        bidPerCellWei: BigInt(String(args.bidPerCellWei ?? 0)),
        cells: Number(args.cells ?? 0),
        cidHash,
        proposedAt: 0,
      });
    }
  }

  return Array.from(proposals.values());
}

// ---------------------------------------------------------------------------
// Manifest chain — reads from the agent's own ManifestStore
// ---------------------------------------------------------------------------

async function fetchPreviousAgentManifestPlacements(params: {
  publicClient: PublicClient<Transport, Chain>;
  manifestStore: Address;
}): Promise<{ placements: Placement[]; latestFinalizedEpoch: number }> {
  const latestFinalizedEpoch = Number(
    await readContractSafe({
      publicClient: params.publicClient,
      address: params.manifestStore,
      abi: loreBoardManifestStoreAbi,
      functionName: "latestFinalizedEpoch",
      label: `agent:latestFinalizedEpoch ${params.manifestStore}`,
    })
  );

  if (!latestFinalizedEpoch) {
    return { placements: [], latestFinalizedEpoch: 0 };
  }

  const manifestData = (await readContractSafe({
    publicClient: params.publicClient,
    address: params.manifestStore,
    abi: loreBoardManifestStoreAbi,
    functionName: "manifestOf",
    args: [latestFinalizedEpoch],
    label: `agent:manifestOf ${params.manifestStore} ${latestFinalizedEpoch}`,
  })) as readonly [Hex, string];

  const cid = String(manifestData[1]).replace(/^ipfs:\/\//, "").trim();
  if (!cid) {
    console.warn("[agent-finalize] previous manifest CID is empty");
    return { placements: [], latestFinalizedEpoch };
  }

  for (const gateway of IPFS_GATEWAYS) {
    try {
      const res = await fetch(`${gateway}${cid}`, {
        signal: AbortSignal.timeout(15_000),
      });
      if (!res.ok) continue;
      const manifest = await res.json();
      const placements = Array.isArray(manifest.placements)
        ? (manifest.placements as Placement[])
        : [];
      console.log(
        `[agent-finalize] loaded previous manifest: epoch=${latestFinalizedEpoch} placements=${placements.length}`
      );
      return { placements, latestFinalizedEpoch };
    } catch {
      // try next gateway
    }
  }

  console.warn("[agent-finalize] failed to fetch previous manifest from IPFS");
  return { placements: [], latestFinalizedEpoch };
}

// ---------------------------------------------------------------------------
// Voting finalization
// ---------------------------------------------------------------------------

function parseEpochFinalized(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (Array.isArray(value) && typeof value[0] === "boolean") return value[0];
  if (value && typeof value === "object" && "finalized" in value) {
    return (value as { finalized: boolean }).finalized === true;
  }
  return false;
}

async function finalizeAgentVotingEpoch(params: {
  publicClient: PublicClient<Transport, Chain>;
  operatorWallet: WalletClient<Transport, Chain>;
  voting: Address;
  board: Address;
  epochId: number;
}) {
  // Check if already finalized
  const votingEpoch = (await readContractSafe({
    publicClient: params.publicClient,
    address: params.voting,
    abi: votingV2Abi,
    functionName: "epochs",
    args: [BigInt(params.epochId)],
    label: `agent:epochs ${params.voting} ${params.epochId}`,
  })) as unknown;

  if (parseEpochFinalized(votingEpoch)) {
    console.log(`[agent-finalize] voting already finalized epoch ${params.epochId}`);
    return;
  }

  // Determine finalization path: direct or via board relay
  const boardAdmin = (await readContractSafe({
    publicClient: params.publicClient,
    address: params.voting,
    abi: votingV2Abi,
    functionName: "boardAdmin",
    label: `agent:boardAdmin ${params.voting}`,
  })) as Address;

  const operatorAddress = params.operatorWallet.account?.address?.toLowerCase();
  const boardAdminLower = boardAdmin.toLowerCase();
  const boardLower = params.board.toLowerCase();

  if (operatorAddress === boardAdminLower) {
    // Direct path: operator is the boardAdmin
    const tx = await params.operatorWallet.writeContract({
      address: params.voting,
      abi: votingV2Abi,
      functionName: "setEpochFinalized",
      args: [BigInt(params.epochId), true],
      account: params.operatorWallet.account!,
    });
    console.log("[agent-finalize] setEpochFinalized tx:", tx);
    await waitForReceiptWithTimeout({
      publicClient: params.publicClient,
      label: `agent:setEpochFinalized receipt ${tx}`,
      request: { hash: tx },
    });
  } else if (boardAdminLower === boardLower) {
    // Board relay path: boardAdmin == board contract, use finalizeEpochInVoting
    const boardOperator = (await readContractSafe({
      publicClient: params.publicClient,
      address: params.board,
      abi: boardV2Abi,
      functionName: "operator",
      label: `agent:operator ${params.board}`,
    })) as Address;

    if (boardOperator.toLowerCase() !== operatorAddress) {
      console.warn(
        `[agent-finalize] operator wallet does not match BoardV2.operator; skipping voting finalize`
      );
      return;
    }

    const tx = await params.operatorWallet.writeContract({
      address: params.board,
      abi: boardV2Abi,
      functionName: "finalizeEpochInVoting",
      args: [BigInt(params.epochId)],
      account: params.operatorWallet.account!,
    });
    console.log("[agent-finalize] finalizeEpochInVoting tx:", tx);
    await waitForReceiptWithTimeout({
      publicClient: params.publicClient,
      label: `agent:finalizeEpochInVoting receipt ${tx}`,
      request: { hash: tx },
    });
  } else {
    console.warn(
      `[agent-finalize] cannot finalize voting: boardAdmin=${boardAdmin} not in wallet`
    );
  }
}

// ---------------------------------------------------------------------------
// Main finalization orchestrator
// ---------------------------------------------------------------------------

export async function finalizeAgentEpochIfReady(params: {
  publicClient: PublicClient<Transport, Chain>;
  operatorWallet: WalletClient<Transport, Chain>;
  treasury: Address;
  voting: Address;
  board: Address;
  manifestStore: Address;
  epochId: number;
  proposals: ChainProposal[];
}) {
  // 1. Check treasury finalization
  // manifestRootOf may revert for non-finalized epochs on fresh deployments
  let manifestRootOnChain: Hex | null = null;
  try {
    manifestRootOnChain = (await readContractSafe({
      publicClient: params.publicClient,
      address: params.treasury,
      abi: treasuryAbi,
      functionName: "manifestRootOf",
      args: [params.epochId],
      label: `agent:manifestRootOf ${params.treasury} ${params.epochId}`,
    })) as Hex;
  } catch {
    // revert = not finalized
  }

  const treasuryFinalized =
    !!manifestRootOnChain && manifestRootOnChain !== ZERO_BYTES32;

  // 2. Check voting finalization
  let votingEpoch: unknown = null;
  try {
    votingEpoch = await readContractSafe({
      publicClient: params.publicClient,
      address: params.voting,
      abi: votingV2Abi,
      functionName: "epochs",
      args: [BigInt(params.epochId)],
      label: `agent:epochs ${params.voting} ${params.epochId}`,
    });
  } catch {
    // revert = not finalized
  }

  const votingFinalized = parseEpochFinalized(votingEpoch);

  if (treasuryFinalized && votingFinalized) {
    return; // fully done
  }

  if (treasuryFinalized && !votingFinalized) {
    console.log(
      `[agent-finalize] treasury finalized but voting not; finalizing voting for epoch ${params.epochId}`
    );
    await finalizeAgentVotingEpoch({
      publicClient: params.publicClient,
      operatorWallet: params.operatorWallet,
      voting: params.voting,
      board: params.board,
      epochId: params.epochId,
    });
    return;
  }

  if (!params.proposals.length) {
    return; // nothing to finalize
  }

  // 3. Evaluate proposals: check vote window closed + vote outcome
  const nowSec = Math.floor(Date.now() / 1000);
  const accepted: ChainProposal[] = [];
  const rejected: ChainProposal[] = [];

  for (const proposal of params.proposals) {
    const meta = (await readContractSafe({
      publicClient: params.publicClient,
      address: params.voting,
      abi: votingV2Abi,
      functionName: "getPlacementMeta",
      args: [proposal.id],
      label: `agent:getPlacementMeta ${params.voting} ${proposal.id}`,
    })) as readonly [bigint, bigint, number, boolean];

    const voteEndsAt = Number(meta[1]);
    const placementEpochId = meta[2];
    const exists = meta[3];

    if (!exists) continue;
    if (placementEpochId !== params.epochId) continue;
    if (voteEndsAt >= nowSec) continue; // voting still open

    const isPending = (await readContractSafe({
      publicClient: params.publicClient,
      address: params.voting,
      abi: votingV2Abi,
      functionName: "isPendingPlacement",
      args: [BigInt(params.epochId), proposal.id],
      label: `agent:isPendingPlacement ${params.voting} ${proposal.id}`,
    })) as boolean;

    if (!isPending) continue;

    const passed = (await readContractSafe({
      publicClient: params.publicClient,
      address: params.voting,
      abi: votingV2Abi,
      functionName: "passesMajority51",
      args: [BigInt(params.epochId), proposal.id],
      label: `agent:passesMajority51 ${params.voting} ${proposal.id}`,
    })) as boolean;

    if (passed) accepted.push(proposal);
    else rejected.push(proposal);
  }

  if (!accepted.length && !rejected.length) {
    console.log(
      `[agent-finalize] no finalizable placements for epoch ${params.epochId}`
    );
    return;
  }

  accepted.sort((a, b) => a.id.toLowerCase().localeCompare(b.id.toLowerCase()));
  rejected.sort((a, b) => a.id.toLowerCase().localeCompare(b.id.toLowerCase()));

  console.log(
    `[agent-finalize] epoch ${params.epochId}: proposals=${params.proposals.length} accepted=${accepted.length} rejected=${rejected.length}`
  );

  // 4. Build placements from accepted proposals
  const acceptedPlacements: Placement[] = [];
  for (const proposal of accepted) {
    const cid = await fetchCidForPlacement({
      publicClient: params.publicClient,
      board: params.board,
      placementId: proposal.id,
    });
    if (!cid) {
      console.warn(`[agent-finalize] missing cid for placement ${proposal.id}`);
    }
    acceptedPlacements.push(asPlacement(proposal, cid));
  }

  // 5. Load previous manifest from agent ManifestStore and merge
  const { placements: previousPlacements, latestFinalizedEpoch } =
    await fetchPreviousAgentManifestPlacements({
      publicClient: params.publicClient,
      manifestStore: params.manifestStore,
    });

  const existingIds = new Set(
    previousPlacements.map((p) => p.id.toLowerCase())
  );
  const mergedPlacements = [...previousPlacements];
  for (const placement of acceptedPlacements) {
    if (!existingIds.has(placement.id.toLowerCase())) {
      mergedPlacements.push(placement);
    }
  }
  mergedPlacements.sort((a, b) =>
    a.id.toLowerCase().localeCompare(b.id.toLowerCase())
  );

  const anchorEpoch = Math.max(params.epochId, latestFinalizedEpoch + 1);

  console.log(
    `[agent-finalize] merged: ${previousPlacements.length} previous + ${acceptedPlacements.length} new = ${mergedPlacements.length} total (anchorEpoch=${anchorEpoch})`
  );

  // 6. Build manifest, upload to IPFS, finalize on-chain
  const manifestPayload = buildManifestPayload({
    epoch: anchorEpoch,
    placements: mergedPlacements,
    finalizedAt: nowSec,
  });

  const cid = await uploadJSON(
    `agent-loreboard-epoch-${anchorEpoch}.manifest.json`,
    manifestPayload.manifest
  );

  const acceptedIds = accepted.map((p) => p.id);
  const rejectedIds = rejected.map((p) => p.id);

  // Treasury: finalizeEpoch
  const finalizeTx = await params.operatorWallet.writeContract({
    address: params.treasury,
    abi: treasuryAbi,
    functionName: "finalizeEpoch",
    args: [anchorEpoch, manifestPayload.manifestRoot, cid, acceptedIds, rejectedIds],
    account: params.operatorWallet.account!,
  });
  console.log("[agent-finalize] finalizeEpoch tx:", finalizeTx);
  await waitForReceiptWithTimeout({
    publicClient: params.publicClient,
    label: `agent:finalizeEpoch receipt ${finalizeTx}`,
    request: { hash: finalizeTx },
  });

  // ManifestStore: anchor
  const anchorTx = await params.operatorWallet.writeContract({
    address: params.manifestStore,
    abi: loreBoardManifestStoreAbi,
    functionName: "anchor",
    args: [anchorEpoch, manifestPayload.manifestRoot, cid],
    account: params.operatorWallet.account!,
  });
  console.log("[agent-finalize] manifest anchor tx:", anchorTx);
  await waitForReceiptWithTimeout({
    publicClient: params.publicClient,
    label: `agent:anchor receipt ${anchorTx}`,
    request: { hash: anchorTx },
  });

  // Voting: mark epoch finalized
  await finalizeAgentVotingEpoch({
    publicClient: params.publicClient,
    operatorWallet: params.operatorWallet,
    voting: params.voting,
    board: params.board,
    epochId: params.epochId,
  });

  console.log(`[agent-finalize] epoch ${params.epochId}: finalization complete (cid=${cid})`);
}
