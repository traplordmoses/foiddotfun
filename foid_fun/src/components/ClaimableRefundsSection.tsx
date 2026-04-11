"use client";

import { memo, useEffect, useState } from "react";
import { useClaimableRefund } from "@/hooks/useClaimableRefund";
import { BLOCK_EXPLORER_URL } from "@/lib/contracts";

export const ClaimableRefundsSection = memo(function ClaimableRefundsSection() {
  const {
    claimableEth,
    hasClaimable,
    isLoading,
    withdraw,
    isWithdrawing,
    withdrawError,
    withdrawSuccess,
    transactionHash,
  } = useClaimableRefund();

  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    if (withdrawSuccess) {
      setShowSuccess(true);
      const timer = setTimeout(() => setShowSuccess(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [withdrawSuccess]);

  if (isLoading) {
    return (
      <div className="rounded-xl border border-white/10 bg-black/20 p-4 backdrop-blur-sm">
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-white/80">
          💰 Claimable Refunds
        </h3>
        <div className="text-xs text-white/50 animate-pulse">Checking balance...</div>
      </div>
    );
  }

  if (!hasClaimable && !withdrawError && !showSuccess) {
    return null; // Don't show if no claimable balance
  }

  return (
    <div className="rounded-xl border border-white/10 bg-black/20 p-4 backdrop-blur-sm">
      <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-white/80">
        💰 Claimable Refunds
      </h3>

      <div className="space-y-3">
        {hasClaimable && (
          <>
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-950/20 p-3">
              <div className="mb-2 text-xs text-emerald-300/70">
                You have refunds from rejected placements
              </div>
              <div className="mb-3 flex items-baseline gap-2">
                <span className="text-2xl font-bold text-emerald-400">{claimableEth}</span>
                <span className="text-sm text-emerald-400/70">ETH</span>
              </div>
              <button
                onClick={withdraw}
                disabled={isWithdrawing}
                className={`
                  w-full rounded-lg px-4 py-2 text-sm font-semibold
                  transition-all duration-200
                  ${
                    isWithdrawing
                      ? "cursor-not-allowed bg-emerald-900/50 text-emerald-400/50"
                      : "bg-emerald-600 text-white hover:bg-emerald-500 active:scale-95"
                  }
                `}
              >
                {isWithdrawing ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white"></span>
                    Withdrawing...
                  </span>
                ) : (
                  "Claim Refund"
                )}
              </button>
            </div>

            <div className="text-xs text-white/50">
              <div className="mb-1">ℹ️ How refunds work:</div>
              <ul className="ml-4 list-disc space-y-1 text-white/40">
                <li>When a placement is rejected, you get a refund minus a small anti-spam fee (~10%)</li>
                <li>Refunds are automatically credited to your claimable balance</li>
                <li>Click &quot;Claim Refund&quot; to withdraw to your wallet</li>
              </ul>
            </div>
          </>
        )}

        {withdrawError && (
          <div className="rounded-lg border border-red-500/30 bg-red-950/20 p-3">
            <div className="mb-1 text-xs font-semibold text-red-400">Withdrawal Failed</div>
            <div className="text-xs text-red-300/70">{withdrawError}</div>
          </div>
        )}

        {showSuccess && transactionHash && (
          <div className="rounded-lg border border-emerald-500/30 bg-emerald-950/20 p-3">
            <div className="mb-1 text-xs font-semibold text-emerald-400">✅ Refund Claimed!</div>
            <div className="text-xs text-emerald-300/70">
              Your funds have been sent to your wallet.
            </div>
            {transactionHash && (
              <a
                href={`${BLOCK_EXPLORER_URL}/tx/${transactionHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-block text-xs text-emerald-400 underline hover:text-emerald-300"
              >
                View transaction →
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  );
});
