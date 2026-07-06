/**
 * Board mutation authentication — EIP-191 personal-sign message contracts for
 * /api/place and /api/propose.
 *
 * Same discipline as chatAuth.ts: the client signs exactly what the server
 * verifies, so the canonical message strings live here and NOWHERE else. Any
 * drift between the two sides turns every request into a 401.
 *
 * Replay protection is timestamp-based (no server-side nonce store — the
 * routes run on serverless instances with no shared memory). A captured
 * signature is only replayable by whoever already controls the wallet, within
 * the freshness window, over the same canonical fields — which the existing
 * per-owner cooldown / rate limit already bounds.
 */

/** Signatures older than this are rejected. */
export const BOARD_SIG_MAX_AGE_MS = 5 * 60 * 1000;

/** Allowance for client clock skew — timestamps further in the future are rejected. */
export const BOARD_SIG_MAX_FUTURE_SKEW_MS = 2 * 60 * 1000;

/**
 * The exact string the wallet signs to place a pixel-rect intent. Covers every
 * field the server trusts to attribute and price the placement, so none of them
 * can be swapped after signing. Kept human-readable — it shows verbatim in
 * wallet signing prompts (MetaMask etc.).
 *
 * The wallet is lowercased inside the builder so both sides produce
 * byte-identical output regardless of address casing.
 */
export function buildPlaceSignMessage(params: {
  owner: string;
  cid: string;
  rect: { x: number; y: number; w: number; h: number };
  cells: number;
  feePerCellWei: string;
  tipPerCellWei: string;
  timestamp: number;
}): string {
  const { owner, cid, rect, cells, feePerCellWei, tipPerCellWei, timestamp } =
    params;
  return [
    "FOID board place",
    "",
    `CID: ${cid}`,
    `Rect: ${rect.x},${rect.y},${rect.w},${rect.h}`,
    `Cells: ${cells}`,
    `Fee/cell: ${feePerCellWei}`,
    `Tip/cell: ${tipPerCellWei}`,
    "",
    `Owner: ${owner.toLowerCase()}`,
    `Timestamp: ${timestamp}`,
  ].join("\n");
}

/**
 * The exact string the wallet signs to submit a placement proposal. Covers the
 * mutating, spendable fields (image, rect, bid) plus the owner + timestamp.
 */
export function buildProposeSignMessage(params: {
  owner: string;
  cid: string;
  rect: { x: number; y: number; w: number; h: number };
  bidPerCellWei: string;
  timestamp: number;
}): string {
  const { owner, cid, rect, bidPerCellWei, timestamp } = params;
  return [
    "FOID board propose",
    "",
    `CID: ${cid}`,
    `Rect: ${rect.x},${rect.y},${rect.w},${rect.h}`,
    `Bid/cell: ${bidPerCellWei}`,
    "",
    `Owner: ${owner.toLowerCase()}`,
    `Timestamp: ${timestamp}`,
  ].join("\n");
}
