// /src/lib/concurrency.ts
// Tiny bounded-concurrency runner. We intentionally avoid a dep on p-limit —
// this is the minimum viable version, correct for our usage: unordered fan-out
// of N tasks with at most `limit` in flight, surfacing the first error.
//
// Usage:
//   const results = await mapWithConcurrency(items, 4, async (item, idx) => {
//     return await upload(item);
//   });

export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  if (items.length === 0) return [];
  const effectiveLimit = Math.max(1, Math.min(limit, items.length));
  const results: R[] = new Array(items.length);
  let cursor = 0;

  const runOne = async (): Promise<void> => {
    while (true) {
      const i = cursor++;
      if (i >= items.length) return;
      results[i] = await worker(items[i], i);
    }
  };

  const runners = Array.from({ length: effectiveLimit }, () => runOne());
  await Promise.all(runners);
  return results;
}

/**
 * Like mapWithConcurrency but settles every task — a single failure does not
 * cancel the rest. Returns a per-item success/error result mirroring
 * Promise.allSettled.
 */
export async function mapWithConcurrencySettled<T, R>(
  items: readonly T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>
): Promise<PromiseSettledResult<R>[]> {
  if (items.length === 0) return [];
  const effectiveLimit = Math.max(1, Math.min(limit, items.length));
  const results: PromiseSettledResult<R>[] = new Array(items.length);
  let cursor = 0;

  const runOne = async (): Promise<void> => {
    while (true) {
      const i = cursor++;
      if (i >= items.length) return;
      try {
        const value = await worker(items[i], i);
        results[i] = { status: "fulfilled", value };
      } catch (reason) {
        results[i] = { status: "rejected", reason };
      }
    }
  };

  const runners = Array.from({ length: effectiveLimit }, () => runOne());
  await Promise.all(runners);
  return results;
}
