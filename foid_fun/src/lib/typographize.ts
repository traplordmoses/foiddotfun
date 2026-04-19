/**
 * Typographic polish for Mommy's spoken text.
 *
 * Applied ONLY to foid/mommy-role messages at render-queue time — never to
 * user input or system messages. Keeps typed-animation output clean by
 * running before the char-by-char reveal so curly quotes animate in.
 *
 * Transforms:
 *   "..."  → "…"            (horizontal ellipsis)
 *   " - "  → " — "          (em dash when surrounded by spaces)
 *   '"..."' → '"..."'       (curly double quotes, paired)
 *   "'"    → "'"            (curly apostrophe inside contractions)
 *
 * The contraction regex is intentionally lazy: it catches don't/it's/we're
 * but also rewrites plurals-with-apostrophe (nope's). That edge case is
 * acceptable — correctness over Mommy's casual voice is a non-goal.
 */
export function typographize(input: string): string {
  if (!input) return input;
  let out = input;

  // Ellipsis: three dots (with optional spaces between) → …
  out = out.replace(/\.{3}/g, "\u2026");

  // Em-dash: " - " (spaces on both sides) → " — "
  out = out.replace(/ - /g, " \u2014 ");

  // Curly double quotes — pair them left→right.
  // Opening quote: start of string, or preceded by whitespace / ( / [.
  out = out.replace(/(^|[\s(\[])"/g, "$1\u201C");
  // Any remaining " → closing curly quote.
  out = out.replace(/"/g, "\u201D");

  // Curly apostrophe inside contractions: letter'letter → letter’letter.
  out = out.replace(/([a-zA-Z])'([a-zA-Z])/g, "$1\u2019$2");

  return out;
}
