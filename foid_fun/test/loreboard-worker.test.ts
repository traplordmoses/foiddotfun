import { describe, expect, it } from "vitest";
import {
  buildManifestPayload,
  selectMaturedPlacementIds,
} from "../scripts/loreboard-worker";

describe("loreboard worker finalize selection", () => {
  it("returns only placements for the matured epoch", () => {
    const placements = [
      { epoch: 3, id: "0xaaa" },
      { epoch: 4, id: "0xbbb" },
      { epoch: 3, id: "0xccc" },
    ];

    const matured = selectMaturedPlacementIds({
      epochId: 3,
      nowSec: 200,
      endsAtSec: 150,
      placements,
    });

    expect(matured).toEqual(["0xaaa", "0xccc"]);
  });

  it("returns no placements when the epoch has not matured", () => {
    const placements = [{ epoch: 2, id: "0x111" }];

    const matured = selectMaturedPlacementIds({
      epochId: 2,
      nowSec: 100,
      endsAtSec: 150,
      placements,
    });

    expect(matured).toEqual([]);
  });
});

describe("manifest root stability", () => {
  it("produces stable roots for identical inputs", () => {
    const placements = [
      {
        id: "0xabc",
        owner: "0x0000000000000000000000000000000000000001",
        cid: "bafy-test",
        name: "",
        mime: "image/png" as const,
        rect: { x: 0, y: 0, w: 1, h: 1 },
        cells: 1,
        bidPerCellWei: "10",
        width: 1,
        height: 1,
      },
    ];

    const payloadA = buildManifestPayload({
      epoch: 7,
      placements,
      finalizedAt: 123456,
    });
    const payloadB = buildManifestPayload({
      epoch: 7,
      placements,
      finalizedAt: 123456,
    });

    expect(payloadA.manifestJson).toEqual(payloadB.manifestJson);
    expect(payloadA.manifestRoot).toEqual(payloadB.manifestRoot);
  });
});
