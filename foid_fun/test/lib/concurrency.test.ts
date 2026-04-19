// test/lib/concurrency.test.ts
// Covers both runners in @/lib/concurrency:
//   - mapWithConcurrency        (surfaces first error)
//   - mapWithConcurrencySettled (returns per-item Promise.allSettled results)
//
// The four behaviours the submit pipeline depends on:
//   1. Result array preserves input order even though execution is unordered.
//   2. At most `limit` tasks are in flight at any point.
//   3. Settled variant returns per-item errors without cancelling peers.
//   4. Empty input short-circuits to an empty array without touching the worker.
import { describe, it, expect, vi } from "vitest";
import { mapWithConcurrency, mapWithConcurrencySettled } from "@/lib/concurrency";

/** Helper: promise that resolves to `value` after `ms`. */
const delay = <T>(value: T, ms: number) =>
  new Promise<T>((resolve) => setTimeout(() => resolve(value), ms));

describe("mapWithConcurrency", () => {
  it("preserves input order in the result array (unordered execution)", async () => {
    // Give the middle item the longest delay so, if results were appended in
    // completion order, it would land last. With ordered-by-index writes it
    // must land in slot 1.
    const items = [10, 80, 20];
    const result = await mapWithConcurrency(items, 3, async (n) => {
      await delay(null, n);
      return n * 2;
    });
    expect(result).toEqual([20, 160, 40]);
  });

  it("bounds concurrency to the limit parameter", async () => {
    let inFlight = 0;
    let peak = 0;
    const items = Array.from({ length: 12 }, (_, i) => i);
    await mapWithConcurrency(items, 3, async (_n) => {
      inFlight++;
      peak = Math.max(peak, inFlight);
      await delay(null, 20);
      inFlight--;
    });
    expect(peak).toBeLessThanOrEqual(3);
    // And we actually USED the parallelism — a bounded-to-3 run should peak
    // at 3 for a 12-item set, not just 1.
    expect(peak).toBeGreaterThanOrEqual(2);
  });

  it("returns an empty array for empty input without calling the worker", async () => {
    const worker = vi.fn();
    const result = await mapWithConcurrency([], 4, worker);
    expect(result).toEqual([]);
    expect(worker).not.toHaveBeenCalled();
  });

  it("surfaces the first error (non-settled variant is fail-fast)", async () => {
    const items = [1, 2, 3];
    await expect(
      mapWithConcurrency(items, 2, async (n) => {
        if (n === 2) throw new Error("boom");
        await delay(null, 5);
        return n;
      }),
    ).rejects.toThrow("boom");
  });

  it("clamps limit to [1, items.length]", async () => {
    // limit=0 would be a bug but shouldn't hang; it should act as limit=1.
    const seen: number[] = [];
    await mapWithConcurrency([1, 2, 3], 0, async (n) => {
      seen.push(n);
    });
    expect(seen).toEqual([1, 2, 3]);
  });
});

describe("mapWithConcurrencySettled", () => {
  it("returns per-item fulfilled/rejected without cancelling the batch", async () => {
    const results = await mapWithConcurrencySettled([1, 2, 3, 4], 2, async (n) => {
      if (n === 2) throw new Error("two failed");
      await delay(null, 5);
      return n * 10;
    });
    expect(results).toHaveLength(4);
    expect(results[0]).toEqual({ status: "fulfilled", value: 10 });
    expect(results[1]).toMatchObject({ status: "rejected" });
    expect((results[1] as PromiseRejectedResult).reason).toBeInstanceOf(Error);
    expect(results[2]).toEqual({ status: "fulfilled", value: 30 });
    expect(results[3]).toEqual({ status: "fulfilled", value: 40 });
  });

  it("preserves order across mixed success + failure", async () => {
    const results = await mapWithConcurrencySettled([100, 10, 60], 3, async (n) => {
      await delay(null, n);
      if (n === 10) throw new Error("middle");
      return n;
    });
    expect(results.map((r) => r.status)).toEqual(["fulfilled", "rejected", "fulfilled"]);
  });

  it("returns an empty array for empty input", async () => {
    const worker = vi.fn();
    const result = await mapWithConcurrencySettled([], 4, worker);
    expect(result).toEqual([]);
    expect(worker).not.toHaveBeenCalled();
  });
});
