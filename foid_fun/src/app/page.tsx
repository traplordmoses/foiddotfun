import Link from "next/link";
import Image from "next/image";

const heroTile = {
  title: "loreboard.app",
  label: "Loreboard",
  href: "/board",
  accent: "#ff6bd5",
  tagline: "the community canvas . propose . vote . build culture",
  description: "A living collage of community-curated memes. Propose an image, let the community vote, and watch it become permanent on-chain art.",
} as const;

const tiles = [
  {
    title: "pray.exe",
    label: "Pray",
    href: "/pray",
    accent: "#00ffff",
    description: "Daily on-chain ritual. Build streaks, earn voting power.",
    icon: (
      <svg viewBox="0 0 48 48" fill="none" className="home-tile__svg-icon">
        <circle cx="24" cy="24" r="20" fill="url(#pray-grad)" opacity="0.25" />
        <path d="M24 8v8m0 16v8M8 24h8m16 0h8" stroke="#00ffff" strokeWidth="2.5" strokeLinecap="round" />
        <circle cx="24" cy="24" r="6" stroke="#00ffff" strokeWidth="2" fill="none" opacity="0.8" />
        <circle cx="24" cy="24" r="12" stroke="#00ffff" strokeWidth="1.2" fill="none" opacity="0.4" />
        <defs><radialGradient id="pray-grad"><stop stopColor="#00ffff" /><stop offset="1" stopColor="transparent" /></radialGradient></defs>
      </svg>
    ),
  },
  {
    title: "vote.exe",
    label: "Vote",
    href: "/vote",
    accent: "#a855f7",
    description: "Swipe right to approve, left to reject. Shape the board.",
    icon: (
      <svg viewBox="0 0 48 48" fill="none" className="home-tile__svg-icon">
        <circle cx="24" cy="24" r="20" fill="url(#vote-grad)" opacity="0.25" />
        <path d="M14 24l7 7 13-14" stroke="#a855f7" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="24" cy="24" r="16" stroke="#a855f7" strokeWidth="1.2" fill="none" opacity="0.4" />
        <path d="M10 28l4-4m20-4l4-4" stroke="#a855f7" strokeWidth="1.2" strokeLinecap="round" opacity="0.3" />
        <defs><radialGradient id="vote-grad"><stop stopColor="#a855f7" /><stop offset="1" stopColor="transparent" /></radialGradient></defs>
      </svg>
    ),
  },
  {
    title: "mifoid.exe",
    label: "MiFOID",
    href: "/mifoid",
    accent: "#818cf8",
    description: "3,333 unique agent-rendered NFTs. Your key to the ecosystem.",
    icon: (
      <svg viewBox="0 0 48 48" fill="none" className="home-tile__svg-icon">
        <circle cx="24" cy="24" r="20" fill="url(#mifoid-grad)" opacity="0.25" />
        <rect x="14" y="12" width="20" height="24" rx="4" stroke="#818cf8" strokeWidth="2" fill="none" opacity="0.6" />
        <circle cx="24" cy="22" r="5" stroke="#818cf8" strokeWidth="2" fill="none" opacity="0.8" />
        <path d="M17 32c0-3 3-5 7-5s7 2 7 5" stroke="#818cf8" strokeWidth="1.8" strokeLinecap="round" fill="none" opacity="0.7" />
        <defs><radialGradient id="mifoid-grad"><stop stopColor="#818cf8" /><stop offset="1" stopColor="transparent" /></radialGradient></defs>
      </svg>
    ),
  },
  {
    title: "about.exe",
    label: "About",
    href: "/about",
    accent: "#34d399",
    description: "Contracts, roadmap, FAQ.",
    icon: (
      <svg viewBox="0 0 48 48" fill="none" className="home-tile__svg-icon">
        <circle cx="24" cy="24" r="20" fill="url(#about-grad)" opacity="0.25" />
        <circle cx="24" cy="24" r="14" stroke="#34d399" strokeWidth="1.8" fill="none" opacity="0.45" />
        <circle cx="24" cy="17" r="2" fill="#34d399" opacity="0.9" />
        <path d="M24 23v10" stroke="#34d399" strokeWidth="2.5" strokeLinecap="round" />
        <defs><radialGradient id="about-grad"><stop stopColor="#34d399" /><stop offset="1" stopColor="transparent" /></radialGradient></defs>
      </svg>
    ),
  },
] as const;

/* Floating sparkle positions for homepage */
const HOME_SPARKLES = [
  { top: "8%", left: "12%", size: 22, delay: "0s" },
  { top: "15%", left: "82%", size: 28, delay: "0.6s" },
  { top: "45%", left: "6%", size: 18, delay: "1.2s" },
  { top: "60%", left: "90%", size: 24, delay: "0.3s" },
  { top: "80%", left: "18%", size: 20, delay: "0.9s" },
  { top: "35%", left: "92%", size: 16, delay: "1.5s" },
  { top: "72%", left: "85%", size: 26, delay: "0.4s" },
];

export default function LandingPage() {
  return (
    <main className="relative isolate min-h-screen bg-foid-bg text-white/90 flex flex-col items-center px-4 pt-12 sm:pt-16 pb-32 sm:pb-36 overflow-hidden">
      <div className="pointer-events-none fixed inset-0 z-0 vignette" />

      {/* Floating sparkles & bubbles — MiFOID-style */}
      <div className="pointer-events-none fixed inset-0 z-[1] overflow-hidden">
        {HOME_SPARKLES.map((s, i) => (
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
          src="/bubble.png" alt="" width={60} height={60}
          className="home-bubble absolute"
          style={{ top: "25%", left: "8%", opacity: 0.12 }}
          unoptimized
        />
        <Image
          src="/bubble.png" alt="" width={40} height={40}
          className="home-bubble-sm absolute"
          style={{ top: "65%", left: "88%", opacity: 0.10 }}
          unoptimized
        />
      </div>

      <div className="relative z-10 flex flex-col items-center w-full max-w-[1100px]">
        {/* FOID FOUNDATION — top title */}
        <span className="foid-title foid-title--xl mb-3">
          <span aria-hidden className="foid-title__highlight" />
          <span className="foid-title__text">FOID FOUNDATION</span>
          <span aria-hidden className="foid-title__sweep" />
        </span>

        {/* Subtitle — pink gradient text like MiFOID */}
        <p className="home-subtitle text-center text-sm sm:text-base tracking-[0.15em] mb-10 sm:mb-14 max-w-md font-mono uppercase">
          the internet&apos;s permanent memory
        </p>

        {/* LOREBOARD — hero tile, full width */}
        <Link href={heroTile.href} className="home-tile home-tile--hero" prefetch>
          <div className="vista-window home-tile__window">
            <div className="vista-window__titlebar">
              <div className="vista-window__controls" aria-hidden="true">
                <span className="vista-window__control vista-window__control--minimize" />
                <span className="vista-window__control vista-window__control--restore" />
                <span className="vista-window__control vista-window__control--close" />
              </div>
              <span className="vista-window__title text-[11px]">{heroTile.title}</span>
            </div>
            <div className="vista-window__body">
              <div
                className="home-tile__body home-tile__body--hero"
                style={{
                  borderTop: `2px solid ${heroTile.accent}33`,
                  "--tile-accent-glow": `${heroTile.accent}15`,
                } as React.CSSProperties}
              >
                {/* SVG loreboard icon */}
                <div className="home-tile__icon home-tile__icon--hero" style={{ color: heroTile.accent }}>
                  <svg viewBox="0 0 64 64" fill="none" className="w-12 h-12 sm:w-16 sm:h-16">
                    <rect x="4" y="4" width="56" height="56" rx="8" stroke="currentColor" strokeWidth="1.5" fill="none" opacity="0.3" />
                    <rect x="8" y="8" width="22" height="18" rx="3" fill="currentColor" opacity="0.15" stroke="currentColor" strokeWidth="1" />
                    <rect x="34" y="8" width="22" height="12" rx="3" fill="currentColor" opacity="0.1" stroke="currentColor" strokeWidth="1" />
                    <rect x="8" y="30" width="16" height="24" rx="3" fill="currentColor" opacity="0.1" stroke="currentColor" strokeWidth="1" />
                    <rect x="28" y="24" width="28" height="16" rx="3" fill="currentColor" opacity="0.15" stroke="currentColor" strokeWidth="1" />
                    <rect x="28" y="44" width="28" height="12" rx="3" fill="currentColor" opacity="0.1" stroke="currentColor" strokeWidth="1" />
                    <circle cx="32" cy="32" r="3" fill="currentColor" opacity="0.5" />
                  </svg>
                </div>
                <span className="home-tile__label home-tile__label--hero home-tile__label--glow">{heroTile.label}</span>
                <span className="home-tile__tagline">{heroTile.tagline}</span>
                <span className="home-tile__description">{heroTile.description}</span>
                <span className="home-tile__cta">
                  Enter the Board <span aria-hidden>&rarr;</span>
                </span>
              </div>
            </div>
          </div>
        </Link>

        {/* 4 secondary tiles — even row */}
        <div className="home-tiles-grid home-tiles-grid--secondary">
          {tiles.map((tile) => (
            <Link key={tile.href} href={tile.href} className="home-tile" prefetch>
              <div className="vista-window home-tile__window">
                <div className="vista-window__titlebar">
                  <div className="vista-window__controls" aria-hidden="true">
                    <span className="vista-window__control vista-window__control--minimize" />
                    <span className="vista-window__control vista-window__control--restore" />
                    <span className="vista-window__control vista-window__control--close" />
                  </div>
                  <span className="vista-window__title text-[11px]">{tile.title}</span>
                </div>
                <div className="vista-window__body">
                  <div className="home-tile__body" style={{ borderTop: `2px solid ${tile.accent}33`, "--tile-accent-glow": `${tile.accent}15` } as React.CSSProperties}>
                    <div className="home-tile__icon" style={{ color: tile.accent }}>{tile.icon}</div>
                    <span className="home-tile__label home-tile__label--glow">{tile.label}</span>
                    <span className="home-tile__tile-desc">{tile.description}</span>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
