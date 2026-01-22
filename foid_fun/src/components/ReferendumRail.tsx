"use client";

import { useCallback, useEffect, useState } from "react";
import { formatEth } from "@/lib/wei";
import type { Rect } from "@/lib/grid";

type ProposalLite = {
  id: string;
  owner: string;
  cid: string;
  name: string;
  mime: "image/png" | "image/jpeg";
  rect: Rect;
  cells: number;
  bidPerCellWei: string;
  epochSubmitted: number;
  voteEndsAtEpoch: number;
  yes: number;
  no: number;
  status: "proposed" | "accepted" | "rejected" | "expired";
  voteEndsAtSec?: number;
  isVotable?: boolean;
  createdAt?: number;
};

type StatusPayload = {
  epoch: number;
  secondsLeft: number;
  latestManifestCID: string | null;
};

type ApiProposalsPayload = {
  proposals: ProposalLite[];
  debug?: {
    epoch?: number;
    latestBlock?: number | string;
    fromBlock?: number | string;
    pendingLogCount?: number;
    boardLogCount?: number;
    joinedRenderableCount?: number;
    pendingActiveCount?: number;
    lastError?: string | null;
    rangesScanned?: number;
  };
};

export default function ReferendumRail() {
  const [payload, setPayload] = useState<ApiProposalsPayload | null>(null);
  const [status, setStatus] = useState<StatusPayload | null>(null);
  const [lastRefreshAt, setLastRefreshAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const proposals = payload?.proposals ?? [];

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/status", { cache: "no-store" });
      if (res.ok) {
        setStatus(await res.json());
      }
    } catch {
      // best-effort only
    }
  }, []);

  const refresh = useCallback(async () => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    try {
      const res = await fetch("/api/proposals", {
        cache: "no-store",
        signal: controller.signal,
      });
      if (!res.ok) throw new Error(`proposals ${res.status}`);
      const data = (await res.json()) as ApiProposalsPayload;
      if (data?.proposals) {
        setPayload(data);
      }
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      clearTimeout(timeout);
      setLastRefreshAt(Date.now());
      void fetchStatus();
    }
  }, [fetchStatus]);

  useEffect(() => {
    refresh();
    const tick = () => {
      if (document?.visibilityState === "hidden") return;
      refresh();
    };
    const interval = setInterval(tick, 6000);
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        refresh();
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [refresh]);

  const cast = async (id: string, yes: boolean, allow: boolean) => {
    if (!allow) return;
    const voter = "0xDEADBEEFDEADBEEFDEADBEEFDEADBEEFDEADBEEF";
    await fetch("/api/vote", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ proposalId: id, voter, vote: yes }),
    }).catch(() => undefined);
    refresh();
  };

  const finalize = async () => {
    await fetch("/api/finalize", { method: "POST" }).catch(() => undefined);
    await refresh();
  };

  const nowSec = Math.floor(Date.now() / 1000);
  const sorted = [...proposals].sort((a, b) => {
    const score = (value?: number) => value ?? 0;
    const first = score(a.createdAt ?? a.epochSubmitted);
    const second = score(b.createdAt ?? b.epochSubmitted);
    if (first !== second) return second - first;
    return a.id.localeCompare(b.id);
  });

  const systemLine = () => {
    const debug = payload?.debug;
    const age = lastRefreshAt ? Math.max(0, Math.floor((Date.now() - lastRefreshAt) / 1000)) : null;
    const parts: string[] = [];
    if (age !== null) parts.push(`updated ${age}s ago`);
    if (debug?.latestBlock || debug?.fromBlock) {
      const latest = debug.latestBlock ?? "—";
      const from = debug.fromBlock ?? "—";
      parts.push(`blocks ${latest} → ${from}`);
    }
    const pushValue = (label: string, value?: number) => {
      if (typeof value === "number") {
        parts.push(`${label} ${value}`);
      }
    };
    pushValue("pendingLogs", debug?.pendingLogCount);
    pushValue("boardLogs", debug?.boardLogCount);
    pushValue("active", debug?.pendingActiveCount);
    if (typeof debug?.rangesScanned === "number") {
      parts.push(`ranges ${debug.rangesScanned}`);
    }
    return parts.join(" · ");
  };

  const debug = payload?.debug;

  return (
    <div className="rounded-2xl border border-white/15 bg-white/6 backdrop-blur-md p-4 text-white/90 shadow-[0_8px_30px_rgba(0,0,0,.18)]">
      <h2 className="font-semibold mb-2">Votes</h2>

      <div className="text-sm mb-3">
        <div>
          Epoch: <span className="font-semibold">{status?.epoch ?? "—"}</span>
        </div>
        <div>
          Seconds left: <span className="font-semibold">{status?.secondsLeft ?? "—"}</span>
        </div>
        <div className="truncate">
          Manifest: <code>{status?.latestManifestCID ?? "—"}</code>
        </div>
      </div>

      <button
        onClick={finalize}
        className="w-full mb-3 rounded-xl px-4 py-2 bg-cyan-300/90 hover:bg-cyan-200 text-black font-medium transition"
        type="button"
      >
        Finalize Epoch (dev)
      </button>

      <div className="text-[11px] text-white/60 mb-2 flex flex-wrap gap-2">
        <span>{systemLine() || "waiting for data..."}</span>
        {debug?.lastError && (
          <span className="text-rose-300">error: {debug.lastError}</span>
        )}
      </div>

      {error && (
        <div className="text-[11px] text-amber-200 mb-2">fetch issue: {error}</div>
      )}

      <div className="max-h-72 overflow-auto space-y-2 text-sm">
        {sorted.length === 0 && (
          <div className="text-white/70">No active proposals.</div>
        )}
        {sorted.map((m) => {
          const voters = m.yes + m.no;
          const pct = voters ? Math.round((m.yes / voters) * 100) : 0;
          const ends = m.voteEndsAtSec ?? 0;
          const isOpen = Boolean(m.isVotable ?? ends > nowSec);
          const badgeText = isOpen
            ? "VOTING OPEN"
            : m.status === "proposed"
            ? "AWAITING REGISTRATION"
            : m.status.toUpperCase();
          const hint =
            isOpen ? "" : m.status === "proposed" ? "awaiting registration" : "voting closed";
          return (
            <div
              key={m.id}
              className="relative rounded-lg border border-white/15 bg-white/5 p-2"
            >
              <div className="absolute top-2 right-2 rounded-full border border-white/20 bg-black/40 px-2 py-0.5 text-[10px] tracking-[0.2em] text-white/80">
                {badgeText}
              </div>
              <div className="flex items-center justify-between">
                <div className="font-medium">
                  {m.cells} cells · {formatEth(BigInt(m.bidPerCellWei))}/cell
                </div>
                <div className="text-xs uppercase tracking-wide opacity-80">
                  {m.status}
                </div>
              </div>
              <div className="text-xs opacity-85">
                Yes {m.yes} · No {m.no} · {pct}%
              </div>
              <div className="mt-2 flex gap-2">
                <button
                  onClick={() => cast(m.id, true, isOpen)}
                  className="px-2 py-1 bg-white/80 text-black rounded-md disabled:opacity-40"
                  type="button"
                  disabled={!isOpen}
                >
                  Yes
                </button>
                <button
                  onClick={() => cast(m.id, false, isOpen)}
                  className="px-2 py-1 bg-black/50 text-white border border-white/20 rounded-md disabled:opacity-40"
                  type="button"
                  disabled={!isOpen}
                >
                  No
                </button>
              </div>
              {!isOpen && (
                <div className="text-[11px] text-white/60 mt-1">
                  {hint}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
