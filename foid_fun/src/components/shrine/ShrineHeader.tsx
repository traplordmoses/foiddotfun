"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount, useReadContract } from "wagmi";
import { type Hex } from "viem";

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
      { name: "score", type: "uint16" },
      { name: "prayerHash", type: "bytes32" },
    ],
  },
] as const;

const MIRROR_ADDRESS = process.env.NEXT_PUBLIC_FOIP_MIRROR as Hex | undefined;
const FLUENT_CHAIN_ID = 20993;

export default function ShrineHeader() {
  const { address, isConnected } = useAccount();

  // Read streak from Prayer Mirror contract
  const { data: mirrorData } = useReadContract({
    address: (MIRROR_ADDRESS ?? "0x0000000000000000000000000000000000000000") as Hex,
    abi: PrayerMirrorAbi,
    functionName: "get",
    args: [((address ?? "0x0000000000000000000000000000000000000000") as Hex)],
    chainId: FLUENT_CHAIN_ID,
    query: {
      enabled: Boolean(address && MIRROR_ADDRESS),
    },
  });

  const streak = mirrorData ? Number(mirrorData[0] ?? 0) : 0;

  return (
    <header className="shrine-header">
      {isConnected && streak > 0 && (
        <div className="shrine-header__streak">
          <span className="shrine-header__streak-flame">🔥</span>
          <span>{streak} day{streak !== 1 ? "s" : ""}</span>
        </div>
      )}
      <ConnectButton
        chainStatus="icon"
        accountStatus="avatar"
        showBalance={false}
      />
    </header>
  );
}
