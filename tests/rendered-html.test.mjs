import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import test, { after, before } from "node:test";

const port = 31_487;
const baseUrl = `http://127.0.0.1:${port}`;
let server;

before(async () => {
  server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "--port", String(port)], {
    cwd: new URL("..", import.meta.url),
    env: { ...process.env, NODE_ENV: "production" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let startupError = "";
  server.stderr.on("data", (chunk) => { startupError += chunk; });
  for (let attempt = 0; attempt < 80; attempt += 1) {
    if (server.exitCode !== null) throw new Error(`Next.js exited during startup: ${startupError}`);
    try {
      const response = await fetch(baseUrl);
      if (response.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Next.js did not start: ${startupError}`);
});

after(() => {
  server?.kill("SIGTERM");
});

async function render(path = "/", init = {}) {
  return fetch(`${baseUrl}${path}`, { headers: { accept: "text/html", ...(init.headers ?? {}) }, ...init });
}

test("renders the premium HF homepage without placeholder claims", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /Adelaide[\s\S]*Removalists[\s\S]*You Can[\s\S]*Rely On/i);
  assert.match(html, /Tell us about your move/i);
  assert.match(html, /Muhammad Rasheed/i);
  assert.match(html, /hf-logo-2026\.webp/i);
  assert.match(html, /muhammad-rasheed-ceo\.webp/i);
  assert.match(html, /hf-residential-premium\.webp/i);
  assert.match(html, /hf-packing-premium\.webp/i);
  assert.match(html, /hf-office-premium\.webp/i);
  assert.match(html, /hf-interstate-premium\.webp/i);
  assert.match(html, /Work in Motion/i);
  assert.match(html, /\$74/);
  assert.match(html, /\$119\.43/);
  assert.match(html, /4\.9 Google rating/i);
  assert.match(html, /417(?:<!-- -->)? reviews/i);
  assert.match(html, /Open 24 Hours/i);
  assert.match(html, /25–45 m³/i);
  assert.match(html, /40–60 m³/i);
  assert.match(html, /AggregateRating/);
  assert.match(html, /"ratingValue":4\.9/);
  assert.match(html, /application\/ld\+json/);
  assert.match(html, /<title>Adelaide Removalists \| 4\.9★ Rated Local &amp; Interstate \| HF Removals<\/title>/i);
  assert.doesNotMatch(html, /HF Removals Adelaide \| HF Removals Adelaide<\/title>/i);
  assert.doesNotMatch(html, /codex-preview|react-loading-skeleton|5\.0 from|200\+ happy|#1 Adelaide|award.winning/i);
  assert.doesNotMatch(html, /Hamza Khan|Jessica Taylor|David Miller|Sarah Jenkins/i);
  assert.match(html, /Mishaal/i);
  assert.match(html, /Max Lazzaris/i);
  assert.match(html, /Ayan Ali/i);
  assert.match(html, /shagun sharma/i);
  assert.match(html, /Muhammad and the team at HF Removals provided an exceptional house moving service/i);
  assert.match(html, /Verified visible excerpt/i);
});

test("renders service, area, route, guide and contact routes", async () => {
  const paths = [
    ["/services/residential-removals", /A clear plan for moving home/i],
    ["/areas/salisbury", /Coordinate homes, units and workplaces/i],
    ["/interstate/adelaide-perth", /\$186\.06/i],
    ["/guides/office-relocation-checklist", /Office Relocation Checklist/i],
    ["/contact", /Talk to HF Removals Adelaide/i],
  ];
  for (const [path, pattern] of paths) {
    const response = await render(path);
    assert.equal(response.status, 200, path);
    assert.match(await response.text(), pattern, path);
  }

  const about = await render("/about");
  assert.match(await about.text(), /<title>About \| HF Removals Adelaide<\/title>/i);

  const contact = await render("/contact");
  const contactHtml = await contact.text();
  assert.match(contactHtml, /Google Map showing HF Removals Adelaide/i);
  assert.match(contactHtml, /4v1787515237189/i);
  assert.match(contactHtml, /referrerpolicy="strict-origin-when-cross-origin"/i);
  assert.match(contactHtml, /6MW7\+J5 Elizabeth Vale/i);
  assert.match(contactHtml, /loading="lazy"/i);
  assert.match(contactHtml, /Get directions/i);

  const service = await render("/services/residential-removals");
  assert.doesNotMatch(await service.text(), /FAQPage/);
});

test("serves crawl discovery endpoints and unique guide metadata", async () => {
  const robots = await render("/robots.txt");
  assert.equal(robots.status, 200);
  assert.match(robots.headers.get("content-type") ?? "", /text\/plain/);
  assert.match(await robots.text(), /Sitemap: https:\/\/hfremovalsadelaide\.com\.au\/sitemap\.xml/);

  const sitemap = await render("/sitemap.xml");
  assert.equal(sitemap.status, 200);
  assert.match(sitemap.headers.get("content-type") ?? "", /xml/);
  assert.match(await sitemap.text(), /https:\/\/hfremovalsadelaide\.com\.au\/services\/residential-removals/);

  const guide = await render("/guides/office-relocation-checklist");
  const html = await guide.text();
  assert.match(html, /<title>Office Relocation Checklist \| HF Removals Adelaide<\/title>/i);
  assert.doesNotMatch(html, /href="\/(?:services|areas|pricing|about|contact|guides|interstate|privacy|terms)[^"]*\/"/i);
});

test("renders one coherent, accessible FormSubmit quote flow", async () => {
  for (const path of ["/", "/contact"]) {
    const response = await render(path);
    assert.equal(response.status, 200, path);
    const html = await response.text();

    assert.match(html, /<form[^>]+action="https:\/\/formsubmit\.co\/hfremovalad@gmail\.com"[^>]+method="POST"/i, path);
    assert.match(html, /name="_subject"[^>]+value="New HF Removals Adelaide Quote Request"/i, path);
    assert.match(html, /name="_captcha"[^>]+value="false"/i, path);
    assert.match(html, /name="website"[^>]+value="HF Removals Adelaide Website"/i, path);
    assert.match(html, /name="_next"[^>]+value="https:\/\/hf-removals-adelaide\.vercel\.app\//i, path);
    assert.match(html, /<input(?=[^>]*name="_honey")(?=[^>]*tabindex="-1")[^>]*>/i, path);
    for (const field of ["name", "phone", "email", "moving_from", "moving_to", "move_type", "property_size", "preferred_moving_date", "details"]) {
      assert.match(html, new RegExp(`name="${field}"`, "i"), `${path}: ${field}`);
    }
  }

  const client = await readFile(new URL("../app/components/SiteClient.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(client, /fetch\(["']\/api\/quote/i);
  assert.doesNotMatch(client, /openEmailFallback|QUOTE_ENDPOINT_URL|formsubmit\.co\/h\[/i);
});

test("keeps verified rates, coverage wording and canonical route inventory centralized", async () => {
  const data = await readFile(new URL("../lib/site-data.ts", import.meta.url), "utf8");
  assert.match(data, /\$74/);
  assert.match(data, /\$89/);
  assert.match(data, /\$119\.43/);
  assert.match(data, /\$186\.06/);
  assert.match(data, /per m³/);
  assert.match(data, /Up to \$1,000,000 Public Liability & Transit Insurance/);
  assert.match(data, /rating: 4\.9/);
  assert.match(data, /reviewCount: 417/);
  assert.match(data, /verifiedAt: "2026-08-21"/);
  assert.match(data, /Complimentary mattress protection/);
  assert.doesNotMatch(data, /five-star|fully insured|no hidden fees|on-time every time/i);
});
