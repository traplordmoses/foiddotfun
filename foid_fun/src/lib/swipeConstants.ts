import { CHAIN_ID } from "@/config/canonical";
import { CONTRACTS } from "@/lib/contracts/addresses";
import { ipfsToHttp } from "@/lib/ipfsUrl";

/* ─── EIP-712 domain & types (shared between client + server) ─── */

export const EIP712_DOMAIN = {
  name: "FoidSwipe",
  version: "1",
  chainId: CHAIN_ID,
  verifyingContract: CONTRACTS.SWIPE as `0x${string}`,
} as const;

export const EIP712_TYPES = {
  SwipeVote: [
    { name: "proposalId", type: "uint256" },
    { name: "approve", type: "bool" },
    { name: "deadline", type: "uint256" },
  ],
} as const;

/* ─── UI helpers ─── */

export function tryNextGateway(el: HTMLImageElement, cid?: string) {
  if (!cid) return;
  const urls = ipfsToHttp(cid);
  const idx = Number(el.dataset.gatewayIndex ?? "-1") + 1;
  if (idx < urls.length) {
    el.src = urls[idx];
    el.dataset.gatewayIndex = String(idx);
  }
}

export function truncateAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export const CARD_VISUALS = [
  { gradient: "linear-gradient(135deg, #1a0a2e 0%, #3d1a6e 50%, #0f0c29 100%)", symbol: "\u2694\uFE0F" },
  { gradient: "linear-gradient(135deg, #0a1a2e 0%, #1a3d6e 50%, #0c1929 100%)", symbol: "\u{1F6E1}\uFE0F" },
  { gradient: "linear-gradient(135deg, #2e0a1a 0%, #6e1a3d 50%, #290c0f 100%)", symbol: "\u2620\uFE0F" },
  { gradient: "linear-gradient(135deg, #0a2e1a 0%, #1a6e3d 50%, #0c290f 100%)", symbol: "\u{1F451}" },
  { gradient: "linear-gradient(135deg, #2e2e0a 0%, #6e6e1a 50%, #29290c 100%)", symbol: "\u{1F525}" },
  { gradient: "linear-gradient(135deg, #0a0a2e 0%, #1a1a6e 50%, #0c0c29 100%)", symbol: "\u{1F30C}" },
] as const;

/* ─── Vote weight tier labels ─── */

export function tierLabel(weight: number): string {
  if (weight >= 500) return "Foid Sovereign";
  if (weight >= 250) return "Oracle";
  if (weight >= 150) return "Devotee";
  return "Whisper";
}

export function tierMultiplier(weight: number): string {
  return `${(weight / 100).toFixed(1)}x`;
}
