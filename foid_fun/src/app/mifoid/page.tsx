"use client";

import { useCallback, useEffect, useState } from "react";
import { useAccount, useDisconnect, useConnect } from "wagmi";
import Image from "next/image";
import AppTitlebar from "@/app/(components)/AppTitlebar";

const FEATURE_CARDS = [
  {
    title: "TRAIT SELECTION",
    body: "Milady-style trait picker. Each combination is unique and enforced on-chain — no two MiFOIDs are alike.",
    icon: "🎨",
  },
  {
    title: "AGENT-RENDERED",
    body: "Foid Mommy renders every MiFOID in Blender/Eevee on demand. No pre-baked PFPs — your NFT is built to order.",
    icon: "🖥️",
  },
  {
    title: "LIVING AGENT",
    body: "Each MiFOID becomes a Telegram AI agent powered by Qwen/Ollama. Personality derived from traits.",
    icon: "💬",
  },
  {
    title: "GOVERNANCE BOOST",
    body: "+50 flat bonus on StreakVotingPower for all MiFOID holders. Shape the loreboard with amplified weight.",
    icon: "⚡",
  },
];

const MINT_TIERS = [
  { tier: "GENESIS", range: "#1 — 1000", price: "0.01 ETH", color: "rgba(116, 255, 235, 0.9)" },
  { tier: "AWAKENED", range: "#1001 — 2500", price: "0.015 ETH", color: "rgba(168, 130, 255, 0.9)" },
  { tier: "ASCENDED", range: "#2501 — 3333", price: "0.02 ETH", color: "rgba(255, 160, 220, 0.9)" },
];

const PIPELINE_STEPS = [
  "Mint Event",
  "Chain Listener",
  "Read Traits",
  "Blender Render",
  "IPFS Upload",
  "Set tokenURI",
  "Telegram DM",
];

const EXTRA_CARDS = [
  {
    title: "PROVENANCE",
    body: "Transfer count = \"body count.\" Genesis holders get virgin chat access. On-chain history matters.",
  },
  {
    title: "3D RENDER",
    body: "Full Blender scene with Eevee lighting. Not a flat PNG — a rendered 3D character model.",
  },
  {
    title: "UNIQUENESS",
    body: "Trait combos validated on-chain at mint. Duplicates are impossible by design.",
  },
  {
    title: "VISUAL PACKAGING",
    body: "Each MiFOID comes with a GameBoy-style display card, shareable and collectible.",
  },
];

/* Floating mini-windows — repositioned for scrollable layout */
const FLOAT_IMAGES = [
  { src: "/mifoid04.png", alt: "MiFOID - gray tee", delay: "0s" },
  { src: "/mifoid07.png", alt: "MiFOID in Blender", delay: "0.9s" },
  { src: "/mifoid08.png", alt: "MiFOID texture paint", delay: "1.5s" },
  { src: "/mifoid02.png", alt: "MiFOID - green hoodie", delay: "1.2s" },
  { src: "/mifoid03.png", alt: "MiFOID - black hoodie", delay: "0.3s" },
];

const SPARKLES = [
  { top: "8%", left: "15%", size: 30, delay: "0s" },
  { top: "22%", left: "85%", size: 22, delay: "0.8s" },
  { top: "45%", left: "10%", size: 26, delay: "0.4s" },
  { top: "65%", left: "90%", size: 20, delay: "1.2s" },
  { top: "85%", left: "50%", size: 24, delay: "0.6s" },
];

export default function MiFOIDPage() {
  const { address, isConnected } = useAccount();
  const { disconnect } = useDisconnect();
  const { connectors } = useConnect();

  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const handleSwitchWallet = useCallback(() => {
    const injected = connectors.find((c) => c.id === "injected") ?? connectors[0];
    if (injected) injected.connect?.();
  }, [connectors]);

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

            {/* Content area — scrollable, iridescent gradient */}
            <div
              className="vista-window__body mifoid-iridescent"
              style={{ overflowY: "auto", flex: 1, minHeight: 0, position: "relative" }}
            >
              {/* Decorative sparkles */}
              <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
                <Image
                  src="/bubble.png" alt="" width={70} height={70}
                  className="mifoid-bubble absolute"
                  style={{ top: "15%", left: "80%", opacity: 0.14 }}
                  unoptimized
                />
                <Image
                  src="/bubble.png" alt="" width={35} height={35}
                  className="mifoid-bubble-sm absolute"
                  style={{ top: "55%", left: "5%", opacity: 0.12 }}
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

              {/* Scrollable content */}
              <div className="relative z-10 px-4 sm:px-8 py-6 flex flex-col gap-10">

                {/* A. Hero header */}
                <div className="text-center">
                  <h1 className="mifoid-hero-title font-mono font-black tracking-[0.15em] uppercase text-[clamp(18px,2.5vw,32px)] leading-tight">
                    MIFOID — THE WORLD&apos;S FIRST<br />AGENT-GENERATED NFT COLLECTION
                  </h1>
                  <p className="mt-2 text-white/60 font-mono text-[clamp(11px,1.2vw,15px)] tracking-[0.1em] uppercase">
                    3,333 born, not generated.
                  </p>
                </div>

                {/* Floating MiFOID images — horizontal strip */}
                <div className="flex justify-center gap-3 flex-wrap">
                  {FLOAT_IMAGES.map((fw, i) => (
                    <div key={i} className="mifoid-paint-window" style={{ animationDelay: fw.delay }}>
                      <Image
                        src={fw.src} alt={fw.alt}
                        width={100} height={93}
                        className="w-full h-auto"
                        style={{ borderRadius: 8, border: "1.5px solid rgba(168,130,255,0.25)" }}
                        unoptimized
                      />
                    </div>
                  ))}
                </div>

                {/* B. Feature cards — 2x2 grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {FEATURE_CARDS.map((feat, i) => (
                    <div key={i} className="mifoid-card">
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="text-lg">{feat.icon}</span>
                        <h3 className="mifoid-feature-title font-mono font-bold tracking-[0.1em] uppercase text-sm">
                          {feat.title}
                        </h3>
                      </div>
                      <p className="text-white/80 text-xs leading-relaxed">{feat.body}</p>
                    </div>
                  ))}
                </div>

                {/* C. Tiered Mint Pricing */}
                <div>
                  <h2 className="mifoid-section-title font-mono font-bold tracking-[0.15em] uppercase text-center mb-4">
                    TIERED MINT PRICING
                  </h2>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {MINT_TIERS.map((t, i) => (
                      <div key={i} className="mifoid-card text-center">
                        <div className="font-mono font-bold text-sm tracking-[0.12em] mb-1" style={{ color: t.color }}>
                          {t.tier}
                        </div>
                        <div className="text-white/50 text-[10px] tracking-wide mb-2">{t.range}</div>
                        <div className="font-mono font-black text-lg text-white/90">{t.price}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* D. Pipeline flow */}
                <div>
                  <h2 className="mifoid-section-title font-mono font-bold tracking-[0.15em] uppercase text-center mb-4">
                    RENDER PIPELINE
                  </h2>
                  <div className="flex flex-wrap justify-center items-center gap-1">
                    {PIPELINE_STEPS.map((step, i) => (
                      <div key={i} className="flex items-center gap-1">
                        <span className="mifoid-pipeline-step font-mono text-[10px] sm:text-xs tracking-wide uppercase px-2 py-1 rounded-md">
                          {step}
                        </span>
                        {i < PIPELINE_STEPS.length - 1 && (
                          <span className="text-white/30 text-xs font-mono">&rarr;</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* E. Sub-Agent System */}
                <div className="mifoid-card">
                  <h2 className="mifoid-feature-title font-mono font-bold tracking-[0.1em] uppercase text-sm mb-2">
                    SUB-AGENT SYSTEM
                  </h2>
                  <p className="text-white/80 text-xs leading-relaxed">
                    Every MiFOID becomes an AI sub-agent on Telegram. Personality is derived from on-chain traits —
                    your MiFOID builds memory over conversations, develops opinions, and interacts with other agents.
                    Powered by Qwen/Ollama with persistent context windows.
                  </p>
                </div>

                {/* F. Extra cards — 2x2 grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pb-4">
                  {EXTRA_CARDS.map((card, i) => (
                    <div key={i} className="mifoid-card">
                      <h3 className="mifoid-feature-title font-mono font-bold tracking-[0.1em] uppercase text-sm mb-1.5">
                        {card.title}
                      </h3>
                      <p className="text-white/80 text-xs leading-relaxed">{card.body}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <style jsx>{`
        /* Iridescent gradient */
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

        /* Hero title — bold gradient */
        :global(.mifoid-hero-title) {
          background: linear-gradient(135deg, #f5a0c0 0%, #ffcce0 40%, #c0a0ff 70%, #f5a0c0 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          text-shadow: none;
          filter: drop-shadow(0 0 18px rgba(245, 160, 192, 0.3));
        }

        /* Section title */
        :global(.mifoid-section-title) {
          background: linear-gradient(135deg, rgba(116, 255, 235, 0.9) 0%, rgba(168, 130, 255, 0.9) 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          filter: drop-shadow(0 0 8px rgba(116, 255, 235, 0.2));
        }

        /* Feature title — pink gradient text */
        :global(.mifoid-feature-title) {
          background: linear-gradient(135deg, #f5a0c0 0%, #ffcce0 50%, #f5a0c0 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          text-shadow: none;
          filter: drop-shadow(0 0 12px rgba(245, 160, 192, 0.3));
        }

        /* Card style */
        :global(.mifoid-card) {
          padding: 14px 16px;
          border-radius: 12px;
          border: 1px solid rgba(168, 130, 255, 0.2);
          background:
            linear-gradient(180deg, rgba(255, 255, 255, 0.06), rgba(255, 255, 255, 0) 50%),
            rgba(10, 8, 24, 0.55);
          backdrop-filter: blur(12px);
          box-shadow:
            0 8px 24px rgba(0, 0, 0, 0.3),
            inset 0 1px 0 rgba(255, 255, 255, 0.08);
        }

        /* Pipeline step */
        :global(.mifoid-pipeline-step) {
          background: rgba(10, 8, 24, 0.6);
          border: 1px solid rgba(116, 255, 235, 0.2);
          color: rgba(116, 255, 235, 0.85);
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

        /* Floating images drift */
        :global(.mifoid-paint-window) {
          animation: mifoid-paint-drift 5s ease-in-out infinite;
          transition: transform 0.3s ease, filter 0.3s ease;
          width: 100px;
        }
        :global(.mifoid-paint-window:hover) {
          transform: scale(1.1) !important;
          filter: drop-shadow(0 0 16px rgba(168,130,255,0.5));
          animation-play-state: paused;
        }
        @keyframes mifoid-paint-drift {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-8px); }
        }

        /* Scrollbar */
        :global(.mifoid-iridescent) {
          scrollbar-width: thin;
          scrollbar-color: rgba(168, 130, 255, 0.3) transparent;
        }
        :global(.mifoid-iridescent)::-webkit-scrollbar { width: 8px; }
        :global(.mifoid-iridescent)::-webkit-scrollbar-thumb {
          border-radius: 999px;
          background: rgba(168, 130, 255, 0.3);
          border: 2px solid transparent;
          background-clip: padding-box;
        }
        :global(.mifoid-iridescent)::-webkit-scrollbar-track { background: transparent; }
      `}</style>
    </main>
  );
}
