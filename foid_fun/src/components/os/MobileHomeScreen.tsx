"use client";

// src/components/os/MobileHomeScreen.tsx
// What a phone shows after you close a window. Route windows minimize to
// the dock (useWindowStore). On the desktop the shell's wallpaper and
// windows take over, but on a phone that left nothing but the page
// background. This lays the apps out over the wallpaper like a phone home
// screen: tap one to open it, or tap the one you just closed to bring it
// back. Escape does the same for the current window.

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type CSSProperties } from "react";
import { navItems, type NavItem } from "@/components/Dock";
import { GlassIcon } from "@/components/ui/GlassIcon";
import { useWindowStore } from "@/stores/windowStore";
import "./mobile-home-screen.css";

const EPISODES: NavItem = {
  href: "/watch",
  label: "Episodes",
  glass: "episodes",
  icon: (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="7" width="20" height="15" rx="2" />
      <polyline points="17 2 12 7 7 2" />
      <path d="M10 11.5v6l5-3z" />
    </svg>
  ),
};

const APPS: NavItem[] = [...navItems, EPISODES];

// Each app's accent (from the launcher tiles where one exists) tints its
// glass tile.
const ACCENT: Record<string, string> = {
  "/": "#7dd3fc",
  "/pray": "#22d3ee",
  "/board": "#ff6bd5",
  "/vote": "#a855f7",
  "/mifoid": "#818cf8",
  "/files": "#38bdf8",
  "/about": "#34d399",
  "/watch": "#f59e0b",
};

function clockParts(now: Date): { time: string; period: string; date: string } {
  const parts = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).formatToParts(now);
  const time = parts
    .filter((p) => p.type === "hour" || p.type === "minute" || (p.type === "literal" && p.value.trim() === ":"))
    .map((p) => p.value)
    .join("");
  const period = parts.find((p) => p.type === "dayPeriod")?.value.toLowerCase() ?? "";
  const date = new Intl.DateTimeFormat(undefined, { weekday: "long", day: "numeric", month: "long" })
    .format(now)
    .toLowerCase();
  return { time, period, date };
}

export function MobileHomeScreen() {
  const minimized = useWindowStore((s) => s.minimized);
  const restore = useWindowStore((s) => s.restore);
  const pathname = usePathname();
  const [now, setNow] = useState<Date | null>(null);

  // Opening another app always shows its window, even on a route whose
  // chrome has no window controls to reset the store.
  useEffect(() => {
    useWindowStore.getState().restore();
  }, [pathname]);

  useEffect(() => {
    if (!minimized) return;
    setNow(new Date());
    const id = window.setInterval(() => setNow(new Date()), 15_000);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") restore();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("keydown", onKey);
    };
  }, [minimized, restore]);

  if (!minimized) return null;
  const clock = now ? clockParts(now) : null;

  return (
    <section className="home-screen" aria-label="Home screen">
      <div className="home-screen__clock">
        {clock ? (
          <>
            <time className="home-screen__time" dateTime={now?.toISOString()}>
              {clock.time}
              {clock.period ? <span className="home-screen__period">{clock.period}</span> : null}
            </time>
            <span className="home-screen__date">{clock.date}</span>
          </>
        ) : null}
      </div>

      <nav className="home-screen__grid" aria-label="Apps">
        {APPS.map((app, i) => {
          const style = { "--app-accent": ACCENT[app.href] ?? "#7dd3fc", "--i": i } as CSSProperties;
          const body = (
            <>
              <span className="home-screen__tile" aria-hidden="true">
                {app.glass ? <GlassIcon name={app.glass} px={128} size={44} /> : app.icon}
              </span>
              <span className="home-screen__label">{app.label}</span>
            </>
          );
          // The app whose window was just closed reopens in place; the
          // rest navigate (the route change opens their window).
          return app.href === pathname ? (
            <button key={app.href} type="button" className="home-screen__app" style={style} onClick={restore}>
              {body}
            </button>
          ) : (
            <Link key={app.href} href={app.href} className="home-screen__app" style={style}>
              {body}
            </Link>
          );
        })}
      </nav>

      <p className="home-screen__hint">tap an app to open it</p>
    </section>
  );
}
