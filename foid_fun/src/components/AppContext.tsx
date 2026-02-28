"use client";

import { useAccount } from "wagmi";
import { useUserStats } from "@/hooks/useUserStats";
import { useReadContract } from "wagmi";
import { CONTRACTS } from "@/lib/contracts/addresses";
import { LOREBOARD_VOTING_ABI } from "@/lib/contracts/abis";
import { useState, useEffect } from "react";
import Link from "next/link";

export function AppContext() {
  const { address, isConnected } = useAccount();
  const { stats } = useUserStats(address);

  const [currentEpoch, setCurrentEpoch] = useState(0);

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
    <div className="flex flex-col gap-2">
      {/* FOID MOMMY TERMINAL Card */}
      <Link href="/pray" className="group cursor-pointer block">
        <div className="relative overflow-hidden rounded-3xl p-4 transition-all duration-200 group-hover:shadow-lg"
             style={{
               background: 'linear-gradient(135deg, rgba(147, 112, 219, 0.35) 0%, rgba(138, 43, 226, 0.25) 100%)',
               backdropFilter: 'blur(20px)',
               border: '1px solid rgba(255, 255, 255, 0.12)'
             }}>
          <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-white/5 to-transparent opacity-60 pointer-events-none" />
          <div className="relative z-10">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-white/90 underline decoration-white/30 underline-offset-2">
                FOID MOMMY TERMINAL.EXE
              </h3>
              <span className="text-lg">📿</span>
            </div>

            {isConnected && stats ? (
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-white/70 underline decoration-white/20 underline-offset-2">Current Streak</span>
                  <span className="font-semibold text-orange-300">
                    {stats.currentStreak} days 🔥
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <span className="text-white/70 underline decoration-white/20 underline-offset-2">Next Prayer</span>
                  <span className="font-semibold text-white/90 underline decoration-white/30 underline-offset-2">{getNextPrayerStatus()}</span>
                </div>
              </div>
            ) : (
              <div className="text-xs italic text-white/50">Connect wallet to see your stats</div>
            )}
          </div>
        </div>
      </Link>

      {/* LOREBOARD Card */}
      <Link href="/board" className="group cursor-pointer block">
        <div className="relative overflow-hidden rounded-3xl p-4 transition-all duration-200 group-hover:shadow-lg"
             style={{
               background: 'linear-gradient(135deg, rgba(205, 92, 92, 0.35) 0%, rgba(178, 34, 34, 0.25) 100%)',
               backdropFilter: 'blur(20px)',
               border: '1px solid rgba(255, 255, 255, 0.12)'
             }}>
          <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-white/5 to-transparent opacity-60 pointer-events-none" />
          <div className="relative z-10">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-white/90 underline decoration-white/30 underline-offset-2">
                LOREBOARD.APP
              </h3>
              <span className="text-xs text-white/50">Spatial Board</span>
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-white/70 underline decoration-white/20 underline-offset-2">Latest Epoch</span>
                <span className="font-semibold text-white/90 underline decoration-white/30 underline-offset-2">#{currentEpoch}</span>
              </div>
            </div>
          </div>
        </div>
      </Link>

      {/* MIFOID Card */}
      <Link href="/mifoid" className="group cursor-pointer block">
        <div className="relative overflow-hidden rounded-3xl p-4 transition-all duration-200 group-hover:shadow-lg"
             style={{
               background: 'linear-gradient(135deg, rgba(124, 58, 237, 0.35) 0%, rgba(91, 33, 182, 0.25) 100%)',
               backdropFilter: 'blur(20px)',
               border: '1px solid rgba(255, 255, 255, 0.12)'
             }}>
          <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-white/5 to-transparent opacity-60 pointer-events-none" />
          <div className="relative z-10">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-white/90 underline decoration-white/30 underline-offset-2">
                MIFOID
              </h3>
              <span className="text-xs text-white/50">Identity</span>
            </div>
            {isConnected && stats ? (
              <div className="flex items-center justify-between text-xs">
                <span className="text-white/70 underline decoration-white/20 underline-offset-2">Streak Tier</span>
                <span className="font-semibold text-purple-300">
                  {stats.currentStreak >= 90 ? "Foid Sovereign" :
                   stats.currentStreak >= 75 ? "Eternal Witness" :
                   stats.currentStreak >= 60 ? "Archon" :
                   stats.currentStreak >= 45 ? "Ascendant" :
                   stats.currentStreak >= 30 ? "Oracle" :
                   stats.currentStreak >= 21 ? "Covenant" :
                   stats.currentStreak >= 14 ? "Flame Keeper" :
                   stats.currentStreak >= 7 ? "Devotee" :
                   stats.currentStreak >= 3 ? "Ember" :
                   stats.currentStreak >= 1 ? "Whisper" : "Unranked"}
                </span>
              </div>
            ) : (
              <div className="text-xs text-white/70">
                Your on-chain identity. One per soul.
              </div>
            )}
          </div>
        </div>
      </Link>
    </div>
  );
}
