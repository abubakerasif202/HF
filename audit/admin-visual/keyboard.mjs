// Synthetic-admin keyboard smoke test: search dialog and mobile navigation.
import { chromium, expect } from "@playwright/test";
import { buildAuthCookies } from "./session.mjs";

const base = process.argv[2] ?? "http://127.0.0.1:3200";
const mock = process.env.MOCK_PORT ?? "54399";
const browser = await chromium.launch();
try {
  const context = await browser.newContext();
  await context.addCookies(buildAuthCookies("http://127.0.0.1:" + mock));
  for (const width of [375, 768, 1440]) {
    const page = await context.newPage();
    await page.setViewportSize({ width, height: 900 });
    const response = await page.goto(base + "/admin", { waitUntil: "networkidle" });
    expect(response?.status()).toBe(200);

    const trigger = page.getByRole("button", { name: "Search bookings, enquiries and customers" });
    await trigger.focus();
    await page.keyboard.press("Control+k");
    await expect(page.locator("dialog.a-gs")).toBeVisible();
    await expect(page.locator("input.a-gs-input")).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(page.locator("dialog.a-gs")).toBeHidden();
    await expect(trigger).toBeFocused();

    const menu = page.locator(".a-menu-btn");
    if (await menu.isVisible()) {
      await menu.focus();
      await page.keyboard.press("Enter");
      await expect(page.locator("#admin-sidebar")).toHaveAttribute("data-open", "true");
      await expect(page.getByRole("button", { name: "Close menu" })).toBeFocused();
      await page.keyboard.press("Escape");
      await expect(page.locator("#admin-sidebar")).toHaveAttribute("data-open", "false");
      await expect(menu).toBeFocused();
    }
    console.log("ok keyboard@" + width);
    await page.close();
  }
  await context.close();
} finally {
  await browser.close();
}
