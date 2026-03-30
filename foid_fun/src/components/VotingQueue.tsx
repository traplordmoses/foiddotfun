"use client";

import { useEffect, useState, useCallback } from "react";
import { useAccount } from "wagmi";
import { cidToHttpUrl } from "@/lib/ipfsUrl";
import { CONTRACTS } from "@/lib/contracts/addresses";
import { LOREBOARD_ABI } from "@/lib/contracts/abis/loreboard";

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

function shortAddr(addr: string) {
  if (!addr || addr.length < 10) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-3)}`;
}

function timeRemaining(endsAt: number): string {
  const now = Math.floor(Date.now() / 1000);
  const diff = endsAt - now;
  if (diff <= 0) return "voting ended";
  const hours = Math.floor(diff / 3600);
  const mins = Math.floor((diff % 3600) / 60);
  if (hours > 24) return `${Math.floor(hours / 24)}d ${hours % 24}h left`;
  if (hours > 0) return `${hours}h ${mins}m left`;
  return `${mins}m left`;
}

export function VotingQueue() {
  const { address } = useAccount();
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [votedOn, setVotedOn] = useState<Set<number>>(new Set());
  const [voting, setVoting] = useState<number | null>(null);

  const fetchProposals = useCallback(async () => {
    try {
      const res = await fetch("/api/swipe/proposals");
      const data = await res.json();
      setProposals(data.proposals ?? []);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProposals();
    const interval = setInterval(fetchProposals, 30000);
    return () => clearInterval(interval);
  }, [fetchProposals]);

  const nowSec = Math.floor(Date.now() / 1000);
  const activeProposals = proposals.filter(
    (p) => !p.finalized && p.votingEndsAt > nowSec
  );

  // On-chain vote via castVote()
  const handleVote = useCallback(
    async (proposalId: number, approve: boolean) => {
      if (!address) return;
      setVoting(proposalId);

      try {
        const { getWalletClient, fluentTestnet } = await import("@/lib/viem");
        const walletClient = await getWalletClient();
        const contractAddr = CONTRACTS.SWIPE as `0x${string}`;

        await walletClient.writeContract({
          account: (walletClient.account ?? address) as `0x${string}`,
          address: contractAddr,
          abi: LOREBOARD_ABI,
          functionName: "castVote",
          args: [BigInt(proposalId), approve],
          chain: fluentTestnet,
        });

        setVotedOn((prev) => new Set(prev).add(proposalId));
        fetchProposals();
      } catch {
        // user rejected or error
      } finally {
        setVoting(null);
      }
    },
    [address, fetchProposals]
  );

  if (loading) {
    return (
      <div style={{ padding: "16px", color: "rgba(255,255,255,0.4)", fontSize: "12px" }}>
        Loading proposals...
      </div>
    );
  }

  if (activeProposals.length === 0) {
    return (
      <div style={{ padding: "16px", color: "rgba(255,255,255,0.3)", fontSize: "12px", textAlign: "center" }}>
        No active proposals in voting queue
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
      {activeProposals.map((p) => {
        const total = p.forCount + p.againstCount;
        const pct = total > 0 ? Math.round((p.forCount / total) * 100) : 0;
        const hasVoted = votedOn.has(p.id);
        const isVoting = voting === p.id;
        const imageUrl = p.ipfsCid ? cidToHttpUrl(p.ipfsCid) : null;

        return (
          <div
            key={p.id}
            style={{
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: "8px",
              padding: "12px",
              display: "flex",
              gap: "10px",
            }}
          >
            {imageUrl && (
              <div
                style={{
                  width: "56px",
                  height: "56px",
                  borderRadius: "4px",
                  overflow: "hidden",
                  flexShrink: 0,
                  border: "1px dashed rgba(62,238,196,0.3)",
                }}
              >
                <img
                  src={imageUrl}
                  alt=""
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              </div>
            )}

            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "4px",
                }}
              >
                <span style={{ fontSize: "11px", color: "rgba(62,238,196,0.9)", fontWeight: 600 }}>
                  #{p.id} by {shortAddr(p.proposer)}
                </span>
                <span style={{ fontSize: "10px", color: "rgba(255,215,0,0.7)" }}>
                  {timeRemaining(p.votingEndsAt)}
                </span>
              </div>

              <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.4)", marginBottom: "6px" }}>
                {p.status === "voting" ? "Active vote" : p.ipfsCid ? "Proposal" : ""}
              </div>

              <div
                style={{
                  height: "4px",
                  borderRadius: "2px",
                  background: "rgba(255,255,255,0.08)",
                  overflow: "hidden",
                  marginBottom: "6px",
                }}
              >
                <div
                  style={{
                    height: "100%",
                    width: `${pct}%`,
                    background:
                      pct >= 51
                        ? "rgba(62,238,196,0.7)"
                        : "rgba(255,184,0,0.7)",
                    transition: "width 0.3s",
                  }}
                />
              </div>

              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <span style={{ fontSize: "10px", color: "rgba(255,255,255,0.5)" }}>
                  {p.forCount} for / {p.againstCount} against ({pct}%)
                </span>

                {hasVoted ? (
                  <span style={{ fontSize: "10px", color: "rgba(62,238,196,0.6)" }}>
                    voted
                  </span>
                ) : address ? (
                  <div style={{ display: "flex", gap: "4px" }}>
                    <button
                      disabled={isVoting}
                      onClick={() => handleVote(p.id, true)}
                      style={{
                        fontSize: "10px",
                        padding: "2px 10px",
                        background: "rgba(62,238,196,0.15)",
                        border: "1px solid rgba(62,238,196,0.3)",
                        borderRadius: "4px",
                        color: "rgba(62,238,196,0.9)",
                        cursor: isVoting ? "wait" : "pointer",
                      }}
                    >
                      {isVoting ? "..." : "Approve"}
                    </button>
                    <button
                      disabled={isVoting}
                      onClick={() => handleVote(p.id, false)}
                      style={{
                        fontSize: "10px",
                        padding: "2px 10px",
                        background: "rgba(255,100,100,0.1)",
                        border: "1px solid rgba(255,100,100,0.2)",
                        borderRadius: "4px",
                        color: "rgba(255,150,150,0.8)",
                        cursor: isVoting ? "wait" : "pointer",
                      }}
                    >
                      Reject
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
