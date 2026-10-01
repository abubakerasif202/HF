import assert from "node:assert/strict";
import test, { before, after } from "node:test";
import { chromium } from "@playwright/test";
import { startServer, hostRequest, origin } from "../audit/seo/validate-seo.mjs";

let runtime;
let browser;
before(async () => { runtime = await startServer(); browser = await chromium.launch({ channel: "chromium" }); });
after(async () => { await browser?.close(); runtime?.server.kill(); });

test("unrecognised extra path segments cannot duplicate ranking pages", async () => {
  for (const path of ["/services/residential-removals/duplicate", "/pricing/duplicate", "/interstate/adelaide-sydney/duplicate", "/guides/how-removalist-pricing-works/duplicate"]) {
    const response = await fetch(`${runtime.base}${path}`, { redirect: "manual" });
    assert.equal(response.status, 404, path);
  }
});

test("legacy hostname and path redirects preserve query strings directly", async () => {
  for (const [oldPath, destination] of [["/contact-us/", "/contact"], ["/about-us/", "/about"]]) {
    const response = await hostRequest(runtime.port, `${oldPath}?utm_source=seo-regression`, "hfremovalsadelaide.com.au");
    assert.equal(response.status, 308);
    assert.equal(response.location, `${origin}${destination}?utm_source=seo-regression`);
  }
});

test("pricing has commercial ownership and the guide links back to rates", async () => {
  const page = await browser.newPage();
  try {
    await page.goto(`${runtime.base}/pricing`);
    assert.match(await page.locator("h1").innerText(), /pricing|prices|rates/i);
    assert.match(await page.locator("main").innerText(), /call.out/i);
    assert.ok(await page.locator('main a[href="/guides/how-removalist-pricing-works"]').count());
    await page.goto(`${runtime.base}/guides/how-removalist-pricing-works`);
    assert.ok(await page.locator('main a[href="/pricing"]').count());
  } finally { await page.close(); }
});

test("quote phone pattern compiles in native Unicode mode and validates realistic input", async () => {
  const page = await browser.newPage();
  const errors = [];
  page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
  try {
    await page.goto(`${runtime.base}/`);
    const results = await page.locator('input[name="phone"]').evaluate(input => {
      const pattern = input.getAttribute("pattern");
      const regex = new RegExp(`^(?:${pattern})$`, "v");
      return ["0491704136", "+61 491 704 136", "(0491) 704-136", "abcdefgh", "123", ""].map(value => {
        input.value = value;
        return { value, regexMatches: regex.test(value), nativeValid: input.checkValidity() };
      });
    });
    assert.deepEqual(results.map(({ nativeValid }) => nativeValid), [true, true, true, false, false, false]);
    assert.deepEqual(results.map(({ regexMatches }) => regexMatches), [true, true, true, false, false, false]);
    assert.deepEqual(errors.filter(message => /pattern|regular expression|invalid.*flag/i.test(message)), []);
  } finally { await page.close(); }
});

test("FAQ structured data uses questions and answers present in rendered content", async () => {
  const page = await browser.newPage();
  try {
    for (const path of ["/", "/pricing", "/services/interstate-removals", "/services/packing-unpacking", "/areas/unley-park", "/interstate/adelaide-sydney"]) {
      await page.goto(`${runtime.base}${path}`);
      const { visible, faqs } = await page.evaluate(() => {
        const schemas = [...document.querySelectorAll('script[type="application/ld+json"]')].flatMap(e => {
          const schema = JSON.parse(e.textContent);
          return Array.isArray(schema) ? schema : schema["@graph"] ?? [schema];
        });
        return { visible: [...document.querySelectorAll("main details.faq-item")].map(item => ({ question: item.querySelector("summary span")?.textContent.replace(/\s+/g, " "), answer: item.querySelector("p")?.textContent.replace(/\s+/g, " ") })), faqs: schemas.filter(s => s["@type"] === "FAQPage").flatMap(s => s.mainEntity ?? []) };
      });
      assert.ok(faqs.length > 0, `${path}: missing FAQ schema`);
      assert.equal(faqs.length, visible.length, `${path}: FAQ count differs`);
      assert.deepEqual(faqs.map(faq => ({ question: faq.name.replace(/\s+/g, " "), answer: faq.acceptedAnswer.text.replace(/\s+/g, " ") })), visible, `${path}: schema differs from actual FAQ content`);
    }
  } finally { await page.close(); }
});
