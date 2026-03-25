// lib/manifestOnChain.ts
// Simple loader for the latest on-chain manifest via IPFS
// ⚠️ DEPRECATED: Use useLatestManifestFromChain() hook instead for dynamic CID from contract

import { debug } from "@/lib/debug";

const FALLBACK_MANIFEST_CID = "QmXaauLefqxRhFcaMi3WN4P87GBe6GVirfDMR3qqpPVma4";

const IPFS_GATEWAYS = [
  "https://ipfs.io/ipfs/",
  "https://cloudflare-ipfs.com/ipfs/",
  "https://gateway.pinata.cloud/ipfs/",
  "https://dweb.link/ipfs/",
];

interface ManifestData {
  epoch?: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  placements?: any[];
  finalizedAt?: number;
}

/**
 * Fetch the latest manifest from IPFS using multiple gateways for reliability
 * @param cid - The IPFS CID to fetch (should come from useLatestManifestFromChain hook)
 */
export async function fetchLatestManifestFromIPFS(
  cid: string = FALLBACK_MANIFEST_CID
): Promise<ManifestData> {
  debug.log("[manifestOnChain] 📦 Fetching manifest from IPFS:", cid);

  let lastError: Error | null = null;

  // Try each gateway until one succeeds
  for (const gateway of IPFS_GATEWAYS) {
    try {
      const url = `${gateway}${cid}`;
      debug.log(`[manifestOnChain] Trying: ${url}`);

      const response = await fetch(url, {
        headers: {
          Accept: "application/json",
        },
        // Add timeout
        signal: AbortSignal.timeout(10000), // 10 second timeout
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      debug.log("[manifestOnChain] ✅ Success! Placements:", data?.placements?.length ?? 0);

      return data;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      debug.warn(`[manifestOnChain] ⚠️ Gateway failed:`, err);
      // Continue to next gateway
    }
  }

  // All gateways failed
  throw new Error(`Failed to load manifest from all gateways. Last error: ${lastError?.message}`);
}

/**
 * Get fallback manifest CID for offline/error scenarios only
 * ⚠️ DEPRECATED: Use useLatestManifestFromChain() hook instead
 * This fallback should only be used when the contract is unreachable
 */
export function getFallbackManifestCID(): string {
  debug.warn('[manifestOnChain] ⚠️ Using fallback CID - contract read should be preferred');
  return FALLBACK_MANIFEST_CID;
}

/**
 * @deprecated Use useLatestManifestFromChain() hook to read CID from contract
 */
export function getLatestManifestCID(): string {
  debug.error('[manifestOnChain] ❌ DEPRECATED: Use useLatestManifestFromChain() hook instead');
  return getFallbackManifestCID();
}
