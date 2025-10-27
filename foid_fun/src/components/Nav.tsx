"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "Dashboard" },
  { href: "/token", label: "Token" },
  { href: "/bridge", label: "Bridge" },
  { href: "/registry", label: "Registry" },
];

export default function Nav() {
  const pathname = usePathname();
  return (
   <nav className="border-b border-neutral-800/60 bg-neutral-950/70 backdrop-blur">
      <div className="mx-auto max-w-6xl flex items-center justify-between px-4 py-3">
        <span className="font-mono tracking-wide text-neutral-300">wFOID • control panel</span>
        <ul className="flex gap-3">
          {links.map((l) => {
            const active = pathname === l.href;
            return (
              <li key={l.href}>
                <Link
                  href={l.href}
                  className={`px-3 py-1.5 rounded-xl transition
                    ${active
                      ? "bg-neutral-800 text-white"
                      : "text-neutral-300 hover:bg-neutral-800/60 hover:text-white"}`}
                >
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
