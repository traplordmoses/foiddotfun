import Link from "next/link";

const heroTile = {
  title: "loreboard.app",
  label: "Loreboard",
  href: "/board",
  accent: "#ff6bd5",
  tagline: "the community canvas — propose, vote, build culture",
  description: "A living collage of community-curated memes. Propose an image, let the community vote, and watch it become permanent on-chain art.",
} as const;

const tiles = [
  {
    title: "pray.exe",
    label: "Pray",
    href: "/pray",
    accent: "#00ffff",
    description: "Daily check-in with Foid Mommy. Build streaks, earn voting power.",
    icon: (
      <svg viewBox="0 0 48 48" fill="none" className="home-tile__svg-icon">
        <circle cx="24" cy="24" r="20" fill="url(#pray-grad)" opacity="0.15" />
        <path d="M24 8v8m0 16v8M8 24h8m16 0h8" stroke="#00ffff" strokeWidth="2" strokeLinecap="round" />
        <circle cx="24" cy="24" r="6" stroke="#00ffff" strokeWidth="1.5" fill="none" opacity="0.6" />
        <circle cx="24" cy="24" r="12" stroke="#00ffff" strokeWidth="1" fill="none" opacity="0.3" />
        <defs><radialGradient id="pray-grad"><stop stopColor="#00ffff" /><stop offset="1" stopColor="transparent" /></radialGradient></defs>
      </svg>
    ),
  },
  {
    title: "vote.exe",
    label: "Vote",
    href: "/swipe",
    accent: "#a855f7",
    description: "Swipe right to approve, left to reject. Shape the board.",
    icon: (
      <svg viewBox="0 0 48 48" fill="none" className="home-tile__svg-icon">
        <circle cx="24" cy="24" r="20" fill="url(#vote-grad)" opacity="0.15" />
        <path d="M14 24l7 7 13-14" stroke="#a855f7" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="24" cy="24" r="16" stroke="#a855f7" strokeWidth="1" fill="none" opacity="0.25" />
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
        <circle cx="24" cy="24" r="20" fill="url(#mifoid-grad)" opacity="0.15" />
        <rect x="14" y="12" width="20" height="24" rx="4" stroke="#818cf8" strokeWidth="1.5" fill="none" opacity="0.5" />
        <circle cx="24" cy="22" r="5" stroke="#818cf8" strokeWidth="1.5" fill="none" />
        <path d="M17 32c0-3 3-5 7-5s7 2 7 5" stroke="#818cf8" strokeWidth="1.5" strokeLinecap="round" fill="none" opacity="0.6" />
        <defs><radialGradient id="mifoid-grad"><stop stopColor="#818cf8" /><stop offset="1" stopColor="transparent" /></radialGradient></defs>
      </svg>
    ),
  },
  {
    title: "about.exe",
    label: "About",
    href: "/about",
    accent: "#34d399",
    description: "Learn how it all works. Contracts, roadmap, FAQ.",
    icon: (
      <svg viewBox="0 0 48 48" fill="none" className="home-tile__svg-icon">
        <circle cx="24" cy="24" r="20" fill="url(#about-grad)" opacity="0.15" />
        <circle cx="24" cy="24" r="14" stroke="#34d399" strokeWidth="1.5" fill="none" opacity="0.3" />
        <circle cx="24" cy="18" r="1.5" fill="#34d399" />
        <path d="M24 23v9" stroke="#34d399" strokeWidth="2" strokeLinecap="round" />
        <defs><radialGradient id="about-grad"><stop stopColor="#34d399" /><stop offset="1" stopColor="transparent" /></radialGradient></defs>
      </svg>
    ),
  },
] as const;

export default function LandingPage() {
  return (
    <main className="relative isolate min-h-screen bg-foid-bg text-white/90 flex flex-col items-center px-4 pt-12 sm:pt-16 pb-28">
      <div className="pointer-events-none fixed inset-0 z-0 vignette" />

      <div className="relative z-10 flex flex-col items-center w-full max-w-[1100px]">
        {/* FOID FOUNDATION — top title */}
        <span className="foid-title foid-title--xl mb-4">
          <span aria-hidden className="foid-title__highlight" />
          <span className="foid-title__text">FOID FOUNDATION</span>
          <span aria-hidden className="foid-title__sweep" />
        </span>

        {/* Subtitle */}
        <p className="text-center text-sm sm:text-base text-white/40 tracking-wide mb-10 sm:mb-14 max-w-md font-light">
          the internet&apos;s permanent memory — powered by community governance
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
                <span className="home-tile__label home-tile__label--hero">{heroTile.label}</span>
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
                    <span className="home-tile__label">{tile.label}</span>
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
