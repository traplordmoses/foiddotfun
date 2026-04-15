"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAccount, useDisconnect } from "wagmi";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import AppTitlebar from "@/app/(components)/AppTitlebar";
import { UserDashboard } from "@/components/UserDashboard";
import CompactMusicPlayer from "@/components/CompactMusicPlayer";

const MusicPanel = dynamic(() => import("@/components/MusicPanel"), {
  ssr: false,
  loading: () => (
    <div className="flex flex-col items-center justify-center gap-2 py-6 text-xs text-white/55">
      <span className="font-terminal uppercase tracking-[0.28em]">booting music…</span>
    </div>
  ),
});

type IdleCallbackHandle = number;
type IdleCallback = (deadline: { didTimeout: boolean; timeRemaining: () => number }) => void;
type IdleOptions = { timeout?: number };
type IdleWindow = Window & {
  requestIdleCallback?: (callback: IdleCallback, options?: IdleOptions) => IdleCallbackHandle;
  cancelIdleCallback?: (handle: IdleCallbackHandle) => void;
};

export default function DashboardPage() {
  const { address, isConnected } = useAccount();
  const { disconnect } = useDisconnect();
  const { openConnectModal } = useConnectModal();

  const handleSwitchWallet = useCallback(() => {
    disconnect();
    setTimeout(() => openConnectModal?.(), 100);
  }, [disconnect, openConnectModal]);

  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const musicRef = useRef<HTMLDivElement | null>(null);
  const [musicReady, setMusicReady] = useState(false);

  useEffect(() => {
    if (musicReady) return;
    if (typeof window === "undefined") return;

    let cancelled = false;
    const enable = () => { if (!cancelled) setMusicReady(true); };

    const idleWindow = window as IdleWindow;
    const idleCb = idleWindow.requestIdleCallback?.(enable, { timeout: 1400 }) ?? null;
    const timeout = window.setTimeout(enable, 1600);

    return () => {
      cancelled = true;
      if (idleCb !== null) idleWindow.cancelIdleCallback?.(idleCb);
      window.clearTimeout(timeout);
    };
  }, [musicReady]);

  const loadNow = useCallback(() => setMusicReady(true), []);

  return (
    <main className="relative isolate min-h-screen bg-foid-bg text-white/90 overflow-hidden flex items-center justify-center" style={{ height: "100vh" }}>
      <div className="pointer-events-none fixed inset-0 z-0 vignette" />
      <section className="relative z-10 w-full max-w-full px-2 sm:px-4">
        <div className="mx-auto w-full max-w-4xl">
          <div className="vista-window vista-window--terminal vista-window--enhanced w-full flex flex-col" style={{ maxHeight: "94vh" }}>
            <AppTitlebar
              title="YOUR_FOID_DASHBOARD.EXE"
              connected={mounted && isConnected}
              address={mounted ? address : undefined}
              onDisconnect={() => disconnect()}
              onSwitchWallet={handleSwitchWallet}
            />
            <div className="vista-window__body overflow-y-auto" style={{ flex: 1, minHeight: 0 }}>
              <UserDashboard />

              <div ref={musicRef} className="mt-6 flex flex-col gap-3 px-4 pb-4">
                {musicReady ? (
                  <>
                    <MusicPanel className="w-full min-h-[190px]" />
                    <div className="flex justify-center">
                      <CompactMusicPlayer mountLogic={false} />
                    </div>
                  </>
                ) : (
                  <div className="flex min-h-[120px] w-full flex-col items-center justify-center gap-3 text-center text-xs text-white/55">
                    <p className="text-white/40">music loads after the page.</p>
                    <button
                      type="button"
                      onClick={loadNow}
                      className="rounded-full border border-white/20 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.3em] text-white/65 transition hover:bg-white/10 hover:border-white/30"
                    >
                      load
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
