/**
 * /.well-known/farcaster.json — manifest field limits.
 *
 * Warpcast validates the manifest on "Submit ownership change" and rejects
 * the whole thing on a single overlong string (tagline was 31 chars against
 * a 30 limit, which blocked domain verification). These are the documented
 * mini app manifest caps; keep the copy inside them.
 */
import { afterEach, describe, expect, it } from "vitest";
import { GET } from "@/app/.well-known/farcaster.json/route";

const LIMITS = {
  name: 32,
  subtitle: 30,
  description: 170,
  tagline: 30,
  ogTitle: 30,
  ogDescription: 100,
} as const;

type Manifest = {
  accountAssociation?: { header?: string; payload?: string; signature?: string };
  miniapp: Record<string, unknown>;
};

async function manifest(): Promise<Manifest> {
  const res = await GET();
  return (await res.json()) as Manifest;
}

afterEach(() => {
  delete process.env.FARCASTER_ACCOUNT_ASSOCIATION;
});

describe("farcaster manifest", () => {
  it("keeps every capped string inside its limit", async () => {
    const { miniapp } = await manifest();
    for (const [field, max] of Object.entries(LIMITS)) {
      const value = miniapp[field];
      expect(typeof value, `${field} should be a string`).toBe("string");
      // Spread to count code points, not UTF-16 units.
      expect([...(value as string)].length, `${field} is over ${max} chars`).toBeLessThanOrEqual(max);
    }
  });

  it("keeps tags within 5 entries of 20 lowercase chars", async () => {
    const { miniapp } = await manifest();
    const tags = miniapp.tags as string[];
    expect(tags.length).toBeLessThanOrEqual(5);
    for (const tag of tags) {
      expect(tag.length).toBeLessThanOrEqual(20);
      expect(tag).toBe(tag.toLowerCase());
      expect(tag).not.toMatch(/\s/);
    }
  });

  it("ships at most 3 screenshots", async () => {
    const { miniapp } = await manifest();
    expect((miniapp.screenshotUrls as string[]).length).toBeLessThanOrEqual(3);
  });

  it("nests the account association exactly once", async () => {
    // The route wraps the env value in `accountAssociation` itself, so the
    // var holds only the inner object. Pasting Warpcast's copy block whole
    // produces accountAssociation.accountAssociation and fails verification.
    process.env.FARCASTER_ACCOUNT_ASSOCIATION = JSON.stringify({
      header: "h",
      payload: "p",
      signature: "s",
    });
    const parsed = await manifest();
    expect(parsed.accountAssociation).toEqual({ header: "h", payload: "p", signature: "s" });
    expect(parsed.accountAssociation).not.toHaveProperty("accountAssociation");
  });

  it("omits the association when the env var is unset or malformed", async () => {
    expect((await manifest()).accountAssociation).toBeUndefined();
    process.env.FARCASTER_ACCOUNT_ASSOCIATION = "not json";
    expect((await manifest()).accountAssociation).toBeUndefined();
  });
});
