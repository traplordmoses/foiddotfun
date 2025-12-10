import { getAddress } from "viem";

function safeAddress(addr?: string | null): `0x${string}` | undefined {
  if (!addr) return undefined;
  try {
    return getAddress(addr);
  } catch (err) {
    console.warn("[contracts] invalid address env", addr, err);
    return undefined;
  }
}

// Try multiple env keys so a single bad value doesn't brick the board.
const manifestStoreCandidates = [
  process.env.NEXT_PUBLIC_LOREBOARD_MANIFEST_STORE_ADDRESS,
  process.env.NEXT_PUBLIC_LOREBOARD_ANCHOR,
  process.env.NEXT_PUBLIC_MANIFEST_STORE,
  process.env.NEXT_PUBLIC_MANIFEST_STORE_ADDRESS,
];

export const LOREBOARD_MANIFEST_STORE_ADDRESS = manifestStoreCandidates
  .map((v) => safeAddress(v))
  .find(Boolean);
