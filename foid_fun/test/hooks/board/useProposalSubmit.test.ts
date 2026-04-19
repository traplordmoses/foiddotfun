// test/hooks/board/useProposalSubmit.test.ts
// Covers the submit state machine's four core paths:
//   1. Happy path          — upload + propose + confirmed
//   2. User rejection      — peer items stay queued for retry
//   3. Upload failure      — item marked failed, batch continues
//   4. Validation failure  — not-touching items rejected pre-upload
// Plus the cancelItem escape hatch from P0-B1.
//
// We stub `uploadImage` and `propose` so no network / wallet is touched.
// The grid helpers (overlap/isTouching) are left real — they're pure and
// their bugs would silently break the test suite anyway.
/** @vitest-environment happy-dom */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import type { PendingItem } from "@/state/board";
import { TILE } from "@/lib/grid";

// Stub IPFS uploader so no actual HTTP goes out.
vi.mock("@/lib/ipfs", () => ({
  uploadImage: vi.fn(async (_name: string, _file: File, _mime: string) => "Qm" + "x".repeat(44)),
}));

// Stub isUserRejection so we can flag a particular error shape without
// having to match the real wagmi/viem error codes.
vi.mock("@/lib/errors", async () => {
  const actual = await vi.importActual<typeof import("@/lib/errors")>("@/lib/errors");
  return {
    ...actual,
    isUserRejection: (err: unknown) =>
      err instanceof Error && err.message === "USER_REJECTED",
    parseWeb3Error: (err: unknown) => ({
      message: err instanceof Error ? err.message : "unknown",
    }),
  };
});

import { useProposalSubmit } from "@/hooks/board/useProposalSubmit";
import { uploadImage } from "@/lib/ipfs";

const mockedUpload = uploadImage as unknown as ReturnType<typeof vi.fn>;

// Build a minimal pending item — rect is in world coordinates; using TILE
// units so the cell count is non-zero and rectCells returns truthy.
function makeItem(id: string, x = 0, y = 0, w = TILE, h = TILE): PendingItem {
  return {
    id,
    name: `item-${id}`,
    mime: "image/png",
    width: w,
    height: h,
    rect: { x, y, w, h },
    cells: 1,
    tipPerCellWei: 0n,
    previewUrl: `blob:fake-${id}`,
    file: new File([new Uint8Array([1, 2, 3])], `${id}.png`, { type: "image/png" }),
    cid: undefined,
    fitMode: "contain",
  };
}

const ADDR = "0x1234567890abcdef1234567890abcdef12345678" as const;
const HAPPY_TX = { txHash: "0xabc", receipt: {}, proposalId: 42 };

describe("useProposalSubmit — happy path", () => {
  beforeEach(() => {
    mockedUpload.mockReset().mockResolvedValue("Qm" + "x".repeat(44));
  });

  it("uploads, proposes, and confirms a single item", async () => {
    const propose = vi.fn().mockResolvedValue(HAPPY_TX);
    const onConfirmed = vi.fn();
    const onBatchDone = vi.fn();
    const item = makeItem("a");

    const { result } = renderHook(() =>
      useProposalSubmit({
        address: ADDR,
        propose,
        items: [item],
        occupiedRects: [{ x: TILE, y: 0, w: TILE, h: TILE }], // neighbour so isTouching passes
        onItemConfirmed: onConfirmed,
        onBatchDone,
      }),
    );

    await act(async () => {
      await result.current.submit();
    });

    expect(propose).toHaveBeenCalledOnce();
    expect(onConfirmed).toHaveBeenCalledOnce();
    expect(onBatchDone).toHaveBeenCalledOnce();
    const [[batchResult]] = onBatchDone.mock.calls;
    expect(batchResult.confirmed).toHaveLength(1);
    expect(batchResult.failed).toHaveLength(0);
    expect(batchResult.rejected).toHaveLength(0);
    expect(result.current.statuses[item.id]?.state).toBe("confirmed");
    expect(result.current.statuses[item.id]?.txHash).toBe("0xabc");
  });
});

describe("useProposalSubmit — user rejection mid-batch", () => {
  beforeEach(() => {
    mockedUpload.mockReset().mockResolvedValue("Qm" + "x".repeat(44));
  });

  it("marks rejected item + leaves peers queued for retry", async () => {
    // Three items; propose rejects the second. The third should land on
    // 'queued' (NOT failed) so the caller can offer the user a retry.
    const items = [
      makeItem("a", 0, 0),
      makeItem("b", TILE, 0),
      makeItem("c", TILE * 2, 0),
    ];
    const neighbour = { x: 0, y: TILE, w: TILE, h: TILE };
    const propose = vi
      .fn()
      .mockResolvedValueOnce({ ...HAPPY_TX, proposalId: 1 })
      .mockRejectedValueOnce(new Error("USER_REJECTED"))
      .mockResolvedValueOnce({ ...HAPPY_TX, proposalId: 3 });

    const { result } = renderHook(() =>
      useProposalSubmit({
        address: ADDR,
        propose,
        items,
        occupiedRects: [neighbour],
      }),
    );

    await act(async () => {
      await result.current.submit();
    });

    expect(propose).toHaveBeenCalledTimes(2); // 3rd never got attempted
    expect(result.current.statuses["a"]?.state).toBe("confirmed");
    expect(result.current.statuses["b"]?.state).toBe("rejected");
    expect(result.current.statuses["c"]?.state).toBe("queued");
  });
});

describe("useProposalSubmit — upload failure", () => {
  beforeEach(() => {
    mockedUpload.mockReset();
  });

  it("marks an upload-failed item without cancelling the batch", async () => {
    const items = [makeItem("a", 0, 0), makeItem("b", TILE, 0)];
    const neighbour = { x: 0, y: TILE, w: TILE, h: TILE };
    // First upload fails; second succeeds.
    mockedUpload
      .mockRejectedValueOnce(new Error("IPFS pin failed"))
      .mockResolvedValueOnce("Qm" + "y".repeat(44));
    const propose = vi.fn().mockResolvedValue(HAPPY_TX);

    const { result } = renderHook(() =>
      useProposalSubmit({
        address: ADDR,
        propose,
        items,
        occupiedRects: [neighbour],
      }),
    );

    await act(async () => {
      await result.current.submit();
    });

    expect(result.current.statuses["a"]?.state).toBe("failed");
    expect(result.current.statuses["a"]?.detail).toMatch(/upload failed/i);
    expect(result.current.statuses["b"]?.state).toBe("confirmed");
    // Propose only ran for item b.
    expect(propose).toHaveBeenCalledOnce();
  });
});

describe("useProposalSubmit — validation failures", () => {
  beforeEach(() => {
    mockedUpload.mockReset().mockResolvedValue("Qm" + "x".repeat(44));
  });

  it("throws when an item is not touching any existing placement", async () => {
    // NOTE: isTouching() treats an empty occupied list as "first placement —
    // anywhere is valid", so the not-touching branch only fires when there
    // IS something on the board and the new rect isn't adjacent. Seed one
    // placement at the origin and drop far from it.
    const propose = vi.fn();
    const items = [makeItem("lonely", 10_000, 10_000)];
    const occupied = [{ x: 0, y: 0, w: TILE, h: TILE }];

    const { result } = renderHook(() =>
      useProposalSubmit({
        address: ADDR,
        propose,
        items,
        occupiedRects: occupied,
      }),
    );

    await act(async () => {
      await expect(result.current.submit()).rejects.toThrow(/not touching/i);
    });
    expect(propose).not.toHaveBeenCalled();
  });

  it("throws when items overlap existing placements", async () => {
    const propose = vi.fn();
    const occupied = { x: 0, y: 0, w: TILE * 4, h: TILE * 4 };
    const item = makeItem("overlap-me", TILE, TILE); // squarely inside occupied

    const { result } = renderHook(() =>
      useProposalSubmit({
        address: ADDR,
        propose,
        items: [item],
        occupiedRects: [occupied],
      }),
    );

    await act(async () => {
      await expect(result.current.submit()).rejects.toThrow(/overlap/i);
    });
  });
});

describe("useProposalSubmit — cancelItem (P0-B1 escape hatch)", () => {
  beforeEach(() => {
    mockedUpload.mockReset();
  });

  it("skips propose for an item cancelled mid-upload — no ETH spent", async () => {
    // Design of the production hook: each new submit() starts with a fresh
    // cancelled Set (so stale cancels from a prior batch don't bleed
    // forward). The meaningful window for cancel is between upload-start
    // and propose-call. We simulate that by pausing the upload, calling
    // cancelItem while it's in flight, then resolving the upload and
    // asserting that propose NEVER fires for the cancelled item.
    let resolveUpload: ((cid: string) => void) | null = null;
    mockedUpload.mockImplementation(
      () =>
        new Promise<string>((resolve) => {
          resolveUpload = resolve;
        }),
    );
    const propose = vi.fn().mockResolvedValue(HAPPY_TX);
    const item = makeItem("cancel-me");
    const neighbour = { x: TILE, y: 0, w: TILE, h: TILE };

    const { result } = renderHook(() =>
      useProposalSubmit({
        address: ADDR,
        propose,
        items: [item],
        occupiedRects: [neighbour],
      }),
    );

    // Kick off submit but don't await — we need to interleave cancel.
    let submitPromise!: Promise<unknown>;
    act(() => {
      submitPromise = result.current.submit();
    });
    // Wait for the upload to reach the "uploading" state so we know we're
    // past the fresh-Set reset.
    await waitFor(() => {
      expect(result.current.statuses[item.id]?.state).toBe("uploading");
    });
    // Cancel while upload is still pending.
    act(() => {
      result.current.cancelItem(item.id);
    });
    // Now release the upload.
    resolveUpload!("Qm" + "x".repeat(44));

    await act(async () => {
      await submitPromise;
    });

    expect(result.current.statuses[item.id]?.state).toBe("rejected");
    expect(result.current.statuses[item.id]?.detail).toMatch(/removed from tray/i);
    expect(propose).not.toHaveBeenCalled();
  });

  it("clears the cancel set on the next submit() call (fresh-batch isolation)", async () => {
    // Cancel during submit #1 → rejected. Submit #2 should run cleanly.
    mockedUpload.mockResolvedValue("Qm" + "x".repeat(44));
    const propose = vi.fn().mockResolvedValue(HAPPY_TX);
    const neighbour = { x: TILE, y: 0, w: TILE, h: TILE };
    const itemA = makeItem("a");

    const { result } = renderHook(() =>
      useProposalSubmit({
        address: ADDR,
        propose,
        items: [itemA],
        occupiedRects: [neighbour],
      }),
    );

    // Submit #1: add a cancel during upload so item ends rejected.
    let resolveUpload: ((cid: string) => void) | null = null;
    mockedUpload.mockImplementationOnce(
      () =>
        new Promise<string>((resolve) => {
          resolveUpload = resolve;
        }),
    );
    let firstSubmit!: Promise<unknown>;
    act(() => {
      firstSubmit = result.current.submit();
    });
    await waitFor(() => {
      expect(result.current.statuses["a"]?.state).toBe("uploading");
    });
    act(() => {
      result.current.cancelItem("a");
    });
    resolveUpload!("Qm" + "x".repeat(44));
    await act(async () => {
      await firstSubmit;
    });
    expect(result.current.statuses["a"]?.state).toBe("rejected");

    // Submit #2 should start with a fresh cancel set, so 'a' lands.
    mockedUpload.mockResolvedValueOnce("Qm" + "y".repeat(44));
    await act(async () => {
      await result.current.submit();
    });
    await waitFor(() => {
      expect(result.current.statuses["a"]?.state).toBe("confirmed");
    });
    expect(propose).toHaveBeenCalledOnce();
  });
});
