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

      // Pre-flight overlap check — abort before gas burn if spot is taken
      const overlapRes = await fetch(
        `/api/swipe/check-overlap?x=${args.x}&y=${args.y}&w=${args.w}&h=${args.h}`
      );
      if (overlapRes.ok) {
        const overlapData = await overlapRes.json();
        if (!overlapData.ok) {
          const c = overlapData.conflict;
          throw new Error(
            `Spot is taken — overlaps ${c.source} ${c.source === "swipe" ? `proposal #${c.proposalId}` : `placement #${c.placementId}`} at (${c.gridX}, ${c.gridY})`
          );
        }
      }

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

        // ── Link on-chain proposalId to server-side proposal ──
        // Parse the LoreboardProposed event from receipt logs to get the on-chain proposalId
        try {
          const { parseEventLogs } = await import("viem");
          const events = parseEventLogs({
            abi: SWIPE_ABI,
            logs: receipt.logs,
            eventName: "LoreboardProposed",
          });
          if (events.length > 0) {
            const onChainId = Number((events[0].args as Record<string, unknown>).proposalId);
            // POST to /api/propose/link to create the mapping
            fetch("/api/propose/link", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                localId: args.ipfsCid, // Use CID as local identifier
                onChainId,
              }),
            }).catch((err) => console.warn("[useSwipePropose] link failed:", err));
          }
        } catch (err) {
          console.warn("[useSwipePropose] event parse failed:", err);
        }

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
