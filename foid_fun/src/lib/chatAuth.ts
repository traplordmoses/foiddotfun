/**
 * Chat send authentication — EIP-191 personal-sign message contract.
 *
 * The client signs exactly what the server verifies, so the canonical
 * message string lives here and NOWHERE else. Any drift between the two
 * sides turns every send into a 401.
 *
 * Replay protection is timestamp-based (no server-side nonce store — the
 * route runs on serverless instances with no shared memory). A captured
 * signature is only replayable by whoever already sent the message, within
 * the freshness window, as the same wallet and text — which the rate limit
 * already bounds.
 */

/** Signatures older than this are rejected. */
export const CHAT_SIG_MAX_AGE_MS = 5 * 60 * 1000;

/** Allowance for client clock skew — timestamps further in the future are rejected. */
export const CHAT_SIG_MAX_FUTURE_SKEW_MS = 2 * 60 * 1000;

/**
 * The exact string the wallet signs for a chat send. Shown verbatim in
 * wallet signing prompts (MetaMask etc.), so it stays human-readable.
 *
 * The wallet is lowercased inside the builder so both sides produce
 * byte-identical output regardless of address casing.
 */
export function buildChatSignMessage(
  wallet: string,
  message: string,
  timestamp: number
): string {
  return [
    "FOID board chat",
    "",
    message,
    "",
    `Wallet: ${wallet.toLowerCase()}`,
    `Timestamp: ${timestamp}`,
  ].join("\n");
}
