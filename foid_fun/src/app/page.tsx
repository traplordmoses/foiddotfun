"use client";

import Image from "next/image";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import CompactMusicPlayer from "@/components/CompactMusicPlayer";
import { UserDashboard } from "@/components/UserDashboard";
import { AppContext } from "@/components/AppContext";
import { ConnectButton } from "@rainbow-me/rainbowkit";

const MusicPanel = dynamic(() => import("@/components/MusicPanel"), {
  ssr: false,
  loading: () => (
    <div className="flex flex-col items-center justify-center gap-2 py-6 text-xs text-white/55">
      <span className="font-terminal uppercase tracking-[0.28em]">booting music…</span>
      <span className="text-[10px] uppercase tracking-[0.34em] text-white/30">
        keeping the launcher snappy
      </span>
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

export default function LandingPage() {
  const musicRef = useRef<HTMLDivElement | null>(null);
  const [musicPanelReady, setMusicPanelReady] = useState(false);

  useEffect(() => {
    if (musicPanelReady) return;
    if (typeof window === "undefined") return;

    let cancelled = false;
    const enable = () => {
      if (!cancelled) setMusicPanelReady(true);
    };

    const idleWindow = window as IdleWindow;
    const idleCb =
      idleWindow.requestIdleCallback?.(enable, { timeout: 1400 }) ?? null;
    const timeout = window.setTimeout(enable, 1600);

    return () => {
      cancelled = true;
      if (idleCb !== null) idleWindow.cancelIdleCallback?.(idleCb);
      window.clearTimeout(timeout);
    };
  }, [musicPanelReady]);

  useEffect(() => {
    if (musicPanelReady) return;
    if (typeof window === "undefined" || typeof IntersectionObserver === "undefined") return;

    const target = musicRef.current;
    if (!target) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) setMusicPanelReady(true);
      },
      { rootMargin: "48px", threshold: 0.12 }
    );

    observer.observe(target);
    return () => observer.disconnect();
  }, [musicPanelReady]);

  const loadMusicPanelNow = useCallback(() => setMusicPanelReady(true), []);

  return (
    <main className="relative isolate min-h-[100svh] bg-foid-bg text-white/90 overflow-x-hidden overflow-y-auto lg:overflow-hidden">
      <div className="pointer-events-none fixed inset-0 z-0 vignette" />

        <div className="relative z-10 mx-auto flex min-h-0 w-full max-w-[1200px] flex-col px-4 py-4 lg:h-screen lg:px-8 lg:py-6 home-shell">
        {/* Title with Connect Wallet Button */}
        <div className="mb-4 flex items-center justify-between">
          <div className="flex-1 flex items-center justify-center">
            <span className="foid-title foid-title--xl">
              <span aria-hidden className="foid-title__highlight" />
              <span className="foid-title__text">FOID FOUNDATION</span>
              <span aria-hidden className="foid-title__sweep" />
            </span>
          </div>

          {/* Connect Wallet Button - Top Right */}
          <div className="hidden lg:block">
            <ConnectButton
              chainStatus="icon"
              showBalance={false}
            />
          </div>
        </div>

        <div className="grid flex-1 min-h-0 grid-cols-1 gap-5 lg:grid-cols-[1.6fr_1fr] lg:items-stretch home-main-grid">
          {/* LEFT PANEL: User Dashboard (replaces hero image) */}
          <section className="vista-window vista-window--media flex min-h-[320px] sm:min-h-[360px] lg:min-h-0 flex-col overflow-hidden max-h-[520px] sm:max-h-[640px] lg:max-h-none lg:h-full w-full home-hero-window">
            <div className="vista-window__titlebar">
              <div className="vista-window__controls" aria-hidden="true">
                <span className="vista-window__control vista-window__control--minimize" />
                <span className="vista-window__control vista-window__control--restore" />
                <span className="vista-window__control vista-window__control--close" />
              </div>

              <span className="vista-window__title text-[12px]">
                <span
                  aria-hidden="true"
                  className="inline-flex h-[40px] w-[40px] items-center justify-center"
                >
                  <Image
                    src="/foidmommy.gif"
                    alt=""
                    width={40}
                    height={40}
                    className="block"
                  />
                </span>{" "}
                your_foid_dashboard.exe
              </span>
            </div>

            <div className="vista-window__body vista-window__body--flush flex-1 min-h-0 overflow-hidden !p-0 !border-0 !bg-transparent">
              <UserDashboard />
            </div>
          </section>

          {/* RIGHT PANEL: App Context + Music */}
          <aside className="vista-window vista-window--compact flex min-h-[320px] sm:min-h-[380px] lg:min-h-0 flex-col overflow-hidden max-h-[520px] sm:max-h-[640px] lg:max-h-none lg:h-full w-full foid-right-panel home-cta-panel">
            <div className="vista-window__titlebar">
              <div className="vista-window__controls" aria-hidden="true">
                <span className="vista-window__control vista-window__control--minimize" />
                <span className="vista-window__control vista-window__control--restore" />
                <span className="vista-window__control vista-window__control--close" />
              </div>

              <span className="vista-window__title text-[12px]">
                <span
                  aria-hidden="true"
                  className="inline-flex h-[40px] w-[40px] items-center justify-center"
                >
                  <Image
                    src="/foidmommy.gif"
                    alt=""
                    width={40}
                    height={40}
                    className="block"
                  />
                </span>{" "}
                foid.fun
              </span>
            </div>

            <div className="vista-window__body flex flex-1 min-h-0 flex-col overflow-hidden">
              <div className="flex flex-1 min-h-0 flex-col px-4 pt-4 pb-2 sm:px-6 sm:pt-6 sm:pb-1 !pb-4 overflow-hidden">
                <div className="mx-auto flex h-full w-full max-w-[360px] flex-1 flex-col gap-4">
                  {/* App Context Cards - NEW */}
                  <div className="flex-shrink-0">
                    <AppContext />
                  </div>

                  {/* Music Player Section */}
                  <div
                    ref={musicRef}
                    className="launcher-music flex flex-col gap-3 flex-1 min-h-0"
                  >
                    {musicPanelReady ? (
                      <>
                        <div className="w-full flex-1">
                          <MusicPanel className="home-music-panel h-full min-h-[190px] sm:min-h-[250px] w-full" />
                        </div>
                        <div className="home-ipod-frame flex-shrink-0">
                          <CompactMusicPlayer mountLogic={false} />
                        </div>
                      </>
                    ) : (
                      <div className="flex min-h-[190px] w-full flex-1 flex-col items-center justify-center gap-3 text-center text-xs text-white/55">
                        <p className="text-white/40">music loads after the launcher.</p>
                        <button
                          type="button"
                          onClick={loadMusicPanelNow}
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
          </aside>
        </div>

        {/* Mobile Connect Wallet Button */}
        <div className="mt-4 flex justify-center lg:hidden">
          <ConnectButton
            chainStatus="icon"
            showBalance={false}
          />
        </div>
      </div>
      <style jsx>{`
        :global(.foid-right-panel .vista-window__body) {
          padding: 0;
        }

        :global(.foid-right-panel .launcher-music) {
          flex: 1 1 auto;
          min-height: 0;
        }

        :global(.home-music-panel) :global(.mt-3) {
          display: none;
        }

        :global(.home-music-panel) {
          padding: 0 !important;
          border-radius: 28px;
          background: transparent;
          box-shadow: none;
        }

        :global(.home-ipod-frame) {
          width: 100%;
          display: flex;
          justify-content: center;
          margin-top: 4px;
          border-radius: 30px;
          padding: 0;
          border: none;
          background: transparent;
          box-shadow: none;
          flex-shrink: 0;
        }

        :global(.home-ipod-frame) :global(.ipod-player) {
          width: 100%;
          border-radius: 26px;
          transform: scale(1);
        }

        :global(.home-shell) {
          min-height: 0;
        }

        :global(.home-main-grid) {
          width: 100%;
        }

        @media (max-width: 640px) {
          :global(.home-main-grid) {
            gap: 14px;
          }
          :global(.home-hero-window),
          :global(.home-cta-panel) {
            min-height: 260px;
            max-height: none;
          }
          :global(.home-hero-window) {
            padding-bottom: 4px;
          }
        }
      `}</style>
    </main>
  );
}
