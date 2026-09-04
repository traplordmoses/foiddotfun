import type { ReactNode } from "react";
// files.css now rides with the FilesApp component (src/apps/FilesApp.tsx)
// so the desktop shell's FILES window loads it too — not just this route.

export const metadata = {
  title: "Files",
  description: "The MiFOID media archive: videos, renders and stills the foundation is preserving.",
};

export default function FilesLayout({ children }: { children: ReactNode }) {
  return children;
}
