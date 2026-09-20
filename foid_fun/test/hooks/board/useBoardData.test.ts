// test/hooks/board/useBoardData.test.ts
// Covers the three invariants we depend on in the board page:
//   1. Every tick uses a fresh AbortController — a new tick cancels the
//      previous in-flight fetch so stale responses can't win the state race.
//   2. refetch() overrides the scheduled tick + participates in the same
//      cancellation pool.
//   3. Visibility gating: hidden tabs skip the tick entirely; becoming
//      visible again triggers a forced refetch.
/** @vitest-environment happy-dom */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";

// Stub publicClient so we don't reach for an RPC during tests. The hook
// only uses getBlockNumber + watchBlockNumber from it.
vi.mock("@/lib/viem", () => ({
  publicClient: {
    getBlockNumber: vi.fn(async () => 1n),
    watchBlockNumber: vi.fn(() => () => {}),
  },
}));

// Stub the API-adapter imports so normalizeProposals is a passthrough and
// the hook's downstream state writes are deterministic.
vi.mock("@/lib/board", async () => {
  const actual = await vi.importActual<typeof import("@/lib/board")>("@/lib/board");
  return {
    ...actual,
    normalizeProposals: (p: unknown[]) => p,
  };
});

import { useBoardData } from "@/hooks/board/useBoardData";

// Track every fetch call + the AbortSignal it received so we can assert on
// cancellation behaviour.
type FetchCall = { url: string; signal: AbortSignal; resolve: (body: unknown, status?: number) => void };
let pendingFetches: FetchCall[] = [];

function installFetchMock() {
  pendingFetches = [];
  const fetchMock = vi.fn((url: string, init?: RequestInit) => {
    const signal = (init?.signal ?? new AbortController().signal) as AbortSignal;
    return new Promise<Response>((resolve, reject) => {
      const aborted = () => {
        const err = new Error("Aborted");
        err.name = "AbortError";
        reject(err);
      };
      if (signal.aborted) {
        aborted();
        return;
      }
      signal.addEventListener("abort", aborted);
      pendingFetches.push({
        url,
        signal,
        resolve: (body: unknown, status = 200) =>
          resolve(
            new Response(JSON.stringify(body), {
              status,
              headers: { "Content-Type": "application/json" },
            }),
          ),
      });
    });
  });
  (globalThis as unknown as { fetch: typeof fetch }).fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
}

describe("useBoardData", () => {
  beforeEach(() => {
    installFetchMock();
  });
  afterEach(() => {
    pendingFetches = [];
  });

  it("uses a fresh AbortController for each tick and cancels the previous one on refetch()", async () => {
    const { result } = renderHook(() => useBoardData(60_000));

    // Wait for the initial tick to fire two fetches (/api/proposals +
    // /api/swipe/proposals).
    await waitFor(() => {
      expect(pendingFetches.length).toBeGreaterThanOrEqual(2);
    });
    const initial = pendingFetches.slice(0, 2);
    expect(initial[0].signal.aborted).toBe(false);

    // Call refetch while the first tick is still pending — the hook should
    // abort the initial signals and create new ones.
    let refetchPromise!: Promise<void>;
    act(() => {
      refetchPromise = result.current.refetch();
    });

    await waitFor(() => {
      expect(initial[0].signal.aborted).toBe(true);
      expect(initial[1].signal.aborted).toBe(true);
    });

    // Resolve the new fetches so refetch() settles.
    await waitFor(() => {
      expect(pendingFetches.length).toBeGreaterThanOrEqual(4);
    });
    const fresh = pendingFetches.slice(2);
    fresh.forEach((f) => f.resolve({ proposals: [] }));
    await refetchPromise;
  });

  it("releases loading=false after the initial tick resolves", async () => {
    const { result } = renderHook(() => useBoardData(60_000));
    // Initial state must be loading:true while the tick is pending.
    expect(result.current.loading).toBe(true);

    await waitFor(() => {
      expect(pendingFetches.length).toBeGreaterThanOrEqual(2);
    });
    pendingFetches.forEach((f) =>
      f.resolve(
        f.url.includes("swipe")
          ? { proposals: [] }
          : { proposals: [], debug: { note: "empty" } },
      ),
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
  });

  it("gates ticks on document.hidden and resumes when the tab becomes visible", async () => {
    // Start visible so the initial tick lands and we can drain it.
    Object.defineProperty(document, "hidden", {
      configurable: true,
      get: () => false,
    });
    renderHook(() => useBoardData(60_000));

    // Initial tick → two fetches. Drain so subsequent counts are clean.
    await waitFor(() => {
      expect(pendingFetches.length).toBeGreaterThanOrEqual(2);
    });
    pendingFetches.forEach((f) => f.resolve({ proposals: [] }));
    pendingFetches = [];

    // Flip to hidden, fire the visibility event — the handler must bail
    // (its own early return) because document.hidden is true.
    Object.defineProperty(document, "hidden", {
      configurable: true,
      get: () => true,
    });
    document.dispatchEvent(new Event("visibilitychange"));
    await new Promise((r) => setTimeout(r, 20));
    expect(pendingFetches.length).toBe(0);

    // Flip back to visible — the handler calls tick(), which should enqueue
    // a fresh pair of fetches.
    Object.defineProperty(document, "hidden", {
      configurable: true,
      get: () => false,
    });
    document.dispatchEvent(new Event("visibilitychange"));
    await waitFor(() => {
      expect(pendingFetches.length).toBeGreaterThanOrEqual(2);
    });
  });
  it("keeps successful data during a partial outage and exposes a retry state", async () => {
    const { result } = renderHook(() => useBoardData());
    await waitFor(() => expect(pendingFetches).toHaveLength(2));
    const original = [{ id: "kept", cid: "test" }];
    pendingFetches[0].resolve({ proposals: original });
    pendingFetches[1].resolve({ proposals: [] });
    await waitFor(() => expect(result.current.proposals).toEqual(original));
    let pending!: Promise<void>;
    act(() => { pending = result.current.refetch(); });
    await waitFor(() => expect(pendingFetches).toHaveLength(4));
    pendingFetches[2].resolve({ error: "unavailable" }, 503);
    pendingFetches[3].resolve({ proposals: [] });
    await act(async () => { await pending; });
    expect(result.current.proposals).toEqual(original);
    expect(result.current.error).toContain("last available data");
  });

  it("surfaces a server stale flag even when HTTP succeeds", async () => {
    const { result } = renderHook(() => useBoardData());
    await waitFor(() => expect(pendingFetches).toHaveLength(2));
    pendingFetches[0].resolve({ proposals: [] });
    pendingFetches[1].resolve({ proposals: [], stale: true });
    await waitFor(() => expect(result.current.error).toContain("last available data"));
  });

});
