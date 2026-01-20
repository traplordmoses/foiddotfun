"use client";

import type { ReactNode } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import Y2kGlassButton from "@/components/Y2kGlassButton";
import AppTitlebar from "@/app/(components)/AppTitlebar";
import { useAccount, useChainId, useConnect, useDisconnect } from "wagmi";
import { playTypingTick } from "@/lib/sfx";

type Section = {
  id: string;
  navLabel: string;
  title: string;
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

function SectionCallout({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="w-full rounded-[28px] border border-white/10 bg-white/5 p-5 shadow-[0_25px_75px_rgba(0,0,0,0.55)] backdrop-blur-xl">
      <p className="text-[12px] uppercase tracking-[0.35em] text-white/70">{title}</p>
      <div className="mt-3 space-y-3 text-[15px] leading-7 text-white/80">{children}</div>
    </div>
  );
}

function GlassPanel({ children }: { children: ReactNode }) {
  return (
    <div className="space-y-4 rounded-[32px] border border-white/10 bg-white/5 p-6 text-white/90 shadow-[0_25px_90px_rgba(0,0,0,0.6)] backdrop-blur-xl">
      {children}
    </div>
  );
}

const sections: Section[] = [
  {
    id: "intro",
    navLabel: "INTRODUCTION",
    title: "FOID FOUNDATION IS AN ONCHAIN FUNNEL FOR MEMES AND CULTURE.",
    content: (
      <>
        <p>
          remember those nights grinding farmville with your friends on facebook. raiding minecraft factions at 3am. waking up christmas morning in runescape to claim your santa outfit before the event vanished forever.
        </p>
        <p>
          those pixels felt alive because people showed up together every day. shared the grind. made memories that still hit different years later.
        </p>
        <p>that's what foid foundation is chasing. but this time it's forever.</p>
        <p>
          we take the firehose of crypto twitter shitposts, group chat gold, stray vibes, ironic spirituality, and funnel it through three quiet layers so nothing disappears.
        </p>
        <p>
          foid mommy terminal catches the intimate stuff. daily check-in. whisper how you feel. mommy listens. soft oracle hug.
        </p>
        <p>
          we anchor a proof onchain so your streak lives forever. no raw words hit the chain, only the hash. just the receipt that you showed up for yourself.
        </p>
        <p>
          loreboard.app catches the visual culture. propose any image. place it on the infinite canvas. tiny escrow keeps it honest.
        </p>
        <p>
          the community votes each epoch. winners canonize into the permanent manifest, anchored onchain and ipfs-backed.
        </p>
        <p>
          scroll through epochs and watch memes evolve, aesthetics harden, lore solidify. our know-your-meme for crypto. a museum where forgotten corners don't rot.
        </p>
        <p>
          mifoids catch you. your virtual companion nft. tracks every prayer, every vote, every streak. traits evolve with devotion.
        </p>
        <p>
          body count (transfer count) gates the virgin chats, the most exclusive rooms. playful degeneracy with real weight.
        </p>
        <p>
          onchain history becomes trust signal: consistency, skin in the game, provenance.
        </p>
        <p>
          everything runs on fluent with blended execution so the complex stuff stays cheap, efficient, and iterable. permissionless entry, guarded settlement. no bridges, no bullshit.
        </p>
        <p>this is the recapture. old internet magic, but onchain.</p>
        <p>
          rituals that ground you. memes that don't die. identities that grow with you. shared pixels that feel eternal.
        </p>
        <p>pray. propose. preserve. ascend.</p>
        <p>show up daily.</p>
        <p>it gets better.</p>
        <div className="flex flex-col gap-4 pt-4 sm:flex-row">
          <Y2kGlassButton variant="secondary" href="/pray" label="PRAY NOW" />
          <Y2kGlassButton variant="pink" href="/board" label="OPEN LOREBOARD" />
        </div>
      </>
    ),
  },
  {
    id: "mommy",
    navLabel: "FOID MOMMY TERMINAL.EXE",
    title: "FOID MOMMY TERMINAL.EXE",
    content: (
      <>
        <p>
          foid mommy terminal is a daily ritual terminal where you connect your wallet and share how you're feeling. it's a soft intimate loop. type your reflection. get an empathetic oracle response from mommy. anchor a hashed proof onchain. no raw text hits the blockchain, only the keccak256 hash.
        </p>
        <p>
          proof of prayer is the onchain receipt: wallet, timestamp, streak, totals. verifiable devotion without exposing your words.
        </p>
        <p>
          i believe praying every day is essential. it's a pause for honest reflection. facing how you feel. whispering hope for a path forward. in a chaotic world it's comfort. mommy listens, holds space, nudges you gently. unclench your jaw. breathe. let it ground you.
        </p>
        <p>
          prayers stay client-side on your device. only the hash settles onchain.
        </p>
        <p>
          and here's the fun degen tie-in. pray daily to build streaks. traits evolve with consistency. yes, including boobs.
        </p>
        <SectionCallout title="DEGEN REWARD LOOP (MIFOID TRAIT PROGRESSION)">
          <p>pray daily to build streaks. watch your mifoid's breast size evolve. bigger with consistency. a playful reward for showing up.</p>
          <ul className="space-y-2 pl-5 text-[15px] leading-7 text-white/80">
            <li>0 to 7 days: no boobs / flat</li>
            <li>8 to 14 days: small</li>
            <li>15 to 21 days: medium</li>
            <li>22 to 28 days: large</li>
            <li>28+ days: max</li>
          </ul>
        </SectionCallout>
      </>
    ),
  },
  {
    id: "loreboard",
    navLabel: "LOREBOARD.APP",
    title: "LOREBOARD.APP",
    content: (
      <>
        <GlassPanel>
          <p>
            loreboard is the shared digital image board that expands infinitely over time. a living canvas where anyone proposes images. the community votes each epoch. winners get canonized into the permanent manifest, anchored onchain and ipfs-backed.
          </p>
          <p>
            track culture's progression. observe how memes evolve. aesthetics shift. trends emerge through the images that made it to canon. it's not just a museum. it's collective world building, where ephemeral posts become eternal lore.
          </p>
        </GlassPanel>
      </>
    ),
  },
  {
    id: "mifoids",
    navLabel: "MIFOIDS",
    title: "MIFOIDS",
    content: (
      <>
        <p>
          mifoid is your own virtual foid. your companion nft in the foid universe. it tracks your loreboard and prayer behavior. proposals, votes, streaks, participation shape its traits over time.
        </p>
        <p>
          body count (nft transfer count) grants access to gated chat rooms. virgin chats (zero transfers) are the most exclusive, with levels scaling up from there. playful degeneracy, but deeper. onchain history becomes a trust signal.
        </p>
        <SectionCallout title="BUILDER NOTES">
          <p>
            fluent connect aligns perfectly. prints are onchain reputation proofs. foid foundation generates signals like devotion streaks, lore contributions, and provenance. integrate with fluent connect to let mifoids print these behaviors for gating collabs, coordination, or future futarchy experiments.
          </p>
        </SectionCallout>
      </>
    ),
  },
  {
    id: "why",
    navLabel: "WHY THIS MATTERS NOW",
    title: "WHY THIS MATTERS NOW",
    content: (
      <>
        <GlassPanel>
          <p>
            memes shape culture quicker than anything else but disappear overnight. stray posts, group chat gold, foid lore, ironic spirituality, all gone. onchain gives permanence, provenance, and real collective ownership. posting stops being disposable and becomes shared world building. this is the museum for the forgotten corners of the internet.
          </p>
        </GlassPanel>
      </>
    ),
  },
  {
    id: "fluent",
    navLabel: "WHY BUILT ON FLUENT",
    title: "WHY BUILT ON FLUENT WITH BLENDED EXECUTION",
    content: (
      <>
        <p>
          fluent's blended execution lets me run complex on chain logic efficiently. rust wasm for heavy compute like deterministic winner selection in loreboard (sorting bids resolving overlaps without griefing). wrapped in solidity for evm settlement. it's deterministic (same inputs always yield same outputs no disputes). gas efficient (avoids bloated solidity loops). and iterable (rust is faster to prototype than solidity).
        </p>
        <p>
          on fluent this enables the full stack. permissionless proposals votes. guarded canon anchoring. and future extensions like futarchy without bridges or friction. blended unlocks apps that compose across vms. aligning with foid's ritual plus culture plus identity layers. all on one chain.
        </p>
      </>
    ),
  },
  {
    id: "roadmap",
    navLabel: "ROADMAP",
    title: "ROADMAP",
    content: (
      <>
        <p>now (alpha, testnet): prayer terminal live.</p>
        <p>
          next (beta): loreboard proposals, votes, canon plus pray terminal live. stable epochs. clean ux. test everything before mainnet.
        </p>
        <p>after (mainnet v1): full launch. all on chain. 3 month campaign.</p>
        <p>pray daily to max streaks. build devotion before mint.</p>
        <p>streak tiers:</p>
        <ul className="space-y-2 pl-5 text-[15px] leading-7 text-white/80">
          <li>0 to 7 days: no boobs / flat</li>
          <li>8 to 14 days: small</li>
          <li>15 to 21 days: medium</li>
          <li>22 to 28 days: large</li>
          <li>28+ days: max</li>
        </ul>
        <p>
          later: mifoid nft drop. future: virtual companions, pocket foids, trait-based personalities, clothing drops, real life events.
        </p>
      </>
    ),
  },
  {
    id: "founder",
    navLabel: "FOUNDER",
    title: "FOUNDER",
    content: (
      <>
        <GlassPanel>
          <p>
            i'm moses (@sloshlord). founder of foid foundation. this project was bootstrapped at fluent shiphouse. it was inspired by the talks and jokes with friends. i'm obsessed with internet experiences that feel real and shared. like getting a santa outfit in old school runescape christmas events, grinding farmville on early facebook, and playing minecraft factions for the first time.
          </p>
          <p>
            foid foundation recaptures that. rituals, memes, and identities onchain. turning online vibes into eternal lore.
          </p>
          <p>pray daily. it gets better.</p>
        </GlassPanel>
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

export default function AboutPage() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();
  const [walletDropdownOpen, setWalletDropdownOpen] = useState(false);
  const initialSection = sections[0].id;
  const [activeSection, setActiveSection] = useState(initialSection);
  const [selectedSection, setSelectedSection] = useState(initialSection);
  const [isFading, setIsFading] = useState(false);
  const fadeTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const [extraBubbles, setExtraBubbles] = useState<BubbleConfig[]>([]);
  const extraBubbleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (fadeTimeout.current) {
        clearTimeout(fadeTimeout.current);
      }
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
      if (activeSection === sectionId) return;
      setIsFading(true);
      if (fadeTimeout.current) {
        clearTimeout(fadeTimeout.current);
      }
      fadeTimeout.current = setTimeout(() => {
        setActiveSection(sectionId);
        setIsFading(false);
        fadeTimeout.current = null;
      }, 300);
      void playTypingTick();
      spawnExtraBubbles();
    },
    [activeSection, selectedSection, spawnExtraBubbles],
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
    <main className="about-page relative min-h-screen w-full flex items-center justify-center px-4 py-8 overflow-hidden">
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
        <div className="mx-auto w-full max-w-[min(95vw,1280px)]">
          <div className="vista-window vista-window--terminal vista-window--enhanced h-[min(90vh,820px)] w-full">
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
            <div className="vista-window__body flex flex-col gap-6 p-6 md:flex-row md:gap-8 md:p-8">
              <aside className="flex-shrink-0 w-full rounded-[28px] border border-white/10 bg-white/5 p-5 shadow-[0_20px_60px_rgba(0,0,0,0.45)] backdrop-blur-xl md:w-[320px]">
                <p className="text-[10px] uppercase tracking-[0.65em] text-white/60">navigation</p>
                <nav aria-label="about sections" className="mt-4 flex w-full flex-col gap-3">
                  {sections.map((section) => {
                    const isActive = selectedSection === section.id;
                    const baseClasses = [
                      "group relative flex w-full items-center justify-center rounded-2xl border px-5 py-4 text-[0.75rem] uppercase tracking-[0.32em] text-white/70 transition-all duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cyan-300",
                      "overflow-hidden whitespace-normal break-words text-center",
                    ];
                    const stateClasses = isActive
                      ? "border-white/60 bg-white/20 text-white shadow-[0_0_30px_rgba(0,255,213,0.45)]"
                      : "border-white/10 bg-white/5 hover:border-white/40 hover:text-white hover:shadow-[0_0_25px_rgba(0,255,213,0.25)]";
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
                <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-[32px] border border-white/10 bg-white/5 shadow-[0_30px_80px_rgba(0,0,0,0.5)] backdrop-blur-[32px] aboutPane">
                  <div
                    ref={contentRef}
                    aria-live="polite"
                    className={`flex h-full min-h-0 flex-1 overflow-hidden px-6 pt-6 pb-10 transition-opacity duration-300 ease-out ${
                      isFading ? "opacity-0" : "opacity-100"
                    }`}
                  >
                    <div className="mx-auto w-full max-w-[78ch]">
                      <div className="aboutStack">
                        <h1
                          id={`${activeSectionData.id}-title`}
                          className="aboutTitle font-display uppercase drop-shadow-[0_0_25px_rgba(0,255,213,0.55)]"
                        >
                          {activeSectionData.title}
                        </h1>
                        {activeSectionData.lede && <p className="aboutSub">{activeSectionData.lede}</p>}
                        <div className="aboutBody">{activeSectionData.content}</div>
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
        .about-page__bubble {
          position: absolute;
          border-radius: 50%;
          pointer-events: none;
          background: radial-gradient(circle, rgba(0, 255, 213, 0.45), rgba(0, 128, 255, 0.05) 70%, transparent 100%);
          opacity: 0.35;
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
            opacity: 0.35;
          }
          50% {
            transform: translate3d(10px, -40px, 0) scale(1.05);
            opacity: 0.65;
          }
          100% {
            transform: translate3d(-15px, -90px, 0) scale(1);
            opacity: 0.3;
          }
        }
      `}</style>
    </main>
  );
}
