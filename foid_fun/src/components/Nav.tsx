"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const links = [
  { href: "/", label: "Dashboard" },
  { href: "/wFOID", label: "wFOID" },
  { href: "/wETH", label: "wETH" },
  { href: "/foidswap", label: "FoidSwap" },
  { href: "/foidfactory", label: "FoidFactory" },
];

export default function Nav() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  const linkClassName = (active: boolean) =>
    `block rounded-full px-3 py-1.5 text-sm font-medium tracking-wide transition ${
      active
        ? "bg-gradient-to-r from-foid-aqua/80 via-foid-periw/80 to-foid-candy/80 text-foid-midnight shadow-[0_0_20px_rgba(114,225,255,0.45)]"
        : "text-white/85 hover:bg-white/15 hover:text-white hover:shadow-[0_0_16px_rgba(114,225,255,0.24)]"
    }`;

  return (
    <nav className="relative border-b border-white/10 bg-transparent backdrop-blur-sm">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 foid-glass">
        <span className="font-mono text-sm uppercase tracking-[0.32em] text-foid-mint/90 sm:text-base">
          wFOID • control panel
        </span>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setIsOpen((prev) => !prev)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/35 bg-white/15 text-white/80 transition hover:border-white/55 hover:text-white focus:outline-none focus:ring-2 focus:ring-foid-cyan/50 md:hidden"
            aria-label="Toggle navigation"
            aria-expanded={isOpen}
            aria-controls="mobile-nav"
          >
            <svg
              className="h-5 w-5"
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path strokeLinecap="round" d="M3.5 6h13m-13 4h13m-13 4h13" />
            </svg>
          </button>
          <ul className="hidden items-center gap-3 md:flex">
            {links.map((l) => {
              const active = pathname === l.href;
              return (
                <li key={l.href}>
                  <Link href={l.href} className={linkClassName(active)}>
                    {l.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
      <div
        id="mobile-nav"
        className={`foid-glass border border-white/20 px-4 py-3 md:hidden ${
          isOpen ? "block" : "hidden"
        }`}
      >
        <ul className="flex flex-col gap-2">
          {links.map((l) => {
            const active = pathname === l.href;
            return (
              <li key={l.href}>
                <Link href={l.href} className={linkClassName(active)}>
                  {l.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}
