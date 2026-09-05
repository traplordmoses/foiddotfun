import type { ReactNode } from "react";
import { routeMetadata } from "@/lib/routeMetadata";
// files.css + about.css now ride with the AboutApp component
// (src/apps/AboutApp.tsx) so the desktop shell's ABOUT window loads them
// too — not just this route. ABOUT.EXE shares the FILES.EXE Finder chrome
// wholesale; about.css only adds the TEXTEDIT.EXE reader styles.

export const metadata = routeMetadata({
  title: "About",
  description:
    "How FOID works: the prayer ritual, the Loreboard, streak-weighted voting, the contracts on Fluent, and the roadmap.",
  path: "/about",
  card: "about",
});

export default function AboutLayout({ children }: { children: ReactNode }) {
  return children;
}
