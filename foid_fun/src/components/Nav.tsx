"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const links = [
  { href: "/", label: "Dashboard" },
  { href: "/token", label: "Token" },
  { href: "/registry", label: "Registry" },
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
    `block rounded-xl px-3 py-1.5 text-sm transition ${
      active
        ? "bg-neutral-800 text-white"
        : "text-neutral-300 hover:bg-neutral-800/60 hover:text-white"
    }`;

  return (
    <nav className="border-b border-neutral-800/60 bg-neutral-950/70 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <span className="font-mono text-sm tracking-wide text-neutral-300 sm:text-base">
          wFOID • control panel
        </span>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setIsOpen((prev) => !prev)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-neutral-800/70 bg-neutral-900/80 text-neutral-200 transition hover:border-neutral-700 hover:text-white focus:outline-none focus:ring-2 focus:ring-fluent-pink md:hidden"
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
        className={`border-t border-neutral-800/60 bg-neutral-950/90 px-4 py-3 md:hidden ${
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
