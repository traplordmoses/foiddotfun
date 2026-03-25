"use client";

import Link from "next/link";
import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import { useAccount, useDisconnect } from "wagmi";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import AppTitlebar from "@/app/(components)/AppTitlebar";

/* Navigation tiles */
const NAV_TILES = [
  { label: "Pray", href: "/pray" },
  { label: "Vote", href: "/vote" },
  { label: "MiFOID", href: "/mifoid" },
  { label: "About", href: "/about" },
] as const;

/* Floating MiFOID character images — positioned around the edges, desktop only */
const FLOAT_IMAGES = [
  { src: "/1smile.png",    alt: "MiFOID smile",      top: "12%",  left: -80,   rotate: -5,  delay: "0s",   size: 110 },
  { src: "/pinkhat.png",   alt: "MiFOID pink hat",   top: "55%",  left: -70,   rotate: 4,   delay: "0.8s", size: 100 },
  { src: "/w.png",         alt: "MiFOID portrait",   top: "10%",  right: -75,  rotate: 5,   delay: "0.4s", size: 105 },
  { src: "/varsity.png",   alt: "MiFOID varsity",    top: "52%",  right: -80,  rotate: -6,  delay: "1.2s", size: 100 },
  { src: "/soccer.png",    alt: "MiFOID soccer",     bottom: 20,  left: -60,   rotate: 6,   delay: "0.6s", size: 95 },
  { src: "/horns.png",     alt: "MiFOID horns",      bottom: 15,  right: -65,  rotate: -4,  delay: "1.0s", size: 95 },
];

/* Collage images — small grid of MiFOID art hinting at the loreboard */
const COLLAGE_IMAGES = [
  "/mifoid01.png", "/mifoid02.png", "/mifoid03.png",
  "/mifoid04.png", "/mifoid05.png", "/mifoid06.png",
  "/mifoid07.png", "/mifoid08.png", "/IMG_7266.jpg",
];

/* Sparkle positions */
const SPARKLES = [
  { top: "8%", left: "15%", size: 22, delay: "0s" },
  { top: "20%", left: "80%", size: 28, delay: "0.7s" },
  { top: "50%", left: "8%", size: 18, delay: "1.3s" },
  { top: "70%", left: "88%", size: 24, delay: "0.4s" },
  { top: "85%", left: "20%", size: 20, delay: "1.0s" },
  { top: "35%", left: "85%", size: 16, delay: "1.6s" },
];

export default function LandingPage() {
  const { address, isConnected } = useAccount();
  const { disconnect } = useDisconnect();
  const { openConnectModal } = useConnectModal();

  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const handleSwitchWallet = useCallback(() => {
    disconnect();
    setTimeout(() => openConnectModal?.(), 100);
  }, [disconnect, openConnectModal]);

  return (
    <main
      className="home-page relative bg-foid-bg text-white/90 overflow-hidden flex items-center justify-center"
      style={{ height: "100vh" }}
    >
      <div className="pointer-events-none fixed inset-0 z-0 vignette" />

      <section className="relative z-10 w-full max-w-full px-2 sm:px-4">
        <div className="mx-auto w-full max-w-6xl">
          <div className="vista-window vista-window--terminal vista-window--enhanced h-[94vh] max-h-[94vh] w-full flex flex-col">
            <AppTitlebar
              title="FOID_FOUNDATION.EXE"
              connected={mounted && isConnected}
              address={mounted ? address : undefined}
              onDisconnect={() => disconnect()}
              onSwitchWallet={handleSwitchWallet}
            />

            {/* Window body — full iridescent */}
            <div
              className="vista-window__body home-iridescent"
              style={{ overflow: "hidden", flex: 1, minHeight: 0, position: "relative" }}
            >
              {/* Sparkles + bubbles */}
              <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
                {SPARKLES.map((s, i) => (
                  <Image key={i} src="/star-sparkle.png" alt="" width={s.size} height={s.size}
                    className="home-sparkle absolute" style={{ top: s.top, left: s.left, animationDelay: s.delay }} unoptimized />
                ))}
                <Image src="/bubble.png" alt="" width={60} height={60} className="home-bubble absolute"
                  style={{ top: "25%", left: "5%", opacity: 0.14 }} unoptimized />
                <Image src="/bubble.png" alt="" width={35} height={35} className="home-bubble-sm absolute"
                  style={{ top: "65%", left: "90%", opacity: 0.10 }} unoptimized />
              </div>

              {/* Floating MiFOID images — desktop only, around the edges */}
              <div className="absolute inset-0 z-[1] pointer-events-none overflow-visible hidden lg:block">
                {FLOAT_IMAGES.map((img, i) => {
                  const pos: React.CSSProperties = {
                    position: "absolute",
                    width: img.size,
                    animationDelay: img.delay,
                    transform: `rotate(${img.rotate}deg)`,
                  };
                  if (img.top !== undefined) pos.top = img.top;
                  if ("bottom" in img && img.bottom !== undefined) pos.bottom = img.bottom;
                  if (img.left !== undefined) pos.left = img.left;
                  if ("right" in img && img.right !== undefined) pos.right = img.right;
                  return (
                    <div key={i} className="home-float-img" style={pos}>
                      <Image src={img.src} alt={img.alt} width={img.size} height={img.size}
                        className="w-full h-auto rounded-xl"
                        style={{ border: "1.5px solid rgba(168,130,255,0.25)" }}
                        unoptimized />
                    </div>
                  );
                })}
              </div>

              {/* Main content */}
              <div className="relative z-10 flex flex-col items-center justify-center h-full px-4 sm:px-8 py-4 overflow-y-auto">
                {/* Title — bigger, floating */}
                <div className="home-float mb-1">
                  <h1 className="home-title font-mono font-bold tracking-[0.22em] uppercase text-center">
                    FOID FOUNDATION
                  </h1>
                </div>

                {/* Pink subtitle — floats with title */}
                <div className="home-float" style={{ animationDelay: "0.5s" }}>
                  <p className="home-subtitle font-mono text-xs sm:text-sm tracking-[0.18em] uppercase text-center mb-6 sm:mb-8">
                    the internet&apos;s permanent memory
                  </p>
                </div>

                {/* Loreboard hero — centered, prominent */}
                <Link href="/board" className="home-card home-card--hero w-full max-w-[700px] mb-5 sm:mb-6" prefetch>
                  {/* Mini collage grid inside hero card — hinting at the loreboard */}
                  <div className="home-collage">
                    {COLLAGE_IMAGES.map((src, i) => (
                      <div key={i} className="home-collage__cell">
                        <Image src={src} alt="" width={60} height={60} className="w-full h-full object-cover" unoptimized />
                      </div>
                    ))}
                  </div>
                  <Image src="/star-sparkle.png" alt="" width={16} height={16} className="home-card__sparkle" unoptimized />
                  <span className="home-card__label home-card__label--hero">Loreboard</span>
                  <span className="home-card__desc home-card__desc--hero">The community canvas. Propose, vote, build culture.</span>
                  <span className="home-card__cta">Enter the Board <span aria-hidden>&rarr;</span></span>
                </Link>

                {/* 4 nav tiles — clean row */}
                <div className="home-nav-row w-full max-w-[700px]">
                  {NAV_TILES.map((tile) => (
                    <Link key={tile.href} href={tile.href} className="home-nav-btn" prefetch>
                      <Image src="/star-sparkle.png" alt="" width={10} height={10} className="home-nav-btn__sparkle" unoptimized />
                      <span className="home-nav-btn__label">{tile.label}</span>
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <style jsx>{`
        /* Iridescent body */
        :global(.home-iridescent) {
          background:
            linear-gradient(135deg,
              rgba(200, 120, 255, 0.42) 0%,
              rgba(120, 160, 255, 0.35) 25%,
              rgba(255, 160, 220, 0.32) 50%,
              rgba(140, 180, 255, 0.38) 75%,
              rgba(180, 120, 255, 0.42) 100%
            ) !important;
          background-size: 300% 300% !important;
          animation: home-iri 10s ease infinite !important;
        }
        @keyframes home-iri {
          0%   { background-position: 0% 50%; }
          50%  { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }

        /* Title — BIGGER */
        :global(.home-title) {
          font-size: clamp(28px, 5vw, 52px);
          color: rgba(255, 255, 255, 0.95);
          text-shadow: 0 0 30px rgba(200, 180, 255, 0.3), 0 0 60px rgba(168, 130, 255, 0.15);
        }

        /* Pink subtitle */
        :global(.home-subtitle) {
          background: linear-gradient(135deg, #f5a0c0 0%, #ffcce0 50%, #f5a0c0 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          filter: drop-shadow(0 0 14px rgba(245, 160, 192, 0.3));
        }

        /* Float animation */
        :global(.home-float) {
          animation: home-title-float 6s ease-in-out infinite;
        }
        @keyframes home-title-float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-5px); }
        }

        /* Floating MiFOID images — drift like MiFOID page */
        :global(.home-float-img) {
          animation: home-img-drift 5s ease-in-out infinite;
          transition: transform 0.3s ease, filter 0.3s ease;
          filter: drop-shadow(0 0 20px rgba(168, 130, 255, 0.25)) drop-shadow(0 8px 24px rgba(0,0,0,0.25));
        }
        :global(.home-float-img:hover) {
          z-index: 20 !important;
          transform: scale(1.12) !important;
          filter: drop-shadow(0 0 24px rgba(168,130,255,0.5)) drop-shadow(0 12px 32px rgba(0,0,0,0.35));
          animation-play-state: paused;
        }
        @keyframes home-img-drift {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }

        /* Sparkle animations */
        :global(.home-sparkle) {
          animation: home-sp-float 5s ease-in-out infinite, home-twinkle 2.5s ease-in-out infinite;
        }
        @keyframes home-sp-float {
          0%, 100% { transform: translateY(0) rotate(0deg); }
          50% { transform: translateY(-12px) rotate(10deg); }
        }
        @keyframes home-twinkle {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 0.9; }
        }
        :global(.home-bubble) { animation: home-bb 8s ease-in-out infinite; }
        :global(.home-bubble-sm) { animation: home-bb 6s ease-in-out infinite; }
        @keyframes home-bb {
          0%, 100% { transform: translateY(0) translateX(0); }
          33% { transform: translateY(-18px) translateX(10px); }
          66% { transform: translateY(-6px) translateX(-8px); }
        }

        /* Hero card */
        :global(.home-card--hero) {
          position: relative;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 28px 24px 24px;
          border-radius: 16px;
          border: 1px solid rgba(255, 255, 255, 0.2);
          background: rgba(255, 255, 255, 0.08);
          backdrop-filter: blur(14px);
          -webkit-backdrop-filter: blur(14px);
          text-decoration: none;
          text-align: center;
          transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
          overflow: hidden;
          cursor: pointer;
        }
        :global(.home-card--hero:hover) {
          transform: translateY(-4px) scale(1.01);
          border-color: rgba(245, 160, 192, 0.35);
          background: rgba(255, 255, 255, 0.13);
          box-shadow: 0 16px 52px rgba(255, 107, 213, 0.18), 0 0 28px rgba(168, 130, 255, 0.15);
        }

        /* Mini collage grid inside hero */
        :global(.home-collage) {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 4px;
          width: 180px;
          height: 120px;
          margin-bottom: 14px;
          border-radius: 10px;
          overflow: hidden;
          border: 1px solid rgba(255, 255, 255, 0.12);
          opacity: 0.7;
          transition: opacity 0.3s ease;
        }
        :global(.home-card--hero:hover .home-collage) {
          opacity: 0.9;
        }
        :global(.home-collage__cell) {
          overflow: hidden;
          background: rgba(0, 0, 0, 0.2);
        }
        :global(.home-collage__cell img) {
          transition: transform 0.4s ease;
        }
        :global(.home-card--hero:hover .home-collage__cell img) {
          transform: scale(1.1);
        }

        /* Card sparkle */
        :global(.home-card__sparkle) {
          position: absolute;
          top: 12px;
          right: 14px;
          opacity: 0.5;
          animation: home-csp 3s ease-in-out infinite;
        }
        @keyframes home-csp {
          0%, 100% { opacity: 0.3; transform: scale(1); }
          50% { opacity: 0.7; transform: scale(1.15); }
        }

        /* Card labels — pink gradient */
        :global(.home-card__label) {
          font-family: var(--font-mono, ui-monospace, monospace);
          font-weight: 700;
          text-transform: uppercase;
          background: linear-gradient(135deg, #f5a0c0 0%, #ffcce0 50%, #f5a0c0 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          filter: drop-shadow(0 0 14px rgba(245, 160, 192, 0.3));
          transition: filter 0.3s ease;
        }
        :global(.home-card__label--hero) {
          font-size: clamp(26px, 3.5vw, 38px);
          letter-spacing: 0.28em;
          margin-bottom: 6px;
        }
        :global(.home-card--hero:hover .home-card__label) {
          filter: drop-shadow(0 0 24px rgba(245, 160, 192, 0.55));
        }

        /* Card desc */
        :global(.home-card__desc) {
          font-size: 12px;
          line-height: 1.5;
          color: rgba(255, 255, 255, 0.55);
          max-width: 480px;
        }
        :global(.home-card__desc--hero) {
          font-size: 13px;
          color: rgba(255, 255, 255, 0.6);
          margin-bottom: 14px;
        }
        :global(.home-card--hero:hover .home-card__desc) {
          color: rgba(255, 255, 255, 0.78);
        }

        /* CTA */
        :global(.home-card__cta) {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 8px 24px;
          border-radius: 24px;
          font-size: 12px;
          font-weight: 600;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: rgba(255, 255, 255, 0.9);
          background: linear-gradient(135deg, rgba(255, 107, 213, 0.3) 0%, rgba(168, 85, 247, 0.3) 100%);
          border: 1px solid rgba(255, 107, 213, 0.25);
          backdrop-filter: blur(8px);
          transition: all 0.28s ease;
        }
        :global(.home-card--hero:hover .home-card__cta) {
          background: linear-gradient(135deg, rgba(255, 107, 213, 0.5) 0%, rgba(168, 85, 247, 0.5) 100%);
          border-color: rgba(255, 107, 213, 0.45);
          box-shadow: 0 0 20px rgba(255, 107, 213, 0.25);
          color: #fff;
        }

        /* Nav row — 4 clean buttons */
        :global(.home-nav-row) {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 12px;
        }
        :global(.home-nav-btn) {
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          padding: 14px 8px;
          border-radius: 12px;
          border: 1px solid rgba(255, 255, 255, 0.12);
          background: rgba(255, 255, 255, 0.05);
          backdrop-filter: blur(10px);
          -webkit-backdrop-filter: blur(10px);
          text-decoration: none;
          transition: all 0.28s cubic-bezier(0.34, 1.56, 0.64, 1);
          cursor: pointer;
          overflow: hidden;
        }
        :global(.home-nav-btn:hover) {
          transform: translateY(-3px) scale(1.03);
          border-color: rgba(245, 160, 192, 0.3);
          background: rgba(255, 255, 255, 0.10);
          box-shadow: 0 8px 28px rgba(168, 130, 255, 0.15), 0 0 14px rgba(245, 160, 192, 0.1);
        }
        :global(.home-nav-btn__sparkle) {
          opacity: 0.4;
          animation: home-csp 3s ease-in-out infinite;
          flex-shrink: 0;
        }
        :global(.home-nav-btn__label) {
          font-family: var(--font-mono, ui-monospace, monospace);
          font-size: 13px;
          font-weight: 700;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          background: linear-gradient(135deg, #f5a0c0 0%, #ffcce0 50%, #f5a0c0 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          filter: drop-shadow(0 0 10px rgba(245, 160, 192, 0.25));
          transition: filter 0.3s ease;
        }
        :global(.home-nav-btn:hover .home-nav-btn__label) {
          filter: drop-shadow(0 0 18px rgba(245, 160, 192, 0.5));
        }

        /* ── Mobile ── */
        @media (max-width: 768px) {
          :global(.home-title) {
            font-size: clamp(22px, 6vw, 34px);
          }
          :global(.home-nav-row) {
            grid-template-columns: repeat(2, 1fr);
            gap: 8px;
          }
          :global(.home-nav-btn) {
            padding: 12px 6px;
          }
          :global(.home-nav-btn__label) {
            font-size: 11px;
            letter-spacing: 0.12em;
          }
          :global(.home-card--hero) {
            padding: 22px 16px 20px;
          }
          :global(.home-card__label--hero) {
            font-size: 22px;
            letter-spacing: 0.2em;
          }
          :global(.home-collage) {
            width: 140px;
            height: 95px;
            margin-bottom: 10px;
          }
          :global(.home-card__desc--hero) {
            font-size: 11px;
          }
          :global(.home-card__cta) {
            font-size: 10px;
            padding: 6px 16px;
          }
        }
        @media (max-width: 480px) {
          :global(.home-nav-row) {
            gap: 6px;
          }
          :global(.home-nav-btn) {
            padding: 10px 4px;
            border-radius: 10px;
          }
          :global(.home-nav-btn__label) {
            font-size: 10px;
            letter-spacing: 0.08em;
          }
          :global(.home-nav-btn__sparkle) {
            display: none;
          }
          :global(.home-card__label--hero) {
            font-size: 18px;
          }
          :global(.home-collage) {
            width: 120px;
            height: 80px;
          }
        }
      `}</style>
    </main>
  );
}
