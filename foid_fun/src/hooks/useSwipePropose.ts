"use client";

import { useCallback, useState } from "react";
import { useAccount } from "wagmi";
import { CONTRACTS } from "@/lib/contracts/addresses";
import { LOREBOARD_ABI } from "@/lib/contracts/abis/loreboard";

export function useSwipePropose() {
  const { address } = useAccount();
  const [isPending, setIsPending] = useState(false);

  const propose = useCallback(
    async (args: { ipfsCid: string; x: number; y: number; w: number; h: number }) => {
      if (!address) throw new Error("Wallet not connected");

      const { getWalletClient, publicClient, fluentTestnet } = await import(
        "@/lib/viem"
      );
      const walletClient = await getWalletClient();

      const contractAddr = CONTRACTS.SWIPE as `0x${string}`;
      if (!contractAddr) throw new Error("Loreboard contract not configured");

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
          address: contractAddr,
          abi: LOREBOARD_ABI,
          functionName: "propose",
          args: [args.ipfsCid, args.x, args.y, args.w, args.h],
          value: fee,
          chain: fluentTestnet,
        });

        const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });

        // Parse the ProposalCreated event to get the on-chain proposalId
        let proposalId: number | null = null;
        try {
          const { parseEventLogs } = await import("viem");
          const events = parseEventLogs({
            abi: LOREBOARD_ABI,
            logs: receipt.logs,
            eventName: "ProposalCreated",
          });
          if (events.length > 0) {
            const onChainId = Number((events[0].args as Record<string, unknown>).proposalId);
            proposalId = onChainId;
            fetch("/api/propose/link", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                localId: args.ipfsCid,
                onChainId,
              }),
            }).catch((err) => console.warn("[useSwipePropose] link failed:", err));
          }
        } catch (err) {
          console.warn("[useSwipePropose] event parse failed:", err);
        }

        return { txHash, receipt, proposalId };
      } finally {
        setIsPending(false);
      }
    },
    [address]
  );

  return { propose, isPending };
}
