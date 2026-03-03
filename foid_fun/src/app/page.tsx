import Link from "next/link";

const tiles = [
  { title: "pray.exe", label: "Pray", href: "/pray", icon: "🙏", accent: "#00ffff" },
  { title: "loreboard.exe", label: "Loreboard", href: "/board", icon: "🖼️", accent: "#ff6bd5" },
  { title: "swipe.exe", label: "Swipe", href: "/swipe", icon: "👆", accent: "#a855f7" },
  { title: "gallery.exe", label: "Gallery", href: "/gallery", icon: "🏛️", accent: "#fbbf24" },
  { title: "mifoid.exe", label: "MiFOID", href: "/mifoid", icon: "🤖", accent: "#818cf8" },
  { title: "about.exe", label: "About", href: "/about", icon: "📖", accent: "#34d399" },
] as const;

export default function LandingPage() {
  return (
    <main className="relative isolate min-h-screen bg-foid-bg text-white/90 flex flex-col items-center px-4 pt-16 pb-28">
      <div className="pointer-events-none fixed inset-0 z-0 vignette" />

      <div className="relative z-10 flex flex-col items-center w-full max-w-[1100px]">
        {/* FOID FOUNDATION — top title */}
        <span className="foid-title foid-title--xl mb-16">
          <span aria-hidden className="foid-title__highlight" />
          <span className="foid-title__text">FOID FOUNDATION</span>
          <span aria-hidden className="foid-title__sweep" />
        </span>

        {/* 6 tiles — all same size, uniform grid */}
        <div className="home-tiles-grid">
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
                    <span className="home-tile__icon" style={{ color: tile.accent }}>{tile.icon}</span>
                    <span className="home-tile__label">{tile.label}</span>
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
