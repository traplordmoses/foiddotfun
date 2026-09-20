import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import sharp from "sharp";
const cid = "Qm" + "a".repeat(44);
const png = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
beforeEach(() => vi.resetModules());
afterEach(() => vi.unstubAllGlobals());
const req = () => new NextRequest(`https://foid.fun/api/ipfs/${cid}`);
describe("image proxy", () => {
  it("rejects HTML even when its upstream MIME claims to be an image", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("<html><script>bad()</script></html>", { headers: { "content-type": "image/png" } })));
    const { GET } = await import("@/app/api/ipfs/[cid]/route");
    expect((await GET(req(), { params: { cid } })).status).toBe(415);
  });
  it("recognizes raster bytes when a gateway returns generic MIME metadata", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(png, { headers: { "content-type": "application/octet-stream" } })));
    const { GET } = await import("@/app/api/ipfs/[cid]/route");
    const res = await GET(req(), { params: { cid } });
    expect(res.status).toBe(200); expect(res.headers.get("content-type")).toBe("image/png");
    expect(res.headers.get("content-security-policy")).toContain("sandbox"); expect(res.headers.get("x-content-type-options")).toBe("nosniff");
  });
  it("coalesces concurrent misses for the same image", async () => {
    const fetcher = vi.fn(async () => new Response(png)); vi.stubGlobal("fetch", fetcher);
    const { GET } = await import("@/app/api/ipfs/[cid]/route");
    const responses = await Promise.all([GET(req(), { params: { cid } }), GET(req(), { params: { cid } })]);
    expect(responses.every((r) => r.ok)).toBe(true); expect(fetcher).toHaveBeenCalledOnce();
  });
  it("resizes public-gateway originals and caches the bounded variant", async () => {
    const source = await sharp({ create: { width: 1200, height: 600, channels: 3, background: "#4689ab" } }).png().toBuffer();
    const fetcher = vi.fn(async () => new Response(new Uint8Array(source)));
    vi.stubGlobal("fetch", fetcher);
    const { GET } = await import("@/app/api/ipfs/[cid]/route");
    const request = new NextRequest(`https://foid.fun/api/ipfs/${cid}?w=128&f=webp`);
    const response = await GET(request, { params: { cid } });
    expect(response.headers.get("content-type")).toBe("image/webp");
    expect(await sharp(Buffer.from(await response.arrayBuffer())).metadata()).toMatchObject({ width: 256, height: 128 });
    expect((await GET(request, { params: { cid } })).headers.get("x-ipfs-proxy-cache")).toBe("HIT");
    expect(fetcher).toHaveBeenCalledOnce();
  });
});
