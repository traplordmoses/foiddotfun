import { describe, expect, it } from "vitest";
import { isCrawler, isPhone } from "@/lib/userAgent";

describe("isCrawler", () => {
  it.each([
    "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
    "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; OAI-SearchBot/1.0; +https://openai.com/searchbot)",
    "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; ChatGPT-User/1.0; +https://openai.com/bot)",
    "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; Claude-User/1.0; +Claude-User@anthropic.com)",
    "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; Perplexity-User/1.0; +https://perplexity.ai/perplexity-user)",
    "meta-externalagent/1.1 (+https://developers.facebook.com/docs/sharing/webmasters/crawler)",
    "facebookexternalhit/1.1",
  ])("treats %s as a crawler", (ua) => {
    expect(isCrawler(ua)).toBe(true);
  });

  it("leaves ordinary browsers alone", () => {
    expect(isCrawler("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36")).toBe(false);
    expect(isCrawler("Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1")).toBe(false);
    expect(isCrawler(null)).toBe(false);
  });
});

describe("isPhone", () => {
  it("uses the client hint when present", () => {
    expect(isPhone("", "?1")).toBe(true);
    expect(isPhone("Mozilla/5.0 (Windows NT 10.0) Chrome/128.0", "?0")).toBe(false);
  });
  it("falls back to the user agent", () => {
    expect(isPhone("Mozilla/5.0 (Linux; Android 14; Pixel 8) Mobile Safari/537.36")).toBe(true);
    expect(isPhone("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)")).toBe(false);
  });
});
