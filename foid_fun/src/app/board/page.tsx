"use client";

// MIFOID_LOREBOARD.APP route (/board) — thin wrapper around the extracted
// BoardAppCore (src/apps/BoardApp.tsx). The app content is shared verbatim
// with the desktop shell's BOARD window (multi-window plan §4): the route
// presentation renders today's page exactly — mobile tree + desktop main
// (particles, vista-window, titlebar) — inside the same ErrorBoundary +
// Suspense this page always had. board.css now loads via BoardApp.
//
// board/layout.tsx keeps `dynamic = "force-dynamic"` for this route; the
// shell mounts BoardApp with ssr:false so the home route needs no such
// treatment.

import { Suspense } from "react";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { BoardAppCore } from "@/apps/BoardApp";

export default function BoardPage() {
  return (
    <ErrorBoundary
      route="board"
      title="Board Error"
      description="Something went wrong loading the board. This has been logged."
    >
      <Suspense
        fallback={
          <main className="min-h-screen w-full flex items-center justify-center px-4">
            <div className="font-terminal text-xs uppercase tracking-[0.16em] text-white/70 flex items-center gap-3">
              <span className="inline-block h-4 w-4 rounded-full border-2 border-cyan-100/35 border-t-cyan-100 animate-spin" />
              loading board...
            </div>
          </main>
        }
      >
        <BoardAppCore presentation="route" />
      </Suspense>
    </ErrorBoundary>
  );
}
