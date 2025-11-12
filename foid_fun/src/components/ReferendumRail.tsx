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
};

type StatusPayload = {
  epoch: number;
  secondsLeft: number;
  latestManifestCID: string | null;
};

export default function ReferendumRail() {
  const [proposals, setProposals] = useState<ProposalLite[]>([]);
  const [status, setStatus] = useState<StatusPayload | null>(null);

  const refresh = useCallback(async () => {
    const [p, s] = await Promise.all([
      fetch("/api/proposals")
        .then((r) => r.json())
        .catch(() => ({ proposals: [] })),
      fetch("/api/status")
        .then((r) => r.json())
        .catch(() => null),
    ]);
    setProposals(p.proposals ?? []);
    setStatus(s);
  }, []);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 2000);
    return () => clearInterval(t);
  }, [refresh]);

  const cast = async (id: string, yes: boolean) => {
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

  return (
    <div className="rounded-2xl border border-white/15 bg-white/6 backdrop-blur-md p-4 text-white/90 shadow-[0_8px_30px_rgba(0,0,0,.18)]">
      <h2 className="font-semibold mb-2">Referendums</h2>

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

      <div className="max-h-72 overflow-auto space-y-2 text-sm">
        {proposals.length === 0 && (
          <div className="text-white/70">No active proposals.</div>
        )}
        {proposals.map((m) => {
          const voters = m.yes + m.no;
          const pct = voters ? Math.round((m.yes / voters) * 100) : 0;
          return (
            <div
              key={m.id}
              className="rounded-lg border border-white/15 bg-white/5 p-2"
            >
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
                  onClick={() => cast(m.id, true)}
                  className="px-2 py-1 bg-white/80 text-black rounded-md"
                  type="button"
                >
                  Yes
                </button>
                <button
                  onClick={() => cast(m.id, false)}
                  className="px-2 py-1 bg-black/50 text-white border border-white/20 rounded-md"
                  type="button"
                >
                  No
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
