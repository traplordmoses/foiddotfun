"use client";

import { useEffect, useMemo, useState } from "react";

const AGENT_EPOCH_ZERO = 1770791951;
const AGENT_EPOCH_LENGTH = 3600;

export const AGENT_VOTE_WINDOW_SEC = 10800;

export type AgentEpochInfo = {
  enabled: boolean;
  index: number;
  secondsLeft: number;
  endsAtSec: number;
  lengthSec: number;
};

function getAgentEpochInfo(nowMs: number): AgentEpochInfo {
  if (typeof window === "undefined") {
    return { enabled: false, index: 0, secondsLeft: 0, endsAtSec: 0, lengthSec: AGENT_EPOCH_LENGTH };
  }
  const nowSec = Math.floor(nowMs / 1000);
  const elapsed = Math.max(0, nowSec - AGENT_EPOCH_ZERO);
  const index = Math.floor(elapsed / AGENT_EPOCH_LENGTH);
  const endsAtSec = AGENT_EPOCH_ZERO + (index + 1) * AGENT_EPOCH_LENGTH;
  const secondsLeft = Math.max(0, endsAtSec - nowSec);
  return { enabled: true, index, secondsLeft, endsAtSec, lengthSec: AGENT_EPOCH_LENGTH };
}

export function useAgentEpoch(): AgentEpochInfo {
  const [mounted, setMounted] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => setMounted(true), []);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  return useMemo(
    () => (mounted ? getAgentEpochInfo(now) : { enabled: false, index: 0, secondsLeft: 0, endsAtSec: 0, lengthSec: AGENT_EPOCH_LENGTH }),
    [mounted, now],
  );
}
