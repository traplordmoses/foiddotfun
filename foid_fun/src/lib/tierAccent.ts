/**
 * Tier-reactive accent color: cool cyan-mint (fresh wallet) → warm gold
 * (high-streak wallet). Used for the --pray-accent CSS custom property on
 * the pray page root, so the whole surface evolves as the user's tier climbs.
 *
 * Map is keyed by tier level (0–10). Level 0 is the unconnected/default state.
 */
const ACCENT_MAP: Record<number, string> = {
  0: "#6eead8",
  1: "#6eead8",
  2: "#7adcd0",
  3: "#8ed0c4",
  4: "#a4c2b1",
  5: "#bab49b",
  6: "#caa585",
  7: "#d49a6f",
  8: "#dc8f56",
  9: "#d88040",
  10: "#d8b56e",
};

export function tierAccent(level: number): string {
  return ACCENT_MAP[level] ?? "#6eead8";
}
