// Guards the hand-reviewable caption file (scripts/caption-placements.ts)
// against bad edits: every entry must be usable as alt text, a page title
// and a description.
import { describe, expect, it } from "vitest";
import captionsFile from "@/content/placementCaptions.json";

type Caption = { title: string; alt: string; description: string; tags: string[]; sensitive: boolean };
const captions = (captionsFile as { captions: Record<string, Caption> }).captions;

describe("placement captions", () => {
  it("has entries keyed by IPFS CIDs", () => {
    const keys = Object.keys(captions);
    expect(keys.length).toBeGreaterThan(0);
    for (const cid of keys) expect(cid).toMatch(/^(Qm[1-9A-HJ-NP-Za-km-z]{44}|b[a-z2-7]{58,})$/);
  });

  it("keeps every field within the lengths the pages rely on", () => {
    for (const [cid, c] of Object.entries(captions)) {
      expect(c.title.length, cid).toBeGreaterThan(2);
      expect(c.title.length, cid).toBeLessThanOrEqual(70);
      expect(c.alt.length, cid).toBeGreaterThan(10);
      expect(c.alt.length, cid).toBeLessThanOrEqual(140);
      expect(c.alt, cid).not.toMatch(/^(image|picture|photo) of/i);
      expect(c.description.length, cid).toBeLessThanOrEqual(300);
      expect(c.tags.length, cid).toBeGreaterThan(0);
      expect(c.tags.length, cid).toBeLessThanOrEqual(6);
      expect(typeof c.sensitive, cid).toBe("boolean");
    }
  });
});
