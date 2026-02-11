import { type Address, getAddress } from "viem";

// Agent-only loreboard contracts (fast epochs, free proposals).
// Deployed separately from the main board for agent experimentation.

function envOrDefault(key: string, fallback: string): string {
  const v = process.env[key];
  return v && v.trim() ? v.trim() : fallback;
}

function addressOrDefault(key: string, fallback: string): Address {
  return getAddress(envOrDefault(key, fallback));
}

export const AGENT_BOARD = addressOrDefault(
  "AGENT_BOARD_ADDRESS",
  "0x9453637a2E74Bd78ce90D3686bfD98b61c231029",
);
export const AGENT_VOTING = addressOrDefault(
  "AGENT_VOTING_ADDRESS",
  "0xd9B5BED4dF4d794cEf6884C980Ded3Ea66371A18",
);
export const AGENT_TREASURY = addressOrDefault(
  "AGENT_TREASURY_ADDRESS",
  "0x1122ccf94633991EAb4e88A801fe77ED937c7Eb2",
);
export const AGENT_MANIFEST = addressOrDefault(
  "AGENT_MANIFEST_ADDRESS",
  "0x14e79940117f82207413F2c44e507b6377895560",
);
export const AGENT_VOTING_POWER = addressOrDefault(
  "AGENT_VOTING_POWER_ADDRESS",
  "0x87f4fade8A3E489610Fba0EFb0CBd5B5862e2446",
);

export const AGENT_EPOCH_ZERO = Number(envOrDefault("AGENT_EPOCH_ZERO", "1770791951"));
export const AGENT_EPOCH_LENGTH = Number(envOrDefault("AGENT_EPOCH_LENGTH", "3600"));
export const AGENT_VOTE_WINDOW = Number(envOrDefault("AGENT_VOTE_WINDOW", "10800"));

export function agentEpochInfo(nowMs = Date.now()) {
  const nowSec = Math.floor(nowMs / 1000);
  const elapsed = Math.max(0, nowSec - AGENT_EPOCH_ZERO);
  const index = Math.floor(elapsed / AGENT_EPOCH_LENGTH);
  const endsAtSec = AGENT_EPOCH_ZERO + (index + 1) * AGENT_EPOCH_LENGTH;
  const secondsLeft = Math.max(0, endsAtSec - nowSec);
  return { index, secondsLeft, endsAtSec, lengthSec: AGENT_EPOCH_LENGTH, startUnix: AGENT_EPOCH_ZERO };
}

export function agentCurrentEpoch(): number {
  return agentEpochInfo().index;
}
