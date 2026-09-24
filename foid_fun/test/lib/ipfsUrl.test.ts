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

  it("puts the edge-cacheable proxy path first for sized WebP tiles", async () => {
    const { ipfsImageUrls } = await load({
      NEXT_PUBLIC_IPFS_PROXY_PATH: "/api/ipfs",
      NEXT_PUBLIC_IPFS_GATEWAY_BASE: "https://example.mypinata.cloud",
    });
    const urls = ipfsImageUrls(CID, { width: 128, format: "webp", quality: 80 });
    expect(urls[0]).toBe(`/img/ipfs/${CID}.webp?w=128&f=webp&q=80`);
  });

  it("uses the edge path without deployment env and keeps a custom proxy", async () => {
    const bare = await load({});
    expect(bare.ipfsImageUrls(CID, { width: 64, format: "webp" })[0]).toBe(`/img/ipfs/${CID}.webp?w=64&f=webp`);
    const custom = await load({ NEXT_PUBLIC_IPFS_PROXY_PATH: "https://cdn.example/ipfs" });
    expect(custom.ipfsImageUrls(CID, { width: 64, format: "webp" })[0]).toBe(`https://cdn.example/ipfs/${CID}?w=64&f=webp`);
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

  it("uses the bundled thumbnail proxy without deployment configuration", async () => {
    const { ipfsImageUrls, isProxyCandidate } = await load({
      NEXT_PUBLIC_IPFS_GATEWAY_BASE: "https://ipfs.io",
    });
    const urls = ipfsImageUrls(CID, { width: 64 });
    expect(urls[0]).toBe(`/api/ipfs/${CID}?w=64`);
    expect(urls[1]).toBe(`https://ipfs.io/ipfs/${CID}`);
    expect(urls.some(isProxyCandidate)).toBe(true);
    expect(ipfsImageUrls(CID)[0]).toBe(`https://ipfs.io/ipfs/${CID}`);
  });
});

describe("ipfsToHttp with non-IPFS URLs", () => {
  afterEach(() => { vi.resetModules(); });

  it("passes ordinary https URLs through untouched", async () => {
    const { ipfsToHttp, extractIpfsCid } = await load({
      NEXT_PUBLIC_IPFS_GATEWAY_BASE: "https://example.mypinata.cloud",
    });
    const media = "https://media.foid.fun/media/sybau-heartbreak.jpg";
    expect(extractIpfsCid(media)).toBeNull();
    expect(ipfsToHttp(media)).toEqual([media]);
  });

  it("still extracts the CID from gateway and proxy URLs", async () => {
    const { extractIpfsCid } = await load({});
    expect(extractIpfsCid(`https://gw.example/ipfs/${CID}`)).toBe(CID);
    expect(extractIpfsCid(`https://foid.fun/api/ipfs/${CID}?w=64`)).toBe(CID);
    expect(extractIpfsCid(`ipfs://${CID}`)).toBe(CID);
    expect(extractIpfsCid(CID)).toBe(CID);
  });
});
