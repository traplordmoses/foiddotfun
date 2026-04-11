import type { ReactNode } from "react";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import "./vote-animations.css";

export const metadata = { title: "VOTE" };

export default function VoteLayout({ children }: { children: ReactNode }) {
  return (
    <ErrorBoundary title="Vote crashed" description="Something went wrong loading proposals. Try refreshing the page.">
      {children}
    </ErrorBoundary>
  );
}
