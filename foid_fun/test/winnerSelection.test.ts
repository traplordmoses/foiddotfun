import { describe, expect, it } from "vitest";
import { sortCandidatesByTieBreak } from "../src/lib/winnerSelection";
import { overlap } from "../src/lib/grid";

describe("winner selection tie-break", () => {
  it("orders by bid desc, epochSubmitted asc, id asc", () => {
    const candidates = [
      {
        id: "a-id",
        rect: { x: 0, y: 0, w: 1, h: 1 },
        bidPerCellWei: "10",
        epochSubmitted: 1,
      },
      {
        id: "aa-id",
        rect: { x: 0, y: 0, w: 1, h: 1 },
        bidPerCellWei: "10",
        epochSubmitted: 1,
      },
      {
        id: "c-id",
        rect: { x: 0, y: 0, w: 1, h: 1 },
        bidPerCellWei: "12",
        epochSubmitted: 5,
      },
      {
        id: "b-id",
        rect: { x: 0, y: 0, w: 1, h: 1 },
        bidPerCellWei: "10",
        epochSubmitted: 2,
      },
    ];

    const sorted = sortCandidatesByTieBreak(candidates);
    expect(sorted.map((c) => c.id)).toEqual(["c-id", "a-id", "aa-id", "b-id"]);
  });
});

describe("overlap edge-touch", () => {
  it("treats edge-touching rects as non-overlapping", () => {
    const a = { x: 0, y: 0, w: 10, h: 10 };
    const b = { x: 10, y: 0, w: 10, h: 10 };
    const c = { x: 9, y: 0, w: 10, h: 10 };

    expect(overlap(a, b)).toBe(false);
    expect(overlap(a, c)).toBe(true);
  });
});
