"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAccount } from "wagmi";
import Link from "next/link";
import { useParams } from "next/navigation";
import { getWalletClient } from "@/lib/viem";
import { CONTRACTS } from "@/lib/contracts/addresses";
import { SWIPE_ABI } from "@/lib/contracts/abis/swipe";
import { FoidOSWindow } from "@/components/FoidOSWindow";
import { useSwipeVote } from "@/hooks/useSwipeVote";
import { useReadContract } from "wagmi";
import toast from "react-hot-toast";
import { cidToHttpUrl, ipfsToHttp } from "@/lib/ipfsUrl";

function tryNextGateway(el: HTMLImageElement, cid?: string) {
  if (!cid) return;
  const urls = ipfsToHttp(cid);
  const idx = Number(el.dataset.gatewayIndex ?? "-1") + 1;
  if (idx < urls.length) { el.src = urls[idx]; el.dataset.gatewayIndex = String(idx); }
}

function truncateAddress(addr: string): string {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

const EIP712_DOMAIN = {
  name: "FoidSwipe",
  version: "1",
  chainId: 20994,
  verifyingContract: CONTRACTS.SWIPE as `0x${string}`,
};

const EIP712_TYPES = {
  SwipeVote: [
    { name: "proposalId", type: "uint256" },
    { name: "approve", type: "bool" },
    { name: "deadline", type: "uint256" },
  ],
} as const;

export default function ProposalDetailPage() {
  const params = useParams();
  const proposalId = Number(params.id);
  const { address, isConnected } = useAccount();

  const [voting, setVoting] = useState(false);
  const [voted, setVoted] = useState(false);
  const [timeLeft, setTimeLeft] = useState("");
  const [voteCounts, setVoteCounts] = useState({ forCount: 0, againstCount: 0 });

  const contractAddr = (CONTRACTS.SWIPE ?? "") as `0x${string}`;
  const enabled = !!contractAddr;

  // Read proposal data
  const { data: proposalRaw } = useReadContract({
    address: contractAddr,
    abi: SWIPE_ABI,
    functionName: "getProposal",
    args: [BigInt(proposalId)],
    query: { enabled },
  });

  const proposal = proposalRaw as
    | {
        id: bigint;
        proposer: string;
        ipfsCid: string;
        createdAt: bigint;
        votingEndsAt: bigint;
        finalized: boolean;
        canonized: boolean;
        trestEntryId: bigint;
      }
    | undefined;

  // Fetch vote counts from API
  useEffect(() => {
    let alive = true;
    const fetchVotes = async () => {
      try {
        const res = await fetch(`/api/swipe/vote?proposalId=${proposalId}`);
        if (!res.ok) return;
        const data = await res.json();
        if (!alive) return;
        setVoteCounts({ forCount: data.forCount ?? 0, againstCount: data.againstCount ?? 0 });
      } catch {}
    };
    fetchVotes();
    const interval = setInterval(fetchVotes, 5000);
    return () => { alive = false; clearInterval(interval); };
  }, [proposalId]);

  // Timer
  useEffect(() => {
    if (!proposal) return;
    const update = () => {
      const now = Math.floor(Date.now() / 1000);
      const diff = Number(proposal.votingEndsAt) - now;
      if (diff <= 0) {
        setTimeLeft("Voting ended");
        return;
      }
      const h = Math.floor(diff / 3600);
      const m = Math.floor((diff % 3600) / 60);
      const s = diff % 60;
      setTimeLeft(`${h}h ${m}m ${s}s`);
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [proposal]);

  const isActive = useMemo(() => {
    if (!proposal) return false;
    const now = Math.floor(Date.now() / 1000);
    return !proposal.finalized && now < Number(proposal.votingEndsAt);
  }, [proposal]);

  const totalVotes = voteCounts.forCount + voteCounts.againstCount;

  const handleVote = useCallback(
    async (approve: boolean) => {
      if (!isConnected || !address || !proposal) return;
      try {
        setVoting(true);
        const walletClient = await getWalletClient();

        const signature = await walletClient.signTypedData({
          account: walletClient.account ?? address,
          domain: EIP712_DOMAIN,
          types: EIP712_TYPES,
          primaryType: "SwipeVote",
          message: {
            proposalId: BigInt(proposalId),
            approve,
            deadline: BigInt(Number(proposal.votingEndsAt)),
          },
        });

        const res = await fetch("/api/swipe/vote", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            proposalId,
            approve,
            deadline: Number(proposal.votingEndsAt),
            signature,
            voter: address,
          }),
        });

        if (!res.ok) throw new Error("Vote submission failed");

        toast.success(approve ? "Approved!" : "Rejected!");
        setVoted(true);
        // Refresh vote counts
        const countRes = await fetch(`/api/swipe/vote?proposalId=${proposalId}`);
        if (countRes.ok) {
          const data = await countRes.json();
          setVoteCounts({ forCount: data.forCount ?? 0, againstCount: data.againstCount ?? 0 });
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Vote failed");
      } finally {
        setVoting(false);
      }
    },
    [isConnected, address, proposal, proposalId]
  );

  // Swipe vote
  const swipe = useSwipeVote({
    threshold: 100,
    onSwipeRight: () => handleVote(true),
    onSwipeLeft: () => handleVote(false),
  });

  const canSwipe = isActive && !voted && !voting;

  if (!proposal) {
    return (
      <main className="relative isolate min-h-screen bg-foid-bg text-white/90 px-4 py-8">
        <div className="pointer-events-none fixed inset-0 z-0 vignette" />
        <div className="relative z-10 mx-auto max-w-4xl">
          <FoidOSWindow title={`proposal_${proposalId}.exe`}>
            <div className="p-6">
              <Link
                href="/swipe"
                className="mb-4 inline-flex items-center text-sm text-white/40 transition hover:text-purple-400"
              >
                &larr; Back to Swipe
              </Link>
              <div className="flex items-center justify-center py-20">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-purple-500 border-t-transparent" />
              </div>
            </div>
          </FoidOSWindow>
        </div>
      </main>
    );
  }

  return (
    <main className="relative isolate min-h-screen bg-foid-bg text-white/90 px-4 py-8 pb-28">
      <div className="pointer-events-none fixed inset-0 z-0 vignette" />
      <div className="relative z-10 mx-auto max-w-4xl">
        <FoidOSWindow title={`proposal_${proposalId}.exe`}>
          <div className="p-4 md:p-6 flex flex-col gap-6">
            <Link
              href="/swipe"
              className="inline-flex items-center text-sm text-white/40 transition hover:text-purple-400"
            >
              &larr; Back to Swipe
            </Link>

            {/* Header */}
            <div className="flex items-center justify-between">
              <h1 className="text-xl font-bold text-white">
                Proposal #{proposalId}
              </h1>
              <span
                className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wider ${
                  proposal.finalized
                    ? proposal.canonized
                      ? "bg-green-600/20 text-green-400"
                      : "bg-red-600/20 text-red-400"
                    : isActive
                      ? "bg-amber-500/20 text-amber-400"
                      : "bg-neutral-700/30 text-neutral-400"
                }`}
              >
                {proposal.finalized
                  ? proposal.canonized ? "Canonized" : "Rejected"
                  : isActive ? timeLeft : "Voting ended"}
              </span>
            </div>

            {/* Single proposal card — swipeable on active proposals */}
            <div className="mx-auto w-full max-w-md">
              <div
                className="relative overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-900/40"
                {...(canSwipe ? swipe.handlers : {})}
                style={canSwipe ? { ...swipe.style, touchAction: "pan-y" } : undefined}
              >
                {canSwipe && swipe.direction === "right" && (
                  <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
                    <span className="rounded-xl border-4 border-green-500 px-4 py-1 text-lg font-black uppercase text-green-500 -rotate-12 opacity-80">
                      Approve
                    </span>
                  </div>
                )}
                {canSwipe && swipe.direction === "left" && (
                  <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
                    <span className="rounded-xl border-4 border-red-500 px-4 py-1 text-lg font-black uppercase text-red-500 rotate-12 opacity-80">
                      Reject
                    </span>
                  </div>
                )}
                <div className="aspect-square">
                  {proposal.ipfsCid ? (
                    <img
                      src={cidToHttpUrl(proposal.ipfsCid)}
                      alt={`Proposal #${proposalId}`}
                      className="h-full w-full object-cover"
                      draggable={false}
                      onError={(e) => tryNextGateway(e.currentTarget, proposal.ipfsCid)}
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-neutral-600">
                      Loading...
                    </div>
                  )}
                </div>
                <div className="border-t border-neutral-800 bg-neutral-900/60 px-4 py-3">
                  <span className="text-[10px] uppercase tracking-wider text-neutral-500">
                    Proposer
                  </span>
                  <div className="mt-1 font-mono text-xs text-neutral-300">
                    {truncateAddress(proposal.proposer)}
                  </div>
                </div>
              </div>
            </div>

            {/* Swipe hint */}
            {canSwipe && (
              <div className="text-center text-xs text-white/40">
                Drag left to reject, right to approve · or use buttons below
              </div>
            )}

            {/* Vote progress */}
            {totalVotes > 0 && (
              <div className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-4">
                <div className="mb-2 flex justify-between text-sm font-mono">
                  <span className="text-green-400">
                    {voteCounts.forCount} approve
                  </span>
                  <span className="text-red-400">
                    {voteCounts.againstCount} reject
                  </span>
                </div>
                <div className="flex h-3 overflow-hidden rounded-full bg-neutral-800">
                  <div
                    className="bg-green-500 transition-all"
                    style={{
                      width: `${(voteCounts.forCount / totalVotes) * 100}%`,
                    }}
                  />
                  <div
                    className="bg-red-500 transition-all"
                    style={{
                      width: `${(voteCounts.againstCount / totalVotes) * 100}%`,
                    }}
                  />
                </div>
              </div>
            )}

            {/* Button voting fallback */}
            {isActive && !voted && (
              <div className="rounded-xl border border-purple-500/20 bg-purple-500/5 p-4">
                <h2 className="mb-3 text-center text-xs font-semibold uppercase tracking-wider text-white/60">
                  Cast Your Vote
                </h2>
                <div className="flex gap-4">
                  <button
                    onClick={() => handleVote(false)}
                    disabled={voting || !isConnected}
                    className="flex-1 rounded-lg border border-red-500/30 bg-red-600/20 py-2.5 text-sm font-semibold text-red-300 transition hover:bg-red-600/40 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {voting ? "..." : "Reject"}
                  </button>
                  <button
                    onClick={() => handleVote(true)}
                    disabled={voting || !isConnected}
                    className="flex-1 rounded-lg border border-green-500/30 bg-green-600/20 py-2.5 text-sm font-semibold text-green-300 transition hover:bg-green-600/40 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {voting ? "..." : "Approve"}
                  </button>
                </div>
              </div>
            )}

            {voted && !proposal.finalized && (
              <div className="rounded-lg border border-purple-500/20 bg-purple-500/5 p-3 text-center text-sm text-purple-300">
                You have voted. Results revealed when voting ends.
              </div>
            )}

            {proposal.finalized && (
              <div className="rounded-xl border border-purple-500/20 bg-purple-500/5 p-4 text-center">
                <h2 className="mb-1 text-xs font-semibold uppercase tracking-wider text-purple-300">
                  Proposal Complete
                </h2>
                <p className="text-sm text-neutral-400">
                  {proposal.canonized ? (
                    <>
                      This meme was canonized to the{" "}
                      <Link href="/gallery" className="text-purple-400 hover:underline">
                        Gallery
                      </Link>
                      !
                    </>
                  ) : (
                    "This proposal was rejected by the community."
                  )}
                </p>
              </div>
            )}
          </div>
        </FoidOSWindow>
      </div>
    </main>
  );
}
