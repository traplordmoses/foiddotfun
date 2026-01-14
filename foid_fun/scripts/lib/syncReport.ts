import type { Address, Chain, Hex, PublicClient, Transport } from "viem";
import treasuryAbi from "../../src/abi/LoreBoardTreasury.json" assert { type: "json" };
import { readContractSafe } from "./contract";
import { fetchCidForPlacement } from "./manifest";
import type { ChainProposal } from "./types";

const votingV2Abi = [
  {
    type: "function",
    name: "voteWindowSeconds",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint32" }],
  },
  {
    type: "function",
    name: "epochZeroUnix",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint64" }],
  },
  {
    type: "function",
    name: "epochSeconds",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint32" }],
  },
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
    name: "epochs",
    stateMutability: "view",
    inputs: [{ name: "epochId", type: "uint256" }],
    outputs: [{ name: "finalized", type: "bool" }],
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
] as const;

const ZERO_BYTES32 =
  "0x0000000000000000000000000000000000000000000000000000000000000000";

export async function logFinalizeReadinessReport(params: {
  publicClient: PublicClient<Transport, Chain>;
  voting: Address;
  board: Address;
  epochId: number;
  proposals: ChainProposal[];
}) {
  const [
    voteWindowSecondsRaw,
    epochZeroUnixRaw,
    epochSecondsRaw,
    boardAdmin,
  ] = (await Promise.all([
    readContractSafe({
      publicClient: params.publicClient,
      address: params.voting,
      abi: votingV2Abi,
      functionName: "voteWindowSeconds",
      label: `voteWindowSeconds ${params.voting}`,
    }),
    readContractSafe({
      publicClient: params.publicClient,
      address: params.voting,
      abi: votingV2Abi,
      functionName: "epochZeroUnix",
      label: `epochZeroUnix ${params.voting}`,
    }),
    readContractSafe({
      publicClient: params.publicClient,
      address: params.voting,
      abi: votingV2Abi,
      functionName: "epochSeconds",
      label: `epochSeconds ${params.voting}`,
    }),
    readContractSafe({
      publicClient: params.publicClient,
      address: params.voting,
      abi: votingV2Abi,
      functionName: "boardAdmin",
      label: `boardAdmin ${params.voting}`,
    }),
  ])) as [bigint | number, bigint | number, bigint | number, Address];

  const voteWindowSeconds = Number(voteWindowSecondsRaw);
  const epochZeroUnix = Number(epochZeroUnixRaw);
  const epochSeconds = Number(epochSecondsRaw);
  const nowSec = Math.floor(Date.now() / 1000);

  console.log(
    `[ready] epoch=${params.epochId} voteWindowSeconds=${voteWindowSeconds} epochZeroUnix=${epochZeroUnix} epochSeconds=${epochSeconds} boardAdmin=${boardAdmin} now=${nowSec}`
  );

  for (const proposal of params.proposals) {
    const cid = await fetchCidForPlacement({
      publicClient: params.publicClient,
      board: params.board,
      placementId: proposal.id,
    });

    const meta =
      (await readContractSafe({
        publicClient: params.publicClient,
        address: params.voting,
        abi: votingV2Abi,
        functionName: "getPlacementMeta",
        args: [proposal.id],
        label: `getPlacementMeta ${params.voting} ${proposal.id}`,
      })) as readonly [bigint, bigint, number, boolean];
    const registeredAt = meta[0];
    const voteEndsAt = meta[1];
    const placementEpochId = meta[2];
    const exists = meta[3];

    const isPending =
      (await readContractSafe({
        publicClient: params.publicClient,
        address: params.voting,
        abi: votingV2Abi,
        functionName: "isPendingPlacement",
        args: [BigInt(params.epochId), proposal.id],
        label: `isPendingPlacement ${params.voting} ${proposal.id}`,
      })) as boolean;

    const votes =
      (await readContractSafe({
        publicClient: params.publicClient,
        address: params.voting,
        abi: votingV2Abi,
        functionName: "getPlacementVotes",
        args: [BigInt(params.epochId), proposal.id],
        label: `getPlacementVotes ${params.voting} ${proposal.id}`,
      })) as readonly [bigint, bigint];
    const yesVotes = votes[0];
    const noVotes = votes[1];

    const meetsQuorum =
      (await readContractSafe({
        publicClient: params.publicClient,
        address: params.voting,
        abi: votingV2Abi,
        functionName: "meetsQuorum",
        args: [BigInt(params.epochId), proposal.id],
        label: `meetsQuorum ${params.voting} ${proposal.id}`,
      })) as boolean;

    const passesMajority51 =
      (await readContractSafe({
        publicClient: params.publicClient,
        address: params.voting,
        abi: votingV2Abi,
        functionName: "passesMajority51",
        args: [BigInt(params.epochId), proposal.id],
        label: `passesMajority51 ${params.voting} ${proposal.id}`,
      })) as boolean;

    console.log(
      `[ready] epoch=${params.epochId} id=${proposal.id} proposedAt=${proposal.proposedAt} cid=${cid} cidHash=${proposal.cidHash} registeredAt=${registeredAt} voteEndsAt=${voteEndsAt} metaEpoch=${placementEpochId} metaExists=${exists} isPending=${isPending} votesYes=${yesVotes} votesNo=${noVotes} meetsQuorum=${meetsQuorum} passesMajority51=${passesMajority51} now=${nowSec}`
    );
  }
}

export async function summarizeEpoch(params: {
  publicClient: PublicClient<Transport, Chain>;
  voting: Address;
  board: Address;
  treasury: Address;
  epochId: number;
  proposals: ChainProposal[];
}) {
  const voteWindowSeconds = Number(
    await readContractSafe({
      publicClient: params.publicClient,
      address: params.voting,
      abi: votingV2Abi,
      functionName: "voteWindowSeconds",
      label: `voteWindowSeconds ${params.voting}`,
    })
  );

  const votingFinalized =
    (await readContractSafe({
      publicClient: params.publicClient,
      address: params.voting,
      abi: votingV2Abi,
      functionName: "epochs",
      args: [BigInt(params.epochId)],
      label: `epochs ${params.voting} ${params.epochId}`,
    })) as boolean;

  const treasuryRoot =
    (await readContractSafe({
      publicClient: params.publicClient,
      address: params.treasury,
      abi: treasuryAbi,
      functionName: "manifestRootOf",
      args: [params.epochId],
      label: `manifestRootOf ${params.treasury} ${params.epochId}`,
    })) as Hex;
  const treasuryFinalized = treasuryRoot && treasuryRoot !== ZERO_BYTES32;

  if (!params.proposals.length) {
    console.log(
      `[sync] epoch=${params.epochId} proposals=0 registered=0 pending=0 meetsQuorum=0 passesMajority51=0 votingFinalized=${votingFinalized} treasuryFinalized=${treasuryFinalized} voteWindowSeconds=${voteWindowSeconds}`
    );
    return;
  }

  let withCid = 0;
  let registered = 0;
  let pending = 0;
  let meetsQuorum = 0;
  let passes = 0;
  let withVotes = 0;

  for (const proposal of params.proposals) {
    const cid = await fetchCidForPlacement({
      publicClient: params.publicClient,
      board: params.board,
      placementId: proposal.id,
    });
    if (cid) withCid += 1;

    const meta =
      (await readContractSafe({
        publicClient: params.publicClient,
        address: params.voting,
        abi: votingV2Abi,
        functionName: "getPlacementMeta",
        args: [proposal.id],
        label: `getPlacementMeta ${params.voting} ${proposal.id}`,
      })) as readonly [bigint, bigint, number, boolean];
    const placementEpochId = meta[2];
    const exists = meta[3];
    if (exists) registered += 1;
    if (placementEpochId !== params.epochId) {
      console.warn(
        `[warn] placement ${proposal.id} meta epoch=${placementEpochId} does not match event epoch=${params.epochId}`
      );
    }

    const isPending =
      (await readContractSafe({
        publicClient: params.publicClient,
        address: params.voting,
        abi: votingV2Abi,
        functionName: "isPendingPlacement",
        args: [BigInt(params.epochId), proposal.id],
        label: `isPendingPlacement ${params.voting} ${proposal.id}`,
      })) as boolean;
    if (isPending) pending += 1;

    const votes =
      (await readContractSafe({
        publicClient: params.publicClient,
        address: params.voting,
        abi: votingV2Abi,
        functionName: "getPlacementVotes",
        args: [BigInt(params.epochId), proposal.id],
        label: `getPlacementVotes ${params.voting} ${proposal.id}`,
      })) as readonly [bigint, bigint];
    if (votes[0] + votes[1] > 0n) withVotes += 1;

    const hasQuorum =
      (await readContractSafe({
        publicClient: params.publicClient,
        address: params.voting,
        abi: votingV2Abi,
        functionName: "meetsQuorum",
        args: [BigInt(params.epochId), proposal.id],
        label: `meetsQuorum ${params.voting} ${proposal.id}`,
      })) as boolean;
    if (hasQuorum) meetsQuorum += 1;

    const passed =
      (await readContractSafe({
        publicClient: params.publicClient,
        address: params.voting,
        abi: votingV2Abi,
        functionName: "passesMajority51",
        args: [BigInt(params.epochId), proposal.id],
        label: `passesMajority51 ${params.voting} ${proposal.id}`,
      })) as boolean;
    if (passed) passes += 1;
  }

  console.log(
    `[sync] epoch=${params.epochId} proposals=${params.proposals.length} registered=${registered} pending=${pending} withCid=${withCid} withVotes=${withVotes} meetsQuorum=${meetsQuorum} passesMajority51=${passes} votingFinalized=${votingFinalized} treasuryFinalized=${treasuryFinalized} voteWindowSeconds=${voteWindowSeconds}`
  );
}
