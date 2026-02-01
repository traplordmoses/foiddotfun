"use client";

import { useAccount } from "wagmi";
import { useUserStats } from "@/hooks/useUserStats";
import { useReadContract } from "wagmi";
import { CONTRACTS } from "@/lib/contracts/addresses";
import { LOREBOARD_VOTING_ABI } from "@/lib/contracts/abis";
import { useState, useEffect, useRef } from "react";
import Link from "next/link";

interface AppContextProps {
  enablePendingPoll?: boolean;
}

export function AppContext({ enablePendingPoll = false }: AppContextProps) {
  const { address, isConnected } = useAccount();
  const { stats } = useUserStats(address);

  const [activePendingCount, setActivePendingCount] = useState(0);
  const [userPendingCount, setUserPendingCount] = useState(0);
  const [currentEpoch, setCurrentEpoch] = useState(0);
  const pendingFetchKey = useRef<string | null>(null);

  // Get current epoch
  const { data: epochData } = useReadContract({
    address: CONTRACTS.LOREBOARD_VOTING as `0x${string}`,
    abi: LOREBOARD_VOTING_ABI,
    functionName: "epochAt",
    args: [BigInt(Math.floor(Date.now() / 1000))],
  });

  useEffect(() => {
    if (epochData) {
      setCurrentEpoch(Number(epochData));
    }
  }, [epochData]);

  // Fetch pending proposals count
  useEffect(() => {
    if (!currentEpoch) return;

    const requestKey = `${currentEpoch}-${address ?? "none"}`;
    if (!enablePendingPoll) {
      setActivePendingCount(0);
      setUserPendingCount(0);
      pendingFetchKey.current = null;
      return;
    }
    if (pendingFetchKey.current === requestKey) {
      return;
    }
    pendingFetchKey.current = requestKey;

    const fetchPendingCount = async () => {
      try {
        // Call server-side API route with Blockscout fallback
        const response = await fetch("/api/proposals", { cache: "no-store" });

        if (!response.ok) {
          console.error(`[AppContext] API error: ${response.status}`);
          return;
        }

        const data = await response.json();
        console.log(`[AppContext] Fetched ${data.proposals?.length || 0} proposals from API`);

        // Filter for current epoch proposals that are still voting
        const currentEpochProposals = (data.proposals || []).filter(
          (p: any) =>
            Number(p.epochSubmitted || p.epochId || p.epoch || 0) === currentEpoch &&
            p.isVotable !== false &&
            p.status !== "accepted" &&
            p.status !== "rejected"
        );

        setActivePendingCount(currentEpochProposals.length);

        // Filter for user's proposals in current epoch (if connected)
        if (address) {
          const userProposals = currentEpochProposals.filter(
            (p: any) => p.owner?.toLowerCase() === address.toLowerCase()
          );
          setUserPendingCount(userProposals.length);
          console.log(
            `[AppContext] User has ${userProposals.length} pending proposals in epoch ${currentEpoch}`
          );
        } else {
          setUserPendingCount(0);
        }
      } catch (error) {
        console.error("[AppContext] Error fetching pending proposals:", error);
      }
    };

    fetchPendingCount();
  }, [currentEpoch, address, enablePendingPoll]);

  // Calculate next prayer time
  const getNextPrayerStatus = () => {
    if (!stats?.nextPrayerAt) return "Ready now";

    const now = Math.floor(Date.now() / 1000);
    const nextPrayer = Number(stats.nextPrayerAt);

    if (nextPrayer <= now) return "Ready now";

    const diff = nextPrayer - now;
    const hours = Math.floor(diff / 3600);
    const minutes = Math.floor((diff % 3600) / 60);

    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  return (
    <div className="flex flex-col gap-3">
      {/* FOID MOMMY TERMINAL Card */}
      <Link href="/pray" className="group cursor-pointer block">
        <div className="premium-card premium-card--prayer relative overflow-hidden rounded-2xl p-5 transition-all duration-300 group-hover:scale-[1.02] group-hover:shadow-2xl">
          {/* Animated gradient border */}
          <div className="absolute inset-0 rounded-2xl p-[1.5px] premium-card__border--prayer">
            <div className="absolute inset-[1.5px] rounded-2xl bg-gradient-to-br from-indigo-900/40 via-purple-900/30 to-indigo-950/40 backdrop-blur-xl" />
          </div>

          {/* Glow effect on hover */}
          <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-blue-500/0 via-purple-500/0 to-pink-500/0 opacity-0 blur-xl transition-opacity duration-300 group-hover:opacity-30" />

          {/* Content */}
          <div className="relative z-10">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-bold uppercase tracking-wider bg-gradient-to-r from-blue-300 via-purple-300 to-pink-300 bg-clip-text text-transparent">
                FOID MOMMY TERMINAL.EXE
              </h3>
              <span className="text-2xl drop-shadow-lg">📿</span>
            </div>

            {isConnected && stats ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-white/70">Current Streak</span>
                  <span className="premium-stat font-bold text-white bg-gradient-to-r from-orange-400 to-pink-400 bg-clip-text text-transparent">
                    {stats.currentStreak} days 🔥
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <span className="text-white/70">Next Prayer</span>
                  <span className="font-semibold text-white/95">{getNextPrayerStatus()}</span>
                </div>
              </div>
            ) : (
              <div className="text-xs italic text-white/60">Connect wallet to see your stats</div>
            )}
          </div>

          {/* Shine effect */}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-out" />
        </div>
      </Link>

      {/* LOREBOARD Card */}
      <Link href="/board" className="group cursor-pointer block">
        <div className="premium-card premium-card--board relative overflow-hidden rounded-2xl p-5 transition-all duration-300 group-hover:scale-[1.02] group-hover:shadow-2xl">
          {/* Animated gradient border */}
          <div className="absolute inset-0 rounded-2xl p-[1.5px] premium-card__border--board">
            <div className="absolute inset-[1.5px] rounded-2xl bg-gradient-to-br from-orange-900/40 via-red-900/30 to-pink-950/40 backdrop-blur-xl" />
          </div>

          {/* Glow effect on hover */}
          <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-orange-500/0 via-red-500/0 to-pink-500/0 opacity-0 blur-xl transition-opacity duration-300 group-hover:opacity-30" />

          {/* Content */}
          <div className="relative z-10">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-bold uppercase tracking-wider bg-gradient-to-r from-orange-300 via-red-300 to-pink-300 bg-clip-text text-transparent">
                LOREBOARD.APP
              </h3>
              <span className="text-2xl drop-shadow-lg">🎨</span>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-white/70">Active Proposals</span>
                <span className="premium-stat font-bold bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
                  {activePendingCount}
                </span>
              </div>

              {isConnected && userPendingCount > 0 && (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-white/70">Your Pending</span>
                  <span className="font-semibold text-white/95">
                    {userPendingCount} <span className="text-blue-300">🗳️</span>
                  </span>
                </div>
              )}

              <div className="flex items-center justify-between text-xs">
                <span className="text-white/70">Latest Epoch</span>
                <span className="font-semibold text-white/95">#{currentEpoch}</span>
              </div>
            </div>
          </div>

          {/* Shine effect */}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-out" />
        </div>
      </Link>

      <style jsx>{`
        .premium-card__border--prayer {
          background: linear-gradient(135deg,
            rgba(99, 102, 241, 0.6) 0%,
            rgba(168, 85, 247, 0.6) 25%,
            rgba(236, 72, 153, 0.6) 50%,
            rgba(168, 85, 247, 0.6) 75%,
            rgba(99, 102, 241, 0.6) 100%
          );
          background-size: 200% 200%;
          animation: borderShift 3s ease infinite;
        }

        .premium-card__border--board {
          background: linear-gradient(135deg,
            rgba(251, 146, 60, 0.6) 0%,
            rgba(239, 68, 68, 0.6) 25%,
            rgba(236, 72, 153, 0.6) 50%,
            rgba(239, 68, 68, 0.6) 75%,
            rgba(251, 146, 60, 0.6) 100%
          );
          background-size: 200% 200%;
          animation: borderShift 3s ease infinite;
        }

        @keyframes borderShift {
          0%, 100% {
            background-position: 0% 50%;
          }
          50% {
            background-position: 100% 50%;
          }
        }

        .premium-stat {
          font-size: 0.875rem;
          filter: drop-shadow(0 0 4px currentColor);
        }
      `}</style>
    </div>
  );
}
