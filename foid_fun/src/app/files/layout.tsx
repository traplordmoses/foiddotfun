import type { ReactNode } from "react";
// files.css now rides with the FilesApp component (src/apps/FilesApp.tsx)
// so the desktop shell's FILES window loads it too — not just this route.

export const metadata = { title: "FILES" };

export default function FilesLayout({ children }: { children: ReactNode }) {
  return children;
}
