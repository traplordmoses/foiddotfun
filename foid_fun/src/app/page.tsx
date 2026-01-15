"use client";

import Image from "next/image";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import Y2kGlassButton from "@/components/Y2kGlassButton";

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

    const idleCb =
      (window as any).requestIdleCallback?.(enable, { timeout: 1400 }) ?? null;
    const timeout = window.setTimeout(enable, 1600);

    return () => {
      cancelled = true;
      if (idleCb !== null) (window as any).cancelIdleCallback?.(idleCb);
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
    <main className="relative isolate min-h-screen bg-foid-bg text-white/90 overflow-hidden">
      <div className="pointer-events-none fixed inset-0 z-0 vignette" />

      {/* tiny global styles for title shimmer + hover sheen */}
      <style jsx global>{`
        @keyframes foidTitleShimmer {
          0% { background-position: 0% 50%; transform: translateY(0px); }
          50% { background-position: 100% 50%; transform: translateY(-1px); }
          100% { background-position: 0% 50%; transform: translateY(0px); }
        }
        @keyframes foidSheen {
          0% { transform: translateX(-120%) skewX(-14deg); opacity: 0; }
          20% { opacity: 1; }
          100% { transform: translateX(140%) skewX(-14deg); opacity: 0; }
        }
        .foid-title {
          position: relative;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 8px 16px;
          border-radius: 9999px;
          border: 1px solid rgba(255,255,255,0.2);
          background:
            radial-gradient(120% 160% at 0% 50%, rgba(8, 50, 90, 0.45) 0%, rgba(8,50,90,0) 62%),
            radial-gradient(120% 160% at 100% 50%, rgba(8, 50, 90, 0.45) 0%, rgba(8,50,90,0) 62%),
            radial-gradient(120% 140% at 50% 30%, rgba(255,255,255,0.26) 0%, rgba(255,255,255,0) 60%),
            linear-gradient(180deg, rgba(180, 238, 255, 0.45) 0%, rgba(95, 190, 230, 0.38) 45%, rgba(30, 70, 120, 0.35) 100%);
          box-shadow:
            0 26px 60px rgba(60, 180, 255, 0.25),
            0 12px 28px rgba(0,0,0,0.22),
            0 0 0 1px rgba(255,255,255,0.2),
            inset 0 1px 0 rgba(255,255,255,0.75),
            inset 0 -18px 30px rgba(8, 24, 50, 0.35),
            inset 0 0 0 1px rgba(255,255,255,0.1);
          backdrop-filter: blur(14px) saturate(1.25);
          -webkit-backdrop-filter: blur(14px) saturate(1.25);
          overflow: hidden;
        }
        .foid-title__rim {
          pointer-events: none;
          position: absolute;
          inset: 1px;
          border-radius: inherit;
          border: 1px solid rgba(255,255,255,0.2);
          box-shadow:
            inset 0 1px 0 rgba(255,255,255,0.38),
            0 0 0 1px rgba(255, 106, 192, 0.18);
          opacity: 0.98;
        }
        .foid-title__highlight {
          pointer-events: none;
          position: absolute;
          left: 10px;
          right: 10px;
          top: 6px;
          height: 16px;
          border-radius: 9999px;
          background: linear-gradient(180deg, rgba(255,255,255,0.86) 0%, rgba(255,255,255,0.34) 58%, rgba(255,255,255,0) 100%);
          opacity: 0.95;
          filter: blur(0.25px);
        }
        .foid-title__haze {
          pointer-events: none;
          position: absolute;
          left: 12px;
          right: 12px;
          top: 30px;
          height: 20px;
          border-radius: 9999px;
          opacity: 0.6;
          background: radial-gradient(120% 140% at 50% 40%, rgba(255,255,255,0.16) 0%, rgba(255,255,255,0) 72%);
        }
        .foid-title__spec {
          pointer-events: none;
          position: absolute;
          left: 12px;
          right: 12px;
          bottom: 8px;
          height: 2px;
          border-radius: 9999px;
          opacity: 0.55;
          background: linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.58) 45%, rgba(255,255,255,0) 100%);
        }
        .foid-title__text {
          font-family: var(--font-display);
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: 0.22em;
          font-size: clamp(23px, 2vw + 14px, 42px);
          line-height: 1;
          position: relative;
          z-index: 2;
          color: transparent;
          background-image: linear-gradient(
            90deg,
            rgba(214, 248, 255, 0.98),
            rgba(120, 230, 255, 0.98),
            rgba(255, 168, 224, 0.95),
            rgba(214, 248, 255, 0.98)
          );
          background-size: 260% 260%;
          -webkit-background-clip: text;
          background-clip: text;
          text-shadow:
            0 0 18px rgba(114, 225, 255, 0.45),
            0 0 22px rgba(255, 120, 210, 0.32);
          filter: drop-shadow(0 0 18px rgba(120, 230, 255, 0.32));
          animation: foidTitleShimmer 7.5s ease-in-out infinite;
        }
        .foid-title__sweep {
          pointer-events: none;
          position: absolute;
          inset: -40% -60%;
          background: linear-gradient(
            90deg,
            rgba(255,255,255,0),
            rgba(255,255,255,0.16),
            rgba(255,255,255,0)
          );
          transform: translateX(-30%) skewX(-18deg);
          opacity: 0.35;
          mix-blend-mode: screen;
          z-index: 3;
        }
        .foid-title--xl {
          padding: 9px 16px;
        }
        @media (max-width: 640px) {
          .foid-title {
            padding: 7px 11px;
          }
          .foid-title__text {
            letter-spacing: 0.18em;
          }
        }

        /* brighter vista blue (like your reference) */
        .vista-window__titlebar {
          background: #50acec !important;
        }
      `}</style>

      <div className="relative z-10 mx-auto flex h-screen w-full max-w-[1200px] flex-col px-5 py-5 lg:px-8 lg:py-6">
        {/* title */}
        <div className="mb-4 flex items-center justify-center">
          <span className="foid-title foid-title--xl">
            <span aria-hidden className="foid-title__rim" />
            <span aria-hidden className="foid-title__highlight" />
            <span aria-hidden className="foid-title__haze" />
            <span aria-hidden className="foid-title__spec" />
            <span className="foid-title__text">FOID FOUNDATION</span>
            <span aria-hidden className="foid-title__sweep" />
          </span>
        </div>

        <div className="grid flex-1 min-h-0 grid-cols-1 gap-5 lg:grid-cols-[1.6fr_1fr] lg:items-stretch">
          {/* hero */}
          <section className="vista-window vista-window--media flex min-h-0 flex-col overflow-hidden max-h-[640px] lg:max-h-[720px] w-full">
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
                foid_mommy.jpg
              </span>

            </div>

            <div className="vista-window__body vista-window__body--flush flex-1 min-h-0 overflow-hidden !p-0 !border-0 !bg-transparent">
              {/* reduced padding so image is bigger */}
              <div className="relative h-full w-full p-2 sm:p-2">
                {/* single frame only */}
                <div className="relative h-full w-full overflow-hidden rounded-2xl">
                  <Image
                    src="/foidmommy.jpg"
                    alt="Crayon sketch of Foid with cherries and neon eyes on a diner table."
                    fill
                    priority
                    sizes="(max-width: 1024px) 100vw, 60vw"
                    className="object-cover"
                    style={{ objectPosition: "50% 35%" }}
                  />
                </div>
              </div>
            </div>
          </section>

          {/* launcher */}
          <aside className="vista-window vista-window--compact flex min-h-0 flex-col overflow-hidden max-h-[640px] lg:max-h-[720px] w-full">
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
            <div className="vista-window__body flex flex-1 min-h-0 flex-col">
              {/* buttons */}
              <div className="px-7 pt-0 pb-2 -mt-3">
                <div className="flex flex-col gap-4">
                  <Y2kGlassButton
                    href="/foid-mommy-terminal"
                    label="FOID_MOMMY_TERMINAL.EXE"
                  />
                  <Y2kGlassButton href="/board" label="LOREBOARD.APP" />
                </div>
              </div>

              {/* music: render ONLY the player (no extra frame) */}
              <div className="flex min-h-0 flex-1 flex-col">
                <div ref={musicRef} className="min-h-0 flex-1 overflow-hidden">
                  {musicPanelReady ? (
                    <div className="h-full w-full origin-top scale-[0.95]">
                      <MusicPanel />
                    </div>
                  ) : (
                    <div className="flex h-full min-h-[150px] flex-col items-center justify-center gap-3 px-4 text-center text-xs text-white/55">
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
              {/* removed the “fits @ 100%” footer entirely */}
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
