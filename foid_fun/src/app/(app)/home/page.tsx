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

      <div className="relative z-10 mx-auto flex h-screen w-full max-w-[1200px] flex-col px-5 py-5 lg:px-8 lg:py-6">
        {/* title */}
        <div className="mb-4 flex items-center justify-center">
          <span className="foid-title foid-title--xl">
            <span aria-hidden className="foid-title__highlight" />
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
              <div className="launcher-buttons px-4 pt-2 pb-2">
                <div className="flex flex-col gap-4">
                  <Y2kGlassButton
                    href="/foid-mommy-terminal"
                    label="FOID_MOMMY_TERMINAL.EXE"
                  />
                  <Y2kGlassButton href="/board" label="LOREBOARD.APP" />
                </div>
              </div>

              {/* music: render ONLY the player (no extra frame) */}
              <div className="launcher-music flex min-h-0 flex-col">
                <div ref={musicRef} className="min-h-0 flex flex-col justify-end overflow-hidden">
                  {musicPanelReady ? (
                    <div className="w-full origin-bottom scale-[0.95]">
                      <MusicPanel />
                    </div>
                  ) : (
                    <div className="flex min-h-[150px] w-full flex-col items-center justify-center gap-3 px-4 text-center text-xs text-white/55">
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
