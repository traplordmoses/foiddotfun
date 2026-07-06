// src/components/MarkdownLite.tsx
// Deliberately tiny line-based renderer for the ABOUT.EXE reader.
//
// Supported subset — nothing more:
//   "# " "## " "### "  → h1 / h2 / h3
//   blank-line-separated text → <p>
//   runs of "- "        → <ul><li>
//   "---" on its own    → <hr>
//   inline: **bold**, `code`, [text](url)  (external links open in a new
//   tab with rel="noopener noreferrer"; internal hrefs stay same-tab)
//
// No HTML passthrough, no nesting beyond one inline pass per line. Unknown
// syntax renders as the literal text it is. Keep it dumb and safe.

import React from "react";

type Block =
  | { type: "h1" | "h2" | "h3" | "p"; text: string }
  | { type: "ul"; items: string[] }
  | { type: "hr" };

const INLINE = /(`[^`]+`)|(\*\*[^*]+\*\*)|(\[[^\]]+\]\([^()\s]+\))/g;

function renderInline(text: string): React.ReactNode {
  const out: React.ReactNode[] = [];
  let last = 0;
  let key = 0;
  for (const match of text.matchAll(INLINE)) {
    const index = match.index ?? 0;
    if (index > last) out.push(text.slice(last, index));
    const token = match[0];
    if (token.startsWith("`")) {
      out.push(<code key={key++}>{token.slice(1, -1)}</code>);
    } else if (token.startsWith("**")) {
      out.push(<strong key={key++}>{token.slice(2, -2)}</strong>);
    } else {
      const split = token.indexOf("](");
      const label = token.slice(1, split);
      const href = token.slice(split + 2, -1);
      const external = /^https?:\/\//i.test(href);
      out.push(
        <a
          key={key++}
          href={href}
          {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
        >
          {label}
        </a>,
      );
    }
    last = index + token.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

function parseBlocks(body: string): Block[] {
  const blocks: Block[] = [];
  let paragraph: string[] = [];
  let list: string[] | null = null;

  const flushParagraph = () => {
    if (paragraph.length > 0) {
      blocks.push({ type: "p", text: paragraph.join(" ") });
      paragraph = [];
    }
  };
  const flushList = () => {
    if (list) {
      blocks.push({ type: "ul", items: list });
      list = null;
    }
  };

  for (const raw of body.split("\n")) {
    const line = raw.trim();

    if (!line) {
      flushParagraph();
      flushList();
      continue;
    }
    if (/^-{3,}$/.test(line)) {
      flushParagraph();
      flushList();
      blocks.push({ type: "hr" });
      continue;
    }
    const heading = /^(#{1,3})\s+(.*)$/.exec(line);
    if (heading) {
      flushParagraph();
      flushList();
      const level = heading[1].length;
      blocks.push({ type: level === 1 ? "h1" : level === 2 ? "h2" : "h3", text: heading[2] });
      continue;
    }
    if (line.startsWith("- ")) {
      flushParagraph();
      (list ??= []).push(line.slice(2));
      continue;
    }
    flushList();
    paragraph.push(line);
  }
  flushParagraph();
  flushList();
  return blocks;
}

export default function MarkdownLite({ body }: { body: string }) {
  return (
    <>
      {parseBlocks(body).map((block, i) => {
        switch (block.type) {
          case "h1":
            return <h1 key={i}>{renderInline(block.text)}</h1>;
          case "h2":
            return <h2 key={i}>{renderInline(block.text)}</h2>;
          case "h3":
            return <h3 key={i}>{renderInline(block.text)}</h3>;
          case "hr":
            return <hr key={i} />;
          case "ul":
            return (
              <ul key={i}>
                {block.items.map((item, j) => (
                  <li key={j}>{renderInline(item)}</li>
                ))}
              </ul>
            );
          default:
            return <p key={i}>{renderInline(block.text)}</p>;
        }
      })}
    </>
  );
}
