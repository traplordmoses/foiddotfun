"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import { FoidOSWindow } from "@/components/FoidOSWindow";
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
    <main className="relative isolate min-h-screen bg-foid-bg text-white/90 px-4 py-8">
      <div className="pointer-events-none fixed inset-0 z-0 vignette" />
      <div className="relative z-10">
        <FoidOSWindow title="your_foid_dashboard.exe">
          <UserDashboard />

          <div ref={musicRef} className="mt-6 flex flex-col gap-3">
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
        </FoidOSWindow>
      </div>
    </main>
  );
}
