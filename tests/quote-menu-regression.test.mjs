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
  // The truck is a required choice: pick one the way a visitor would.
  await page.locator('input[type="radio"][name="truck_package_id"][value="mr-12t-2men"]').check();
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
    // The lead carries structured package fields, not just a visible label.
    assert.match(payload, /name="truck_package_id"\r?\n\r?\nmr-12t-2men/);
    assert.match(payload, /name="truck_name"\r?\n\r?\nMR Truck/);
    assert.match(payload, /name="truck_class"\r?\n\r?\nMR/);
    assert.match(payload, /name="truck_capacity"\r?\n\r?\n12 Ton/);
    assert.match(payload, /name="crew_size"\r?\n\r?\n2/);
    assert.match(payload, /name="rate_per_30_min"\r?\n\r?\n\$74 \/ 30 min/);
    assert.match(payload, /name="rate_per_30_min_cents"\r?\n\r?\n7400/);
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

test("truck card selection flows into the quote form radio and the submitted lead", async () => {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  let payload;
  await page.route(endpoint, async route => {
    payload = route.request().postData();
    await route.fulfill({ contentType: "application/json", body: JSON.stringify({ success: true }) });
  });
  try {
    await page.goto(runtime.base);
    await page.getByRole("button", { name: "Select HR Truck" }).click();
    await expect(page.getByRole("button", { name: /Selected: HR Truck/ })).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator('input[type="radio"][name="truck_package_id"][value="hr-16t-2men"]')).toBeChecked();
    await page.locator('[name="name"]').fill("Regression Test");
    await page.locator('[name="phone"]').fill("0400000000");
    await page.locator('[name="email"]').fill("regression@example.invalid");
    await page.locator('[name="moving_from"]').fill("Unley SA");
    await page.locator('[name="moving_to"]').fill("Marion SA");
    await page.locator('[name="preferred_moving_date"]').fill("2099-01-01");
    await page.locator(".form-submit").click();
    await expect(page.locator("#quote-form-status")).toContainText("have been sent");
    assert.match(payload, /name="truck_package_id"\r?\n\r?\nhr-16t-2men/);
    assert.match(payload, /name="truck_capacity"\r?\n\r?\n16 Ton/);
    assert.match(payload, /name="rate_per_30_min_cents"\r?\n\r?\n7900/);
  } finally { await page.close(); }
});

test("truck chosen on the homepage persists into the booking wizard and its availability request", async () => {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const availabilityUrls = [];
  await page.route("**/api/booking/fleet", route => route.fulfill({ contentType: "application/json", body: JSON.stringify({ unavailablePackageIds: [] }) }));
  await page.route("**/api/booking/availability**", async route => {
    availabilityUrls.push(route.request().url());
    await route.fulfill({ contentType: "application/json", body: JSON.stringify({ slots: [], hasCompatibleVehicle: true }) });
  });
  try {
    await page.goto(runtime.base);
    await page.getByRole("button", { name: "Select Small Truck" }).click();
    await page.goto(`${runtime.base}/book`);
    const bar = page.locator(".wizard-truck-bar");
    await expect(bar).toContainText("Small Truck");
    await expect(bar).toContainText("8 Ton");
    await expect(bar).toContainText("2 Men");
    await expect(bar).toContainText("$69");
    await expect(page.locator('input[type="radio"][name="truck_package_id"][value="small-8t-2men"]')).toBeChecked();
    await page.getByRole("button", { name: "Continue" }).click();
    await page.getByLabel("Pickup address: street address").fill("1 Test St");
    await page.getByLabel("Pickup address: suburb").fill("Unley");
    await page.getByLabel("Pickup address: postcode").fill("5061");
    await page.getByLabel("Destination address: street address").fill("2 Test St");
    await page.getByLabel("Destination address: suburb").fill("Marion");
    await page.getByLabel("Destination address: postcode").fill("5043");
    await page.getByRole("button", { name: "Continue" }).click();
    await page.locator('input[type="date"]').fill("2099-01-01");
    await expect.poll(() => availabilityUrls.length).toBeGreaterThan(0);
    assert.match(availabilityUrls[0], /packageId=small-8t-2men/);
    assert.doesNotMatch(availabilityUrls[0], /crewSize/);
  } finally { await page.close(); }
});

test("a truck class with no active vehicle is shown as unavailable with a customer-safe message", async () => {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.route("**/api/booking/fleet", route => route.fulfill({ contentType: "application/json", body: JSON.stringify({ unavailablePackageIds: ["small-8t-2men"] }) }));
  try {
    await page.goto(`${runtime.base}/book?package=small-8t-2men`);
    await expect(page.locator('input[type="radio"][name="truck_package_id"][value="small-8t-2men"]')).toBeDisabled();
    await expect(page.locator('input[type="radio"][name="truck_package_id"][value="hr-16t-2men"]')).toBeEnabled();
    await expect(page.locator("main p[role=alert]")).toContainText("This truck is currently unavailable for online booking. Please call 0491 704 136 or choose another truck.");
    await expect(page.getByRole("button", { name: "Continue" })).toBeDisabled();
    const text = await page.locator("main").innerText();
    assert.doesNotMatch(text, /database|vehicle_type|configure/i);
  } finally { await page.close(); }
});
