"use client";

// VOTE.EXE route (/vote) — thin window wrapper around the extracted
// VoteApp (src/apps/VoteApp.tsx). The app content is shared verbatim with
// the desktop shell's VOTE window (multi-window plan §4): this page only
// owns the standalone presentation — full-viewport main, one vista-window,
// AppTitlebar wallet wiring. (No mounted-guard here — the original page
// passed the live wagmi values straight through; preserved as-is.)
//
// /vote/[id] and /vote/submit stay full routes (plan §4, VOTE row).

import { useAccount } from "wagmi";
import { useSwitchWallet } from "@/hooks/useSwitchWallet";
import AppTitlebar from "@/app/(components)/AppTitlebar";
import VoteApp from "@/apps/VoteApp";

export default function VotePage() {
  const { address, isConnected } = useAccount();
  const { disconnect, switchWallet } = useSwitchWallet();

  return (
    <main className="relative bg-foid-bg text-white/90 overflow-hidden flex items-center justify-center" style={{ height: "100dvh", overscrollBehavior: "none" }}>
      <div className="pointer-events-none fixed inset-0 z-0 vignette" aria-hidden="true" />

      <section className="relative z-10 w-full max-w-full px-2 sm:px-4">
        <div className="mx-auto w-full max-w-6xl">
          <div className="vista-window vista-window--terminal vista-window--enhanced h-[94vh] max-h-[94vh] w-full flex flex-col">
            <AppTitlebar title="VOTE.EXE" connected={isConnected} address={address} onDisconnect={() => disconnect()} onSwitchWallet={switchWallet} />
            <VoteApp />
          </div>
        </div>
      </section>
    </main>
  );
}
