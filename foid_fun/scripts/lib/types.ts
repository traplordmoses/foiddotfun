import type { Address, Hex } from "viem";

export type Rect = { x: number; y: number; w: number; h: number };

export type Placement = {
  id: string;
  owner: string;
  cid: string;
  name: string;
  mime: "image/png" | "image/jpeg";
  rect: Rect;
  cells: number;
  bidPerCellWei: string;
  width: number;
  height: number;
  cidHash?: string;
};

export type ChainProposal = {
  id: Hex;
  bidder: Address;
  epoch: number;
  rect: Rect;
  bidPerCellWei: bigint;
  cells: number;
  cidHash: Hex;
  proposedAt: number;
};

export type ManifestPayload = {
  manifest: {
    epoch: number;
    finalizedAt: number;
    placements: Placement[];
    placementsRoot: Hex;
  };
  manifestJson: string;
  manifestRoot: Hex;
  placementsRoot: Hex;
};
