"use client";

import { IS_MAINNET } from "@/config/canonical";

/**
 * Wraps a page that requires deployed contracts.
 * On mainnet (when contracts aren't deployed yet), shows a "coming soon" message.
 * On testnet, renders children normally.
 */
export function MainnetGate({ children }: { children: React.ReactNode }) {
  if (!IS_MAINNET) return <>{children}</>;

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 px-4 text-center">
      <div className="vista-window vista-window--compact w-full max-w-md">
        <div className="vista-window__titlebar">
          <div className="vista-window__controls" aria-hidden="true">
            <span className="vista-window__control vista-window__control--minimize" />
            <span className="vista-window__control vista-window__control--restore" />
            <span className="vista-window__control vista-window__control--close" />
          </div>
          <span className="vista-window__title text-[12px]">MAINNET_STATUS.EXE</span>
        </div>
        <div className="vista-window__body flex flex-col items-center gap-4 py-10 px-6">
          <div className="text-4xl">&#x1f6a7;</div>
          <h2 className="font-mono text-lg font-bold tracking-[0.2em] uppercase text-white/90">
            Coming Soon to Mainnet
          </h2>
          <p className="font-mono text-xs text-white/50 max-w-xs leading-relaxed">
            Contracts are being deployed to Fluent mainnet.
            In the meantime, visit the testnet to explore.
          </p>
          <a
            href="https://testnet.foid.fun"
            className="mt-2 rounded-full border border-fuchsia-500/40 bg-fuchsia-500/10 px-6 py-2 font-mono text-xs font-semibold uppercase tracking-[0.2em] text-fuchsia-300 transition hover:bg-fuchsia-500/20 hover:border-fuchsia-500/60"
          >
            Visit Testnet
          </a>
        </div>
      </div>
    </div>
  );
}
