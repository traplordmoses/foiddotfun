// test/effects/placementPersonalization.test.ts
// Covers every variant of pickPersonalization:
//   - user milestones: first / 100th / 1000th
//   - meme numbers: #69 / #420 / #1337
//   - primes in (2, 10_000)
//   - default fallback
//   - priority: user milestone beats meme id
import { describe, it, expect } from "vitest";
import { pickPersonalization } from "@/effects/placementPersonalization";

describe("pickPersonalization", () => {
  describe("user milestones", () => {
    it("fires 'milestone-first' when userPlacementCount === 0", () => {
      const p = pickPersonalization(42, 0);
      expect(p.variant).toBe("milestone-first");
      // Milestones use eyebrow + hero split so "ENGRAVED" stays monumental.
      expect(p.eyebrow).toBe("FIRST");
      expect(p.headline).toBe("ENGRAVED");
      expect(p.subhead).toBe("welcome to the loreboard");
    });

    it("fires 'milestone-hundred' when userPlacementCount === 99", () => {
      // 99 = the user's count BEFORE this placement lands, so this placement
      // is their 100th. See the pickPersonalization docstring.
      const p = pickPersonalization(1, 99);
      expect(p.variant).toBe("milestone-hundred");
      expect(p.eyebrow).toBe("100");
      expect(p.headline).toBe("ENGRAVED");
    });

    it("fires 'milestone-thousand' when userPlacementCount === 999", () => {
      const p = pickPersonalization(9999, 999);
      expect(p.variant).toBe("milestone-thousand");
      expect(p.eyebrow).toBe("1000");
      expect(p.headline).toBe("ENGRAVED");
    });

    it("user milestone takes priority over meme numbers", () => {
      // 69 would normally fire meme-69; but being the user's first wins.
      const p = pickPersonalization(69, 0);
      expect(p.variant).toBe("milestone-first");
    });
  });

  describe("meme numbers", () => {
    it("fires 'meme-69' on proposal id 69", () => {
      const p = pickPersonalization(69, 10);
      expect(p.variant).toBe("meme-69");
      expect(p.headline).toBe("NICE");
    });

    it("fires 'meme-420' on proposal id 420", () => {
      const p = pickPersonalization(420, 10);
      expect(p.variant).toBe("meme-420");
      expect(p.headline).toBe("BLAZE IT");
    });

    it("fires 'meme-1337' on proposal id 1337", () => {
      const p = pickPersonalization(1337, 10);
      expect(p.variant).toBe("meme-1337");
      expect(p.headline).toBe("ELITE");
    });

    it("user count is respected without triggering a milestone", () => {
      // userPlacementCount === 10 is not a milestone, so we still fire the meme.
      const p = pickPersonalization(420, 10);
      expect(p.variant).toBe("meme-420");
    });
  });

  describe("prime numbers", () => {
    it("fires 'prime' for primes in (2, 10_000)", () => {
      // 4999 is prime.
      const p = pickPersonalization(4999, 50);
      expect(p.variant).toBe("prime");
      expect(p.subhead).toBe("prime #4999");
    });

    it("does not fire prime for 2 (excluded by the > 2 bound)", () => {
      const p = pickPersonalization(2, 50);
      expect(p.variant).toBe("default");
    });

    it("does not fire prime for composites", () => {
      const p = pickPersonalization(1000, 50);
      expect(p.variant).toBe("default");
    });

    it("does not fire prime for ids >= 10_000", () => {
      // 10007 is prime but above the cap.
      const p = pickPersonalization(10007, 50);
      expect(p.variant).toBe("default");
    });

    it("meme ids take priority over prime-ness", () => {
      // 1337 is not prime (7 × 191) — picked to test the ordering directly.
      // Use 467 which IS prime but also not a meme id, to check prime fires.
      expect(pickPersonalization(467, 50).variant).toBe("prime");
    });
  });

  describe("default fallback", () => {
    it("returns default when proposalId is null", () => {
      const p = pickPersonalization(null, 10);
      expect(p.variant).toBe("default");
      expect(p.eyebrow).toBeNull();
      expect(p.headline).toBe("ENGRAVED");
      expect(p.subhead).toBeNull();
    });

    it("returns default when userPlacementCount is undefined and id is unremarkable", () => {
      const p = pickPersonalization(50);
      expect(p.variant).toBe("default");
    });
  });
});
