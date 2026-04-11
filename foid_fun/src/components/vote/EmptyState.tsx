"use client";

import Link from "next/link";
import type { SwipeProposal } from "@/types/vote";
import { ConfettiBurst } from "./ConfettiBurst";

export function EmptyState({ proposals, sessionVoteCount }: { proposals: SwipeProposal[]; sessionVoteCount: number }) {
  const now = Math.floor(Date.now() / 1000);
  const hasActive = proposals.some((p) => !p.finalized && now < p.votingEndsAt);

  return (
    <div className="flex flex-col flex-1 min-h-0 items-center justify-center text-center px-4">
      <ConfettiBurst active={sessionVoteCount >= 5} />
      <div className="relative mb-6">
        <div className="text-6xl" aria-hidden="true" style={{
          filter: "drop-shadow(0 0 20px rgba(168,130,255,.4))",
          animation: "float-sword 3s ease-in-out infinite",
        }}>&#x2694;&#xFE0F;</div>
        <div aria-hidden="true" className="absolute inset-0 rounded-full" style={{ background: "radial-gradient(circle,rgba(168,130,255,.15) 0%,transparent 70%)", filter: "blur(20px)" }} />
      </div>
      <h2 className="text-lg font-bold tracking-wide text-white/85">
        {hasActive ? "All caught up!" : "No active proposals"}
      </h2>
      <p className="mt-2 max-w-xs text-sm leading-relaxed text-white/45">
        {hasActive
          ? "You've voted on every proposal. Check back soon."
          : "The voting queue is empty. Place an image on the Loreboard to start a vote."}
      </p>
      {sessionVoteCount > 0 && (
        <div className="mt-3 rounded-full bg-purple-500/10 border border-purple-500/20 px-4 py-1.5 text-xs text-purple-300">
          {sessionVoteCount} vote{sessionVoteCount !== 1 ? "s" : ""} this session
          {sessionVoteCount >= 5 && " \u{1F525}"}
        </div>
      )}
      <Link href="/board"
        className="mt-5 inline-flex items-center gap-2 rounded-xl px-6 py-2.5 text-sm font-semibold tracking-wide transition hover:scale-[1.03]"
        style={{ background: "linear-gradient(135deg,rgba(168,130,255,.2),rgba(255,107,213,.2))", border: "1px solid rgba(168,130,255,.3)", color: "rgba(200,170,255,.95)", boxShadow: "0 0 20px rgba(168,130,255,.15)" }}>
        Go to Loreboard <span aria-hidden="true">&rarr;</span>
      </Link>
    </div>
  );
}
