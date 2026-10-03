import assert from "node:assert/strict";
import test, { before, after } from "node:test";
import { chromium, expect } from "@playwright/test";
import { startServer } from "../audit/seo/validate-seo.mjs";

let runtime;
let browser;
before(async () => { runtime = await startServer(); browser = await chromium.launch({ channel: "chromium" }); });
after(async () => { await browser?.close(); runtime?.server.kill(); });

const endpoint = "https://api.web3forms.com/submit";
async function fillQuote(page) {
  await page.locator('[name="name"]').fill("Regression Test");
  await page.locator('[name="phone"]').fill("0400000000");
  await page.locator('[name="email"]').fill("regression@example.invalid");
  await page.locator('[name="moving_from"]').fill("Unley SA");
  await page.locator('[name="moving_to"]').fill("Marion SA");
  await page.locator('[name="preferred_moving_date"]').fill("2099-01-01");
}

test("mobile drawer provides keyboard dismissal and preserves user focus", async () => {
  const page = await browser.newPage({ viewport: { width: 375, height: 812 } });
  try {
    await page.goto(runtime.base);
    await page.waitForLoadState("networkidle");
    const trigger = page.locator(".menu-toggle");
    const close = page.getByRole("button", { name: "Close menu", exact: true }).last();
    await trigger.click();
    const home = page.locator('#mobile-menu a[href="/"]');
    // Allow the drawer transition and its deferred focus retries to settle.
    await page.waitForTimeout(350);
    await expect(home).toBeFocused();
    await page.keyboard.press("Shift+Tab");
    await expect(close).toBeFocused();
    await page.waitForTimeout(350);
    await expect(close).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(trigger).toBeFocused();
    await expect(page.locator("#mobile-menu")).toBeHidden();
    await trigger.click();
    await expect(home).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(trigger).toBeFocused();
    await expect(page.locator("#mobile-menu")).toBeHidden();
    assert.equal(await page.locator("main").evaluate(element => element.inert), false);
  } finally { await page.close(); }
});

test("quote success submits once and resets only after provider confirmation", async () => {
  const page = await browser.newPage();
  let requests = 0;
  let payload;
  let release;
  const pending = new Promise(resolve => { release = resolve; });
  await page.route(endpoint, async route => {
    requests++;
    payload = route.request().postData();
    await pending;
    await route.fulfill({ contentType: "application/json", body: JSON.stringify({ success: true }) });
  });
  try {
    await page.goto(runtime.base);
    const from = await page.locator('[name="moving_from"]').getAttribute("autocomplete");
    const to = await page.locator('[name="moving_to"]').getAttribute("autocomplete");
    assert.match(from, /^section-\S+ address-level2$/);
    assert.match(to, /^section-\S+ address-level2$/);
    assert.notEqual(from, to);
    await fillQuote(page);
    await page.locator(".form-submit").evaluate(button => { button.click(); button.click(); });
    await expect(page.locator(".form-submit")).toBeDisabled();
    await expect.poll(() => requests).toBe(1);
    assert.match(payload, /name="replyto"\r?\n\r?\nregression@example\.invalid/);
    assert.match(payload, /name="moving_package"/);
    release();
    await expect(page.locator("#quote-form-status")).toContainText("have been sent");
    await expect(page.locator('[name="name"]')).toHaveValue("");
    await expect(page.locator(".form-submit")).toBeEnabled();
    assert.equal(requests, 1);
  } finally { release(); await page.close(); }
});

for (const failure of ["provider error", "timeout"]) {
  test(`quote ${failure} preserves input and directs uncertain delivery to a call`, async () => {
    const page = await browser.newPage();
    let requests = 0;
    if (failure === "timeout") {
      await page.addInitScript(() => {
        const original = window.setTimeout.bind(window);
        window.setTimeout = (handler, delay, ...args) => original(handler, delay === 20000 ? 200 : delay, ...args);
      });
    }
    await page.route(endpoint, async route => {
      requests++;
      if (failure === "provider error") {
        await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ success: false }) });
      }
      // A stalled route is deliberately never continued to the real provider.
    });
    try {
      await page.goto(runtime.base);
      await fillQuote(page);
      await page.locator(".form-submit").click();
      await expect(page.locator("#quote-form-status")).toContainText("could not confirm whether");
      await expect(page.locator("#quote-form-status")).toContainText("before trying again");
      await expect(page.locator('[name="name"]')).toHaveValue("Regression Test");
      await expect(page.locator('[name="email"]')).toHaveValue("regression@example.invalid");
      await expect(page.locator(".form-submit")).toBeEnabled();
      assert.equal(requests, 1);
    } finally { await page.close(); }
  });
}
