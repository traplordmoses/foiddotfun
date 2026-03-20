"use client";

import { useCallback, useState } from "react";
import { useAccount } from "wagmi";
import { CONTRACTS } from "@/lib/contracts/addresses";
import { SWIPE_ABI } from "@/lib/contracts/abis/swipe";

export function useSwipePropose() {
  const { address } = useAccount();
  const [isPending, setIsPending] = useState(false);

  const proposeLoreboard = useCallback(
    async (args: { ipfsCid: string; x: number; y: number; w: number; h: number }) => {
      if (!address) throw new Error("Wallet not connected");

      const { getWalletClient, publicClient, fluentTestnet } = await import(
        "@/lib/viem"
      );
      const walletClient = await getWalletClient();

      const swipeAddr = CONTRACTS.SWIPE as `0x${string}`;
      if (!swipeAddr) throw new Error("Swipe contract not configured");

      const fee = BigInt(CONTRACTS.SWIPE_SUBMISSION_FEE ?? "1000000000000000");

      setIsPending(true);
      try {
        const txHash = await walletClient.writeContract({
          account: (walletClient.account ?? address) as `0x${string}`,
          address: swipeAddr,
          abi: SWIPE_ABI,
          functionName: "proposeLoreboard",
          args: [args.ipfsCid, args.x, args.y, args.w, args.h],
          value: fee,
          chain: fluentTestnet,
        });

        const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
        return { txHash, receipt };
      } finally {
        setIsPending(false);
      }
    },
    [address]
  );

  const claimVoucher = useCallback(
    async (proposalId: number) => {
      if (!address) throw new Error("Wallet not connected");

      const { getWalletClient, publicClient, fluentTestnet } = await import(
        "@/lib/viem"
      );
      const walletClient = await getWalletClient();

      const swipeAddr = CONTRACTS.SWIPE as `0x${string}`;
      const placementFee = BigInt("1000000000000000"); // 0.001 ETH

      setIsPending(true);
      try {
        const txHash = await walletClient.writeContract({
          account: (walletClient.account ?? address) as `0x${string}`,
          address: swipeAddr,
          abi: SWIPE_ABI,
          functionName: "claimVoucher",
          args: [BigInt(proposalId)],
          value: placementFee,
          chain: fluentTestnet,
        });

        const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
        return { txHash, receipt };
      } finally {
        setIsPending(false);
      }
    },
    [address]
  );

  return { proposeLoreboard, claimVoucher, isPending };
}
