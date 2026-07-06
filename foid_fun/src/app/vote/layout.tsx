import type { ReactNode } from "react";
import { ErrorBoundary } from "@/components/ErrorBoundary";
// vote-animations.css now rides with the VoteApp component
// (src/apps/VoteApp.tsx) so the desktop shell's VOTE window loads it too —
// not just this route. (It is all @keyframes; /vote/[id] and /vote/submit
// don't reference them.)

export const metadata = { title: "VOTE" };

export default function VoteLayout({ children }: { children: ReactNode }) {
  return (
    <ErrorBoundary route="vote" title="Vote crashed" description="Something went wrong loading proposals. Try refreshing the page.">
      {children}
    </ErrorBoundary>
  );
}
