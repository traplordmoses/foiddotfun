// test/lib/ipfsUrl.test.ts
// Candidate-list shape for IPFS images:
//   1. The same-origin proxy comes first and carries the transform query.
//   2. A dedicated Pinata gateway fallback carries the equivalent img-*
//      params, so a stalled proxy falls back to a right-sized variant and
//      not the full original.
//   3. Public gateways are left untouched (they ignore transform params).
//   4. Without transform opts nothing is decorated.
// The gateway list is read from env at module load, so each case resets
// the module registry and imports fresh.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const ENV_KEYS = [
  "NEXT_PUBLIC_IPFS_GATEWAY_BASE",
  "NEXT_PUBLIC_IPFS_GATEWAY",
  "NEXT_PUBLIC_IPFS_PROXY_PATH",
] as const;
const saved: Partial<Record<(typeof ENV_KEYS)[number], string | undefined>> = {};

async function load(env: Partial<Record<(typeof ENV_KEYS)[number], string>>) {
  for (const k of ENV_KEYS) delete process.env[k];
  Object.assign(process.env, env);
  vi.resetModules();
  return import("@/lib/ipfsUrl");
}

const CID = "QmWXzPdj8enMUcQmyns81YoVZVccqABNBUPQrtHyW3bZjY";

describe("ipfsImageUrls", () => {
  beforeEach(() => {
    for (const k of ENV_KEYS) saved[k] = process.env[k];
  });
  afterEach(() => {
    for (const k of ENV_KEYS) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
    vi.resetModules();
  });

  it("puts the proxy first with the transform query", async () => {
    const { ipfsImageUrls } = await load({
      NEXT_PUBLIC_IPFS_PROXY_PATH: "/api/ipfs",
      NEXT_PUBLIC_IPFS_GATEWAY_BASE: "https://example.mypinata.cloud",
    });
    const urls = ipfsImageUrls(CID, { width: 128, format: "webp", quality: 80 });
    expect(urls[0]).toBe(`/api/ipfs/${CID}?w=128&f=webp&q=80`);
  });

  it("mirrors the transforms onto the dedicated Pinata fallback only", async () => {
    const { ipfsImageUrls } = await load({
      NEXT_PUBLIC_IPFS_PROXY_PATH: "/api/ipfs",
      NEXT_PUBLIC_IPFS_GATEWAY_BASE: "https://example.mypinata.cloud",
    });
    const urls = ipfsImageUrls(CID, { width: 128, format: "webp", quality: 80 });
    const dedicated = new URL(urls[1]);
    expect(dedicated.hostname).toBe("example.mypinata.cloud");
    expect(dedicated.pathname).toBe(`/ipfs/${CID}`);
    expect(dedicated.searchParams.get("img-width")).toBe("128");
    expect(dedicated.searchParams.get("img-dpr")).toBe("2");
    expect(dedicated.searchParams.get("img-format")).toBe("webp");
    expect(dedicated.searchParams.get("img-quality")).toBe("80");
    expect(dedicated.searchParams.get("img-fit")).toBe("cover");
    // Public gateways: bare CID paths, no query.
    for (const u of urls.slice(2)) {
      expect(u).toMatch(/^https:\/\/[^/]+\/ipfs\/Qm[^?]+$/);
    }
  });

  it("accepts a full gateway URL as the source and still proxies it", async () => {
    const { ipfsImageUrls } = await load({
      NEXT_PUBLIC_IPFS_PROXY_PATH: "/api/ipfs",
      NEXT_PUBLIC_IPFS_GATEWAY_BASE: "https://example.mypinata.cloud",
    });
    const urls = ipfsImageUrls(`https://example.mypinata.cloud/ipfs/${CID}`, { width: 32 });
    expect(urls[0]).toBe(`/api/ipfs/${CID}?w=32`);
  });

  it("leaves every candidate undecorated without transform opts", async () => {
    const { ipfsImageUrls } = await load({
      NEXT_PUBLIC_IPFS_PROXY_PATH: "/api/ipfs",
      NEXT_PUBLIC_IPFS_GATEWAY_BASE: "https://example.mypinata.cloud",
    });
    const urls = ipfsImageUrls(CID);
    expect(urls[0]).toBe(`/api/ipfs/${CID}`);
    expect(urls[1]).toBe(`https://example.mypinata.cloud/ipfs/${CID}`);
    expect(urls.some((u) => u.includes("?"))).toBe(false);
  });

  it("falls back to gateways alone when no proxy is configured", async () => {
    const { ipfsImageUrls, isProxyCandidate } = await load({
      NEXT_PUBLIC_IPFS_GATEWAY_BASE: "https://ipfs.io",
    });
    const urls = ipfsImageUrls(CID, { width: 64 });
    expect(urls[0]).toBe(`https://ipfs.io/ipfs/${CID}`);
    expect(urls.some(isProxyCandidate)).toBe(false);
  });
});
