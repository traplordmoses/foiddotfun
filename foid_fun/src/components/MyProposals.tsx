"use client";

import { useEffect, useState, useCallback } from "react";
import { useAccount } from "wagmi";
import { useSwipePropose } from "@/hooks/useSwipePropose";
import { cidToHttpUrl } from "@/lib/ipfsUrl";
import { parseWeb3Error, isUserRejection } from "@/lib/errors";

type Proposal = {
  id: number;
  proposer: string;
  ipfsCid: string;
  imageUrl?: string | null;
  createdAt: number;
  votingEndsAt: number;
  finalized: boolean;
  approved: boolean;
  status?: string;
  forCount: number;
  againstCount: number;
};

type VoucherInfo = {
  issuedAt: number;
  expiresAt: number;
  claimed: boolean;
};

function timeUntil(ts: number): string {
  const diff = ts - Math.floor(Date.now() / 1000);
  if (diff <= 0) return "expired";
  const days = Math.floor(diff / 86400);
  const hours = Math.floor((diff % 86400) / 3600);
  if (days > 0) return `${days}d ${hours}h`;
  return `${hours}h ${Math.floor((diff % 3600) / 60)}m`;
}

export function MyProposals() {
  const { address } = useAccount();
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!address) return;
    try {
      const res = await fetch("/api/swipe/proposals");
      const data = await res.json();
      const mine = (data.proposals ?? []).filter(
        (p: Proposal) => p.proposer.toLowerCase() === address.toLowerCase()
      );
      setProposals(mine);

    } catch {
      // silent
    }
  }, [address]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  if (!address) return null;
  if (proposals.length === 0) {
    return (
      <div style={{ padding: "16px", color: "rgba(255,255,255,0.3)", fontSize: "12px", textAlign: "center" }}>
        No proposals yet. Submit one above.
      </div>
    );
  }

  const active = proposals.filter((p) => !p.finalized);
  const approved = proposals.filter((p) => p.finalized && p.approved);
  const rejected = proposals.filter((p) => p.finalized && !p.approved);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
      {error && (
        <div style={{ padding: "8px", background: "rgba(255,50,50,0.1)", borderRadius: "4px", fontSize: "11px", color: "rgba(255,150,150,0.9)" }}>
          {error}
        </div>
      )}

      {active.map((p) => (
        <ProposalRow key={p.id} proposal={p} status="voting" />
      ))}

      {approved.map((p) => (
        <ProposalRow key={p.id} proposal={p} status="approved" />
      ))}

      {rejected.map((p) => (
        <ProposalRow key={p.id} proposal={p} status="rejected" />
      ))}
    </div>
  );
}

function ProposalRow({
  proposal: p,
  status,
  onClaim,
  isClaiming,
}: {
  proposal: Proposal;
  status: "voting" | "approved" | "rejected";
  onClaim?: () => void;
  isClaiming?: boolean;
}) {
  const total = p.forCount + p.againstCount;
  const pct = total > 0 ? Math.round((p.forCount / total) * 100) : 0;
  const imageUrl = p.ipfsCid ? cidToHttpUrl(p.ipfsCid) : null;

  const statusColors = {
    voting: { bg: "rgba(255,215,0,0.08)", border: "rgba(255,215,0,0.2)", text: "rgba(255,215,0,0.8)" },
    approved: { bg: "rgba(62,238,196,0.08)", border: "rgba(62,238,196,0.2)", text: "rgba(62,238,196,0.8)" },
    rejected: { bg: "rgba(255,100,100,0.06)", border: "rgba(255,100,100,0.15)", text: "rgba(255,100,100,0.6)" },
  };
  const c = statusColors[status];

  return (
    <div
      style={{
        background: c.bg,
        border: `1px solid ${c.border}`,
        borderRadius: "6px",
        padding: "10px",
        display: "flex",
        alignItems: "center",
        gap: "10px",
      }}
    >
      {imageUrl && (
        <div style={{ width: "40px", height: "40px", borderRadius: "4px", overflow: "hidden", flexShrink: 0 }}>
          <img src={imageUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        </div>
      )}

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: "11px", fontWeight: 600, color: c.text }}>
            #{p.id} — {status === "voting" ? "In Voting" : status === "approved" ? "Approved" : "Rejected"}
          </span>
          <span style={{ fontSize: "10px", color: "rgba(255,255,255,0.4)" }}>
            {pct}% ({p.forCount}/{total})
          </span>
        </div>

        {p.status && (
          <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.3)", marginTop: "2px" }}>
            {p.status}
          </div>
        )}
      </div>

      {status === "approved" && onClaim && (
        <button
          onClick={onClaim}
          disabled={isClaiming}
          style={{
            fontSize: "10px",
            padding: "4px 12px",
            background: "rgba(62,238,196,0.2)",
            border: "1px solid rgba(62,238,196,0.4)",
            borderRadius: "4px",
            color: "rgba(62,238,196,1)",
            cursor: isClaiming ? "wait" : "pointer",
            fontWeight: 600,
            whiteSpace: "nowrap",
          }}
        >
          {isClaiming ? "Claiming..." : "Claim (0.001 ETH)"}
        </button>
      )}
    </div>
  );
}
