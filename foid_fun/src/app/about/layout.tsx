import type { ReactNode } from "react";
// ABOUT.EXE shares the FILES.EXE Finder chrome wholesale — same sidebar,
// toolbar, canvas and status-strip classes. about.css only adds the
// TEXTEDIT.EXE reader styles.
import "../files/files.css";
import "./about.css";

export const metadata = { title: "ABOUT" };

export default function AboutLayout({ children }: { children: ReactNode }) {
  return children;
}
