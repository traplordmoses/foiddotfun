"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAccount } from "wagmi";
import Link from "next/link";
import { useParams } from "next/navigation";
import { CONTRACTS } from "@/lib/contracts/addresses";
import { LOREBOARD_ABI } from "@/lib/contracts/abis/loreboard";
import { FoidOSWindow } from "@/components/FoidOSWindow";
import { useSwipeVote } from "@/hooks/useSwipeVote";
import { useSwipeCastVote } from "@/hooks/useSwipeCastVote";
import { useReadContract } from "wagmi";
import toast from "react-hot-toast";
import { cidToHttpUrl } from "@/lib/ipfsUrl";
import { tryNextGateway, truncateAddress } from "@/lib/swipeConstants";
import type { OnChainProposal } from "@/types/vote";

export default function ProposalDetailPage() {
  const params = useParams();
  const proposalId = Number(params.id);
  const { address, isConnected } = useAccount();
  const [timeLeft, setTimeLeft] = useState("");

  const contractAddr = (CONTRACTS.SWIPE ?? "") as `0x${string}`;

  // Read proposal data from chain
  const { data: proposalRaw } = useReadContract({
    address: contractAddr,
    abi: LOREBOARD_ABI,
    functionName: "getProposal",
    args: [BigInt(proposalId)],
    query: { enabled: !!contractAddr },
  });

  const proposal = proposalRaw as OnChainProposal | undefined;

  // Onchain vote hook — reads tallies and hasVoted directly from contract
  const {
    castVote,
    isWriting,
    isConfirming,
    isConfirmed,
    error: voteError,
    reset,
    refetch,
    forCount,
    againstCount,
    hasVoted,
  } = useSwipeCastVote({ proposalId });

  // Refetch tallies after tx confirms
  useEffect(() => {
    if (isConfirmed) {
      refetch();
      toast.success("Vote confirmed onchain!");
    }
  }, [isConfirmed, refetch]);

  // Show vote errors
  useEffect(() => {
    if (voteError) {
      const msg = voteError.message ?? "Vote failed";
      // Surface the contract revert reason if present
      const match = msg.match(/reverted.*?["'](.+?)["']/i);
      toast.error(match ? match[1] : "Vote failed — check wallet and try again");
      reset();
    }
  }, [voteError, reset]);

  // Countdown timer
  useEffect(() => {
    if (!proposal) return;
    const update = () => {
      const now = Math.floor(Date.now() / 1000);
      const diff = Number(proposal.votingEndsAt) - now;
      if (diff <= 0) { setTimeLeft("Voting ended"); return; }
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
    return !proposal.finalized && Math.floor(Date.now() / 1000) < Number(proposal.votingEndsAt);
  }, [proposal]);

  const isVoting = isWriting || isConfirming;
  const totalVotes = forCount + againstCount;

  const handleVote = useCallback(
    async (approve: boolean) => {
      if (!isConnected || !address || !proposal) return;
      try {
        await castVote(approve);
        // toast shown in isConfirmed effect above
      } catch {
        // error shown in voteError effect above
      }
    },
    [isConnected, address, proposal, castVote]
  );

  const swipe = useSwipeVote({
    threshold: 100,
    onSwipeRight: () => handleVote(true),
    onSwipeLeft: () => handleVote(false),
  });

  const canSwipe = isActive && !hasVoted && !isVoting;

  if (!proposal) {
    return (
      <main className="relative isolate min-h-screen bg-foid-bg text-white/90 px-4 py-8">
        <div className="pointer-events-none fixed inset-0 z-0 vignette" />
        <div className="relative z-10 mx-auto max-w-4xl">
          <FoidOSWindow title={`proposal_${proposalId}.exe`}>
            <div className="p-6">
              <Link href="/swipe" className="mb-4 inline-flex items-center text-sm text-white/40 transition hover:text-purple-400">
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
            <Link href="/swipe" className="inline-flex items-center text-sm text-white/40 transition hover:text-purple-400">
              &larr; Back to Swipe
            </Link>

            {/* Header */}
            <div className="flex items-center justify-between">
              <h1 className="text-xl font-bold text-white">Proposal #{proposalId}</h1>
              <span className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wider ${
                proposal.finalized
                  ? proposal.approved ? "bg-green-600/20 text-green-400" : "bg-red-600/20 text-red-400"
                  : isActive ? "bg-amber-500/20 text-amber-400" : "bg-neutral-700/30 text-neutral-400"
              }`}>
                {proposal.finalized
                  ? (proposal.approved ? "Canonized" : "Rejected")
                  : isActive ? timeLeft : "Voting ended"}
              </span>
            </div>

            {/* Proposal card — swipeable */}
            <div className="mx-auto w-full max-w-md">
              <div
                className="relative overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-900/40"
                {...(canSwipe ? swipe.handlers : {})}
                style={canSwipe ? { ...swipe.style, touchAction: "pan-y" } : undefined}
              >
                {canSwipe && swipe.direction === "right" && (
                  <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
                    <span className="rounded-xl border-[3px] border-green-400 px-6 py-2 text-3xl font-black uppercase text-green-400 -rotate-12 drop-shadow-[0_0_20px_rgba(34,197,94,0.5)]">YES</span>
                  </div>
                )}
                {canSwipe && swipe.direction === "left" && (
                  <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
                    <span className="rounded-xl border-[3px] border-red-400 px-6 py-2 text-3xl font-black uppercase text-red-400 rotate-12 drop-shadow-[0_0_20px_rgba(239,68,68,0.5)]">NO</span>
                  </div>
                )}
                <div className="aspect-square">
                  {proposal.ipfsCid ? (
                    <img src={cidToHttpUrl(proposal.ipfsCid)} alt={`Proposal #${proposalId}`}
                      className="h-full w-full object-cover" draggable={false}
                      onError={(e) => tryNextGateway(e.currentTarget, proposal.ipfsCid)} />
                  ) : (
                    <div className="flex h-full items-center justify-center text-neutral-600">Loading...</div>
                  )}
                </div>
                <div className="border-t border-neutral-800 bg-neutral-900/60 px-4 py-3">
                  <span className="text-[10px] uppercase tracking-wider text-neutral-500">Proposer</span>
                  <div className="mt-1 font-mono text-xs text-neutral-300">{truncateAddress(proposal.proposer)}</div>
                </div>
              </div>
            </div>

            {canSwipe && (
              <div className="text-center text-xs text-white/40">Swipe left for NO, right for YES</div>
            )}

            {/* Live vote tally */}
            {totalVotes > 0 && (
              <div className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-4">
                <div className="mb-2 flex justify-between text-sm font-mono">
                  <span className="text-green-400">{forCount} yes</span>
                  <span className="text-red-400">{againstCount} no</span>
                </div>
                <div className="flex h-3 overflow-hidden rounded-full bg-neutral-800">
                  <div className="bg-green-500 transition-all" style={{ width: `${(forCount / totalVotes) * 100}%` }} />
                  <div className="bg-red-500 transition-all" style={{ width: `${(againstCount / totalVotes) * 100}%` }} />
                </div>
              </div>
            )}

            {/* Vote buttons */}
            {isActive && !hasVoted && (
              <div className="rounded-xl border border-purple-500/20 bg-purple-500/5 p-4">
                <h2 className="mb-3 text-center text-xs font-semibold uppercase tracking-wider text-white/60">
                  {isVoting ? (isWriting ? "Waiting for wallet..." : "Confirming onchain...") : "Cast Your Vote"}
                </h2>
                <div className="flex gap-4">
                  <button onClick={() => handleVote(false)} disabled={isVoting || !isConnected}
                    className="flex-1 rounded-lg border border-red-500/30 bg-red-600/20 py-2.5 text-sm font-semibold text-red-300 transition hover:bg-red-600/40 disabled:cursor-not-allowed disabled:opacity-40">
                    {isVoting ? "..." : "NO"}
                  </button>
                  <button onClick={() => handleVote(true)} disabled={isVoting || !isConnected}
                    className="flex-1 rounded-lg border border-green-500/30 bg-green-600/20 py-2.5 text-sm font-semibold text-green-300 transition hover:bg-green-600/40 disabled:cursor-not-allowed disabled:opacity-40">
                    {isVoting ? "..." : "YES"}
                  </button>
                </div>
              </div>
            )}

            {hasVoted && !proposal.finalized && (
              <div className="rounded-lg border border-purple-500/20 bg-purple-500/5 p-3 text-center text-sm text-purple-300">
                Vote recorded onchain. Results revealed when voting ends.
              </div>
            )}

            {proposal.finalized && (
              <div className="rounded-xl border border-purple-500/20 bg-purple-500/5 p-4 text-center">
                <h2 className="mb-1 text-xs font-semibold uppercase tracking-wider text-purple-300">Proposal Complete</h2>
                <p className="text-sm text-neutral-400">
                  {proposal.approved ? (
                    <>This meme was canonized to the{" "}
                      <Link href="/board" className="text-purple-400 hover:underline">Loreboard</Link>!
                    </>
                  ) : "This proposal was rejected by the community."}
                </p>
              </div>
            )}
          </div>
        </FoidOSWindow>
      </div>
    </main>
  );
}
