// /src/hooks/board/useBoardData.ts
// Unified data loading for the board. Replaces the two-track pattern in page.tsx:
//   - /api/proposals  (canonized + voting)
//   - /api/swipe/proposals  (onchain voting in progress)
// Exposes a single atomic snapshot with { proposals, voting, debug }.
//
// Previously this hook polled the expensive endpoints on a raw 12s interval —
// even when the tab was hidden, and even when no new blocks had been produced.
// The hook now uses `publicClient.watchBlockNumber` to trigger a refetch only
// when the chain advances (cheap eth_blockNumber calls instead of heavy
// multicall reads), pauses entirely when the tab is hidden, and keeps a 60s
// safety-net interval for the case where a block watcher misses an event.
//
// Key invariants:
//   - AbortController on every tick (cancels in-flight fetches on unmount and
//     when a new tick fires with the previous fetch still pending).
//   - startTransition on every state write to keep the canvas responsive.
//   - Single source of truth — downstream consumers don't have to merge.
"use client";

import { startTransition, useCallback, useEffect, useRef, useState } from "react";
import { contractToWorldRect } from "@/lib/boardSpace";
import type { ProposalSummary, ListProposalsResponse } from "@/lib/api";
import { normalizeProposals } from "@/lib/board";
import { publicClient } from "@/lib/viem";

export type SwipeVotingProposal = {
  id: number;
  cid: string;
  x: number;
  y: number;
  w: number;
  h: number;
  proposer: string;
  votingEndsAt: number;
  forCount: number;
  againstCount: number;
};

export type BoardDataSnapshot = {
  proposals: ProposalSummary[];
  voting: SwipeVotingProposal[];
  debug: ListProposalsResponse["debug"] | null;
  loading: boolean;
  error: string | null;
};

/**
 * Safety-net interval for the case where the block watcher silently drops. We
 * still want the board to refresh at least once a minute if something goes
 * wrong with the RPC subscription. In the happy path this timer never fires
 * before the block watcher has already refetched.
 */
const DEFAULT_INTERVAL_MS = 60_000;

/** How often the block watcher polls the RPC for new blocks. */
const BLOCK_POLL_INTERVAL_MS = 4_000;

type RawSwipeProposal = {
  id: number;
  ipfsCid: string;
  gridX: number;
  gridY: number;
  gridW: number;
  gridH: number;
  proposer: string;
  votingEndsAt: number;
  forCount?: number;
  againstCount?: number;
  finalized: boolean;
  approved: boolean;
};

async function fetchBoardProposals(
  signal: AbortSignal,
  forceFresh = false,
): Promise<ListProposalsResponse> {
  const url = forceFresh ? "/api/proposals?bust=1" : "/api/proposals";
  const res = await fetch(url, { cache: "no-store", signal });
  if (!res.ok) throw new Error(`/api/proposals ${res.status}`);
  return res.json();
}

async function fetchSwipeProposals(
  signal: AbortSignal,
  forceFresh = false,
): Promise<{ proposals: RawSwipeProposal[] }> {
  // `bust=1` tells the API to skip its in-memory cache — necessary after
  // a successful submit so the user doesn't see a pre-submit cached
  // response for up to 15s. See /api/swipe/proposals/route.ts.
  const url = forceFresh ? "/api/swipe/proposals?bust=1" : "/api/swipe/proposals";
  const res = await fetch(url, { cache: "no-store", signal });
  if (!res.ok) return { proposals: [] };
  return res.json();
}

function mapActiveSwipe(raw: RawSwipeProposal[]): SwipeVotingProposal[] {
  const now = Math.floor(Date.now() / 1000);
  return raw
    .filter(
      (p) =>
        !p.finalized && !p.approved && p.votingEndsAt > now && (p.gridW ?? 0) > 0
    )
    .map((p) => {
      const worldRect = contractToWorldRect({
        x: p.gridX,
        y: p.gridY,
        w: p.gridW,
        h: p.gridH,
      });
      return {
        id: p.id,
        cid: p.ipfsCid,
        x: worldRect.x,
        y: worldRect.y,
        w: worldRect.w,
        h: worldRect.h,
        proposer: p.proposer,
        votingEndsAt: p.votingEndsAt,
        forCount: p.forCount ?? 0,
        againstCount: p.againstCount ?? 0,
      };
    });
}

export type UseBoardDataReturn = BoardDataSnapshot & {
  /** Force a fresh fetch outside the interval (e.g. after a successful submit). */
  refetch: () => Promise<void>;
};

export type UseBoardDataOptions = {
  /**
   * Suspend scheduled refetch ticks (desktop shell: window minimized to the
   * dock). While paused, the block watcher's cheap eth_blockNumber poll and
   * the safety interval keep running but their ticks no-op before touching
   * the heavy /api/proposals + /api/swipe/proposals endpoints — mirroring
   * the existing document.hidden gate. Un-pausing fires one catch-up tick
   * immediately (same as the visibilitychange handler), so a restored
   * window is fresh within a frame. Explicit `refetch()` calls are NOT
   * gated — a submit confirmation always lands.
   */
  paused?: boolean;
};

export function useBoardData(
  intervalMs: number = DEFAULT_INTERVAL_MS,
  opts: UseBoardDataOptions = {},
): UseBoardDataReturn {
  const paused = opts.paused ?? false;
  const [proposals, setProposals] = useState<ProposalSummary[]>([]);
  const [voting, setVoting] = useState<SwipeVotingProposal[]>([]);
  const [debug, setDebug] = useState<ListProposalsResponse["debug"] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Ref mirror so the long-lived tick closure reads the CURRENT pause state
  // without re-subscribing the block watcher on every minimize/restore.
  const pausedRef = useRef(paused);
  pausedRef.current = paused;
  // Set inside the main effect; lets the resume effect below trigger a
  // catch-up tick without owning the tick closure.
  const catchUpRef = useRef<(() => void) | null>(null);

  const runTick = useCallback(
    async (signal: AbortSignal, opts: { forceFresh?: boolean } = {}) => {
      const forceFresh = opts.forceFresh ?? false;
      const [boardRes, swipeRes] = await Promise.allSettled([
        fetchBoardProposals(signal, forceFresh),
        fetchSwipeProposals(signal, forceFresh),
      ]);

      if (signal.aborted) return;

      const boardData: ListProposalsResponse =
        boardRes.status === "fulfilled"
          ? boardRes.value
          : { proposals: [], debug: undefined };
      const swipeData: { proposals: RawSwipeProposal[] } =
        swipeRes.status === "fulfilled" ? swipeRes.value : { proposals: [] };
      const nextError =
        boardRes.status === "rejected" && swipeRes.status === "rejected"
          ? "The Loreboard could not be loaded."
          : null;

      const normalized = normalizeProposals(boardData.proposals);
      const activeSwipe = mapActiveSwipe(swipeData.proposals ?? []);

      startTransition(() => {
        setProposals(normalized);
        setDebug(boardData.debug ?? null);
        setVoting(activeSwipe);
        setError(nextError);
        setLoading(false);
      });
    },
    [],
  );

  // Shared ref so refetch() and the scheduled tick participate in the same
  // cancellation pool — prevents two concurrent fetches where the slower
  // (stale) one wins the state race. (Audit note P1-4.)
  const controllersRef = useRef<AbortController[]>([]);

  const abortAll = useCallback(() => {
    for (const c of controllersRef.current) {
      try {
        c.abort();
      } catch {
        /* ignore */
      }
    }
    controllersRef.current = [];
  }, []);

  const refetch = useCallback(async () => {
    // The caller wants fresh data — cancel anything currently in flight so
    // the new fetch can't be stomped by a stale response. `forceFresh`
    // also skips the server's in-memory cache (via ?bust=1), so a
    // just-submitted proposal doesn't wait for the 15s TTL to roll over.
    abortAll();
    const controller = new AbortController();
    controllersRef.current.push(controller);
    try {
      await runTick(controller.signal, { forceFresh: true });
    } catch (err) {
      if ((err as { name?: string })?.name === "AbortError") return;
      startTransition(() => {
        setError("The Loreboard could not be loaded.");
        setLoading(false);
      });
    } finally {
      const idx = controllersRef.current.indexOf(controller);
      if (idx >= 0) controllersRef.current.splice(idx, 1);
    }
  }, [runTick, abortAll]);

  // Tracks the block we last fetched against, so the block watcher can skip
  // redundant refetches when the watcher fires multiple times for the same
  // block (it can, on reconnects) and so the visibility handler can detect
  // whether the chain advanced while the tab was hidden.
  const lastBlockRef = useRef<bigint | null>(null);

  useEffect(() => {
    let cancelled = false;

    const tick = async (atBlock: bigint | null) => {
      if (cancelled) return;
      // Skip entirely when the tab is hidden — the user can't see the board
      // anyway, and a visibility-change handler below will catch up when they
      // return.
      if (typeof document !== "undefined" && document.hidden) return;
      // Same idea for a minimized shell window (opts.paused): the canvas is
      // parked in the dock, so scheduled refreshes are wasted work. The
      // resume effect below catches up the moment the window is restored.
      if (pausedRef.current) return;

      abortAll();
      const controller = new AbortController();
      controllersRef.current.push(controller);
      try {
        await runTick(controller.signal);
        if (atBlock !== null) lastBlockRef.current = atBlock;
      } catch (err) {
        if ((err as { name?: string })?.name === "AbortError") return;
        if (!cancelled) {
          startTransition(() => {
            setError("The Loreboard could not be loaded.");
            setLoading(false);
          });
        }
      } finally {
        const idx = controllersRef.current.indexOf(controller);
        if (idx >= 0) controllersRef.current.splice(idx, 1);
      }
    };

    // Initial fetch: read the current block up-front so we have a baseline.
    void (async () => {
      try {
        const block = await publicClient.getBlockNumber();
        await tick(block);
      } catch {
        // If the RPC is unreachable at boot, still try to fetch the API layer
        // — it may have a cached response.
        await tick(null);
      }
    })();

    // Block-height gate: refetch whenever a new block arrives. This is driven
    // by a cheap eth_blockNumber poll under the hood (BLOCK_POLL_INTERVAL_MS)
    // rather than hammering the expensive /api/proposals endpoint.
    const unwatch = publicClient.watchBlockNumber({
      emitOnBegin: false,
      pollingInterval: BLOCK_POLL_INTERVAL_MS,
      onBlockNumber: (blockNumber) => {
        if (cancelled) return;
        if (lastBlockRef.current !== null && blockNumber <= lastBlockRef.current) {
          // Already fetched for this (or a newer) block — no-op.
          return;
        }
        void tick(blockNumber);
      },
      onError: (err) => {
        console.warn("[useBoardData] block watcher error:", err);
      },
    });

    // Safety-net interval — if the block watcher stalls for any reason, make
    // sure the board still refreshes at least once a minute. This uses the
    // same tick path, so the visibility gate and in-flight cancellation apply.
    const safetyId = window.setInterval(() => {
      void tick(lastBlockRef.current);
    }, intervalMs);

    // When the tab becomes visible again, force a refetch in case blocks were
    // produced while hidden (watchBlockNumber may or may not keep running
    // depending on the browser's throttling policy).
    const onVisibilityChange = () => {
      if (cancelled) return;
      if (typeof document !== "undefined" && !document.hidden) {
        void tick(lastBlockRef.current);
      }
    };
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", onVisibilityChange);
    }

    // Expose a catch-up trigger for the pause/resume effect. Passing the
    // last-seen block keeps the block-gate semantics (a tick for a block we
    // already covered still refreshes the API layer, matching the
    // visibilitychange path).
    catchUpRef.current = () => void tick(lastBlockRef.current);

    return () => {
      cancelled = true;
      catchUpRef.current = null;
      unwatch();
      window.clearInterval(safetyId);
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", onVisibilityChange);
      }
      abortAll();
    };
  }, [intervalMs, runTick, abortAll]);

  // Pause → resume: one immediate catch-up fetch, so a restored window
  // shows current data instead of waiting for the next block/interval.
  const prevPausedRef = useRef(paused);
  useEffect(() => {
    const wasPaused = prevPausedRef.current;
    prevPausedRef.current = paused;
    if (wasPaused && !paused) catchUpRef.current?.();
  }, [paused]);

  return { proposals, voting, debug, loading, error, refetch };
}
