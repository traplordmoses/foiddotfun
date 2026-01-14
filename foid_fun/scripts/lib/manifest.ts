import type { Address, Chain, Hex, PublicClient, Transport } from "viem";
import { hexToString, keccak256, stringToHex } from "viem";
import boardAbi from "../../src/abi/LoreboardBoardV2.json" assert { type: "json" };
import { readContractSafe } from "./contract";
import type { ChainProposal, ManifestPayload, Placement } from "./types";

const toBytes32Id = (value: string): Hex => {
  if (value.startsWith("0x") && value.length === 66) {
    return value as Hex;
  }
  return keccak256(stringToHex(value)) as Hex;
};

const fakeRootFromIds = (ids: Hex[]): Hex => {
  const concat = (`0x${ids.map((id) => id.slice(2)).join("")}` || "0x") as Hex;
  return keccak256(concat) as Hex;
};

const clonePlacement = (p: Placement): Placement => ({
  ...p,
  rect: { ...p.rect },
});

export function buildManifestPayload(params: {
  epoch: number;
  placements: Placement[];
  finalizedAt: number;
}): ManifestPayload {
  const placementsRoot = fakeRootFromIds(
    params.placements.map((placement) => toBytes32Id(placement.id))
  );
  const manifest = {
    epoch: params.epoch,
    finalizedAt: params.finalizedAt,
    placements: params.placements.map(clonePlacement),
    placementsRoot,
  };
  const manifestJson = JSON.stringify(manifest);
  const manifestRoot = keccak256(stringToHex(manifestJson)) as Hex;
  return { manifest, manifestJson, manifestRoot, placementsRoot };
}

function ensureIpfsPrefix(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  return trimmed.startsWith("ipfs://") ? trimmed : `ipfs://${trimmed}`;
}

export function asPlacement(proposal: ChainProposal, cid: string): Placement {
  return {
    id: proposal.id,
    owner: proposal.bidder,
    cid: ensureIpfsPrefix(cid),
    name: "",
    mime: "image/png",
    rect: proposal.rect,
    cells: proposal.cells,
    bidPerCellWei: proposal.bidPerCellWei.toString(),
    width: proposal.rect.w,
    height: proposal.rect.h,
    cidHash: proposal.cidHash,
  };
}

export async function fetchCidForPlacement(params: {
  publicClient: PublicClient<Transport, Chain>;
  board: Address;
  placementId: Hex;
}) {
  const cidBytes = (await readContractSafe({
    publicClient: params.publicClient,
    address: params.board,
    abi: boardAbi,
    functionName: "cidOf",
    args: [params.placementId],
    label: `cidOf ${params.board} ${params.placementId}`,
  })) as Hex;

  if (!cidBytes || cidBytes === "0x") return "";
  try {
    return hexToString(cidBytes);
  } catch {
    return "";
  }
}
