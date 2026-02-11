import { verifyMessage, getAddress } from "viem";

const MAX_TIMESTAMP_DRIFT_MS = 5 * 60 * 1000; // 5 minutes

export type AuthResult =
  | { ok: true; wallet: `0x${string}` }
  | { ok: false; error: string };

export async function verifyAgentSignature(params: {
  wallet: string;
  signature: string;
  timestamp: number;
  action: string;
  payload: string;
}): Promise<AuthResult> {
  const { wallet, signature, timestamp, action, payload } = params;

  if (!wallet || !signature || !timestamp) {
    return { ok: false, error: "Missing wallet, signature, or timestamp" };
  }

  // Validate timestamp freshness
  const now = Date.now();
  const msgTime = timestamp * 1000; // convert seconds to ms
  if (Math.abs(now - msgTime) > MAX_TIMESTAMP_DRIFT_MS) {
    return { ok: false, error: "Timestamp expired or too far in the future (5 minute window)" };
  }

  // Reconstruct the expected message
  const message = `foid:${action}:${timestamp}:${payload}`;

  try {
    const normalizedWallet = getAddress(wallet) as `0x${string}`;

    const valid = await verifyMessage({
      address: normalizedWallet,
      message,
      signature: signature as `0x${string}`,
    });

    if (!valid) {
      return { ok: false, error: "Invalid signature" };
    }

    return { ok: true, wallet: normalizedWallet };
  } catch {
    return { ok: false, error: "Signature verification failed" };
  }
}
