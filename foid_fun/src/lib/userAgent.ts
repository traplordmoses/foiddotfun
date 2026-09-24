// src/lib/userAgent.ts
// Shared user-agent checks for the middleware (edge) and server pages. Kept
// dependency-free so it runs in both runtimes.

/** Search crawlers, AI crawlers and answer agents, and link-preview
 *  fetchers. None of them carry the entry cookie, and bouncing them to the
 *  boot screen would hide the homepage and its share card. The "-User"
 *  agents fetch a page live when someone asks ChatGPT, Claude, Perplexity
 *  or Le Chat about it, so they need the real content too. */
const CRAWLER =
  /bot|crawl|spider|slurp|facebookexternalhit|meta-external(agent|fetcher)|twitterbot|discordbot|telegrambot|whatsapp|linkedinbot|slackbot|embedly|pinterest|warpcast|farcaster|applebot|duckduckbot|duckassist|baiduspider|yandex|(chatgpt|claude|perplexity|mistralai)-user/i;

const PHONE = /Mobi|Android|iPhone|iPod/i;

export function isCrawler(userAgent: string | null | undefined): boolean {
  return CRAWLER.test(userAgent ?? "");
}

export function isPhone(userAgent: string | null | undefined, chUaMobile?: string | null): boolean {
  return chUaMobile === "?1" || PHONE.test(userAgent ?? "");
}
