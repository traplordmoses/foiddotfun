// /src/effects/placementPersonalization.ts
// Pure helpers for deciding whether a just-landed proposal gets a special
// celebration treatment (hacker-mode #1337, thirst-trap #420, nice #69,
// milestone #1 / #100 / #1000, etc.) and if so, which copy to use.
//
// No React, no side effects — kept separate so the celebration component
// stays dumb and the variants are easy to expand + unit-test later.

export type PersonalizationVariant =
  | "default"
  | "milestone-first"
  | "milestone-hundred"
  | "milestone-thousand"
  | "meme-69"
  | "meme-420"
  | "meme-1337"
  | "prime";

export type Personalization = {
  variant: PersonalizationVariant;
  headline: string;
  /** Secondary line shown under the headline. null = omit. */
  subhead: string | null;
  /** Accent hex, drives headline glow + slot-counter border. */
  accent: string;
  /**
   * Optional tier info (phase γ). When present, celebration renders a
   * tier-flavored second subhead line and tints the slab border/glow in
   * tierAccent. Levels 9+ trigger an additional particle burst.
   */
  tierLevel?: number;
  tierName?: string;
  tierSubhead?: string; // e.g. "Certified · 21+ day streak"
  tierAccent?: string;
};

/**
 * Map PrayerTiers level 1–10 to a celebration accent color.
 * Level 0 (unranked) → no tier treatment (returns null).
 * See CLAUDE.md for the canonical Lurker → Mommy Milker table.
 */
export function tierAccentFor(level: number): string | null {
  switch (level) {
    case 1: return "#74ffeb"; // cyan — Lurker
    case 2: return "#a8f0d1"; // mint — NPC
    case 3: return "#72e1ff"; // aqua — Tapped In
    case 4: return "#8faaf2"; // periwinkle — Locked In
    case 5: return "#a78bfa"; // purple — Certified
    case 6: return "#cdb7ff"; // lavender — Undeniable
    case 7: return "#fbbf24"; // gold — Built Different
    case 8: return "#ffa552"; // tangerine — Inevitable
    case 9: return "#f472b6"; // pink — Transcendent (particle burst)
    case 10: return "#e040fb"; // magenta — Mommy Milker (particle burst)
    default: return null;
  }
}

const DEFAULT: Personalization = {
  variant: "default",
  headline: "ENGRAVED",
  subhead: null,
  accent: "#74ffeb",
};

function isPrime(n: number): boolean {
  if (n < 2) return false;
  if (n < 4) return true;
  if (n % 2 === 0) return false;
  for (let i = 3; i * i <= n; i += 2) {
    if (n % i === 0) return false;
  }
  return true;
}

/**
 * Choose a variant for a freshly-confirmed placement. `proposalId` is the
 * on-chain id. `userPlacementCount` is the user's *previous* placement count
 * (not including this one) so e.g. userPlacementCount === 0 means this is
 * their first.
 */
export function pickPersonalization(
  proposalId: number | null,
  userPlacementCount?: number
): Personalization {
  // User milestones take priority over meme numbers.
  if (userPlacementCount === 0) {
    return {
      variant: "milestone-first",
      headline: "FIRST ENGRAVING",
      subhead: "welcome to the loreboard",
      accent: "#fbbf24",
    };
  }
  if (userPlacementCount === 99) {
    return {
      variant: "milestone-hundred",
      headline: "100 ENGRAVED",
      subhead: "certified lurker",
      accent: "#a78bfa",
    };
  }
  if (userPlacementCount === 999) {
    return {
      variant: "milestone-thousand",
      headline: "1000 ENGRAVED",
      subhead: "undeniable",
      accent: "#f472b6",
    };
  }

  if (proposalId != null) {
    if (proposalId === 69) {
      return { variant: "meme-69", headline: "NICE", subhead: "proposal #69", accent: "#f472b6" };
    }
    if (proposalId === 420) {
      return {
        variant: "meme-420",
        headline: "BLAZE IT",
        subhead: "proposal #420",
        accent: "#22c55e",
      };
    }
    if (proposalId === 1337) {
      return {
        variant: "meme-1337",
        headline: "ELITE",
        subhead: "proposal #1337",
        accent: "#06b6d4",
      };
    }
    if (proposalId > 2 && proposalId < 10_000 && isPrime(proposalId)) {
      return {
        variant: "prime",
        headline: "ENGRAVED",
        subhead: `prime #${proposalId}`,
        accent: "#e879f9",
      };
    }
  }

  return DEFAULT;
}
