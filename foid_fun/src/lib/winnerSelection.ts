import type { Rect } from "@/lib/grid";

export type WinnerCandidate = {
  id: string;
  rect: Rect;
  bidPerCellWei: string | bigint;
  epochSubmitted: number;
};

export function compareCandidates(a: WinnerCandidate, b: WinnerCandidate): number {
  const bidA = BigInt(a.bidPerCellWei);
  const bidB = BigInt(b.bidPerCellWei);
  if (bidA !== bidB) return bidB > bidA ? 1 : -1;
  if (a.epochSubmitted !== b.epochSubmitted) {
    return a.epochSubmitted - b.epochSubmitted;
  }
  return a.id.toLowerCase().localeCompare(b.id.toLowerCase());
}

export function sortCandidatesByTieBreak<T extends WinnerCandidate>(candidates: T[]): T[] {
  return candidates.slice().sort(compareCandidates);
}
