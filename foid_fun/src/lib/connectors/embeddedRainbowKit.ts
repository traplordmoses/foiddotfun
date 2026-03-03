/**
 * RainbowKit wallet definition for the DIY embedded wallet.
 *
 * Appears as "FOID Wallet" in the RainbowKit connect modal —
 * first option, no install needed.
 */
import type { Wallet } from "@rainbow-me/rainbowkit";
import { embeddedWalletConnector } from "./embeddedConnector";

// Inline SVG data-URI for the wallet icon (purple diamond)
const ICON =
  "data:image/svg+xml," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48">
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#a855f7"/>
          <stop offset="100%" stop-color="#ec4899"/>
        </linearGradient>
      </defs>
      <rect width="48" height="48" rx="12" fill="#1c2030"/>
      <path d="M24 8 L40 24 L24 40 L8 24 Z" fill="url(#g)"/>
      <text x="24" y="28" text-anchor="middle" font-size="14" fill="white" font-family="monospace" font-weight="bold">F</text>
    </svg>`,
  );

export const foidEmbeddedWallet = (): Wallet => ({
  id: "foid-embedded",
  name: "FOID Wallet",
  iconUrl: ICON,
  iconBackground: "#1c2030",
  installed: true, // always "installed" — it's built-in
  createConnector: () => embeddedWalletConnector(),
});
