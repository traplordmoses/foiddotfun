"use client";

import Link from "next/link";
import { useAccount, useReadContract } from "wagmi";
import { type Hex } from "viem";
import { TARGET_CHAIN_ID } from "@/lib/chain";

const PrayerMirrorAbi = [
  {
    type: "function",
    name: "get",
    stateMutability: "view",
    inputs: [{ name: "user", type: "address" }],
    outputs: [
      { name: "streak", type: "uint32" },
      { name: "longest", type: "uint32" },
      { name: "total", type: "uint32" },
      { name: "milestones", type: "uint32" },
      { name: "legacyMetric", type: "uint16" },
      { name: "prayerHash", type: "bytes32" },
    ],
  },
] as const;

const MIRROR_ADDRESS = process.env.NEXT_PUBLIC_FOIP_MIRROR as Hex | undefined;

export default function RitualWindowContent() {
  const { address, isConnected } = useAccount();

  const { data: mirrorData } = useReadContract({
    address: (MIRROR_ADDRESS ?? "0x0000000000000000000000000000000000000000") as Hex,
    abi: PrayerMirrorAbi,
    functionName: "get",
    args: [((address ?? "0x0000000000000000000000000000000000000000") as Hex)],
    chainId: TARGET_CHAIN_ID,
    query: {
      enabled: Boolean(address && MIRROR_ADDRESS),
    },
  });

  const streak = mirrorData ? Number(mirrorData[0] ?? 0) : 0;

  return (
    <div className="h-full flex flex-col items-center justify-center p-4 text-center">
      {/* Icon/Visual */}
      <div className="text-5xl mb-4 animate-pulse">🙏</div>

      {/* Title */}
      <h2 className="font-primary text-xl font-bold uppercase tracking-wider text-white mb-2">
        Daily Ritual
      </h2>

      {/* Description */}
      <p className="text-sm text-white/70 mb-4 max-w-[240px]">
        Anchor your presence on-chain. Build your streak. Shape your mifoid.
      </p>

      {/* Streak Display */}
      {isConnected && streak > 0 && (
        <div className="flex items-center gap-2 mb-4 px-3 py-1.5 bg-foid-midnight/50 rounded-full border border-foid-tng/30">
          <span className="text-lg">🔥</span>
          <span className="font-terminal text-foid-tng">
            {streak} day{streak !== 1 ? "s" : ""} streak
          </span>
        </div>
      )}

      {/* Enter Button */}
      <Link
        href="/pray"
        className="group relative px-8 py-3 rounded-xl font-bold uppercase tracking-wider text-foid-midnight
                   bg-gradient-to-r from-foid-candy via-foid-aqua to-foid-mint
                   shadow-[0_4px_0_rgba(0,0,0,0.2),0_0_20px_rgba(114,225,255,0.3)]
                   hover:-translate-y-0.5 hover:shadow-[0_6px_0_rgba(0,0,0,0.2),0_0_30px_rgba(114,225,255,0.5)]
                   active:translate-y-0 active:shadow-[0_2px_0_rgba(0,0,0,0.2)]
                   transition-all duration-150"
      >
        <span className="relative z-10">Enter Terminal</span>
      </Link>
    </div>
  );
}
