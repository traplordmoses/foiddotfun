/** Follow owner-scoped pages; an incomplete refresh is an error, never a
 * fabricated complete history. The caller retains its last successful view. */
export async function fetchUserProposals<T>(address: string, signal?: AbortSignal): Promise<{ proposals: T[]; stale: boolean }> {
  const controller = new AbortController();
  const cancel = () => controller.abort();
  signal?.addEventListener("abort", cancel, { once: true });
  if (signal?.aborted) cancel();
  const timer = setTimeout(cancel, 20_000);
  const rows: T[] = [];
  let cursor: number | null = null;
  let stale = false;
  try {
    for (let page = 0; page < 20; page++) {
      const url: string = `/api/swipe/proposals?owner=${encodeURIComponent(address)}${cursor === null ? "" : `&scope=history&cursor=${cursor}`}`;
      const res = await fetch(url, { cache: "no-store", signal: controller.signal });
      if (!res.ok) throw new Error("Your proposal history is temporarily unavailable");
      const data = await res.json();
      if (!Array.isArray(data.proposals)) throw new Error("Invalid proposal history");
      rows.push(...data.proposals);
      stale ||= Boolean(data.stale);
      if (data.nextCursor === null || data.nextCursor === undefined) return { proposals: rows, stale };
      if (!Number.isSafeInteger(data.nextCursor) || (cursor !== null && data.nextCursor >= cursor)) throw new Error("Invalid history cursor");
      cursor = data.nextCursor;
    }
    throw new Error("Your history is too large for this view. Browse older proposals on the Vote page.");
  } finally { clearTimeout(timer); signal?.removeEventListener("abort", cancel); }
}
