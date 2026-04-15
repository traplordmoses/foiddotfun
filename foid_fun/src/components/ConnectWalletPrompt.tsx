"use client";

import { useConnectModal } from "@rainbow-me/rainbowkit";

export function ConnectWalletPrompt() {
  const { openConnectModal } = useConnectModal();

  return (
    <div className="flex h-full flex-col items-center justify-center px-6 text-center">
      <div className="glass-panel max-w-md space-y-6 p-8">
        <div className="space-y-2">
          <h3 className="text-2xl font-bold text-white">Connect Your Wallet</h3>
          <p className="text-sm text-white/60">Connect to see your FOID journey</p>
        </div>

        <button
          onClick={openConnectModal}
          className="w-full rounded-xl border border-white/20 bg-gradient-to-r from-purple-500/80 to-blue-500/80 px-6 py-3 text-sm font-bold uppercase tracking-[0.15em] text-white shadow-lg transition-all hover:from-purple-500 hover:to-blue-500 hover:shadow-purple-500/30 active:scale-[0.97]"
        >
          Connect Wallet
        </button>

        <div className="space-y-2 text-xs text-white/40">
          <p>You&apos;ll be able to see:</p>
          <ul className="list-inside list-disc space-y-1 text-left">
            <li>Your prayer streaks & history</li>
            <li>Your board placements</li>
            <li>Your voting activity</li>
            <li>Achievement milestones</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
