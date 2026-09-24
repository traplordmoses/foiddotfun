import { describe, expect, it } from "vitest";
import { faqEntries, inlineText, paragraphs, summarize } from "@/lib/docText";
import { ABOUT_DOCS } from "@/content/aboutDocs";

describe("docText", () => {
  it("strips inline markdown", () => {
    expect(inlineText("Start at [/pray](/pray) with **Foid Mommy** and `0.001 ETH`.")).toBe("Start at /pray with Foid Mommy and 0.001 ETH.");
  });

  it("drops headings, rules and list markers", () => {
    expect(paragraphs("# TITLE\n\nFirst para.\n\n---\n\n- one\n- two\n\n## Sub\n\nLast.")).toEqual(["First para.", "one two", "Last."]);
  });

  it("summarizes to whole sentences within the limit", () => {
    const body = "# X\n\nShort tag.\n\n" + "This sentence is long enough to describe the page in a useful way for search. ".repeat(4);
    const summary = summarize(body, 158);
    expect(summary.length).toBeLessThanOrEqual(158);
    expect(summary.endsWith(".")).toBe(true);
    expect(summary.startsWith("This sentence")).toBe(true);
  });

  it("gives every real doc a usable description", () => {
    for (const doc of ABOUT_DOCS) {
      const summary = summarize(doc.body);
      expect(summary.length, doc.id).toBeGreaterThan(50);
      expect(summary.length, doc.id).toBeLessThanOrEqual(160);
    }
  });

  it("extracts FAQ pairs from question headings only", () => {
    const faq = faqEntries("# FAQ\n\nIntro.\n\n## Why?\n\nBecause **fun**.\n\n## Not a question\n\nSkip.\n\n## How much?\n\n0.001 ETH.");
    expect(faq).toEqual([
      { question: "Why?", answer: "Because fun." },
      { question: "How much?", answer: "0.001 ETH." },
    ]);
    const real = ABOUT_DOCS.find((d) => d.id === "faq");
    expect(real && faqEntries(real.body).length).toBeGreaterThan(5);
  });
});
