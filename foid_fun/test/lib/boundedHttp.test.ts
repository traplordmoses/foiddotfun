import { afterEach, describe, expect, it, vi } from "vitest";
import { BodyTooLargeError, fetchBounded, readBoundedBody } from "@/lib/boundedHttp";
afterEach(() => vi.unstubAllGlobals());
describe("bounded upstream bodies", () => {
  it("rejects a declared oversized body before reading it", async () => {
    const cancel = vi.fn();
    const body = new ReadableStream({ cancel });
    await expect(readBoundedBody(new Response(body, { headers: { "content-length": "100" } }), 10)).rejects.toBeInstanceOf(BodyTooLargeError);
    expect(cancel).toHaveBeenCalledOnce();
  });
  it("enforces the limit while streaming without Content-Length", async () => {
    const cancel = vi.fn();
    const body = new ReadableStream({ start(c) { c.enqueue(new Uint8Array(6)); c.enqueue(new Uint8Array(6)); }, cancel });
    await expect(readBoundedBody(new Response(body), 10)).rejects.toBeInstanceOf(BodyTooLargeError);
    expect(cancel).toHaveBeenCalledOnce();
  });
  it("accepts a body exactly at its limit", async () => {
    const bytes = await readBoundedBody(new Response("hello"), 5);
    expect(new TextDecoder().decode(bytes)).toBe("hello");
  });
  it("keeps the deadline active after headers arrive", async () => {
    const cancel = vi.fn();
    vi.stubGlobal("fetch", vi.fn(async () => new Response(new ReadableStream({ start(c) { c.enqueue(new Uint8Array(1)); }, cancel }))));
    await expect(fetchBounded("https://upstream.test", {}, 10, 20)).rejects.toMatchObject({ name: "TimeoutError" });
    expect(cancel).toHaveBeenCalledOnce();
  });
  it("cancels body consumption when the caller disconnects", async () => {
    const controller = new AbortController();
    vi.stubGlobal("fetch", vi.fn(async () => new Response(new ReadableStream())));
    const pending = fetchBounded("https://upstream.test", { signal: controller.signal }, 10, 1000);
    controller.abort();
    await expect(pending).rejects.toMatchObject({ name: "AbortError" });
  });
});
