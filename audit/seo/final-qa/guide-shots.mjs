import { chromium } from "@playwright/test";
import { startServer } from "../validate-seo.mjs";
const { server, base } = await startServer();
const browser = await chromium.launch({ channel: "chromium" });
try {
  for (const [n, w, h] of [["390", 390, 844], ["1440", 1440, 900]]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h } });
    const page = await ctx.newPage();
    await page.goto(base + "/adelaide-removalists", { waitUntil: "networkidle" });
    const y0 = await page.locator("h2", { hasText: "Choose the right moving service first" }).evaluate((e) => e.getBoundingClientRect().top + scrollY - 80);
    for (let i = 0; i < 3; i++) {
      await page.evaluate((y) => scrollTo(0, y), y0 + i * (h - 100));
      await page.waitForTimeout(700);
      await page.screenshot({ path: `audit/seo/final-qa/screenshots/guide-${n}-part${i + 1}.png` });
    }
    await ctx.close();
  }
} finally { await browser.close(); server.kill(); }
