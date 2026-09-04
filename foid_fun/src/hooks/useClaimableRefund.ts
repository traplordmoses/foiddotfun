import { useCallback, useEffect, useState } from "react";
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { LOREBOARD_TREASURY_ABI } from "@/lib/contracts/abis";
import { CONTRACTS } from "@/lib/contracts/addresses";
import { formatEther } from "viem";

export function useClaimableRefund() {
  const { address } = useAccount();
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [withdrawError, setWithdrawError] = useState<string | null>(null);
  const [withdrawSuccess, setWithdrawSuccess] = useState(false);

  // Read claimable balance
  const {
    data: claimableWei,
    isLoading: isLoadingClaimable,
    refetch: refetchClaimable,
  } = useReadContract({
    address: CONTRACTS.LOREBOARD_TREASURY as `0x${string}`,
    abi: LOREBOARD_TREASURY_ABI,
    functionName: "claimable",
    args: address ? [address] : undefined,
    query: {
      enabled: !!address,
    },
  });

  // Write contract for withdraw
  const { writeContract, data: hash, error: writeError, reset } = useWriteContract();

  // Wait for transaction
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash,
  });

  // Convert Wei to ETH
  const claimableEth = claimableWei ? formatEther(claimableWei) : "0";
  const hasClaimable = claimableWei ? claimableWei > 0n : false;

  // Handle withdraw
  const withdraw = useCallback(async () => {
    if (!address || !hasClaimable) return;

    setIsWithdrawing(true);
    setWithdrawError(null);
    setWithdrawSuccess(false);
    reset();

    try {
      writeContract({
        address: CONTRACTS.LOREBOARD_TREASURY as `0x${string}`,
        abi: LOREBOARD_TREASURY_ABI,
        functionName: "withdraw",
      });
    } catch (error: unknown) {
      console.error("[useClaimableRefund] Withdraw error:", error);
      setWithdrawError(error instanceof Error && error.message ? error.message : "Failed to withdraw");
      setIsWithdrawing(false);
    }
  }, [address, hasClaimable, writeContract, reset]);

  // Handle transaction confirmation
  useEffect(() => {
    if (isConfirmed) {
      setWithdrawSuccess(true);
      setIsWithdrawing(false);
      // Refetch claimable balance after successful withdrawal
      void refetchClaimable();
    }
  }, [isConfirmed, refetchClaimable]);

  // Handle write errors
  useEffect(() => {
    if (writeError) {
      setWithdrawError(writeError.message || "Transaction failed");
      setIsWithdrawing(false);
    }
  }, [writeError]);

  // Update loading state
  useEffect(() => {
    if (isConfirming && !isWithdrawing) {
      setIsWithdrawing(true);
    }
  }, [isConfirming, isWithdrawing]);

  return {
    claimableWei,
    claimableEth,
    hasClaimable,
    isLoading: isLoadingClaimable,
    withdraw,
    isWithdrawing: isWithdrawing || isConfirming,
    withdrawError,
    withdrawSuccess,
    transactionHash: hash,
    refetch: refetchClaimable,
  };
}
