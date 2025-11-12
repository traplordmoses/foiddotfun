// /src/lib/types.ts
export type Rect = { x: number; y: number; w: number; h: number };

export type PlacementIntent = {
  id: string;
  owner: string;
  cid: string;
  rect: Rect;
  cells: number;
  feePerCellWei: string;   // keep as string for JSON safety
  tipPerCellWei: string;   // keep as string for JSON safety
  timeMs: number;          // <-- used by finalize/mempool sorts
  // optional (present when coming from client)
  name?: string;
  mime?: "image/png" | "image/jpeg";
  fitMode?: "contain" | "cover";
};

export type FinalizedPlacement = {
  id: string;
  owner: string;
  cid: string;
  x: number; y: number; w: number; h: number;
  cells: number;
  // optional metadata
  name?: string;
  mime?: "image/png" | "image/jpeg";
  fitMode?: "contain" | "cover";
  ttl?: number;
  canon?: string;
};

export type Manifest = {
  epoch: number;
  finalizedAt: number;          // unix seconds
  baseFeePerCellWei: string;
  placements: FinalizedPlacement[];
};
