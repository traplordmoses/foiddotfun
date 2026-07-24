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
      <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
        <Link href="/vote/submit" className="foid-cta-btn inline-flex min-h-11 items-center gap-2 px-6 text-sm font-semibold tracking-wide">
          Propose a meme <span aria-hidden="true">&rarr;</span>
        </Link>
        <Link
          href="/board"
          className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/15 bg-white/[0.06] px-5 text-sm font-semibold text-white/70 transition hover:bg-white/10 hover:text-white"
        >
          View Loreboard
        </Link>
      </div>
    </div>
  );
}
