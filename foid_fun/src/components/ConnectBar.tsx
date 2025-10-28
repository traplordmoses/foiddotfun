"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import { BLOCK_EXPLORER_URL, FLUENT_CHAIN_NAME } from "@/lib/contracts";

export function ConnectBar() {
  return (
    <div className="flex items-center justify-between gap-4 p-4">
      <a
        href={BLOCK_EXPLORER_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="text-sm text-fluent-blue underline-offset-4 hover:underline"
      >
        Open {FLUENT_CHAIN_NAME} Explorer ↗
      </a>
      <ConnectButton chainStatus="name" showBalance={false} />
    </div>
  );
}
