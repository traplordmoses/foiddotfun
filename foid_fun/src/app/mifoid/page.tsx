"use client";

import { useCallback, useEffect, useState } from "react";
import { useAccount, useDisconnect } from "wagmi";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import Image from "next/image";
import AppTitlebar from "@/app/(components)/AppTitlebar";

const FEATURES = [
  {
    title: "TRAIT SELECTION",
    body: "Milady-style trait picker.\nEach combination is unique\nand enforced on-chain.",
  },
  {
    title: "AGENT-RENDERED",
    body: "Foid Mommy renders every MiFOID\nin Blender/Eevee on demand.\nNo pre-baked PFPs.",
  },
  {
    title: "LIVING AGENT",
    body: "Each MiFOID becomes a Telegram\nAI agent powered by Qwen/Ollama.\nPersonality derived from traits.",
  },
  {
    title: "GOVERNANCE BOOST",
    body: "+50 flat bonus on StreakVotingPower.\nShape the loreboard with\namplified weight.",
  },
  {
    title: "TIERED MINT",
    body: "3,333 MiFOIDs. Genesis 0.01 ETH,\nAwakened 0.015 ETH,\nAscended 0.02 ETH.",
  },
];

/* 5 floating mini-windows — spread around the GameBoy, larger + glowing */
const FLOAT_WINDOWS = [
  { src: "/mifoid04.png", alt: "MiFOID - gray tee",       top: -35,  left: -100, rotate: -6,  delay: "0s" },
  { src: "/mifoid07.png", alt: "MiFOID in Blender",        top: "18%", left: -115, rotate: -8,  delay: "0.9s" },
  { src: "/mifoid08.png", alt: "MiFOID texture paint",     top: "10%", right: -100, rotate: 5,  delay: "1.5s" },
  { src: "/mifoid02.png", alt: "MiFOID - green hoodie",    bottom: 20, left: -110, rotate: 5,  delay: "1.2s" },
  { src: "/mifoid03.png", alt: "MiFOID - black hoodie",    bottom: -20, right: -95, rotate: -6, delay: "0.3s" },
];

const SPARKLES = [
  { top: "18%", left: "44%", size: 40, delay: "0s" },
  { top: "38%", left: "50%", size: 28, delay: "0.8s" },
  { top: "58%", left: "42%", size: 34, delay: "0.4s" },
  { top: "78%", left: "48%", size: 22, delay: "1.2s" },
  { top: "8%", left: "52%", size: 20, delay: "0.6s" },
];

export default function MiFOIDPage() {
  const { address, isConnected } = useAccount();
  const { disconnect } = useDisconnect();
  const { openConnectModal } = useConnectModal();

  /* Hydration fix — server renders disconnected, client may differ */
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const handleSwitchWallet = useCallback(() => {
    disconnect();
    setTimeout(() => openConnectModal?.(), 100);
  }, [disconnect, openConnectModal]);

  return (
    <main
      className="mifoid-page relative bg-foid-bg text-white/90 overflow-hidden flex items-center justify-center"
      style={{ height: "100vh" }}
    >
      <div className="pointer-events-none fixed inset-0 z-0 vignette" />

      <section className="relative z-10 w-full max-w-full px-2 sm:px-4">
        <div className="mx-auto w-full max-w-6xl">
          <div className="vista-window vista-window--terminal vista-window--enhanced h-[94vh] max-h-[94vh] w-full flex flex-col">
            <AppTitlebar
              title="MIFOID.EXE"
              connected={mounted && isConnected}
              address={mounted ? address : undefined}
              onDisconnect={() => disconnect()}
              onSwitchWallet={handleSwitchWallet}
            />

            {/* Content area — iridescent gradient INSIDE window only */}
            <div
              className="vista-window__body mifoid-iridescent"
              style={{ overflow: "clip", flex: 1, minHeight: 0, position: "relative", padding: "0 24px" }}
            >
              {/* Decorative sparkles + bubbles */}
              <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
                <Image
                  src="/bubble.png" alt="" width={70} height={70}
                  className="mifoid-bubble absolute"
                  style={{ top: "55%", left: "36%", opacity: 0.18 }}
                  unoptimized
                />
                <Image
                  src="/bubble.png" alt="" width={35} height={35}
                  className="mifoid-bubble-sm absolute"
                  style={{ top: "12%", left: "50%", opacity: 0.14 }}
                  unoptimized
                />
                {SPARKLES.map((s, i) => (
                  <Image
                    key={i} src="/star-sparkle.png" alt=""
                    width={s.size} height={s.size}
                    className="mifoid-sparkle absolute"
                    style={{ top: s.top, left: s.left, animationDelay: s.delay }}
                    unoptimized
                  />
                ))}
              </div>

              {/* Sub-header */}
              <div className="absolute top-3 left-4 right-4 lg:left-6 lg:right-6 flex items-center justify-between z-10">
                <span className="font-mono text-xs lg:text-sm font-bold tracking-[0.2em] text-white/90 uppercase">
                  MIFOID
                </span>
                <span className="font-mono text-[10px] lg:text-sm font-medium tracking-[0.1em] lg:tracking-[0.15em] text-white/70 uppercase hidden sm:block">
                  3,333 BORN, NOT GENERATED
                </span>
              </div>

              {/* Flex layout: stacked on mobile, side-by-side on desktop */}
              <div className="relative z-10 flex flex-col lg:flex-row items-center h-full pt-10 lg:pt-8 overflow-y-auto lg:overflow-visible">
                {/* Left — features */}
                <div className="flex flex-col justify-center flex-1 w-full lg:h-full pl-4 pr-4 lg:pl-8 lg:pr-6 gap-4 lg:gap-7 min-w-0 pb-4 lg:pb-0">
                  {FEATURES.map((feat, i) => (
                    <div key={i} className="flex gap-3 items-start">
                      <div className="mifoid-diamond flex-shrink-0 mt-0.5">
                        <Image src="/star-sparkle.png" alt="" width={18} height={18} unoptimized />
                      </div>
                      <div>
                        <h3 className="mifoid-feature-title font-mono font-bold tracking-[0.12em] uppercase text-sm lg:text-[clamp(14px,1.5vw,22px)] leading-tight">
                          {feat.title}
                        </h3>
                        <p className="text-white/85 font-medium text-xs lg:text-[clamp(11px,1.1vw,15px)] leading-snug mt-0.5 whitespace-pre-line">
                          {feat.body}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Right — GameBoy+MiFOID combined image */}
                <div className="flex-1 flex items-center justify-center relative w-full lg:h-full lg:mr-[40px] xl:mr-[70px] pb-20 lg:pb-0">
                  {/* GameBoy + character combined image */}
                  <div
                    className="mifoid-gameboy-wrap relative w-[200px] md:w-[240px] lg:w-[280px] xl:w-[320px]"
                  >
                    {/* Radial glow behind gameboy for focal effect */}
                    <div className="mifoid-focal-glow" />
                    <Image
                      src="/gameboy_mifoid.png"
                      alt="MiFOID Game Boy"
                      width={600}
                      height={1000}
                      className="mifoid-gameboy-shell w-full h-auto"
                      style={{
                        position: "relative",
                        zIndex: 2,
                      }}
                      unoptimized
                    />

                    {/* Floating mini-windows around the GameBoy */}
                    {/* Floating windows — hidden on mobile, shown on desktop */}
                    {FLOAT_WINDOWS.map((fw, i) => {
                      const pos: React.CSSProperties = {
                        position: "absolute",
                        width: 130,
                        zIndex: 10,
                        animationDelay: fw.delay,
                        transform: `rotate(${fw.rotate}deg)`,
                      };
                      if (fw.top !== undefined) pos.top = fw.top;
                      if ("bottom" in fw && fw.bottom !== undefined) pos.bottom = fw.bottom;
                      if (fw.left !== undefined) pos.left = fw.left;
                      if ("right" in fw && fw.right !== undefined) pos.right = fw.right;

                      return (
                        <div key={i} className="mifoid-paint-window hidden lg:block" style={pos}>
                          <Image
                            src={fw.src}
                            alt={fw.alt}
                            width={130}
                            height={121}
                            className="w-full h-auto"
                            style={{
                              borderRadius: 8,
                              boxShadow: "none",
                              border: "1.5px solid rgba(168,130,255,0.25)",
                            }}
                            unoptimized
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <style jsx>{`
        /* Iridescent gradient — inside window only, clearly visible */
        :global(.mifoid-iridescent) {
          background:
            linear-gradient(
              135deg,
              rgba(200, 120, 255, 0.45) 0%,
              rgba(120, 160, 255, 0.38) 25%,
              rgba(255, 160, 220, 0.35) 50%,
              rgba(140, 180, 255, 0.4)  75%,
              rgba(180, 120, 255, 0.45) 100%
            ) !important;
          background-size: 300% 300% !important;
          animation: iridescent 10s ease infinite !important;
        }
        @keyframes iridescent {
          0%   { background-position: 0% 50%; }
          50%  { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }

        /* Feature titles — pink gradient text */
        :global(.mifoid-feature-title) {
          background: linear-gradient(135deg, #f5a0c0 0%, #ffcce0 50%, #f5a0c0 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          text-shadow: none;
          filter: drop-shadow(0 0 12px rgba(245, 160, 192, 0.3));
        }

        /* Diamond bullet pulse */
        :global(.mifoid-diamond) {
          animation: mifoid-diamond-pulse 3s ease-in-out infinite;
        }
        @keyframes mifoid-diamond-pulse {
          0%, 100% { opacity: 0.8; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.1); }
        }

        /* Sparkle float + twinkle */
        :global(.mifoid-sparkle) {
          animation: mifoid-sparkle-float 5s ease-in-out infinite, mifoid-twinkle 2.5s ease-in-out infinite;
        }
        @keyframes mifoid-sparkle-float {
          0%, 100% { transform: translateY(0) rotate(0deg); }
          50% { transform: translateY(-10px) rotate(8deg); }
        }
        @keyframes mifoid-twinkle {
          0%, 100% { opacity: 0.5; }
          50% { opacity: 1; }
        }

        /* Bubble float */
        :global(.mifoid-bubble) {
          animation: mifoid-bubble-drift 8s ease-in-out infinite;
        }
        :global(.mifoid-bubble-sm) {
          animation: mifoid-bubble-drift 6s ease-in-out infinite;
        }
        @keyframes mifoid-bubble-drift {
          0%, 100% { transform: translateY(0) translateX(0); }
          33% { transform: translateY(-15px) translateX(8px); }
          66% { transform: translateY(-5px) translateX(-6px); }
        }

        /* Focal glow behind gameboy */
        :global(.mifoid-focal-glow) {
          position: absolute;
          top: 50%;
          left: 50%;
          width: 140%;
          height: 140%;
          transform: translate(-50%, -50%);
          background: radial-gradient(
            ellipse at center,
            rgba(168, 130, 255, 0.25) 0%,
            rgba(120, 200, 255, 0.15) 30%,
            rgba(255, 160, 220, 0.08) 55%,
            transparent 75%
          );
          border-radius: 50%;
          z-index: 0;
          animation: mifoid-focal-pulse 4s ease-in-out infinite;
          pointer-events: none;
        }
        @keyframes mifoid-focal-pulse {
          0%, 100% { opacity: 0.7; transform: translate(-50%, -50%) scale(1); }
          50% { opacity: 1; transform: translate(-50%, -50%) scale(1.05); }
        }

        /* GameBoy gentle float */
        :global(.mifoid-gameboy-wrap) {
          animation: mifoid-gb-float 6s ease-in-out infinite;
          filter: drop-shadow(0 0 40px rgba(168, 130, 255, 0.3)) drop-shadow(0 16px 48px rgba(0, 0, 0, 0.3));
        }
        @keyframes mifoid-gb-float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-8px); }
        }

        /* Floating windows drift + glow */
        :global(.mifoid-paint-window) {
          animation: mifoid-paint-drift 5s ease-in-out infinite;
          transition: transform 0.3s ease, filter 0.3s ease;
        }
        :global(.mifoid-paint-window:hover) {
          z-index: 20 !important;
          transform: scale(1.1) !important;
          filter: drop-shadow(0 0 16px rgba(168,130,255,0.5)) drop-shadow(0 12px 32px rgba(0, 0, 0, 0.4));
          animation-play-state: paused;
        }
        @keyframes mifoid-paint-drift {
          0%, 100% { transform: translateY(0) rotate(var(--float-rotate, 0deg)); }
          50% { transform: translateY(-10px) rotate(var(--float-rotate, 0deg)); }
        }
      `}</style>
    </main>
  );
}