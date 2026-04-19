// /src/lib/board/gasEstimate.ts
// Estimate gas for a batch of propose() calls so the BatchReviewModal can
// show the user a realistic total cost before they sign.
//
// The estimate is intentionally pessimistic: we simulate each call individually
// with `estimateContractGas` and sum the results. In practice the user's
// wallet will usually come in slightly lower, but overshooting is the right
// default for a fee preview.

import { formatEther } from "viem";
import type { Rect } from "@/lib/grid";
import { worldToContractRect } from "@/lib/boardSpace";
import { CONTRACTS } from "@/lib/contracts/addresses";
import { LOREBOARD_ABI } from "@/lib/contracts/abis/loreboard";
import { mapWithConcurrencySettled } from "@/lib/concurrency";

export type GasEstimateInput = {
  address: `0x${string}`;
  items: { id: string; rect: Rect; ipfsCid?: string }[];
  /** Submission fee per propose() call, in wei. */
  submissionFeeWei: bigint;
};

export type GasEstimateResult = {
  /** Sum of per-item gas limits. */
  totalGas: bigint;
  /** Current base gas price (wei). */
  gasPriceWei: bigint;
  /** Derived: totalGas * gasPriceWei. */
  totalGasCostWei: bigint;
  /** Human-readable ETH string for the UI. */
  totalGasCostEth: string;
  /** True if any individual estimate failed and we fell back to a constant. */
  partial: boolean;
};

/** Pessimistic fallback when eth_estimateGas reverts or RPC is down. */
const FALLBACK_GAS_PER_CALL = 250_000n;

export async function estimateBatchGas({
  address,
  items,
  submissionFeeWei,
}: GasEstimateInput): Promise<GasEstimateResult> {
  // Lazy import so this file is tree-shakable from the server.
  const { publicClient } = await import("@/lib/viem");

  const contractAddr = CONTRACTS.SWIPE as `0x${string}`;

  let gasPriceWei: bigint;
  try {
    gasPriceWei = await publicClient.getGasPrice();
  } catch {
    gasPriceWei = 1_000_000_000n; // 1 gwei fallback
  }

  // Dummy CID is fine for gas shape — contract charges on length class,
  // but for a fee-preview the bytes don't matter enough to justify uploading
  // before the user has confirmed. We simulate with the real CID when it's
  // already cached on the item, otherwise use a representative 59-char v1 CID.
  const DUMMY_CID = "bafkreihdwdcefgh4dqkjv67uzcmw7ojee6xedzdetojuzjevtenxquvyku";

  let partial = false;
  const estimates = await mapWithConcurrencySettled(
    items,
    4,
    async (it) => {
      const onChain = worldToContractRect(it.rect);
      return publicClient.estimateContractGas({
        account: address,
        address: contractAddr,
        abi: LOREBOARD_ABI,
        functionName: "propose",
        args: [it.ipfsCid ?? DUMMY_CID, onChain.x, onChain.y, onChain.w, onChain.h],
        value: submissionFeeWei,
      });
    }
  );

  const totalGas = estimates.reduce<bigint>((sum, res) => {
    if (res.status === "fulfilled") return sum + res.value;
    partial = true;
    return sum + FALLBACK_GAS_PER_CALL;
  }, 0n);

  const totalGasCostWei = totalGas * gasPriceWei;

  return {
    totalGas,
    gasPriceWei,
    totalGasCostWei,
    totalGasCostEth: formatEther(totalGasCostWei),
    partial,
  };
}
