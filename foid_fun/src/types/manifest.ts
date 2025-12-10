import type { FinalizedPlacement } from "@/lib/types";

export type BoardCell = {
  x: number;
  y: number;
  imageCid: string;
  owner: `0x${string}`;
  placedAt: number;
};

// Adapted to match the manifest JSON our finalize pipeline writes today.
export type BoardManifest = {
  epoch: number;
  width?: number;
  height?: number;
  cells?: BoardCell[];
  placements: FinalizedPlacement[];
  renderCid?: string;
  finalizedAt?: number;
};
