import Link from "next/link";

export const metadata = { title: "404" };

const quickLinks = [
  { href: "/pray", label: "Pray", icon: "🙏" },
  { href: "/board", label: "Loreboard", icon: "🖼️" },
  { href: "/vote", label: "Vote", icon: "🗳️" },
] as const;

export default function NotFound() {
  return (
    <main className="relative isolate min-h-screen bg-foid-bg text-white/90 flex flex-col items-center justify-center px-4">
      <div className="pointer-events-none fixed inset-0 z-0 vignette" />

      <div className="relative z-10 w-full max-w-[520px]">
        <div className="vista-window">
          <div className="vista-window__titlebar">
            <div className="vista-window__controls" aria-hidden="true">
              <span className="vista-window__control vista-window__control--minimize" />
              <span className="vista-window__control vista-window__control--restore" />
              <span className="vista-window__control vista-window__control--close" />
            </div>
            <span className="vista-window__title text-[11px]">error_404.exe</span>
          </div>
          <div className="vista-window__body">
            <div className="flex flex-col items-center py-12 px-6 text-center">
              {/* Big 404 */}
              <span
                className="text-[80px] font-bold leading-none tracking-[0.2em] mb-2"
                style={{
                  fontFamily: "var(--font-display), sans-serif",
                  background: "linear-gradient(135deg, #72e1ff 0%, #cdb7ff 50%, var(--foid-pink-hot) 100%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  filter: "drop-shadow(0 0 30px rgba(114, 225, 255, 0.3))",
                }}
              >
                404
              </span>

              <h1
                className="text-sm font-bold tracking-[0.3em] uppercase text-white/70 mb-4"
                style={{ fontFamily: "var(--font-display), sans-serif" }}
              >
                Page Not Found
              </h1>

              <p className="text-sm text-white/45 mb-8 max-w-[320px] leading-relaxed">
                this page doesn&apos;t exist yet&hellip; or maybe it never did.
                either way, there&apos;s nothing here.
              </p>

              {/* Go Home button */}
              <Link
                href="/"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-full text-sm font-semibold tracking-wider uppercase transition-all duration-300"
                style={{
                  background: "linear-gradient(135deg, rgba(114, 225, 255, 0.3) 0%, rgba(168, 85, 247, 0.3) 100%)",
                  border: "1px solid rgba(114, 225, 255, 0.3)",
                  backdropFilter: "blur(8px)",
                  color: "rgba(255, 255, 255, 0.9)",
                }}
              >
                <span>←</span> Go Home
              </Link>

              {/* Quick links */}
              <div className="flex items-center gap-4 mt-8">
                {quickLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="flex flex-col items-center gap-1 px-4 py-3 rounded-xl text-xs font-medium text-white/50 transition-all duration-200 hover:text-white/90 hover:bg-white/8"
                  >
                    <span className="text-lg">{link.icon}</span>
                    <span className="tracking-wider uppercase">{link.label}</span>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
