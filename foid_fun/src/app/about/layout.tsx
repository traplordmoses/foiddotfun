import type { ReactNode } from "react";
// files.css + about.css now ride with the AboutApp component
// (src/apps/AboutApp.tsx) so the desktop shell's ABOUT window loads them
// too — not just this route. ABOUT.EXE shares the FILES.EXE Finder chrome
// wholesale; about.css only adds the TEXTEDIT.EXE reader styles.

export const metadata = { title: "ABOUT" };

export default function AboutLayout({ children }: { children: ReactNode }) {
  return children;
}
