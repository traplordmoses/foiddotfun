"use client";

import Link from "next/link";
import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import { useAccount, useDisconnect } from "wagmi";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import AppTitlebar from "@/app/(components)/AppTitlebar";

const tiles = [
  {
    title: "loreboard.app",
    label: "Loreboard",
    href: "/board",
    accent: "#ff6bd5",
    description: "The community canvas. Propose, vote, build culture.",
  },
  {
    title: "pray.exe",
    label: "Pray",
    href: "/pray",
    accent: "#00ffff",
    description: "Daily on-chain ritual. Build streaks, earn voting power.",
  },
  {
    title: "vote.exe",
    label: "Vote",
    href: "/vote",
    accent: "#a855f7",
    description: "Swipe to approve or reject. Shape the board.",
  },
  {
    title: "mifoid.exe",
    label: "MiFOID",
    href: "/mifoid",
    accent: "#818cf8",
    description: "3,333 agent-rendered NFTs. Your key to the ecosystem.",
  },
  {
    title: "about.exe",
    label: "About",
    href: "/about",
    accent: "#34d399",
    description: "Contracts, roadmap, FAQ.",
  },
] as const;

/* Floating sparkle positions inside the window body */
const SPARKLES = [
  { top: "10%", left: "8%", size: 24, delay: "0s" },
  { top: "22%", left: "85%", size: 30, delay: "0.7s" },
  { top: "48%", left: "5%", size: 20, delay: "1.3s" },
  { top: "65%", left: "92%", size: 26, delay: "0.4s" },
  { top: "82%", left: "14%", size: 18, delay: "1.0s" },
  { top: "38%", left: "90%", size: 22, delay: "1.6s" },
  { top: "75%", left: "80%", size: 28, delay: "0.2s" },
  { top: "15%", left: "50%", size: 16, delay: "0.9s" },
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

            {/* Window body — full iridescent gradient like MiFOID */}
            <div
              className="vista-window__body home-iridescent"
              style={{ overflow: "hidden", flex: 1, minHeight: 0, position: "relative" }}
            >
              {/* Floating sparkles + bubbles inside the window */}
              <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
                {SPARKLES.map((s, i) => (
                  <Image
                    key={i}
                    src="/star-sparkle.png"
                    alt=""
                    width={s.size}
                    height={s.size}
                    className="home-sparkle absolute"
                    style={{ top: s.top, left: s.left, animationDelay: s.delay }}
                    unoptimized
                  />
                ))}
                <Image
                  src="/bubble.png" alt="" width={70} height={70}
                  className="home-bubble absolute"
                  style={{ top: "30%", left: "6%", opacity: 0.14 }}
                  unoptimized
                />
                <Image
                  src="/bubble.png" alt="" width={40} height={40}
                  className="home-bubble-sm absolute"
                  style={{ top: "70%", left: "88%", opacity: 0.10 }}
                  unoptimized
                />
              </div>

              {/* Content — centered vertically */}
              <div className="relative z-10 flex flex-col items-center justify-center h-full px-4 sm:px-8 py-6 overflow-y-auto">
                {/* Title — floating at top */}
                <div className="home-float mb-2">
                  <h1 className="home-title font-mono font-bold tracking-[0.25em] uppercase text-center">
                    FOID FOUNDATION
                  </h1>
                </div>

                {/* Pink subtitle */}
                <p className="home-subtitle font-mono text-xs sm:text-sm tracking-[0.18em] uppercase text-center mb-8 sm:mb-10">
                  the internet&apos;s permanent memory
                </p>

                {/* Tile grid — hero + 4 secondary */}
                <div className="home-grid w-full max-w-[960px]">
                  {tiles.map((tile, idx) => (
                    <Link
                      key={tile.href}
                      href={tile.href}
                      className={`home-card ${idx === 0 ? "home-card--hero" : ""}`}
                      prefetch
                    >
                      {/* Sparkle decoration inside card */}
                      <Image
                        src="/star-sparkle.png" alt="" width={14} height={14}
                        className="home-card__sparkle"
                        unoptimized
                      />

                      <span className="home-card__label">{tile.label}</span>
                      <span className="home-card__desc">{tile.description}</span>

                      {idx === 0 && (
                        <span className="home-card__cta">
                          Enter the Board <span aria-hidden>&rarr;</span>
                        </span>
                      )}
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <style jsx>{`
        /* Iridescent body — same treatment as MiFOID */
        :global(.home-iridescent) {
          background:
            linear-gradient(
              135deg,
              rgba(200, 120, 255, 0.42) 0%,
              rgba(120, 160, 255, 0.35) 25%,
              rgba(255, 160, 220, 0.32) 50%,
              rgba(140, 180, 255, 0.38) 75%,
              rgba(180, 120, 255, 0.42) 100%
            ) !important;
          background-size: 300% 300% !important;
          animation: home-iridescent 10s ease infinite !important;
        }
        @keyframes home-iridescent {
          0%   { background-position: 0% 50%; }
          50%  { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }

        /* Title — large, glowing */
        :global(.home-title) {
          font-size: clamp(22px, 4vw, 42px);
          color: rgba(255, 255, 255, 0.95);
          text-shadow: 0 0 30px rgba(200, 180, 255, 0.3), 0 0 60px rgba(168, 130, 255, 0.15);
        }

        /* Subtitle — pink gradient like MiFOID feature titles */
        :global(.home-subtitle) {
          background: linear-gradient(135deg, #f5a0c0 0%, #ffcce0 50%, #f5a0c0 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          filter: drop-shadow(0 0 14px rgba(245, 160, 192, 0.3));
        }

        /* Gentle float animation for title area */
        :global(.home-float) {
          animation: home-title-float 6s ease-in-out infinite;
        }
        @keyframes home-title-float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-4px); }
        }

        /* Sparkle animations (same as MiFOID) */
        :global(.home-sparkle) {
          animation: home-sparkle-float 5s ease-in-out infinite, home-twinkle 2.5s ease-in-out infinite;
        }
        @keyframes home-sparkle-float {
          0%, 100% { transform: translateY(0) rotate(0deg); }
          50% { transform: translateY(-12px) rotate(10deg); }
        }
        @keyframes home-twinkle {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 0.9; }
        }
        :global(.home-bubble) {
          animation: home-bubble-drift 8s ease-in-out infinite;
        }
        :global(.home-bubble-sm) {
          animation: home-bubble-drift 6s ease-in-out infinite;
        }
        @keyframes home-bubble-drift {
          0%, 100% { transform: translateY(0) translateX(0); }
          33% { transform: translateY(-18px) translateX(10px); }
          66% { transform: translateY(-6px) translateX(-8px); }
        }

        /* Tile grid */
        :global(.home-grid) {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 16px;
        }
        :global(.home-card--hero) {
          grid-column: 1 / -1;
        }

        /* Cards — glass panels inside the iridescent body */
        :global(.home-card) {
          position: relative;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 24px 16px;
          border-radius: 14px;
          border: 1px solid rgba(255, 255, 255, 0.15);
          background: rgba(255, 255, 255, 0.06);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          text-decoration: none;
          text-align: center;
          transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
          overflow: hidden;
          cursor: pointer;
        }
        :global(.home-card:hover) {
          transform: translateY(-4px) scale(1.02);
          border-color: rgba(245, 160, 192, 0.35);
          background: rgba(255, 255, 255, 0.12);
          box-shadow: 0 12px 40px rgba(168, 130, 255, 0.2), 0 0 20px rgba(245, 160, 192, 0.15);
        }
        :global(.home-card--hero) {
          padding: 36px 24px;
          background: rgba(255, 255, 255, 0.08);
          border-color: rgba(255, 255, 255, 0.2);
        }
        :global(.home-card--hero:hover) {
          background: rgba(255, 255, 255, 0.14);
          box-shadow: 0 16px 52px rgba(255, 107, 213, 0.2), 0 0 28px rgba(168, 130, 255, 0.18);
        }

        /* Card sparkle decoration */
        :global(.home-card__sparkle) {
          position: absolute;
          top: 10px;
          right: 12px;
          opacity: 0.5;
          animation: home-card-sparkle-pulse 3s ease-in-out infinite;
        }
        @keyframes home-card-sparkle-pulse {
          0%, 100% { opacity: 0.3; transform: scale(1); }
          50% { opacity: 0.7; transform: scale(1.15); }
        }

        /* Card label — pink gradient text like MiFOID */
        :global(.home-card__label) {
          font-family: var(--font-mono, ui-monospace, monospace);
          font-size: 20px;
          font-weight: 700;
          letter-spacing: 0.2em;
          text-transform: uppercase;
          background: linear-gradient(135deg, #f5a0c0 0%, #ffcce0 50%, #f5a0c0 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          filter: drop-shadow(0 0 14px rgba(245, 160, 192, 0.3));
          margin-bottom: 6px;
          transition: filter 0.3s ease;
        }
        :global(.home-card--hero .home-card__label) {
          font-size: clamp(24px, 3vw, 36px);
          letter-spacing: 0.28em;
          margin-bottom: 8px;
        }
        :global(.home-card:hover .home-card__label) {
          filter: drop-shadow(0 0 22px rgba(245, 160, 192, 0.55));
        }

        /* Card description */
        :global(.home-card__desc) {
          font-size: 11px;
          line-height: 1.5;
          color: rgba(255, 255, 255, 0.55);
          max-width: 480px;
        }
        :global(.home-card--hero .home-card__desc) {
          font-size: 13px;
          color: rgba(255, 255, 255, 0.6);
          margin-bottom: 14px;
        }
        :global(.home-card:hover .home-card__desc) {
          color: rgba(255, 255, 255, 0.75);
        }

        /* CTA button on hero */
        :global(.home-card__cta) {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 8px 22px;
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
        :global(.home-card:hover .home-card__cta) {
          background: linear-gradient(135deg, rgba(255, 107, 213, 0.5) 0%, rgba(168, 85, 247, 0.5) 100%);
          border-color: rgba(255, 107, 213, 0.45);
          box-shadow: 0 0 20px rgba(255, 107, 213, 0.25);
          color: #fff;
        }

        /* Responsive */
        @media (max-width: 768px) {
          :global(.home-grid) {
            grid-template-columns: repeat(2, 1fr);
            gap: 12px;
          }
          :global(.home-card) {
            padding: 18px 12px;
          }
          :global(.home-card--hero) {
            padding: 28px 18px;
          }
          :global(.home-card__label) {
            font-size: 14px;
            letter-spacing: 0.14em;
          }
          :global(.home-card--hero .home-card__label) {
            font-size: 20px;
          }
          :global(.home-card__desc) {
            font-size: 10px;
          }
        }
        @media (max-width: 480px) {
          :global(.home-grid) {
            gap: 8px;
          }
          :global(.home-card) {
            padding: 14px 10px;
          }
          :global(.home-card--hero) {
            padding: 22px 14px;
          }
          :global(.home-card__label) {
            font-size: 12px;
            letter-spacing: 0.1em;
          }
          :global(.home-card--hero .home-card__label) {
            font-size: 16px;
          }
          :global(.home-card__desc) {
            display: none;
          }
          :global(.home-card__cta) {
            font-size: 10px;
            padding: 6px 16px;
          }
        }
      `}</style>
    </main>
  );
}
