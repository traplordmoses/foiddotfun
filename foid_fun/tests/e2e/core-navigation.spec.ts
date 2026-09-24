import { test, expect } from "@playwright/test";

test.describe("core navigation and FOID OS dock", () => {
  test.beforeEach(async ({ context, page }) => {
    await context.addCookies([
      {
        name: "foid_entered",
        value: "1",
        domain: "localhost",
        path: "/",
      },
      {
        name: "foid_onboarded",
        value: "1",
        domain: "localhost",
        path: "/",
      },
    ]);
    await page.addInitScript(() => {
      window.localStorage.removeItem("foid-os-windows-v2");
      window.sessionStorage.setItem("foid_os_booted", "1");
      window.sessionStorage.setItem("foid_dock_arrived", "1");
    });
  });

  test("desktop hides Home and toggles the focused app from its dock icon", async ({ page }) => {
    await page.goto("/");
    const home = page.locator('a[href="/"]').filter({ hasText: "Home" });
    await expect(home).toBeHidden();

    const prayDockIcon = page.locator('[data-dock-app="pray"]');
    await prayDockIcon.click();

    const prayWindow = page.locator('section[aria-label="FOID_MOMMY_TERMINAL.EXE"]');
    await expect(prayWindow).toBeVisible();
    await expect(prayDockIcon).toHaveAttribute("aria-label", "Minimize Pray");

    await prayDockIcon.click();
    await expect(prayWindow).toHaveClass(/foid-window--minimized/);
    await expect(prayDockIcon).toHaveAttribute("aria-label", "Restore Pray");

    await prayDockIcon.click();
    await expect(prayWindow).toHaveClass(/foid-window--restoring/);
    await expect(prayDockIcon).toHaveAttribute("aria-label", "Minimize Pray");
  });

  test("the welcome card closes from the keyboard and stays closed after a reload", async ({ page }) => {
    await page.goto("/");
    const heading = page.getByRole("heading", { name: "The internet’s permanent memory" });
    await expect(heading).toBeVisible();

    await page.getByRole("button", { name: "Close welcome" }).focus();
    await page.keyboard.press("Enter");
    await expect(heading).toHaveCount(0);
    // Focus moves to the desktop instead of falling back to <body>.
    await expect(page.locator("main.os-desktop")).toBeFocused();
    expect(await page.evaluate(() => window.localStorage.getItem("foid_os_welcome_dismissed"))).toBe("1");

    await page.reload();
    // aria-busy clears once the desktop has mounted and read the flag, so
    // the absence check below cannot pass early.
    await expect(page.locator('main.os-desktop[aria-busy="false"]')).toBeAttached();
    await expect(heading).toHaveCount(0);
    await expect(page.locator('[data-dock-app="board"]')).toBeVisible();
  });

  test("mobile keeps Home available and legacy Swipe redirects to Vote", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/vote?standalone=1");

    const home = page.locator('a[href="/"]').filter({ hasText: "Home" });
    await expect(home).toBeVisible();
    await expect(home).toHaveCSS("min-height", "44px");

    await page.goto("/swipe");
    await expect(page).toHaveURL(/\/vote$/);
  });

  test("core routes stay within compact and modern phone viewports", async ({ page }) => {
    const viewports = [
      { width: 375, height: 667 },
      { width: 430, height: 932 },
    ];
    const routes = ["/", "/pray?standalone=1", "/board?standalone=1", "/vote?standalone=1"];

    for (const viewport of viewports) {
      await page.setViewportSize(viewport);
      for (const route of routes) {
        await test.step(`${route} at ${viewport.width}x${viewport.height}`, async () => {
          await page.goto(route);
          await expect(page.locator(".foid-dock")).toBeVisible();
          const overflow = await page.evaluate(() => ({
            document: document.documentElement.scrollWidth - document.documentElement.clientWidth,
            body: document.body.scrollWidth - document.body.clientWidth,
          }));
          expect(overflow.document).toBeLessThanOrEqual(1);
          expect(overflow.body).toBeLessThanOrEqual(1);
        });
      }
    }
  });
});

test.describe("server-rendered content for crawlers", () => {
  const agents = {
    iphone: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
    googlebot: "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
    chatgptUser: "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; ChatGPT-User/1.0; +https://openai.com/bot)",
  };

  for (const [name, userAgent] of Object.entries(agents)) {
    test(`home serves the launcher headline in its HTML to ${name}`, async ({ request }) => {
      const res = await request.get("/", { headers: { "user-agent": userAgent }, maxRedirects: 0 });
      expect(res.status()).toBe(200);
      const html = await res.text();
      expect(html).toMatch(/<h1[^>]*>\s*FOID FOUNDATION\s*<\/h1>/);
      expect(html).toContain('"@type":"Organization"');
      expect(html).toContain('<link rel="canonical" href="https://foid.fun"');
    });
  }

  test("docs are standalone pages with structured data", async ({ request }) => {
    const faq = await (await request.get("/about/faq")).text();
    expect(faq).toContain('"@type":"FAQPage"');
    expect(faq).toContain('<link rel="canonical" href="https://foid.fun/about/faq"');
    expect(faq).toContain("<title>FAQ — The Real Questions | FOID.FUN</title>");
    const sitemap = await (await request.get("/sitemap.xml")).text();
    expect(sitemap).toContain("<loc>https://foid.fun/about/getting-started</loc>");
  });
});

test.describe("loreboard placement pages", () => {
  test("the gallery and the image sitemap render", async ({ request }) => {
    const gallery = await request.get("/board/placements");
    expect(gallery.status()).toBe(200);
    const html = await gallery.text();
    expect(html).toMatch(/<h1[^>]*>Every meme on the Loreboard<\/h1>/);
    expect(html).toContain('"@type":"CollectionPage"');
    const sitemap = await request.get("/sitemap-placements.xml");
    expect(sitemap.status()).toBe(200);
    expect(await sitemap.text()).toContain('xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"');
  });

  test("an unknown proposal still answers, but stays out of search", async ({ request }) => {
    const res = await request.get("/board/proposal/9999999");
    expect(res.status()).toBe(200);
    const html = await res.text();
    expect(html).toContain("isn&#x27;t on the board yet");
    expect(html).toMatch(/<meta name="robots" content="noindex, follow"/);
  });

  test("robots.txt lets share-card images through", async ({ request }) => {
    const robots = await (await request.get("/robots.txt")).text();
    expect(robots).toContain("Allow: /api/og/");
    expect(robots).toContain("Sitemap: https://foid.fun/sitemap-placements.xml");
  });
});

test.describe("mifoid episodes and films", () => {
  test("the watch hub, a film page and the video sitemap render", async ({ request }) => {
    const hub = await request.get("/watch");
    expect(hub.status()).toBe(200);
    expect(await hub.text()).toMatch(/<h1[^>]*>MiFOID episodes<\/h1>/);
    const film = await request.get("/watch/backrooms-vhs");
    expect(film.status()).toBe(200);
    const html = await film.text();
    expect(html).toContain('"@type":"VideoObject"');
    expect(html).toContain('<meta property="og:type" content="video.other"');
    const sitemap = await (await request.get("/sitemap-videos.xml")).text();
    expect(sitemap).toContain('xmlns:video="http://www.google.com/schemas/sitemap-video/1.1"');
    expect(sitemap).toContain("<loc>https://foid.fun/watch/backrooms-vhs</loc>");
  });

  test("an unknown video is a 404", async ({ request }) => {
    expect((await request.get("/watch/not-a-real-episode")).status()).toBe(404);
  });
});
