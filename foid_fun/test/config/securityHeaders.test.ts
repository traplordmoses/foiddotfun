/**
 * next.config.mjs — framing policy.
 *
 * Farcaster and Base clients render a mini app inside an iframe. The audit
 * shipped `frame-ancestors 'none'` plus `X-Frame-Options: DENY`, which let
 * the app open in the native apps (a webview has no frame ancestor) while
 * every web client got a blank box. The policy is now an allowlist in CSP,
 * and X-Frame-Options is gone because it has no allowlist form.
 *
 * Imported by file URL: next.config.mjs is plain JS and the project sets
 * allowJs: false, so a static import would not typecheck.
 */
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";

type HeaderRule = { source: string; headers: { key: string; value: string }[] };

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CONFIG = pathToFileURL(path.resolve(HERE, "../../next.config.mjs")).href;

async function globalHeaders(): Promise<{ key: string; value: string }[]> {
  const mod = (await import(/* @vite-ignore */ CONFIG)) as {
    default: { headers: () => Promise<HeaderRule[]> };
  };
  const rules = await mod.default.headers();
  const global = rules.find((r) => r.source === "/(.*)");
  if (!global) throw new Error("no global header rule in next.config.mjs");
  return global.headers;
}

function directive(csp: string, name: string): string {
  const found = csp
    .split(";")
    .map((d) => d.trim())
    .find((d) => d === name || d.startsWith(`${name} `));
  if (!found) throw new Error(`no ${name} directive in the CSP`);
  return found;
}

describe("framing policy", () => {
  it("admits the Farcaster and Base web clients", async () => {
    const csp = (await globalHeaders()).find((h) => h.key === "Content-Security-Policy")!.value;
    const ancestors = directive(csp, "frame-ancestors");
    for (const origin of [
      "'self'",
      "https://farcaster.xyz",
      "https://*.farcaster.xyz",
      "https://base.org",
      "https://*.base.org",
      "https://wallet.coinbase.com",
    ]) {
      expect(ancestors, `frame-ancestors is missing ${origin}`).toContain(origin);
    }
  });

  it("still refuses everyone else", async () => {
    const csp = (await globalHeaders()).find((h) => h.key === "Content-Security-Policy")!.value;
    const ancestors = directive(csp, "frame-ancestors");
    // A bare wildcard would let any site frame the embedded wallet's PIN entry.
    expect(ancestors.split(/\s+/)).not.toContain("*");
    expect(ancestors).not.toContain("'none'");
  });

  it("sends no X-Frame-Options, which cannot express an allowlist", async () => {
    const keys = (await globalHeaders()).map((h) => h.key.toLowerCase());
    expect(keys).not.toContain("x-frame-options");
  });

  it("keeps the rest of the hardening in place", async () => {
    const headers = await globalHeaders();
    const csp = headers.find((h) => h.key === "Content-Security-Policy")!.value;
    expect(directive(csp, "object-src")).toBe("object-src 'none'");
    expect(directive(csp, "base-uri")).toBe("base-uri 'self'");
    expect(headers.map((h) => h.key)).toContain("X-Content-Type-Options");
    expect(headers.map((h) => h.key)).toContain("Referrer-Policy");
  });
});
