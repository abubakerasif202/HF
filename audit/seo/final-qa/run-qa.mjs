import { chromium } from "@playwright/test";
import fs from "node:fs";
import { startServer } from "../validate-seo.mjs";

const out = "audit/seo/final-qa";
const pages = ["/", "/adelaide-removalists", "/services/residential-removals", "/services/furniture-removals", "/services/interstate-removals", "/services/office-commercial-removals", "/areas/salisbury", "/areas/gawler", "/areas/unley-park", "/areas/malvern", "/contact", "/pricing"];
const viewports = [["desktop-1440", 1440, 900], ["mobile-390", 390, 844], ["mobile-375", 375, 812]];
const slug = (p) => (p === "/" ? "home" : p.slice(1).replace(/\//g, "_"));
const { server, base } = await startServer();
const browser = await chromium.launch({ channel: "chromium" });
const report = { pages: [], links: {}, availabilityText: {} };
try {
  for (const [vname, w, h] of viewports) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h } });
    for (const p of pages) {
      const page = await ctx.newPage();
      const errors = [];
      page.on("pageerror", (e) => errors.push(String(e)));
      page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
      const res = await page.goto(base + p, { waitUntil: "networkidle" });
      await page.waitForTimeout(400);
      const m = await page.evaluate(() => {
        const vw = document.documentElement.clientWidth;
        const over = [...document.querySelectorAll("body *")].filter((el) => { const r = el.getBoundingClientRect(); return r.width > 0 && (r.right > vw + 1) && getComputedStyle(el).position !== "fixed" && !el.closest("[aria-hidden='true']"); }).slice(0, 5).map((el) => el.tagName + "." + String(el.className).slice(0, 40) + " r=" + Math.round(el.getBoundingClientRect().right));
        return { scrollW: document.documentElement.scrollWidth, vw, over, h1: [...document.querySelectorAll("h1")].map((x) => x.textContent.trim()), title: document.title };
      });
      report.pages.push({ vname, path: p, status: res.status(), horizontalOverflow: m.scrollW > m.vw + 1, overflowers: m.over, h1: m.h1, title: m.title, errors });
      await page.screenshot({ path: `${out}/screenshots/${vname}__${slug(p)}.png`, fullPage: true });
      await page.close();
    }
    await ctx.close();
  }
  // links on the guide page
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(base + "/adelaide-removalists", { waitUntil: "networkidle" });
  const hrefs = [...new Set(await page.$$eval("main a[href]", (as) => as.map((a) => a.getAttribute("href"))))];
  for (const href of hrefs) {
    if (/^(tel:|mailto:|https?:)/.test(href)) { report.links[href] = "external-skipped"; continue; }
    const target = href.startsWith("#") ? "/adelaide-removalists" : href.replace(/#.*/, "");
    const r = await fetch(base + (target || "/"), { redirect: "manual" });
    report.links[href] = r.status;
  }
  // availability wording across key pages
  for (const p of ["/", "/adelaide-removalists", "/services/office-commercial-removals", "/services/residential-removals", "/contact"]) {
    await page.goto(base + p, { waitUntil: "networkidle" });
    const text = await page.evaluate(() => document.body.innerText);
    report.availabilityText[p] = [...text.matchAll(/[^.\n]*(24[ -]?hours?|24\/7|round the clock|any time|anytime|open all)[^.\n]*/gi)].map((x) => x[0].trim());
  }
  await ctx.close();
} finally { await browser.close(); server.kill(); }
fs.writeFileSync(`${out}/qa-report.json`, JSON.stringify(report, null, 2));
const bad = report.pages.filter((r) => r.status !== 200 || r.horizontalOverflow || r.errors.length || r.h1.length !== 1);
console.log("pages", report.pages.length, "problems", bad.length);
for (const b of bad) console.log(JSON.stringify({ v: b.vname, p: b.path, s: b.status, o: b.horizontalOverflow, ov: b.overflowers, e: b.errors.slice(0, 2), h1: b.h1.length }));
console.log("broken links", Object.entries(report.links).filter(([, s]) => s !== 200 && s !== "external-skipped"));
console.log(JSON.stringify(report.availabilityText, null, 1));
