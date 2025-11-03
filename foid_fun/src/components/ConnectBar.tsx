"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import { BLOCK_EXPLORER_URL, FLUENT_CHAIN_NAME } from "@/lib/contracts";

export function ConnectBar() {
  return (
    <div className="flex flex-col gap-3 px-2 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-0">
      <a
        href={BLOCK_EXPLORER_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-white/60 bg-white/10 px-5 py-2 text-center text-sm font-semibold tracking-wide text-white shadow-[0_16px_30px_rgba(0,208,255,0.22)] transition hover:border-white hover:bg-white/80 hover:text-foid-midnight sm:w-auto sm:justify-start sm:text-left"
      >
        Open {FLUENT_CHAIN_NAME} Explorer ↗
      </a>
      <div className="flex justify-center sm:justify-end">
        <ConnectButton chainStatus="name" showBalance={false} />
      </div>
    </div>
  );
}
