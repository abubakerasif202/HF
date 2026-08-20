import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import test, { after } from "node:test";

const nextBin = createRequire(import.meta.url).resolve("next/dist/bin/next");
const servers = [];

/**
 * Boot `next start` on its own port with the given environment. Each server is
 * isolated so env-dependent branches of the quote API can be covered without
 * the in-memory rate limiter leaking counts between cases.
 */
async function startServer(port, env = {}) {
  const child = spawn(process.execPath, [nextBin, "start", "--port", String(port)], {
    env: { ...process.env, NODE_ENV: "production", QUOTE_ENDPOINT_URL: "", QUOTE_BEARER_TOKEN: "", ...env },
    stdio: ["ignore", "pipe", "pipe"],
  });
  const errors = [];
  child.stderr.on("data", (chunk) => errors.push(String(chunk)));
  servers.push(child);

  const baseUrl = `http://127.0.0.1:${port}`;
  const deadline = Date.now() + 60_000;
  for (;;) {
    if (child.exitCode !== null) throw new Error(`next start exited early:\n${errors.join("")}`);
    try {
      await fetch(baseUrl, { signal: AbortSignal.timeout(2_000) });
      return baseUrl;
    } catch {
      if (Date.now() > deadline) throw new Error(`next start never became ready:\n${errors.join("")}`);
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }
}

after(() => servers.forEach((child) => child.kill()));

const unconfigured = await startServer(3117);

function get(path) {
  return fetch(`${unconfigured}${path}`, { headers: { accept: "text/html" } });
}

function postQuote(baseUrl, body, headers = {}) {
  return fetch(`${baseUrl}/api/quote`, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

const validQuote = {
  name: "A", phone: "0491 704 136", email: "a@example.com", from: "Adelaide",
  to: "Salisbury", moveType: "Residential", propertySize: "2 Bedroom", details: "", elapsedMs: 2_000,
};

test("renders the premium HF homepage without placeholder claims", async () => {
  const response = await get("/");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /Adelaide[\s\S]*Removalists[\s\S]*You Can[\s\S]*Rely On/i);
  assert.match(html, /Tell us about your move/i);
  assert.match(html, /Muhammad Rasheed/i);
  assert.match(html, /hf-logo-header-mark\.png/i);
  assert.match(html, /muhammad-rasheed-ceo\.webp/i);
  assert.match(html, /\$74/);
  assert.match(html, /\$119\.43/);
  assert.match(html, /4\.9 Google rating/i);
  assert.match(html, /417(?:<!-- -->)? reviews/i);
  assert.match(html, /Open 24 Hours/i);
  assert.match(html, /25–45 m³/i);
  assert.match(html, /40–60 m³/i);
  assert.doesNotMatch(html, /AggregateRating/);
  assert.match(html, /application\/ld\+json/);
  assert.match(html, /<title>Adelaide Removalists \| HF Removals Adelaide<\/title>/i);
  assert.doesNotMatch(html, /HF Removals Adelaide \| HF Removals Adelaide<\/title>/i);
  assert.doesNotMatch(html, /codex-preview|react-loading-skeleton|5\.0 from|200\+ happy|#1 Adelaide|award.winning/i);
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
    const response = await get(path);
    assert.equal(response.status, 200, path);
    assert.match(await response.text(), pattern, path);
  }

  const about = await get("/about");
  assert.match(await about.text(), /<title>About \| HF Removals Adelaide<\/title>/i);

  const contact = await get("/contact");
  const contactHtml = await contact.text();
  assert.match(contactHtml, /Google map showing HF Removals Adelaide in Elizabeth Vale/i);
  assert.match(contactHtml, /6MW7\+J5 Elizabeth Vale/i);
  assert.match(contactHtml, /loading="lazy"/i);
  assert.match(contactHtml, /Get directions/i);

  const service = await get("/services/residential-removals");
  assert.doesNotMatch(await service.text(), /FAQPage/);

  const missing = await get("/services/not-a-real-service");
  assert.equal(missing.status, 404);
});

test("serves crawl discovery endpoints and unique guide metadata", async () => {
  const robots = await get("/robots.txt");
  assert.equal(robots.status, 200);
  assert.match(robots.headers.get("content-type") ?? "", /text\/plain/);
  assert.match(await robots.text(), /Sitemap: https:\/\/hfremovalsadelaide\.com\.au\/sitemap\.xml/);

  const sitemap = await get("/sitemap.xml");
  assert.equal(sitemap.status, 200);
  assert.match(sitemap.headers.get("content-type") ?? "", /xml/);
  assert.match(await sitemap.text(), /https:\/\/hfremovalsadelaide\.com\.au\/services\/residential-removals/);

  const guide = await get("/guides/office-relocation-checklist");
  const html = await guide.text();
  assert.match(html, /<title>Office Relocation Checklist \| HF Removals Adelaide<\/title>/i);
  assert.doesNotMatch(html, /href="\/(?:services|areas|pricing|about|contact|guides|interstate|privacy|terms)[^"]*\/"/i);
});

test("bounds and validates quote API requests without a configured provider", async () => {
  const fast = await postQuote(unconfigured, { ...validQuote, elapsedMs: 200 });
  assert.equal(fast.status, 422);

  const skewed = await postQuote(unconfigured, { ...validQuote, elapsedMs: 5_000, startedAt: Date.now() + 600_000 });
  assert.equal(skewed.status, 503, "a device clock ahead of the server must not reject a genuine enquiry");

  const badDate = await postQuote(unconfigured, { ...validQuote, date: "next week" });
  assert.equal(badDate.status, 422);

  const honeypot = await postQuote(unconfigured, { ...validQuote, company: "spam co" });
  assert.equal(honeypot.status, 200);

  const valid = await postQuote(unconfigured, validQuote);
  assert.equal(valid.status, 503);

  const oversized = await postQuote(unconfigured, { details: "x".repeat(25_000) });
  assert.equal(oversized.status, 413);
});

test("rate limits repeated enquiries once a provider is configured", async () => {
  // Points at the discard port so the handler's outbound fetch fails locally
  // and fast; the limiter runs before that fetch, which is what matters here.
  const configured = await startServer(3118, { QUOTE_ENDPOINT_URL: "https://127.0.0.1:9/quote" });
  const headers = { "x-forwarded-for": "203.0.113.10" };

  const statuses = [];
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const response = await postQuote(configured, validQuote, headers);
    statuses.push(response.status);
  }

  assert.ok(statuses.slice(0, 5).every((status) => status === 502), `expected upstream failures, got ${statuses}`);
  assert.equal(statuses.at(-1), 429, `expected the sixth enquiry to be limited, got ${statuses}`);
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
