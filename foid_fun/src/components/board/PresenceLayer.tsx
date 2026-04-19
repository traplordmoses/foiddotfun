// /src/components/board/PresenceLayer.tsx
// Renders all remote cursor ghosts as children of `.board-stage`. Because
// the stage owns the pan+zoom transform, these absolutely-positioned
// children inherit it automatically — no manual conversion required.
"use client";

import type { PresenceState } from "@/hooks/board/usePresence";
import { CursorGhost } from "./CursorGhost";

type Props = {
  peers: Map<string, PresenceState>;
};

export function PresenceLayer({ peers }: Props) {
  if (peers.size === 0) return null;
  return (
    <>
      {Array.from(peers.values()).map((p) => (
        <CursorGhost key={p.sessionId} state={p} />
      ))}
    </>
  );
}
