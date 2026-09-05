import type { ReactNode } from "react";
import { routeMetadata } from "@/lib/routeMetadata";
// files.css now rides with the FilesApp component (src/apps/FilesApp.tsx)
// so the desktop shell's FILES window loads it too — not just this route.

export const metadata = routeMetadata({
  title: "Files",
  description: "The MiFOID media archive: videos, renders and stills the foundation is preserving.",
  path: "/files",
  card: "files",
});

export default function FilesLayout({ children }: { children: ReactNode }) {
  return children;
}
