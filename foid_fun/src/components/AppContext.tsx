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
    <div className="flex flex-col gap-2.5">
      {/* FOID MOMMY TERMINAL Card */}
      <Link
        href="/pray"
        className="context-card context-card--prayer group cursor-pointer transition-all hover:scale-[1.02]"
      >
        <div className="relative z-10">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-bold uppercase tracking-wider text-white/90">
              FOID MOMMY TERMINAL.EXE
            </h3>
            <span className="text-xl">📿</span>
          </div>

          {isConnected && stats ? (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-white/70">Current Streak</span>
                <span className="stat-value--streak font-bold">
                  {stats.currentStreak} days 🔥
                </span>
              </div>

              <div className="flex items-center justify-between text-xs">
                <span className="text-white/70">Next Prayer</span>
                <span className="font-semibold text-white/90">{getNextPrayerStatus()}</span>
              </div>
            </div>
          ) : (
            <div className="text-xs italic text-white/50">Connect wallet to see your stats</div>
          )}
        </div>
      </Link>

      {/* LOREBOARD Card */}
      <Link
        href="/board"
        className="context-card context-card--board group cursor-pointer transition-all hover:scale-[1.02]"
      >
        <div className="relative z-10">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-bold uppercase tracking-wider text-white/90">
              LOREBOARD.APP
            </h3>
            <span className="text-xl">🎨</span>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-white/70">Active Proposals</span>
              <span className="stat-value font-bold">{activePendingCount}</span>
            </div>

            {isConnected && userPendingCount > 0 && (
              <div className="flex items-center justify-between text-xs">
                <span className="text-white/70">Your Pending</span>
                <span className="font-semibold text-white/90">
                  {userPendingCount} <span className="text-blue-400">🗳️</span>
                </span>
              </div>
            )}

            <div className="flex items-center justify-between text-xs">
              <span className="text-white/70">Latest Epoch</span>
              <span className="font-semibold text-white/90">#{currentEpoch}</span>
            </div>
          </div>
        </div>
      </Link>
    </div>
  );
}
