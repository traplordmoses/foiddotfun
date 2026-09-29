"use client";

// src/components/os/MobileHomeScreen.tsx
// The phone home screen: a clock and the apps over the wallpaper, laid out
// like a phone's. Phones and tablets open foid.fun on it (HomeClient renders
// <HomeScreen page /> at /), and it is what a closed window leaves behind on
// every other route: route windows minimize to the dock (useWindowStore) and
// <MobileHomeScreen /> in ClientLayout shows the home screen then. Tap an
// app to open it, or tap the one you just closed to bring it back. Escape
// does the same for the current window.

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

// Fills the clock in straight from the HTML, before any bundle runs: the
// server can't know the visitor's time, and a blank clock that pops in after
// hydration reads as a slow page. Same strings as clockParts(), which the
// first client render computes too, so hydration keeps them.
const CLOCK_SCRIPT = `(function(){try{var c=document.currentScript.previousElementSibling,n=new Date(),t="",p="";new Intl.DateTimeFormat(void 0,{hour:"numeric",minute:"2-digit"}).formatToParts(n).forEach(function(x){if(x.type==="hour"||x.type==="minute"||(x.type==="literal"&&x.value.trim()===":"))t+=x.value;if(x.type==="dayPeriod"&&!p)p=x.value.toLowerCase()});c.querySelector(".home-screen__digits").textContent=t;c.querySelector(".home-screen__period").textContent=p;c.querySelector(".home-screen__date").textContent=new Intl.DateTimeFormat(void 0,{weekday:"long",day:"numeric",month:"long"}).format(n).toLowerCase();c.querySelector("time").setAttribute("datetime",n.toISOString())}catch(e){}})()`;

export function HomeScreen({ page = false, onReopen }: {
  /** The page at / on phones (server-rendered), rather than the layer a
   *  closed window leaves. */
  page?: boolean;
  /** Brings back the window that was just closed. */
  onReopen?: () => void;
}) {
  const pathname = usePathname();
  // The server renders the clock empty; every client render has the time.
  const [now, setNow] = useState<Date | null>(() => (typeof window === "undefined" ? null : new Date()));

  useEffect(() => {
    setNow(new Date());
    const id = window.setInterval(() => setNow(new Date()), 15_000);
    return () => window.clearInterval(id);
  }, []);

  const clock = now ? clockParts(now) : null;

  return (
    <section className={`home-screen${page ? " home-screen--page" : ""}`} aria-label="Home screen">
      <div className="home-screen__clock">
        <time className="home-screen__time" dateTime={now?.toISOString()} suppressHydrationWarning>
          <span className="home-screen__digits" suppressHydrationWarning>
            {clock?.time ?? ""}
          </span>
          <span className="home-screen__period" suppressHydrationWarning>
            {clock?.period ?? ""}
          </span>
        </time>
        <span className="home-screen__date" suppressHydrationWarning>
          {clock?.date ?? ""}
        </span>
      </div>
      {page ? <script dangerouslySetInnerHTML={{ __html: CLOCK_SCRIPT }} /> : null}

      <nav className="home-screen__grid" aria-label="Apps">
        {APPS.map((app, i) => {
          const style = { "--app-accent": ACCENT[app.href] ?? "#7dd3fc", "--i": i } as CSSProperties;
          const body = (
            <>
              <span className="home-screen__tile" aria-hidden="true">
                {app.glass ? <GlassIcon name={app.glass} px={128} size={44} sweepDelayMs={i * 110} /> : app.icon}
              </span>
              <span className="home-screen__label">{app.label}</span>
            </>
          );
          if (app.href !== pathname) {
            // The route change opens the app's window.
            return (
              <Link key={app.href} href={app.href} className="home-screen__app" style={style}>
                {body}
              </Link>
            );
          }
          // The app whose window was just closed reopens in place. At /
          // this is Home, and you are already there.
          return onReopen ? (
            <button key={app.href} type="button" className="home-screen__app" style={style} onClick={onReopen}>
              {body}
            </button>
          ) : (
            <Link
              key={app.href}
              href={app.href}
              className="home-screen__app"
              style={style}
              aria-current="page"
              onClick={(e) => e.preventDefault()}
            >
              {body}
            </Link>
          );
        })}
      </nav>

      <p className="home-screen__hint">tap an app to open it</p>
    </section>
  );
}

export function MobileHomeScreen() {
  const minimized = useWindowStore((s) => s.minimized);
  const restore = useWindowStore((s) => s.restore);
  const pathname = usePathname();

  // Opening another app always shows its window, even on a route whose
  // chrome has no window controls to reset the store.
  useEffect(() => {
    useWindowStore.getState().restore();
  }, [pathname]);

  useEffect(() => {
    if (!minimized) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") restore();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [minimized, restore]);

  if (!minimized) return null;
  return <HomeScreen onReopen={restore} />;
}
