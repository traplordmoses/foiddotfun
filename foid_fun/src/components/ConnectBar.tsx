"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import { BLOCK_EXPLORER_URL, FLUENT_CHAIN_NAME } from "@/lib/contracts";

export function ConnectBar() {
  return (
    <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
      <a
        href={BLOCK_EXPLORER_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="text-center text-sm text-fluent-blue underline-offset-4 hover:underline sm:text-left"
      >
        Open {FLUENT_CHAIN_NAME} Explorer ↗
      </a>
      <div className="flex justify-center sm:justify-end">
        <ConnectButton chainStatus="name" showBalance={false} />
      </div>
    </div>
  );
}
