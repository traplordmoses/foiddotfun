"use client";

import Image from "next/image";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAccount } from "wagmi";
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
  const { isConnected } = useAccount();
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
    <main className="relative isolate min-h-screen bg-foid-bg text-white/90 overflow-x-hidden overflow-y-auto pb-safe lg:overflow-hidden">
      <div className="pointer-events-none fixed inset-0 z-0 vignette" />

      <div className="relative z-10 mx-auto flex w-full max-w-[1200px] flex-col px-4 py-4 lg:h-screen lg:px-8 lg:py-6 home-shell">
        {/* Title with Connect Wallet Button */}
        <div className="mb-4 flex items-center justify-between">
          <div className="flex-1 flex items-center justify-center">
            <span className="foid-title foid-title--xl">
              <span aria-hidden className="foid-title__highlight" />
              <span className="foid-title__text">FOID FOUNDATION</span>
              <span aria-hidden className="foid-title__sweep" />
            </span>
          </div>

          {/* Connect Wallet Button - Desktop Only */}
          <div className="hidden lg:block">
            <ConnectButton
              chainStatus="icon"
              showBalance={false}
            />
          </div>
        </div>

        {/* MOBILE LAYOUT - Disconnected State */}
        {!isConnected && (
          <div className="flex flex-col gap-6 lg:hidden mb-20">
            <div className="vista-window vista-window--media flex flex-col min-h-[400px]">
              <div className="vista-window__titlebar">
                <div className="vista-window__controls" aria-hidden="true">
                  <span className="vista-window__control vista-window__control--minimize" />
                  <span className="vista-window__control vista-window__control--restore" />
                  <span className="vista-window__control vista-window__control--close" />
                </div>
                <span className="vista-window__title text-[12px]">
                  <Image
                    src="/foidmommy.gif"
                    alt=""
                    width={40}
                    height={40}
                    className="inline-block h-10 w-10"
                  />
                  {" "}welcome.exe
                </span>
              </div>

              <div className="vista-window__body flex flex-1 flex-col items-center justify-center gap-8 p-8">
                <div className="flex flex-col items-center gap-4 text-center">
                  <div className="w-24 h-24 rounded-full bg-gradient-to-br from-yellow-400/20 to-yellow-600/20 flex items-center justify-center border-2 border-yellow-500/40">
                    <svg
                      className="w-12 h-12 text-yellow-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"
                      />
                    </svg>
                  </div>

                  <h2 className="text-2xl font-bold tracking-wide text-white">
                    Connect Your Wallet
                  </h2>

                  <p className="text-sm text-white/70 max-w-xs leading-relaxed">
                    Connect your wallet to view your stats, placements, and voting activity
                  </p>
                </div>

                <div className="w-full max-w-xs">
                  <ConnectButton.Custom>
                    {({ openConnectModal }) => (
                      <button
                        onClick={openConnectModal}
                        type="button"
                        className="w-full min-h-[56px] px-8 py-4 bg-gradient-to-br from-yellow-400 to-yellow-600 text-black font-bold text-lg rounded-xl shadow-lg shadow-yellow-500/25 hover:shadow-yellow-500/40 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 touch-manipulation"
                      >
                        Connect Wallet
                      </button>
                    )}
                  </ConnectButton.Custom>
                </div>

                <div className="flex flex-col gap-2 text-center text-xs text-white/50">
                  <p>Supported wallets:</p>
                  <p className="font-mono">MetaMask • WalletConnect • Coinbase Wallet</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* MOBILE LAYOUT - Connected State */}
        {isConnected && (
          <div className="flex flex-col gap-6 lg:hidden mb-28 pb-28 justify-center">
            {/* User Stats Section */}
            <section className="vista-window vista-window--media flex flex-col h-[75vh] max-h-[75vh] mb-4 overflow-hidden">
              <div className="vista-window__titlebar flex-shrink-0">
                <div className="vista-window__controls" aria-hidden="true">
                  <span className="vista-window__control vista-window__control--minimize" />
                  <span className="vista-window__control vista-window__control--restore" />
                  <span className="vista-window__control vista-window__control--close" />
                </div>
                <span className="vista-window__title text-[12px]">
                  <Image
                    src="/foidmommy.gif"
                    alt=""
                    width={40}
                    height={40}
                    className="inline-block h-10 w-10"
                  />
                  {" "}your_foid_dashboard.exe
                </span>
              </div>

              <div className="vista-window__body vista-window__body--flush flex-1 min-h-0 overflow-hidden !border-0 !bg-transparent">
                <div className="h-full overflow-y-auto" style={{ touchAction: 'pan-y' }}>
                  <UserDashboard />
                </div>
              </div>
            </section>

            {/* App Buttons + Music Section */}
            <aside className="vista-window vista-window--compact flex flex-col min-h-[320px]">
              <div className="vista-window__titlebar">
                <div className="vista-window__controls" aria-hidden="true">
                  <span className="vista-window__control vista-window__control--minimize" />
                  <span className="vista-window__control vista-window__control--restore" />
                  <span className="vista-window__control vista-window__control--close" />
                </div>
                <span className="vista-window__title text-[12px]">
                  <Image
                    src="/foidmommy.gif"
                    alt=""
                    width={40}
                    height={40}
                    className="inline-block h-10 w-10"
                  />
                  {" "}foid.fun
                </span>
              </div>

              <div className="vista-window__body flex flex-1 flex-col">
                <div className="flex flex-1 flex-col px-4 pt-4 pb-4 gap-4">
                  <div className="flex-shrink-0">
                    <AppContext />
                  </div>

                  <div
                    ref={musicRef}
                    className="launcher-music flex flex-col gap-3 flex-1 min-h-0"
                  >
                    {musicPanelReady ? (
                      <>
                        <div className="w-full flex-1">
                          <MusicPanel className="home-music-panel h-full min-h-[190px] w-full" />
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
            </aside>
          </div>
        )}

        {/* DESKTOP LAYOUT - Two Column Grid */}
        <div className="hidden lg:grid grid-cols-[1.6fr_1fr] gap-5 flex-1 min-h-0 items-stretch home-main-grid">
          {/* LEFT PANEL: User Dashboard */}
          <section className="vista-window vista-window--media flex flex-col overflow-hidden h-full w-full home-hero-window">
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
          <aside className="vista-window vista-window--compact flex flex-col overflow-hidden h-full w-full foid-right-panel home-cta-panel">
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
              <div className="flex flex-1 min-h-0 flex-col px-4 pt-4 pb-4 overflow-hidden">
                <div className="mx-auto flex h-full w-full max-w-[360px] flex-1 flex-col gap-4">
                  <div className="flex-shrink-0">
                    <AppContext />
                  </div>

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

        /* Mobile styles */
        @media (max-width: 1023px) {
          :global(.home-shell) {
            min-height: auto;
          }

          :global(.vista-window) {
            width: 100%;
            max-width: 100%;
          }

          :global(.vista-window__body) {
            overflow-y: auto;
            -webkit-overflow-scrolling: touch;
          }
        }

        @media (max-width: 640px) {
          :global(.foid-title--xl) {
            font-size: 1.25rem;
          }

          :global(.vista-window__titlebar) {
            padding: 8px 12px;
          }

          :global(.vista-window__title) {
            font-size: 11px !important;
          }
        }
      `}</style>
    </main>
  );
}
