"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAccount, useReadContract } from "wagmi";
import Link from "next/link";
import { useParams } from "next/navigation";
import { getWalletClient } from "@/lib/viem";
import { CONTRACTS } from "@/lib/contracts/addresses";
import { DUEL_ARENA_ABI } from "@/lib/contracts/abis/duelArena";
import { FoidOSWindow } from "@/components/FoidOSWindow";
import { useSwipeVote } from "@/hooks/useSwipeVote";
import toast from "react-hot-toast";

const IPFS_GATEWAY = "https://ipfs.io/ipfs/";

function cidToUrl(cid: string): string {
  if (!cid) return "";
  if (cid.startsWith("http")) return cid;
  return `${IPFS_GATEWAY}${cid}`;
}

function truncateAddress(addr: string): string {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

export default function DuelDetailPage() {
  const params = useParams();
  const duelId = Number(params.id);
  const { address, isConnected } = useAccount();

  const [voting, setVoting] = useState(false);
  const [timeLeft, setTimeLeft] = useState("");

  const contractAddr = (CONTRACTS.DUEL_ARENA ?? "") as `0x${string}`;
  const enabled = !!contractAddr;

  // Read duel data
  const { data: duelRaw, refetch: refetchDuel } = useReadContract({
    address: contractAddr,
    abi: DUEL_ARENA_ABI,
    functionName: "getDuel",
    args: [BigInt(duelId)],
    query: { enabled },
  });

  const duel = duelRaw as
    | {
        id: bigint;
        submissionA: bigint;
        submissionB: bigint;
        votingStartsAt: bigint;
        votingEndsAt: bigint;
        winner: number;
        totalVotesA: bigint;
        totalVotesB: bigint;
        trestEntryId: bigint;
        finalized: boolean;
      }
    | undefined;

  // Read submissions
  const { data: subARaw } = useReadContract({
    address: contractAddr,
    abi: DUEL_ARENA_ABI,
    functionName: "getSubmission",
    args: duel ? [duel.submissionA] : undefined,
    query: { enabled: !!duel },
  });

  const { data: subBRaw } = useReadContract({
    address: contractAddr,
    abi: DUEL_ARENA_ABI,
    functionName: "getSubmission",
    args: duel ? [duel.submissionB] : undefined,
    query: { enabled: !!duel },
  });

  const subA = subARaw as
    | { id: bigint; creator: string; ipfsCid: string; submittedAt: bigint; matched: boolean }
    | undefined;
  const subB = subBRaw as
    | { id: bigint; creator: string; ipfsCid: string; submittedAt: bigint; matched: boolean }
    | undefined;

  // Check if user has voted
  const { data: hasVoted, refetch: refetchVoted } = useReadContract({
    address: contractAddr,
    abi: DUEL_ARENA_ABI,
    functionName: "hasVotedOnDuel",
    args: address ? [BigInt(duelId), address] : undefined,
    query: { enabled: !!address && enabled },
  });

  // Timer
  useEffect(() => {
    if (!duel) return;
    const update = () => {
      const now = Math.floor(Date.now() / 1000);
      const diff = Number(duel.votingEndsAt) - now;
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
  }, [duel]);

  const isActive = useMemo(() => {
    if (!duel) return false;
    const now = Math.floor(Date.now() / 1000);
    return !duel.finalized && now < Number(duel.votingEndsAt);
  }, [duel]);

  const totalVotes = useMemo(() => {
    if (!duel) return 0n;
    return duel.totalVotesA + duel.totalVotesB;
  }, [duel]);

  const handleVote = useCallback(
    async (side: 1 | 2) => {
      if (!isConnected || !address) return;
      try {
        setVoting(true);
        const walletClient = await getWalletClient();
        await walletClient.writeContract({
          account: address,
          address: contractAddr,
          abi: DUEL_ARENA_ABI,
          functionName: "vote",
          args: [BigInt(duelId), side],
        });
        toast.success("Vote cast!");
        refetchDuel();
        refetchVoted();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Vote failed");
      } finally {
        setVoting(false);
      }
    },
    [isConnected, address, contractAddr, duelId, refetchDuel, refetchVoted]
  );

  // Swipe vote for side A
  const swipeA = useSwipeVote({
    threshold: 100,
    onSwipeRight: () => handleVote(1),
    onSwipeLeft: () => handleVote(2),
  });

  const canSwipe = isActive && !hasVoted && !voting;

  if (!duel) {
    return (
      <main className="relative isolate min-h-screen bg-foid-bg text-white/90 px-4 py-8">
        <div className="pointer-events-none fixed inset-0 z-0 vignette" />
        <div className="relative z-10 mx-auto max-w-4xl">
          <FoidOSWindow title={`duel_${duelId}.exe`}>
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
        <FoidOSWindow title={`duel_${duelId}.exe`}>
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
                Prop #{duelId}
              </h1>
              <span
                className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wider ${
                  duel.finalized
                    ? "bg-purple-600/20 text-purple-400"
                    : isActive
                      ? "bg-amber-500/20 text-amber-400"
                      : "bg-neutral-700/30 text-neutral-400"
                }`}
              >
                {duel.finalized ? "Finalized" : isActive ? timeLeft : "Voting ended"}
              </span>
            </div>

            {/* Side-by-side memes — swipeable on active duels */}
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4">
              {/* Side A */}
              <div
                className="relative overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-900/40"
                {...(canSwipe ? swipeA.handlers : {})}
                style={canSwipe ? { ...swipeA.style, touchAction: "pan-y" } : undefined}
              >
                {canSwipe && swipeA.direction === "right" && (
                  <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
                    <span className="rounded-xl border-4 border-green-500 px-4 py-1 text-lg font-black uppercase text-green-500 -rotate-12 opacity-80">
                      Vote A
                    </span>
                  </div>
                )}
                {canSwipe && swipeA.direction === "left" && (
                  <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
                    <span className="rounded-xl border-4 border-red-500 px-4 py-1 text-lg font-black uppercase text-red-500 rotate-12 opacity-80">
                      Vote B
                    </span>
                  </div>
                )}
                <div className="aspect-square">
                  {subA?.ipfsCid ? (
                    <img
                      src={cidToUrl(subA.ipfsCid)}
                      alt="Side A"
                      className="h-full w-full object-cover"
                      draggable={false}
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-neutral-600">
                      Loading...
                    </div>
                  )}
                </div>
                {duel.finalized && duel.winner === 1 && (
                  <div className="absolute inset-0 flex items-center justify-center bg-amber-500/20 backdrop-blur-[1px]">
                    <span className="rounded-full bg-amber-500 px-4 py-1 text-sm font-bold uppercase text-black">
                      Winner
                    </span>
                  </div>
                )}
                <div className="border-t border-neutral-800 bg-neutral-900/60 px-4 py-3">
                  <span className="text-[10px] uppercase tracking-wider text-neutral-500">
                    Side A
                  </span>
                  {subA && (
                    <div className="mt-1 font-mono text-xs text-neutral-300">
                      {truncateAddress(subA.creator)}
                    </div>
                  )}
                </div>
              </div>

              {/* VS */}
              <div className="flex flex-col items-center gap-2 text-neutral-600">
                <span className="text-2xl font-bold">VS</span>
              </div>

              {/* Side B */}
              <div className="relative overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-900/40">
                <div className="aspect-square">
                  {subB?.ipfsCid ? (
                    <img
                      src={cidToUrl(subB.ipfsCid)}
                      alt="Side B"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-neutral-600">
                      Loading...
                    </div>
                  )}
                </div>
                {duel.finalized && duel.winner === 2 && (
                  <div className="absolute inset-0 flex items-center justify-center bg-amber-500/20 backdrop-blur-[1px]">
                    <span className="rounded-full bg-amber-500 px-4 py-1 text-sm font-bold uppercase text-black">
                      Winner
                    </span>
                  </div>
                )}
                <div className="border-t border-neutral-800 bg-neutral-900/60 px-4 py-3">
                  <span className="text-[10px] uppercase tracking-wider text-neutral-500">
                    Side B
                  </span>
                  {subB && (
                    <div className="mt-1 font-mono text-xs text-neutral-300">
                      {truncateAddress(subB.creator)}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Swipe hint for active duels */}
            {canSwipe && (
              <div className="text-center text-xs text-white/40">
                Drag Side A left/right to vote · or use buttons below
              </div>
            )}

            {/* Vote progress */}
            {totalVotes > 0n && (
              <div className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-4">
                <div className="mb-2 flex justify-between text-sm font-mono">
                  <span className="text-purple-400">
                    {duel.totalVotesA.toString()} votes
                  </span>
                  <span className="text-amber-400">
                    {duel.totalVotesB.toString()} votes
                  </span>
                </div>
                <div className="flex h-3 overflow-hidden rounded-full bg-neutral-800">
                  <div
                    className="bg-purple-500 transition-all"
                    style={{
                      width: `${(Number(duel.totalVotesA) / Number(totalVotes)) * 100}%`,
                    }}
                  />
                  <div
                    className="bg-amber-500 transition-all"
                    style={{
                      width: `${(Number(duel.totalVotesB) / Number(totalVotes)) * 100}%`,
                    }}
                  />
                </div>
              </div>
            )}

            {/* Button voting fallback */}
            {isActive && !hasVoted && (
              <div className="rounded-xl border border-purple-500/20 bg-purple-500/5 p-4">
                <h2 className="mb-3 text-center text-xs font-semibold uppercase tracking-wider text-white/60">
                  Cast Your Vote
                </h2>
                <div className="flex gap-4">
                  <button
                    onClick={() => handleVote(1)}
                    disabled={voting || !isConnected}
                    className="flex-1 rounded-lg border border-purple-500/30 bg-purple-600/20 py-2.5 text-sm font-semibold text-purple-300 transition hover:bg-purple-600/40 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {voting ? "..." : "Vote A"}
                  </button>
                  <button
                    onClick={() => handleVote(2)}
                    disabled={voting || !isConnected}
                    className="flex-1 rounded-lg border border-amber-500/30 bg-amber-600/20 py-2.5 text-sm font-semibold text-amber-300 transition hover:bg-amber-600/40 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {voting ? "..." : "Vote B"}
                  </button>
                </div>
              </div>
            )}

            {hasVoted && !duel.finalized && (
              <div className="rounded-lg border border-purple-500/20 bg-purple-500/5 p-3 text-center text-sm text-purple-300">
                You have voted. Results revealed when voting ends.
              </div>
            )}

            {duel.finalized && (
              <div className="rounded-xl border border-purple-500/20 bg-purple-500/5 p-4 text-center">
                <h2 className="mb-1 text-xs font-semibold uppercase tracking-wider text-purple-300">
                  Proposal Complete
                </h2>
                <p className="text-sm text-neutral-400">
                  {duel.winner === 1 ? "Side A" : "Side B"} wins! The winning meme
                  has been placed on the{" "}
                  <Link href="/gallery" className="text-purple-400 hover:underline">
                    FOIDREST
                  </Link>
                  .
                </p>
              </div>
            )}
          </div>
        </FoidOSWindow>
      </div>
    </main>
  );
}
