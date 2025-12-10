"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";

export function ConnectBar() {
  const showDevBadge = Boolean(process.env.NEXT_PUBLIC_BOARD_PASSWORD);
  return (
    <div className="mb-6 mt-2 flex justify-end">
      <div className="flex items-center gap-3 rounded-2xl border border-white/15 bg-white/8 px-3 py-2 backdrop-blur-lg shadow-[0_10px_35px_rgba(0,0,0,.28)]">
        <ConnectButton chainStatus="name" showBalance={false} />
        {showDevBadge && (
          <span className="inline-flex items-center gap-1 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[12px] font-medium text-white/80">
            <span className="text-[14px]">🛠</span>
            <span>dev access</span>
          </span>
        )}
      </div>
    </div>
  );
}
