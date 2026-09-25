// src/apps/MifoidApp.tsx
// MIFOID.EXE — window content extracted from the /mifoid route so the same
// component renders in BOTH presentations (multi-window plan §4):
//   - the /mifoid route page (thin wrapper: main + vista-window + titlebar)
//   - a desktop shell window (<OSWindow appId="mifoid">) — the default
//     mifoid surface on lg+ viewports since Stage C (routes hand off)
//
// The floating mini-windows are absolutely positioned inside the frame —
// already window-relative, which is what made this an S-tier port. The
// styled-jsx block travels with the component (all rules are :global, so
// the scoping hash is irrelevant); the window-width reflow rules live in
// globals.css under `.mifoid-page` — the route puts that class on <main>,
// the shell puts it on the OSWindow frame.
"use client";

import Image from "next/image";
import MifoidReserve from "@/components/MifoidReserve";

const FEATURES = [
  {
    title: "TRAIT SELECTION",
    body: "Milady-style trait picker.\nEach combination is unique\nand enforced onchain.",
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

/* 5 floating mini-windows — spread around the GameBoy, larger + glowing.
   Positions and size are percentages of the Game Boy, so the collage
   scales as one piece when the Game Boy shrinks to fit a short window.
   h = the render's height at 130px wide (the files are 1200px wide), so the
   width/height attributes carry each render's real proportions. */
const FLOAT_WINDOWS = [
  { src: "/mifoid04.webp", alt: "MiFOID - gray tee",       h: 122, top: "-6.5%", left: "-31%", rotate: -6,  delay: "0s" },
  { src: "/mifoid07.webp", alt: "MiFOID in Blender",        h: 110, top: "18%", left: "-36%", rotate: -8,  delay: "0.9s" },
  { src: "/mifoid08.webp", alt: "MiFOID texture paint",     h: 146, top: "10%", right: "-31%", rotate: 5,  delay: "1.5s" },
  { src: "/mifoid02.webp", alt: "MiFOID - green hoodie",    h: 122, bottom: "3.75%", left: "-34%", rotate: 5,  delay: "1.2s" },
  { src: "/mifoid03.webp", alt: "MiFOID - black hoodie",    h: 122, bottom: "-3.75%", right: "-30%", rotate: -6, delay: "0.3s" },
];

const SPARKLES = [
  { top: "18%", left: "44%", size: 40, delay: "0s" },
  { top: "38%", left: "50%", size: 28, delay: "0.8s" },
  { top: "58%", left: "42%", size: 34, delay: "0.4s" },
  { top: "78%", left: "48%", size: 22, delay: "1.2s" },
  { top: "8%", left: "52%", size: 20, delay: "0.6s" },
];

export default function MifoidApp() {
  return (
    <>
      {/* Content area — iridescent gradient INSIDE window only */}
      <div
        className="vista-window__body mifoid-iridescent flex flex-col"
        style={{ overflow: "clip", flex: 1, minHeight: 0, position: "relative", padding: "0 24px" }}
      >
        {/* Decorative sparkles + bubbles (the sparkles sit over the feature
            text on a phone, so they are wide-layout only) */}
        <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
          <Image
            src="/bubble.webp" alt="" width={70} height={70}
            className="mifoid-bubble absolute"
            style={{ top: "55%", left: "36%", opacity: 0.18 }}
            unoptimized
          />
          <Image
            src="/bubble.webp" alt="" width={35} height={35}
            className="mifoid-bubble-sm absolute"
            style={{ top: "12%", left: "50%", opacity: 0.14 }}
            unoptimized
          />
          {SPARKLES.map((s, i) => (
            <Image
              key={i} src="/star-sparkle.webp" alt=""
              width={s.size} height={s.size}
              className="mifoid-sparkle absolute hidden lg:block"
              style={{ top: s.top, left: s.left, animationDelay: s.delay }}
              unoptimized
            />
          ))}
        </div>

        {/* Sub-header (wide layout; phones carry the title in the hero). In
            the flow, not absolute: it used to sit on top of the feature
            column whenever that column ran taller than the window. */}
        <div className="relative hidden lg:flex flex-none items-center justify-between z-10 pt-3 pb-1 lg:px-2">
          <span className="font-mono text-xs lg:text-sm font-bold tracking-[0.2em] text-white/90 uppercase">
            MIFOID
          </span>
          <span className="font-mono text-[10px] lg:text-sm font-medium tracking-[0.1em] lg:tracking-[0.15em] text-white/70 uppercase hidden sm:block">
            3,333 BORN, NOT GENERATED
          </span>
        </div>

        {/* Flex layout: stacked on mobile, side-by-side on desktop */}
        <div className="relative z-10 flex flex-col lg:flex-row items-center flex-1 min-h-0 pt-4 lg:pt-0 overflow-y-auto lg:overflow-hidden">
          {/* Left — features (below the hero on a phone). On the wide layout
              the column scrolls when the window is short, and "safe" centering
              keeps the top on screen instead of clipping it. */}
          <div className="mifoid-features flex flex-col justify-center flex-none lg:flex-1 w-full lg:h-full pl-4 pr-4 lg:pl-8 lg:pr-6 gap-4 lg:gap-5 min-w-0 pb-6 lg:py-2 lg:overflow-y-auto">
            <MifoidReserve />
            {FEATURES.map((feat, i) => (
              <div key={i} className="flex gap-3 items-start">
                <div className="mifoid-diamond flex-shrink-0 mt-0.5">
                  <Image src="/star-sparkle.webp" alt="" width={18} height={18} unoptimized />
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

          {/* Right — GameBoy+MiFOID combined image. On a phone it is the hero:
              first on screen, with the title and the renders under it. */}
          <div className="mifoid-stage order-first lg:order-none flex-none lg:flex-1 flex flex-col items-center justify-center relative w-full lg:h-full lg:mr-[40px] xl:mr-[70px] pt-2 pb-6 lg:py-0">
            {/* GameBoy + character combined image. On the wide layout its
                width follows the stage's height (46cqh keeps the 3:5 Game Boy
                at ~77% of it), capped at the old sizes. */}
            <div
              className="mifoid-gameboy-wrap relative w-[200px] md:w-[240px] lg:w-[min(280px,46cqh)] xl:w-[min(320px,46cqh)]"
            >
              {/* Radial glow behind gameboy for focal effect */}
              <div className="mifoid-focal-glow" />
              <Image
                src="/gameboy_mifoid.webp"
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
                  width: "40%",
                  zIndex: 10,
                  animationDelay: fw.delay,
                  transform: `rotate(${fw.rotate}deg)`,
                };
                if (fw.top !== undefined) pos.top = fw.top;
                if ("bottom" in fw && fw.bottom !== undefined) pos.bottom = fw.bottom;
                if (fw.left !== undefined) pos.left = fw.left;
                if ("right" in fw && fw.right !== undefined) pos.right = fw.right;

                return (
                  <div key={i} className="mifoid-paint-window hidden lg:block" style={pos} aria-hidden="true">
                    <Image
                      src={fw.src}
                      alt={fw.alt}
                      width={130}
                      height={fw.h}
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

            {/* Phone hero caption + a swipeable strip of renders (on the wide
                layout the same renders float around the Game Boy). */}
            <div className="mifoid-hero-caption lg:hidden">
              <p className="mifoid-hero-caption__title">MiFOID</p>
              <p className="mifoid-hero-caption__tagline">3,333 born, not generated</p>
            </div>
            <ul className="mifoid-renders lg:hidden" aria-label="MiFOID renders">
              {FLOAT_WINDOWS.map((fw) => (
                <li key={fw.src}>
                  <Image src={fw.src} alt={fw.alt} width={112} height={104} loading="lazy" unoptimized />
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

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
          background: linear-gradient(135deg, var(--foid-pink-bloom) 0%, #ffcce0 50%, var(--foid-pink-bloom) 100%);
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

        /* Wide layout: the stage is a size container (the Game Boy width
           reads its height in cqh); the features centre only while they fit. */
        @media (min-width: 1024px) {
          :global(.mifoid-stage) {
            container-type: size;
          }
          :global(.mifoid-features) {
            justify-content: safe center;
          }
          /* Phone-only pieces. Tailwind's lg:hidden loses to the display
             rules below (same specificity, later in the cascade). */
          :global(.mifoid-hero-caption),
          :global(.mifoid-renders) {
            display: none !important;
          }
        }

        /* Phone hero: title + tagline under the Game Boy, then the renders. */
        :global(.mifoid-hero-caption) {
          margin-top: 18px;
          text-align: center;
        }
        :global(.mifoid-hero-caption__title) {
          font-family: var(--font-display);
          font-weight: 700;
          font-size: 26px;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: rgba(255, 255, 255, 0.96);
          text-shadow: 0 0 24px rgba(200, 170, 255, 0.45);
        }
        :global(.mifoid-hero-caption__tagline) {
          margin-top: 4px;
          font-family: var(--font-terminal);
          font-size: 12px;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          color: rgba(255, 255, 255, 0.72);
        }
        :global(.mifoid-renders) {
          display: flex;
          gap: 10px;
          width: calc(100% + 48px); /* bleed through the body's 24px padding */
          margin: 18px -24px 0;
          padding: 4px 24px 8px;
          overflow-x: auto;
          scroll-snap-type: x mandatory;
          scrollbar-width: none;
          list-style: none;
        }
        :global(.mifoid-renders::-webkit-scrollbar) {
          display: none;
        }
        :global(.mifoid-renders li) {
          flex: 0 0 auto;
          scroll-snap-align: center;
        }
        :global(.mifoid-renders img) {
          display: block;
          width: 112px;
          height: 104px;
          object-fit: cover;
          border-radius: 12px;
          border: 1.5px solid rgba(168, 130, 255, 0.35);
          box-shadow: 0 8px 18px rgba(20, 10, 60, 0.3);
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
    </>
  );
}
