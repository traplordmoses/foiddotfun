import type { Address, Chain, Hex, PublicClient, Transport, WalletClient } from "viem";
import treasuryAbi from "../../src/abi/LoreBoardTreasury.json" assert { type: "json" };
import { loreBoardManifestStoreAbi } from "../../src/abi/loreBoardManifestStore";
import { uploadJSON } from "../../src/lib/ipfs";
import { readContractSafe, waitForReceiptWithTimeout } from "./contract";
import { asPlacement, buildManifestPayload, fetchCidForPlacement } from "./manifest";
import type { ChainProposal, Placement } from "./types";

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

const loreboardLiveNftAbi = [
  {
    type: "function",
    name: "syncLatest",
    stateMutability: "nonpayable",
    inputs: [],
    outputs: [],
  },
  {
    type: "function",
    name: "liveEpoch",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "liveManifestRoot",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "bytes32" }],
  },
  {
    type: "function",
    name: "liveManifestCID",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "string" }],
  },
] as const;

const ZERO_BYTES32 =
  "0x0000000000000000000000000000000000000000000000000000000000000000";

const IPFS_GATEWAYS = [
  "https://ipfs.io/ipfs/",
  "https://gateway.pinata.cloud/ipfs/",
  "https://cloudflare-ipfs.com/ipfs/",
];

async function fetchPreviousManifestPlacements(params: {
  publicClient: PublicClient<Transport, Chain>;
  manifestStore: Address;
}): Promise<{ placements: Placement[]; latestFinalizedEpoch: number }> {
  const latestFinalizedEpoch = Number(
    await readContractSafe({
      publicClient: params.publicClient,
      address: params.manifestStore,
      abi: loreBoardManifestStoreAbi,
      functionName: "latestFinalizedEpoch",
      label: `latestFinalizedEpoch ${params.manifestStore}`,
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
    label: `manifestOf ${params.manifestStore} ${latestFinalizedEpoch}`,
  })) as readonly [Hex, string];

  const cid = String(manifestData[1]).replace(/^ipfs:\/\//, "").trim();
  if (!cid) {
    console.warn("[finalize] previous manifest CID is empty");
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
        `[finalize] loaded previous manifest: epoch=${latestFinalizedEpoch} placements=${placements.length}`
      );
      return { placements, latestFinalizedEpoch };
    } catch {
      // try next gateway
    }
  }

  console.warn("[finalize] failed to fetch previous manifest from IPFS");
  return { placements: [], latestFinalizedEpoch };
}

function parseEpochFinalized(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (Array.isArray(value) && typeof value[0] === "boolean") return value[0];
  if (value && typeof value === "object" && "finalized" in value) {
    return (value as { finalized: boolean }).finalized === true;
  }
  return false;
}

async function maybeSyncLoreboardNft(params: {
  publicClient: PublicClient<Transport, Chain>;
  operatorWallet: WalletClient<Transport, Chain> | null;
  nftAddress: Address | null;
  dryRun: boolean;
  skipNftSync: boolean;
  didAnchor: boolean;
}) {
  if (params.skipNftSync) {
    console.log("[nft] syncLatest skipped: SKIP_NFT_SYNC");
    return;
  }
  if (params.dryRun) {
    console.log("[nft] syncLatest skipped: DRY_RUN");
    return;
  }
  if (!params.didAnchor) {
    console.log("[nft] syncLatest skipped: no anchor in this run");
    return;
  }
  if (!params.nftAddress) {
    console.log("[nft] syncLatest skipped: missing LOREBOARD_NFT");
    return;
  }
  if (!params.operatorWallet) {
    console.log("[nft] syncLatest skipped: missing operator wallet");
    return;
  }

  console.log("[nft] syncing live loreboard nft...");
  try {
    const txHash = await params.operatorWallet.writeContract({
      address: params.nftAddress,
      abi: loreboardLiveNftAbi,
      functionName: "syncLatest",
      account: params.operatorWallet.account!,
    });
    const receipt = await waitForReceiptWithTimeout({
      publicClient: params.publicClient,
      label: `syncLatest receipt ${txHash}`,
      request: { hash: txHash },
    });
    console.log(
      `[nft] syncLatest success: ${txHash} block=${receipt.blockNumber}`
    );
    try {
      const [liveEpoch, liveManifestRoot, liveManifestCID] =
        await Promise.all([
          readContractSafe({
            publicClient: params.publicClient,
            address: params.nftAddress,
            abi: loreboardLiveNftAbi,
            functionName: "liveEpoch",
            label: `liveEpoch ${params.nftAddress}`,
          }),
          readContractSafe({
            publicClient: params.publicClient,
            address: params.nftAddress,
            abi: loreboardLiveNftAbi,
            functionName: "liveManifestRoot",
            label: `liveManifestRoot ${params.nftAddress}`,
          }),
          readContractSafe({
            publicClient: params.publicClient,
            address: params.nftAddress,
            abi: loreboardLiveNftAbi,
            functionName: "liveManifestCID",
            label: `liveManifestCID ${params.nftAddress}`,
          }),
        ]);
      const epochLabel =
        typeof liveEpoch === "bigint" ? liveEpoch.toString() : String(liveEpoch);
      console.log(
        `[nft] live state: epoch=${epochLabel} root=${liveManifestRoot} cid=${liveManifestCID}`
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[nft] failed to read live state: ${msg}`);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[nft] syncLatest failed (non-fatal): ${msg}`);
  }
}

async function finalizeVotingEpoch(params: {
  publicClient: PublicClient<Transport, Chain>;
  operatorWallet: WalletClient<Transport, Chain> | null;
  adminWallet: WalletClient<Transport, Chain> | null;
  voting: Address;
  board: Address;
  epochId: number;
  dryRun: boolean;
}) {
  const boardAdmin =
    (await readContractSafe({
      publicClient: params.publicClient,
      address: params.voting,
      abi: votingV2Abi,
      functionName: "boardAdmin",
      label: `boardAdmin ${params.voting}`,
    })) as Address;

  const operatorAddress = params.operatorWallet?.account?.address?.toLowerCase();
  const adminAddress = params.adminWallet?.account?.address?.toLowerCase();
  const boardAdminLower = boardAdmin.toLowerCase();
  const boardLower = params.board.toLowerCase();
  const canUseOperator = operatorAddress && operatorAddress === boardAdminLower;
  const canUseAdmin = adminAddress && adminAddress === boardAdminLower;
  const canUseBoardRelay = boardAdminLower === boardLower;
  const finalizeWallet = canUseOperator
    ? params.operatorWallet
    : canUseAdmin
      ? params.adminWallet
      : null;
  let boardRelayOperatorMatch = false;
  if (canUseBoardRelay && params.operatorWallet) {
    const boardOperator =
      (await readContractSafe({
        publicClient: params.publicClient,
        address: params.board,
        abi: boardV2Abi,
        functionName: "operator",
        label: `operator ${params.board}`,
      })) as Address;
    boardRelayOperatorMatch =
      boardOperator.toLowerCase() ===
      params.operatorWallet.account?.address?.toLowerCase();
  }

  const useBoardRelay =
    !finalizeWallet && canUseBoardRelay && boardRelayOperatorMatch;
  const pathLabel = finalizeWallet
    ? "direct-voting"
    : useBoardRelay
      ? "board-relay"
      : "skipped";

  console.log(
    `[finalize] voting finalize path=${pathLabel} epoch=${params.epochId} boardAdmin=${boardAdmin}`
  );

  if (params.dryRun) {
    console.log(
      `[finalize] DRY_RUN: would ${
        finalizeWallet
          ? "call votingV2.setEpochFinalized directly"
          : useBoardRelay
            ? "call board.finalizeEpochInVoting"
            : "skip voting finalize"
      }`
    );
    return;
  }

  if (!finalizeWallet && !useBoardRelay) {
    if (canUseBoardRelay && !params.operatorWallet) {
      console.warn("[finalize] missing operator wallet for board relay");
    } else if (canUseBoardRelay && !boardRelayOperatorMatch) {
      console.warn(
        "[finalize] operator wallet does not match BoardV2.operator; skipping board relay"
      );
    }
    console.warn(
      `[finalize] skipping votingV2.setEpochFinalized (boardAdmin=${boardAdmin} not in wallet)`
    );
    return;
  }

  const votingEpoch =
    (await readContractSafe({
      publicClient: params.publicClient,
      address: params.voting,
      abi: votingV2Abi,
      functionName: "epochs",
      args: [BigInt(params.epochId)],
      label: `epochs ${params.voting} ${params.epochId}`,
    })) as unknown;
  if (parseEpochFinalized(votingEpoch)) {
    console.log(`[finalize] voting already finalized epoch ${params.epochId}`);
    return;
  }

  if (useBoardRelay) {
    const finalizeVotingTx = await params.operatorWallet!.writeContract({
      address: params.board,
      abi: boardV2Abi,
      functionName: "finalizeEpochInVoting",
      args: [BigInt(params.epochId)],
      account: params.operatorWallet!.account!,
    });
    console.log("[finalize] finalizeEpochInVoting tx:", finalizeVotingTx);
    await waitForReceiptWithTimeout({
      publicClient: params.publicClient,
      label: `finalizeEpochInVoting receipt ${finalizeVotingTx}`,
      request: { hash: finalizeVotingTx },
    });
  } else {
    const finalizeVotingTx = await finalizeWallet!.writeContract({
      address: params.voting,
      abi: votingV2Abi,
      functionName: "setEpochFinalized",
      args: [BigInt(params.epochId), true],
      account: finalizeWallet!.account!,
    });
    console.log("[finalize] setEpochFinalized direct tx:", finalizeVotingTx);
    await waitForReceiptWithTimeout({
      publicClient: params.publicClient,
      label: `setEpochFinalized receipt ${finalizeVotingTx}`,
      request: { hash: finalizeVotingTx },
    });
  }
}

export async function finalizeEpochIfReady(params: {
  publicClient: PublicClient<Transport, Chain>;
  operatorWallet: WalletClient<Transport, Chain> | null;
  adminWallet: WalletClient<Transport, Chain> | null;
  treasury: Address;
  voting: Address;
  board: Address;
  manifestStore: Address;
  nftAddress: Address | null;
  skipNftSync: boolean;
  epochId: number;
  proposals: ChainProposal[];
  dryRun: boolean;
}) {
  let didAnchor = false;

  try {
    const manifestRootOnChain =
      (await readContractSafe({
        publicClient: params.publicClient,
        address: params.treasury,
        abi: treasuryAbi,
        functionName: "manifestRootOf",
        args: [params.epochId],
        label: `manifestRootOf ${params.treasury} ${params.epochId}`,
      })) as Hex;
    const treasuryFinalized =
      !!manifestRootOnChain && manifestRootOnChain !== ZERO_BYTES32;
    if (treasuryFinalized) {
      console.log(
        `[finalize] treasury already finalized epoch ${params.epochId} (root=${manifestRootOnChain})`
      );
    }

    const votingEpoch =
      (await readContractSafe({
        publicClient: params.publicClient,
        address: params.voting,
        abi: votingV2Abi,
        functionName: "epochs",
        args: [BigInt(params.epochId)],
        label: `epochs ${params.voting} ${params.epochId}`,
      })) as unknown;
    const votingFinalized = parseEpochFinalized(votingEpoch);
    if (votingFinalized) {
      console.log(`[finalize] voting already finalized epoch ${params.epochId}`);
    }

    if (treasuryFinalized && votingFinalized) {
      console.log(
        `[finalize] epoch ${params.epochId} already finalized in treasury + voting; skipping`
      );
      return;
    }

    if (treasuryFinalized && !votingFinalized) {
      console.log(
        `[finalize] treasury finalized but voting not; finalizing voting only for epoch ${params.epochId}`
      );
      await finalizeVotingEpoch({
        publicClient: params.publicClient,
        operatorWallet: params.operatorWallet,
        adminWallet: params.adminWallet,
        voting: params.voting,
        board: params.board,
        epochId: params.epochId,
        dryRun: params.dryRun,
      });
      return;
    }

    if (!params.proposals.length) {
      console.log(
        `[finalize] no proposals found for epoch ${params.epochId}; skipping`
      );
      return;
    }

    const nowSec = Math.floor(Date.now() / 1000);

    const accepted: ChainProposal[] = [];
    const rejected: ChainProposal[] = [];

    for (const proposal of params.proposals) {
      const meta =
        (await readContractSafe({
          publicClient: params.publicClient,
          address: params.voting,
          abi: votingV2Abi,
          functionName: "getPlacementMeta",
          args: [proposal.id],
          label: `getPlacementMeta ${params.voting} ${proposal.id}`,
        })) as readonly [bigint, bigint, number, boolean];
      const voteEndsAt = Number(meta[1]);
      const placementEpochId = meta[2];
      const exists = meta[3];
      if (!exists) continue;
      if (placementEpochId !== params.epochId) {
        console.warn(
          `[warn] placement ${proposal.id} meta epoch=${placementEpochId} does not match event epoch=${params.epochId}`
        );
        continue;
      }
      if (voteEndsAt >= nowSec) continue;

      const isPending =
        (await readContractSafe({
          publicClient: params.publicClient,
          address: params.voting,
          abi: votingV2Abi,
          functionName: "isPendingPlacement",
          args: [BigInt(params.epochId), proposal.id],
          label: `isPendingPlacement ${params.voting} ${proposal.id}`,
        })) as boolean;
      if (!isPending) continue;

      const passed = (await readContractSafe({
        publicClient: params.publicClient,
        address: params.voting,
        abi: votingV2Abi,
        functionName: "passesMajority51",
        args: [BigInt(params.epochId), proposal.id],
        label: `passesMajority51 ${params.voting} ${proposal.id}`,
      })) as boolean;
      if (passed) accepted.push(proposal);
      else rejected.push(proposal);
    }

    if (!accepted.length && !rejected.length) {
      console.log(
        `[finalize] no finalizable placements found for epoch ${params.epochId}; skipping`
      );
      return;
    }

    accepted.sort((a, b) =>
      a.id.toLowerCase().localeCompare(b.id.toLowerCase())
    );
    rejected.sort((a, b) =>
      a.id.toLowerCase().localeCompare(b.id.toLowerCase())
    );

    console.log(
      `[finalize] proposals=${params.proposals.length} accepted=${accepted.length} rejected=${rejected.length}`
    );

    // Build new placements from accepted proposals
    const acceptedPlacements: Placement[] = [];
    for (const proposal of accepted) {
      const cid = await fetchCidForPlacement({
        publicClient: params.publicClient,
        board: params.board,
        placementId: proposal.id,
      });
      if (!cid) {
        console.warn(`[warn] missing cid for placement ${proposal.id}`);
      }
      const placement = asPlacement(proposal, cid);
      acceptedPlacements.push(placement);
    }

    // Load previous manifest and merge placements (accumulate board state)
    const { placements: previousPlacements, latestFinalizedEpoch } =
      await fetchPreviousManifestPlacements({
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

    // Anchor epoch must be > latestFinalizedEpoch for latest() to pick it up
    const anchorEpoch = Math.max(params.epochId, latestFinalizedEpoch + 1);

    console.log(
      `[finalize] merged: ${previousPlacements.length} previous + ${acceptedPlacements.length} new = ${mergedPlacements.length} total (anchorEpoch=${anchorEpoch})`
    );

    const manifestPayload = buildManifestPayload({
      epoch: anchorEpoch,
      placements: mergedPlacements,
      finalizedAt: nowSec,
    });

    if (params.dryRun) {
      console.log("[finalize] DRY_RUN: would upload manifest + finalize epoch", {
        epoch: anchorEpoch,
        placements: mergedPlacements.length,
        accepted: accepted.length,
        rejected: rejected.length,
        manifestRoot: manifestPayload.manifestRoot,
      });
      await finalizeVotingEpoch({
        publicClient: params.publicClient,
        operatorWallet: params.operatorWallet,
        adminWallet: params.adminWallet,
        voting: params.voting,
        board: params.board,
        epochId: params.epochId,
        dryRun: true,
      });
      return;
    }

    if (!params.operatorWallet) throw new Error("Missing OPERATOR_KEY");

    const cid = await uploadJSON(
      `loreboard-epoch-${anchorEpoch}.manifest.json`,
      manifestPayload.manifest
    );

    const acceptedIds = accepted.map((p) => p.id);
    const rejectedIds = rejected.map((p) => p.id);

    const finalizeTx = await params.operatorWallet.writeContract({
      address: params.treasury,
      abi: treasuryAbi,
      functionName: "finalizeEpoch",
      args: [
        anchorEpoch,
        manifestPayload.manifestRoot,
        cid,
        acceptedIds,
        rejectedIds,
      ],
      account: params.operatorWallet.account!,
    });
    console.log("[finalize] finalizeEpoch tx:", finalizeTx);
    await waitForReceiptWithTimeout({
      publicClient: params.publicClient,
      label: `finalizeEpoch receipt ${finalizeTx}`,
      request: { hash: finalizeTx },
    });

    const anchorTx = await params.operatorWallet.writeContract({
      address: params.manifestStore,
      abi: loreBoardManifestStoreAbi,
      functionName: "anchor",
      args: [anchorEpoch, manifestPayload.manifestRoot, cid],
      account: params.operatorWallet.account!,
    });
    console.log("[finalize] manifest anchor tx:", anchorTx);
    await waitForReceiptWithTimeout({
      publicClient: params.publicClient,
      label: `anchor receipt ${anchorTx}`,
      request: { hash: anchorTx },
    });
    didAnchor = true;

    await finalizeVotingEpoch({
      publicClient: params.publicClient,
      operatorWallet: params.operatorWallet,
      adminWallet: params.adminWallet,
      voting: params.voting,
      board: params.board,
      epochId: params.epochId,
      dryRun: false,
    });
  } finally {
    await maybeSyncLoreboardNft({
      publicClient: params.publicClient,
      operatorWallet: params.operatorWallet,
      nftAddress: params.nftAddress,
      dryRun: params.dryRun,
      skipNftSync: params.skipNftSync,
      didAnchor,
    });
  }
}
