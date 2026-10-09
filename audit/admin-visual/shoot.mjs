// Screenshots every admin route at 4 widths against the mock-backed app.
//   node audit/admin-visual/shoot.mjs <label> [--base http://127.0.0.1:3200] [--widths 390,768,1440,1920] [--only slug,slug]
// Output: audit/admin-visual/screens/<label>/<route-slug>-<width>.png + <label>/report.json
// Exit code is non-zero if any page is non-200 or ends up on /admin/login (i.e. auth mocking failed).
import { chromium } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { FEATURED_BOOKING_ID, FINALISED_BOOKING_ID } from "./fixtures.mjs";
import { buildAuthCookies } from "./session.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const flag = (name, fallback) => { const i = args.indexOf(name); return i === -1 ? fallback : args[i + 1]; };
const label = args.find((a, i) => !a.startsWith("--") && !args[i - 1]?.startsWith("--")) ?? "run";
const base = flag("--base", "http://127.0.0.1:3200");
const widths = flag("--widths", "390,768,1440,1920").split(",").map(Number);
const only = flag("--only", "")?.split(",").filter(Boolean) ?? [];
const supabaseUrl = `http://127.0.0.1:${process.env.MOCK_PORT ?? 54399}`;

const AUTHED_ROUTES = [
  ["dashboard", "/admin"],
  ["bookings", "/admin/bookings"],
  ["booking-detail", `/admin/bookings/${FEATURED_BOOKING_ID}`],
  ["booking-detail-finalised", `/admin/bookings/${FINALISED_BOOKING_ID}`],
  ["quotes", "/admin/quotes"],
  ["calendar", "/admin/calendar"],
  ["calendar-month", "/admin/calendar?view=month"],
  ["availability", "/admin/availability"],
  ["vehicles", "/admin/vehicles"],
  ["crews", "/admin/crews"],
  ["pricing", "/admin/pricing"],
  ["settings", "/admin/settings"],
];
const LOGIN_ROUTE = ["login", "/admin/login"];

const outDir = path.join(here, "screens", label);
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();
const report = { label, base, takenAt: new Date().toISOString(), pages: [] };
let failures = 0;

async function shootRoute(context, [slug, route], { expectLogin }) {
  if (only.length && !only.includes(slug)) return;
  for (const width of widths) {
    const page = await context.newPage();
    await page.setViewportSize({ width, height: width <= 768 ? 900 : 1000 });
    const entry = { slug, route, width, status: null, finalUrl: null, consoleErrors: [], pageErrors: [], failedRequests: [], badResponses: [], ok: true };
    page.on("console", (m) => { if (m.type() === "error") entry.consoleErrors.push(m.text().slice(0, 400)); });
    page.on("pageerror", (e) => entry.pageErrors.push(String(e).slice(0, 400)));
    page.on("requestfailed", (r) => entry.failedRequests.push(`${r.method()} ${r.url()} ${r.failure()?.errorText ?? ""}`.slice(0, 300)));
    page.on("response", (r) => { if (r.status() >= 400) entry.badResponses.push(`${r.status()} ${r.request().method()} ${r.url()}`.slice(0, 300)); });
    try {
      const response = await page.goto(base + route, { waitUntil: "networkidle", timeout: 60_000 });
      entry.status = response?.status() ?? null;
      entry.finalUrl = page.url();
      await page.evaluate(() => document.fonts?.ready);
      await page.waitForTimeout(400);
      const landedOnLogin = new URL(entry.finalUrl).pathname === "/admin/login";
      if (entry.status !== 200) { entry.ok = false; entry.problem = `HTTP ${entry.status}`; }
      if (landedOnLogin && !expectLogin) { entry.ok = false; entry.problem = "redirected to /admin/login (auth mock failed)"; }
      await page.screenshot({ path: path.join(outDir, `${slug}-${width}.png`), fullPage: true });
    } catch (error) {
      entry.ok = false;
      entry.problem = String(error).slice(0, 300);
    }
    if (!entry.ok) failures += 1;
    report.pages.push(entry);
    console.log(`${entry.ok ? "ok  " : "FAIL"} ${slug}@${width} ${entry.status} ${entry.problem ?? ""} errs=${entry.consoleErrors.length + entry.pageErrors.length}`);
    await page.close();
  }
}

const authed = await browser.newContext();
await authed.addCookies(buildAuthCookies(supabaseUrl));
for (const route of AUTHED_ROUTES) await shootRoute(authed, route, { expectLogin: false });
await authed.close();

const anon = await browser.newContext(); // no cookie: the login page itself
await shootRoute(anon, LOGIN_ROUTE, { expectLogin: true });
await anon.close();
await browser.close();

writeFileSync(path.join(outDir, "report.json"), JSON.stringify(report, null, 2));
console.log(`\n${report.pages.length} screenshots, ${failures} failing. Report: ${path.join(outDir, "report.json")}`);
process.exit(failures ? 1 : 0);
