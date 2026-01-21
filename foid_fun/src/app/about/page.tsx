"use client";

import type { ReactNode } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import AppTitlebar from "@/app/(components)/AppTitlebar";
import { useAccount, useChainId, useConnect, useDisconnect } from "wagmi";
import { playTypingTick } from "@/lib/sfx";

type Section = {
  id: string;
  navLabel: string;
  title: string;
  subtitle?: string;
  lede?: ReactNode;
  content: ReactNode;
};

type BubbleConfig = {
  id: string;
  top: string;
  left: string;
  size: number;
  duration: string;
  delay: string;
};

function GlassPanel({ children }: { children: ReactNode }) {
  return (
    <div className="aboutPanel about-prose aboutGlassCard font-normal">
      {children}
    </div>
  );
}

function SectionHeader({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <header className="aboutHeader">
      <p className="aboutEyebrow">{eyebrow}</p>
      <h1 className="aboutTitle text-balance">{title}</h1>
      {subtitle ? <p className="aboutSubtitle">{subtitle}</p> : null}
    </header>
  );
}

const sections: Section[] = [
  {
    id: "intro",
    navLabel: "INTRODUCTION",
    title: "FOID FOUNDATION",
    subtitle: "an onchain funnel for memes and culture",
    content: (
      <>
        <GlassPanel>
          <p>
            foid foundation is a simple onchain system for preserving the best parts of the internet so they don’t vanish: rituals, memes, and identity. it works as three linked apps. each layer captures something different, and together they turn “online vibes” into permanent lore.
          </p>
        </GlassPanel>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="aboutMiniCard aboutGlassCard">
            <p className="aboutMiniCard__title">foid mommy</p>
            <p className="aboutMiniCard__body">
              pray with mommy.
            </p>
          </div>

          <div className="aboutMiniCard aboutGlassCard">
            <p className="aboutMiniCard__title">loreboard</p>
            <p className="aboutMiniCard__body">
              memetic vision board.
            </p>
          </div>

          <div className="aboutMiniCard aboutGlassCard">
            <p className="aboutMiniCard__title">mifoids</p>
            <p className="aboutMiniCard__body">
              your own personal foid.
            </p>
          </div>
        </div>
      </>
    ),
  },
  {
    id: "mommy",
    navLabel: "FOID_MOMMY_TERMINAL.EXE",
    title: "FOID MOMMY",
    subtitle: "daily ritual terminal • private check-in • hashed proof onchain",
    content: (
      <>
        <GlassPanel>
          <p>
            foid mommy terminal is a daily ritual terminal where you connect your wallet, whisper how you’re feeling, and get an oracle response from mommy. only a keccak256 hash is written onchain, plus the receipt: wallet, timestamp, streak, totals. your raw words never hit the chain. it’s a small pause for honest reflection, a soft loop that helps you show up daily.
          </p>
        </GlassPanel>
      </>
    ),
  },
  {
    id: "loreboard",
    navLabel: "LOREBOARD.APP",
    title: "LOREBOARD.APP",
    subtitle: "infinite image board • proposals, voting, canon • ipfs-backed manifests",
    content: (
      <>
        <div className="grid gap-6">
          <GlassPanel>
            <p>
              loreboard is a shared digital image board that expands infinitely over time. it’s a living canvas where anyone can propose images and place them on the grid.the community votes each epoch, and winners are canonized into a permanent manifest that is anchored onchain and backed by ipfs. it’s the canonical provenance layer for crypto memes, our “know your meme” equivalent. scroll epochs to watch culture evolve in public. it&apos;s not just a museum, it&apos;s collective world building.
            </p>
          </GlassPanel>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="aboutMiniCard aboutGlassCard">
              <p className="aboutMiniCard__title">propose</p>
              <p className="aboutMiniCard__body">propose a placement</p>
            </div>
            <div className="aboutMiniCard aboutGlassCard">
              <p className="aboutMiniCard__title">vote</p>
              <p className="aboutMiniCard__body">vote on proposals</p>
            </div>
            <div className="aboutMiniCard aboutGlassCard">
              <p className="aboutMiniCard__title">cannonize</p>
              <p className="aboutMiniCard__body">winners are cannonized</p>
            </div>
          </div>
        </div>
      </>
    ),
  },
  {
    id: "mifoids",
    navLabel: "MIFOIDS",
    title: "MIFOIDS",
    subtitle: "your virtual companion nft that evolves with devotion",
    content: (
      <>
        <GlassPanel>
          <p>
            mifoid is your own virtual foid, a companion nft in the foid universe. it tracks your prayers and loreboard activity, and evolves over time based on your streaks, proposals, votes, and participation. it’s a personal avatar that grows with you, like a digital soulmate with receipts. body count (nft transfer count) unlocks gated chat rooms. virgin chats (zero transfers) are the most exclusive. onchain history becomes a trust signal, showing consistency, provenance, and skin in the game.
          </p>
        </GlassPanel>
      </>
    ),
  },
  {
    id: "more",
    navLabel: "MORE",
    title: "MORE",
    content: (
      <>
        <div className="aboutMoreGrid">
          <section className="aboutMoreRoadmap">
            <SectionHeader eyebrow="ROADMAP" title="ROADMAP" />
            <div className="aboutRoadmapGrid grid gap-4 md:grid-cols-3 w-full">
              <button type="button" className="aboutMiniCard aboutGlassCard aboutRoadmapCard">
                <p className="aboutMiniCard__title">now (alpha)</p>
                <p className="aboutMiniCard__body">prayer terminal live on testnet.</p>
              </button>

              <button type="button" className="aboutMiniCard aboutGlassCard aboutRoadmapCard">
                <p className="aboutMiniCard__title">next (beta)</p>
                <p className="aboutMiniCard__body">
                  beta launch of foid foundation
                </p>
              </button>

              <button type="button" className="aboutMiniCard aboutGlassCard aboutRoadmapCard">
                <p className="aboutMiniCard__title">after (mainnet v1)</p>
                <p className="aboutMiniCard__body">fluent mainnet launch.</p>
              </button>
            </div>
          </section>

          <div className="aboutMoreCards">
            <div className="aboutMoreCard aboutGlassCard">
              <p className="aboutCardEyebrow">WHY THIS MATTERS</p>
              <p className="aboutCardBody">
                memes move culture, but timelines erase them. the best posts get buried, deleted, or detached from their origin. foid turns those moments into shared history: permanent, provable, collectively owned. a living museum for the corners of the internet that usually vanish.
              </p>
            </div>

            <div className="aboutMoreCard aboutGlassCard">
              <p className="aboutCardEyebrow">WHY FLUENT</p>
              <p className="aboutCardBody">
                fluent’s blended execution lets foid run the heavy parts in rust wasm, then settle cleanly in solidity. deterministic compute for winner selection, bid sorting, and overlap resolution without bloated evm loops. faster iteration, predictable outputs, and one chain for proposals, voting, canon anchoring, and future futarchy extensions.
              </p>
            </div>
          </div>
        </div>
      </>
    ),
  },
];

const bubbleConfigs: BubbleConfig[] = [
  { id: "aurora-1", top: "6%", left: "10%", size: 220, duration: "32s", delay: "-4s" },
  { id: "aurora-2", top: "18%", left: "72%", size: 160, duration: "28s", delay: "-9s" },
  { id: "aurora-3", top: "48%", left: "8%", size: 260, duration: "34s", delay: "-3s" },
  { id: "aurora-4", top: "62%", left: "70%", size: 180, duration: "30s", delay: "-7s" },
  { id: "aurora-5", top: "36%", left: "46%", size: 240, duration: "33s", delay: "-11s" },
  { id: "aurora-6", top: "82%", left: "32%", size: 150, duration: "26s", delay: "-2s" },
];

const legacySectionHashes: Record<string, string> = {
  "#why-this-matters": "more",
  "#why-fluent": "more",
  "#roadmap": "more",
};

const resolveSectionFromHash = (hash: string) => {
  const normalized = hash.trim().toLowerCase();
  if (!normalized) return null;
  if (legacySectionHashes[normalized]) {
    return legacySectionHashes[normalized];
  }
  const sectionId = normalized.startsWith("#") ? normalized.slice(1) : normalized;
  return sections.some((section) => section.id === sectionId) ? sectionId : null;
};

export default function AboutPage() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();
  const [walletDropdownOpen, setWalletDropdownOpen] = useState(false);
  const initialSection = sections[0].id;
  const [activeSection, setActiveSection] = useState(initialSection);
  const [selectedSection, setSelectedSection] = useState(initialSection);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const [extraBubbles, setExtraBubbles] = useState<BubbleConfig[]>([]);
  const extraBubbleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (extraBubbleTimer.current) {
        clearTimeout(extraBubbleTimer.current);
      }
    };
  }, []);

  useEffect(() => {
    if (contentRef.current) {
      contentRef.current.scrollTo({ top: 0 });
    }
  }, [activeSection]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const applyHash = () => {
      const resolved = resolveSectionFromHash(window.location.hash);
      if (!resolved) return;
      setSelectedSection(resolved);
      setActiveSection(resolved);
      if (window.location.hash !== `#${resolved}`) {
        window.history.replaceState(null, "", `#${resolved}`);
      }
    };
    applyHash();
    window.addEventListener("hashchange", applyHash);
    return () => window.removeEventListener("hashchange", applyHash);
  }, []);

  const spawnExtraBubbles = useCallback(() => {
    const generated = Array.from({ length: 2 }, (_, index) => ({
      id: `extra-${Date.now()}-${index}`,
      top: `${10 + Math.random() * 70}%`,
      left: `${5 + Math.random() * 80}%`,
      size: 100 + Math.random() * 140,
      duration: `${18 + Math.random() * 8}s`,
      delay: `${-Math.random() * 5}s`,
    }));
    setExtraBubbles(generated);
    if (extraBubbleTimer.current) {
      clearTimeout(extraBubbleTimer.current);
    }
    extraBubbleTimer.current = setTimeout(() => {
      setExtraBubbles([]);
      extraBubbleTimer.current = null;
    }, 4200);
  }, []);

  const handleSectionClick = useCallback(
    (sectionId: string) => {
      if (selectedSection === sectionId) return;
      setSelectedSection(sectionId);
      setActiveSection(sectionId);
      if (typeof window !== "undefined") {
        window.history.replaceState(null, "", `#${sectionId}`);
      }
      void playTypingTick();
      spawnExtraBubbles();
    },
    [selectedSection, spawnExtraBubbles],
  );

  const activeSectionData = sections.find((section) => section.id === activeSection) ?? sections[0];

  const handleSwitchWallet = useCallback(() => {
    disconnect();
    setTimeout(() => {
      const preferred = connectors.find((connector) => connector.ready) ?? connectors[0];
      if (preferred) {
        connect({ connector: preferred });
      }
    }, 120);
  }, [connect, connectors, disconnect]);

  return (
    <main className="about-page relative min-h-screen w-full flex items-center justify-center overflow-hidden">
      <div className="absolute inset-0 pointer-events-none z-0" aria-hidden>
        {bubbleConfigs.map((bubble) => (
          <span
            key={bubble.id}
            className="about-page__bubble"
            style={{
              top: bubble.top,
              left: bubble.left,
              width: bubble.size,
              height: bubble.size,
              animationDuration: bubble.duration,
              animationDelay: bubble.delay,
            }}
          />
        ))}
        {extraBubbles.map((bubble) => (
          <span
            key={bubble.id}
            className="about-page__bubble about-page__bubble--extra"
            style={{
              top: bubble.top,
              left: bubble.left,
              width: bubble.size,
              height: bubble.size,
              animationDuration: bubble.duration,
              animationDelay: bubble.delay,
            }}
          />
        ))}
      </div>

      <section className="relative z-10 w-full">
        <div className="mx-auto w-full max-w-[min(94vw,1240px)]">
          <div className="vista-window vista-window--terminal vista-window--enhanced h-[min(68vh,600px)] w-full">
            <AppTitlebar
              title="FOID_ABOUT.EXE"
              chainId={chainId}
              connected={isConnected}
              address={address}
              isWalletDropdownOpen={walletDropdownOpen}
              onToggleWallet={() => setWalletDropdownOpen((prev) => !prev)}
              onDisconnect={() => disconnect()}
              onSwitchWallet={handleSwitchWallet}
            />
            <div className="vista-window__body aboutWindowBody flex flex-col md:flex-row">
              <aside className="aboutSidebar aboutGlassShell flex-shrink-0">
                <p className="text-[10px] uppercase tracking-[0.55em] text-white/55">navigation</p>
                <nav aria-label="about sections" className="aboutNav mt-3 flex w-full flex-col">
                  {sections.map((section) => {
                    const isActive = selectedSection === section.id;
                    const baseClasses = [
                      "aboutNavButton group relative flex w-full items-center border transition-all duration-200",
                      "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-cyan-300",
                      "whitespace-normal break-words text-left",
                    ];
                    const stateClasses = isActive ? "aboutNavButton--active text-white" : "text-white/70";
                    return (
                      <button
                        key={section.id}
                        type="button"
                        aria-current={isActive ? "page" : undefined}
                        onClick={() => handleSectionClick(section.id)}
                        className={[...baseClasses, stateClasses].join(" ")}
                      >
                        <span className="leading-tight">{section.navLabel}</span>
                      </button>
                    );
                  })}
                </nav>
              </aside>

              <div className="flex flex-1 min-w-0">
                <div className="aboutPane aboutGlassShell relative flex h-full w-full min-h-0 flex-1 flex-col overflow-hidden">
                  <div
                    ref={contentRef}
                    aria-live="polite"
                    className="aboutContentScroll flex h-full min-h-0 flex-1 overflow-x-hidden overflow-y-auto transition-opacity duration-300 ease-out"
                  >
                    <div className="aboutContentShell">
                      <div className="aboutStack">
                        {activeSectionData.id !== "more" ? (
                          <div className="aboutHeader">
                            <p className="aboutEyebrow">{activeSectionData.navLabel}</p>
                            <h1 id={`${activeSectionData.id}-title`} className="aboutTitle">
                              {activeSectionData.title}
                            </h1>
                            {activeSectionData.subtitle ? (
                              <p className="aboutSubtitle">{activeSectionData.subtitle}</p>
                            ) : null}
                          </div>
                        ) : null}
                        {activeSectionData.lede && <p className="aboutSub foid-small">{activeSectionData.lede}</p>}
                        <div className="aboutBody about-prose foid-body">{activeSectionData.content}</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <style jsx global>{`
        /* ===== one shared glass shell (left + right match exactly) ===== */
        .aboutGlassShell {
          border-radius: 16px;
          border: 1px solid rgba(255, 255, 255, 0.12);
          background: linear-gradient(180deg, rgba(255,255,255,0.05), rgba(0,0,0,0.14));
          box-shadow:
            inset 0 0 0 1px rgba(255, 255, 255, 0.06),
            0 10px 24px rgba(0, 0, 0, 0.24);
          backdrop-filter: blur(26px);
          -webkit-backdrop-filter: blur(26px);
        }

        /* kill the "special" right-pane overlays so it matches the sidebar */
        .aboutPane::before,
        .aboutPane::after {
          content: none !important;
        }

        /* ===== unify glass system (make right cards match left sidebar) ===== */
        .aboutGlassCard {
          position: relative;
          overflow: hidden;
          border-radius: 16px;
          border: 1px solid rgba(255, 255, 255, 0.12);
          background: linear-gradient(
            180deg,
            rgba(255, 255, 255, 0.06),
            rgba(0, 0, 0, 0.16)
          );
          box-shadow:
            inset 0 0 0 1px rgba(255, 255, 255, 0.06),
            0 10px 24px rgba(0, 0, 0, 0.24);
          backdrop-filter: blur(26px);
          -webkit-backdrop-filter: blur(26px);
        }

        .aboutGlassCard > * {
          position: relative;
          z-index: 1;
        }

        /* ===== macOS / web3 typography ===== */
        .about-page {
          font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "SF Pro Text",
            "SF Pro Display", "Helvetica Neue", Arial, "Apple Color Emoji", "Segoe UI Emoji";
          letter-spacing: 0.01em;
          padding: var(--about-pad);
          --about-body-size: 12.8px;
          --about-body-leading: 1.65;
        }

        .aboutWindowBody {
          gap: 18px;
          padding: var(--about-pad);
        }

        .aboutHeader {
          display: grid;
          gap: 6px;
          padding-bottom: 2px;
        }

        .aboutEyebrow {
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 0.32em;
          color: rgba(255, 255, 255, 0.45);
        }

        .aboutTitle {
          font-weight: 560;
          font-size: var(--about-h1);
          line-height: 1.06;
          letter-spacing: 0.07em;
          text-transform: uppercase;
          text-wrap: balance;
          color: rgba(255, 255, 255, 0.94);
          /* web3 macOS: subtle gradient ink */
          background-image: linear-gradient(
            180deg,
            rgba(255,255,255,0.96),
            rgba(210,245,255,0.92) 45%,
            rgba(140,240,255,0.78)
          );
          -webkit-background-clip: text;
          background-clip: text;
          -webkit-text-fill-color: transparent;
          text-shadow: 0 10px 30px rgba(0,0,0,0.28);
        }

        .aboutSubtitle {
          font-size: 13px;
          line-height: 1.58;
          color: rgba(255, 255, 255, 0.66);
          max-width: 70ch;
        }

        /* ===== premium glass pane (inner highlight + aurora) ===== */
        .aboutPane::before {
          content: "";
          position: absolute;
          inset: 0;
          pointer-events: none;
          background:
            linear-gradient(180deg, rgba(255,255,255,0.10), rgba(255,255,255,0.04) 35%, rgba(0,0,0,0.18) 100%);
          opacity: 1;
        }
        .aboutPane::after {
          content: "";
          position: absolute;
          inset: -40px;
          pointer-events: none;
          background:
            radial-gradient(60% 45% at 15% 10%, rgba(0,255,213,0.22), transparent 60%),
            radial-gradient(55% 40% at 85% 20%, rgba(80,170,255,0.18), transparent 62%),
            radial-gradient(55% 50% at 60% 95%, rgba(0,255,213,0.12), transparent 65%);
          mix-blend-mode: screen;
          opacity: 0.4;
          filter: blur(2px);
        }

        /* subtle top hairline like macOS sheets */
        .aboutPane > div:first-child {
          position: relative;
          z-index: 1;
        }
        .aboutPane::marker {
          display: none;
        }

        /* ===== panels/callouts slightly tighter + cleaner ===== */
        .aboutCallout__title {
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.24em;
          color: rgba(255, 255, 255, 0.7);
        }

        .aboutPanel p,
        .aboutPanel li,
        .aboutCallout__body p,
        .aboutCallout__body li {
          font-size: var(--about-body-size);
          line-height: var(--about-body-leading);
        }

        .aboutMiniCard__title {
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.2em;
          color: rgba(255, 255, 255, 0.74);
          margin-bottom: 6px;
        }
        .aboutMiniCard__body {
          font-size: var(--about-body-size);
          line-height: var(--about-body-leading);
          color: rgba(255, 255, 255, 0.7);
        }

        /* ===== sidebar polish ===== */
        .aboutSidebar {
          width: var(--about-sidebar-w);
          max-width: 100%;
          padding: 14px;
        }

        /* ===== why fluent layout (less "one big connected slab") ===== */
        .aboutFeatureGrid {
          display: grid;
          gap: 12px;
        }
        @media (min-width: 768px) {
          .aboutFeatureGrid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }
        .aboutFeatureCard {
          padding: 14px 16px;
        }
        .aboutFeatureCard__title {
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.2em;
          color: rgba(255, 255, 255, 0.74);
          margin-bottom: 6px;
        }
        .aboutFeatureCard__body {
          font-size: var(--about-body-size);
          line-height: var(--about-body-leading);
          color: rgba(255, 255, 255, 0.7);
        }

        .aboutNav {
          gap: 10px;
        }

        .aboutNavButton {
          height: var(--about-nav-h);
          padding: 0 14px;
          border-radius: 12px;
          font-size: 11px;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          background: rgba(255, 255, 255, 0.04);
          border-color: rgba(255, 255, 255, 0.1);
          transform: translateY(0);
        }

        .aboutNavButton::before {
          content: "";
          position: absolute;
          left: 10px;
          top: 50%;
          width: 2px;
          height: 60%;
          border-radius: 999px;
          transform: translateY(-50%);
          background: rgba(150, 220, 255, 0.0);
          transition: background 200ms ease;
        }

        .aboutNavButton:hover {
          background: rgba(255, 255, 255, 0.08);
          border-color: rgba(255, 255, 255, 0.2);
          transform: translateY(-1px);
          color: rgba(255, 255, 255, 0.92);
        }

        .aboutNavButton--active {
          background: rgba(255, 255, 255, 0.11);
          border-color: rgba(255, 255, 255, 0.24);
          box-shadow: 0 10px 24px rgba(0, 0, 0, 0.22);
        }

        .aboutNavButton--active::before {
          background: rgba(120, 220, 255, 0.9);
        }

        .aboutContentScroll {
          padding: 18px 22px 26px;
          scrollbar-gutter: stable;
          scrollbar-width: thin;
          scrollbar-color: rgba(255, 255, 255, 0.22) transparent;
        }

        .aboutContentScroll::-webkit-scrollbar {
          width: 8px;
        }

        .aboutContentScroll::-webkit-scrollbar-thumb {
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.2);
          border: 2px solid transparent;
          background-clip: padding-box;
        }

        .aboutContentScroll::-webkit-scrollbar-track {
          background: transparent;
        }

        .aboutContentShell {
          width: 100%;
          max-width: 920px;
          margin: 0;
        }

        .aboutStack {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .aboutRoadmapGrid {
          margin-bottom: 20px;
        }

        .aboutRoadmapNote {
          font-size: 13px;
          line-height: 1.6;
          color: rgba(255, 255, 255, 0.7);
          margin-top: 2px;
        }

        .aboutTierList {
          margin: 6px 0 10px;
          padding: 0;
          list-style: none;
          display: grid;
          gap: 0;
        }

        .aboutTierList li {
          padding: 7px 0;
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
          font-size: 12.5px;
          line-height: 1.55;
          color: rgba(255, 255, 255, 0.7);
        }

        .aboutTierList li:last-child {
          border-bottom: 0;
        }

        .aboutFooterNote {
          font-size: 12.5px;
          line-height: 1.55;
          color: rgba(255, 255, 255, 0.6);
        }

        .aboutMoreGrid {
          display: grid;
          gap: 18px;
        }

        .aboutMoreRoadmap {
          display: grid;
          gap: 12px;
        }

        .aboutRoadmapCard {
          display: grid;
          gap: 6px;
          width: 100%;
          padding: 14px 16px;
          text-align: left;
          cursor: pointer;
          font: inherit;
          color: inherit;
          transition: transform 180ms ease, border-color 180ms ease, box-shadow 180ms ease;
        }

        .aboutRoadmapCard:hover {
          transform: translateY(-2px);
          border-color: rgba(120, 220, 255, 0.38);
          box-shadow:
            0 16px 28px rgba(0, 0, 0, 0.28),
            0 0 18px rgba(80, 210, 255, 0.18);
        }

        .aboutRoadmapCard:focus-visible {
          outline: 2px solid rgba(120, 220, 255, 0.75);
          outline-offset: 3px;
        }

        .aboutMoreCards {
          display: grid;
          gap: 14px;
        }

        .aboutMoreCard {
          display: grid;
          gap: 10px;
          padding: 16px;
        }

        .aboutCardEyebrow {
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 0.28em;
          color: rgba(255, 255, 255, 0.5);
        }

        .aboutCardTitle {
          font-size: 16px;
          font-weight: 560;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          color: rgba(255, 255, 255, 0.92);
        }

        .aboutCardBody {
          font-size: var(--about-body-size);
          line-height: var(--about-body-leading);
          color: rgba(255, 255, 255, 0.72);
        }

        @media (min-width: 980px) {
          .aboutMoreCards {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 768px) {
          .aboutWindowBody {
            gap: 14px;
          }

          .aboutContentScroll {
            padding: 16px 16px 22px;
          }

          .aboutContentShell {
            max-width: 100%;
          }

          .aboutNavButton {
            font-size: 12px;
            letter-spacing: 0.08em;
          }
        }

        .about-page__bubble {
          position: absolute;
          border-radius: 50%;
          pointer-events: none;
          background: radial-gradient(circle, rgba(0, 255, 213, 0.22), rgba(0, 128, 255, 0.03) 70%, transparent 100%);
          opacity: 0.22;
          filter: blur(0px);
          animation-name: float;
          animation-timing-function: ease-in-out;
          animation-iteration-count: infinite;
        }

        .about-page__bubble--extra {
          opacity: 0.45;
          mix-blend-mode: screen;
        }

        @keyframes float {
          0% {
            transform: translate3d(0, 0, 0) scale(1);
            opacity: 0.18;
          }
          50% {
            transform: translate3d(10px, -40px, 0) scale(1.05);
            opacity: 0.32;
          }
          100% {
            transform: translate3d(-15px, -90px, 0) scale(1);
            opacity: 0.16;
          }
        }
      `}</style>
    </main>
  );
}
