 "use client";

import { useCallback, useState } from "react";
import AppTitlebar from "@/app/(components)/AppTitlebar";
import Y2kGlassButton from "@/components/Y2kGlassButton";
import { useAccount, useChainId, useConnect, useDisconnect } from "wagmi";

const bubbleConfigs = [
  { top: "6%", left: "10%", size: 220, duration: "32s", delay: "-4s" },
  { top: "18%", left: "72%", size: 160, duration: "28s", delay: "-9s" },
  { top: "48%", left: "8%", size: 260, duration: "34s", delay: "-3s" },
  { top: "62%", left: "70%", size: 180, duration: "30s", delay: "-7s" },
  { top: "36%", left: "46%", size: 240, duration: "33s", delay: "-11s" },
  { top: "82%", left: "32%", size: 150, duration: "26s", delay: "-2s" },
];

const profileCTAs = [
  { label: "OPEN LOREBOARD", href: "/board", variant: "pink" as const },
  { label: "OPEN PRAY TERMINAL", href: "/pray", variant: "secondary" as const },
];

type InfoCard = {
  title: string;
  body: string;
  highlights?: string[];
};

const row1Cards: InfoCard[] = [
  {
    title: "Loreboard",
    body: "The infinite manifest of proposals, intents, and meme museum drops. Every piece stakes placement, story, and a micro escrow before entering the epoch vote.",
    highlights: [
      "Intent definitions keep spam out and ritual sincerity in.",
      "51%+ approval seals each submission into the canon.",
    ],
  },
  {
    title: "Foid Mommy",
    body: "A ritual terminal where prayers stay intimate while proofs settle on-chain. Submit, hash, and breathe — streaks and oracles nudge you back with gentle pressure.",
    highlights: [
      "Submit private prayers while hashing proof for the registry.",
      "Streaks, oracle feeds, and heartfelt artifacts keep the energy active.",
    ],
  },
  {
    title: "MiFOIDs",
    body: "AI avatar tokens that evolve with every epoch. Traits unlock gating, governance cues, and secret channels as you keep showing up.",
    highlights: [
      "Traits track prayers, votes, and participation.",
      "Evolutions unlock access, rituals, and new storylines.",
    ],
  },
];

const row2Cards: InfoCard[] = [
  {
    title: "Why this matters",
    body: "Culture lives fast, but the void profile keeps it steady with prayer, lore, and votes archived on-chain. Every ritual builds proof so nothing slips into vapor.",
    highlights: ["The canon is shared, resilient, and always available for the crew."],
  },
  {
    title: "Built on Fluent + Contracts",
    body: "Fluent-native contracts lock micro-escrow, canonization gates, and private proof delivery. The stack keeps rituals verifiable without shouting into the void.",
    highlights: [
      "Micro-escrow keeps spam out while honoring intent.",
      "Smart contracts anchor manifests, proofs, and staking.",
    ],
  },
];

const canonizationSteps = [
  "Propose a piece with intent, placement, and escrow.",
  "Vote through the epoch while sharing reflections with the crew.",
  "Canonize the approved drop and let the manifest breathe.",
];

function InfoCard({ data }: { data: InfoCard }) {
  return (
    <article className="info-card">
      <p className="info-card__title">{data.title}</p>
      <p className="info-card__body">{data.body}</p>
      {data.highlights && (
        <ul className="info-card__list">
          {data.highlights.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      )}
    </article>
  );
}

function CanonizationStrip({ steps }: { steps: string[] }) {
  return (
    <div className="canonization-strip">
      <span className="canonization-strip__label">Canonization in 3 steps</span>
      <div className="canonization-strip__steps">
        {steps.map((step, index) => (
          <span key={`${step}-${index}`}>
            <span className="canonization-strip__index">{String(index + 1).padStart(2, "0")}</span>
            {step}
          </span>
        ))}
      </div>
    </div>
  );
}

export default function AboutPage() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();
  const [walletDropdownOpen, setWalletDropdownOpen] = useState(false);

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
    <main
      className="relative min-h-screen w-full overflow-hidden px-4 py-8 text-white"
      style={{ fontFamily: '"Inter", var(--font-ui)', letterSpacing: "0.01em" }}
    >
      <div className="absolute inset-0 pointer-events-none" aria-hidden>
        {bubbleConfigs.map((bubble, index) => (
          <div
            key={`bubble-${index}`}
            className="bubble"
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

      <div className="relative z-10 mx-auto w-full max-w-[1400px]">
        <section className="vista-window vista-window--enhanced">
          <AppTitlebar
            title="FOID_PROFILE.EXE"
            chainId={chainId}
            connected={isConnected}
            address={address}
            isWalletDropdownOpen={walletDropdownOpen}
            onToggleWallet={() => setWalletDropdownOpen((prev) => !prev)}
            onDisconnect={() => disconnect()}
            onSwitchWallet={handleSwitchWallet}
          />

          <div
            className="vista-window__body flex flex-col gap-5 p-5 sm:p-6"
            style={{
              height: "min(760px, calc(100vh - 145px))",
              minHeight: "0",
            }}
          >
            <div className="flex flex-1 gap-5 overflow-hidden" style={{ minHeight: 0 }}>
              <aside className="profile-column flex-shrink-0">
                <div className="profile-panel">
                  <div className="profile-avatar" aria-hidden="true" />
                  <div className="space-y-1">
                    <p className="profile-subtitle">void profile</p>
                    <h1 className="profile-name">foid foundation</h1>
                    <p className="profile-handle">@sloshlord</p>
                  </div>
                  <p className="profile-bio">
                    On-chain culture OS for memes, rituals, and soft spirituality. We archive devotion, votes, and lore so ephemeral beauty feels eternal.
                  </p>
                  <div className="flex flex-col gap-4">
                    {profileCTAs.map((cta) => (
                      <Y2kGlassButton key={cta.label} href={cta.href} label={cta.label} variant={cta.variant} />
                    ))}
                    <div className="w-full max-w-[180px]">
                      <Y2kGlassButton href="/docs" label="DOCS" variant="secondary" />
                    </div>
                  </div>
                </div>
              </aside>

              <section className="flex flex-1 flex-col gap-5 overflow-hidden" style={{ minHeight: 0 }}>
                <div className="grid gap-5 md:grid-cols-3">
                  {row1Cards.map((card) => (
                    <InfoCard key={card.title} data={card} />
                  ))}
                </div>

                <div className="grid gap-5 md:grid-cols-2">
                  {row2Cards.map((card) => (
                    <InfoCard key={card.title} data={card} />
                  ))}
                </div>

                <CanonizationStrip steps={canonizationSteps} />
              </section>
            </div>
          </div>
        </section>
      </div>

      <style jsx global>{`
        .profile-column {
          width: min(340px, 100%);
          flex-shrink: 0;
        }

        .profile-panel {
          border-radius: 22px;
          border: 1px solid rgba(255, 255, 255, 0.25);
          background: linear-gradient(180deg, rgba(5, 7, 15, 0.95), rgba(10, 12, 24, 0.95));
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.45);
          padding: 2rem;
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }

        .profile-avatar {
          width: 120px;
          height: 120px;
          border-radius: 999px;
          border: 2px solid rgba(255, 255, 255, 0.45);
          background: radial-gradient(circle at 30% 30%, rgba(255, 255, 255, 0.9), rgba(255, 200, 230, 0.25) 60%, rgba(14, 10, 30, 0.8) 100%);
          box-shadow: inset 0 1px 8px rgba(255, 255, 255, 0.45), 0 8px 20px rgba(0, 0, 0, 0.45);
        }

        .profile-subtitle {
          text-transform: uppercase;
          letter-spacing: 0.45em;
          font-size: 0.65rem;
          color: rgba(208, 255, 255, 0.9);
        }

        .profile-name {
          font-family: "Rajdhani", "Inter", var(--font-ui);
          text-transform: lowercase;
          font-size: clamp(2rem, 2vw, 2.25rem);
          letter-spacing: 0.15em;
          color: #ffe7ff;
          text-shadow: 0 0 8px rgba(255, 196, 235, 0.45);
          margin: 0;
        }

        .profile-handle {
          font-size: 0.85rem;
          color: rgba(255, 255, 255, 0.7);
          margin: 0;
        }

        .profile-bio {
          margin: 0;
          font-size: 0.95rem;
          line-height: 1.6;
          color: rgba(255, 255, 255, 0.85);
          letter-spacing: 0.02em;
        }

        .info-card {
          border-radius: 20px;
          border: 1px solid rgba(255, 255, 255, 0.18);
          background: rgba(8, 10, 20, 0.85);
          box-shadow: 0 16px 30px rgba(0, 0, 0, 0.45);
          padding: 1.8rem;
          display: flex;
          flex-direction: column;
          gap: 0.8rem;
          min-height: 220px;
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
        }

        .info-card__title {
          font-family: "Rajdhani", "Inter", var(--font-ui);
          letter-spacing: 0.25em;
          font-size: 0.75rem;
          text-transform: uppercase;
          color: rgba(212, 255, 255, 0.95);
          text-shadow: 0 0 6px rgba(208, 240, 255, 0.6);
          margin: 0;
        }

        .info-card__body {
          margin: 0;
          font-size: 0.95rem;
          line-height: 1.55;
          color: rgba(255, 255, 255, 0.82);
          letter-spacing: 0.01em;
        }

        .info-card__list {
          margin: 0;
          padding-left: 1rem;
          display: flex;
          flex-direction: column;
          gap: 0.35rem;
          font-size: 0.85rem;
          letter-spacing: 0.02em;
          color: rgba(255, 255, 255, 0.75);
        }

        .info-card__list li::marker {
          color: #fff0ff;
        }

        .canonization-strip {
          border-radius: 16px;
          border: 1px solid rgba(255, 255, 255, 0.2);
          background: rgba(12, 14, 24, 0.85);
          padding: 0.75rem 1rem;
          font-size: 0.65rem;
          text-transform: uppercase;
          letter-spacing: 0.3em;
          display: flex;
          flex-wrap: wrap;
          gap: 0.75rem;
          align-items: center;
          justify-content: space-between;
        }

        .canonization-strip__label {
          color: rgba(255, 255, 255, 0.65);
        }

        .canonization-strip__steps {
          display: flex;
          flex: 1;
          gap: 1rem;
          flex-wrap: wrap;
          color: rgba(255, 255, 255, 0.75);
          letter-spacing: 0.15em;
        }

        .canonization-strip__index {
          color: #00ffd5;
          margin-right: 0.35rem;
        }

        .bubble {
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
