// src/lib/docText.ts
// Plain-text helpers over the MarkdownLite subset used by src/content
// (headings, paragraphs, "- " lists, "---", **bold**, `code`, [text](url)).
// Used for meta descriptions and structured data, never for rendering.

/** Strip the inline syntax from one line of MarkdownLite. */
export function inlineText(line: string): string {
  return line
    .replace(/\[([^\]]+)\]\([^()\s]+\)/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

/** Paragraph blocks (no headings, rules or list markers), inline syntax stripped. */
export function paragraphs(markdown: string): string[] {
  return markdown
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter((block) => block && !/^#{1,3} /.test(block) && block !== "---")
    .map((block) =>
      inlineText(
        block
          .split("\n")
          .map((line) => line.replace(/^- /, ""))
          .join(" "),
      ),
    )
    .filter(Boolean);
}

/** A meta-description-sized summary: whole sentences up to `max` chars,
 *  skipping one-line taglines too short to describe anything. */
export function summarize(markdown: string, max = 158): string {
  const source = paragraphs(markdown).filter((p) => p.length >= 60);
  const text = (source.length ? source : paragraphs(markdown)).slice(0, 2).join(" ");
  if (text.length <= max) return text;
  const sentences = text.match(/[^.!?]+[.!?]+(\s|$)/g) ?? [];
  let out = "";
  for (const sentence of sentences) {
    if ((out + sentence).trim().length > max) break;
    out += sentence;
  }
  if (out.trim()) return out.trim();
  const cut = text.slice(0, max - 1);
  return `${cut.slice(0, cut.lastIndexOf(" "))}…`;
}

/** Question/answer pairs from "## Question?" sections, for FAQPage data. */
export function faqEntries(markdown: string): Array<{ question: string; answer: string }> {
  const out: Array<{ question: string; answer: string }> = [];
  const sections = markdown.split(/^## /m).slice(1);
  for (const section of sections) {
    const newline = section.indexOf("\n");
    const question = inlineText(newline === -1 ? section : section.slice(0, newline));
    if (!question.endsWith("?")) continue;
    const answer = paragraphs(newline === -1 ? "" : section.slice(newline + 1)).join(" ");
    if (answer) out.push({ question, answer });
  }
  return out;
}
