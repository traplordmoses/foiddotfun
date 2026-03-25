"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

type NavLink = { href: string; label: string };

const LINKS: NavLink[] = [
  { href: "/", label: "Home" },
  { href: "/pray", label: "Pray" },
  { href: "/board", label: "Loreboard" },
  { href: "/vote", label: "Vote" },
  { href: "/mifoid", label: "MiFOID" },
  { href: "/about", label: "About" },
];

export default function Nav() {
  const pathname = usePathname() || "/";
  const router = useRouter();
  const baseFee =
    process.env.NEXT_PUBLIC_BASE_FEE_PER_CELL_WEI ??
    process.env.NEXT_PUBLIC_BASE_FEE_PER_CELL ??
    "—";
  const network =
    process.env.NEXT_PUBLIC_CHAIN_NAME ??
    process.env.NEXT_PUBLIC_FLUENT_CHAIN_NAME ??
    "Fluent Testnet";

  // Always call hooks on every render (fixes the warning)
  const [isOpen, setIsOpen] = useState(false);

  // Close mobile menu when route changes
  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  // Warm route bundles/data so large text pages open immediately.
  useEffect(() => {
    for (const link of LINKS) {
      if (link.href !== pathname) {
        router.prefetch(link.href);
      }
    }
  }, [pathname, router]);

  // Normalize and compute active path
  const activePath = useMemo(
    () => (pathname.replace(/\/$/, "") || "/"),
    [pathname]
  );

  const linkClass = (href: string) => {
    const active =
      href === "/"
        ? activePath === "/"
        : activePath === href || activePath.startsWith(href + "/");
    return `block rounded-full px-4 py-2 text-base font-medium tracking-wide transition transform ${
      active
        ? "bg-gradient-to-r from-foid-aqua/80 via-foid-periw/80 to-foid-candy/80 text-foid-midnight shadow-[0_0_24px_rgba(114,225,255,0.5)]"
        : "text-white/85 hover:-translate-y-[1px] hover:bg-white/18 hover:text-white hover:shadow-[0_0_18px_rgba(114,225,255,0.32),0_10px_24px_rgba(0,0,0,0.16)]"
    }`;
  };

  const isHome = activePath === "/";
  if (isHome) {
    // Safe to return here because all hooks above have run
    return null;
  }

  return (
    <nav className="relative border-b border-white/10 bg-transparent pb-2 pt-5 backdrop-blur-sm">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 rounded-3xl px-6 py-5 foid-glass">
        <span className="font-mono text-base uppercase tracking-[0.32em] text-foid-mint/90 sm:text-lg">
          control panel
        </span>

        <div className="flex items-center gap-3">
          {/* Mobile toggle */}
          <button
            type="button"
            onClick={() => setIsOpen((v) => !v)}
            className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-white/35 bg-white/15 text-white/80 transition hover:border-white/55 hover:text-white focus:outline-none focus:ring-2 focus:ring-foid-cyan/50 md:hidden"
            aria-label="Toggle navigation"
            aria-expanded={isOpen}
            aria-controls="mobile-nav"
          >
            <svg className="h-5 w-5" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" d="M3.5 6h13m-13 4h13m-13 4h13" />
            </svg>
          </button>

          {/* Desktop links */}
          <ul className="hidden items-center gap-3 md:flex">
            {LINKS.map((l) => (
              <li key={l.href}>
                <Link href={l.href} prefetch className={linkClass(l.href)}>
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Status strip */}
      <div className="mx-auto mt-2 flex max-w-7xl flex-wrap items-center gap-3 rounded-2xl border border-white/10 bg-white/8 px-4 py-2 text-xs text-white/85 backdrop-blur-md shadow-[0_6px_18px_rgba(0,0,0,.22)]">
        <span className="font-semibold text-white/90">Status</span>
        <span className="h-1 w-1 rounded-full bg-emerald-300 shadow-[0_0_0_4px_rgba(99,255,214,0.25)]" aria-hidden />
        <span className="flex items-center gap-1 rounded-full bg-white/5 px-2 py-1">
          <span className="text-white/70">Epoch</span>
          <span className="font-semibold text-white">latest</span>
        </span>
        <span className="flex items-center gap-1 rounded-full bg-white/5 px-2 py-1">
          <span className="text-white/70">Base fee</span>
          <span className="font-semibold text-white">{baseFee}</span>
        </span>
        <span className="flex items-center gap-1 rounded-full bg-white/5 px-2 py-1">
          <span className="h-2 w-2 rounded-full bg-cyan-300 shadow-[0_0_0_4px_rgba(82,255,201,0.18)]" aria-hidden />
          <span className="font-semibold text-white">{network}</span>
        </span>
      </div>

      {/* Mobile menu */}
      <div
        id="mobile-nav"
        className={`foid-glass border border-white/20 px-4 py-3 md:hidden ${isOpen ? "block" : "hidden"}`}
      >
        <ul className="flex flex-col gap-2">
          {LINKS.map((l) => (
            <li key={l.href}>
              <Link
                href={l.href}
                prefetch
                className={linkClass(l.href)}
                onClick={() => setIsOpen(false)}
              >
                {l.label}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );
}
