import { spawn } from "node:child_process";
import { createServer, request } from "node:http";
import { writeFile } from "node:fs/promises";
import { chromium } from "@playwright/test";

export const origin = "https://www.hfremovalsadelaide.com.au";
export const priority = ["/", "/services", ...["residential-removals", "furniture-removals", "office-commercial-removals", "interstate-removals", "packing-unpacking", "backloading"].map(s => `/services/${s}`), "/pricing", "/guides/how-removalist-pricing-works", "/areas", ...["unley-park", "adelaide-hills", "hyde-park", "medindie", "toorak-gardens", "malvern", "adelaide-cbd", "north-adelaide", "woodcroft", "gawler", "mount-barker", "campbelltown"].map(s => `/areas/${s}`), ...["sydney", "melbourne", "perth"].map(s => `/interstate/adelaide-${s}`), "/contact", "/about"];
export async function startServer() {
  const socket = createServer();
  await new Promise(resolve => socket.listen(0, "127.0.0.1", resolve));
  const port = socket.address().port;
  await new Promise(resolve => socket.close(resolve));
  const server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "--port", String(port)], { cwd: process.cwd(), stdio: ["ignore", "pipe", "pipe"] });
  let logs = "";
  server.stdout.on("data", b => { logs += b; });
  server.stderr.on("data", b => { logs += b; });
  const base = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 150; i++) {
    if (server.exitCode !== null) throw new Error(logs);
    try { if ((await fetch(base)).ok) return { server, base, port }; } catch { /* Startup polling only. */ }
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  server.kill();
  throw new Error(`Production server startup timeout: ${logs}`);
}
export function hostRequest(port, path, host) {
  return new Promise((resolve, reject) => {
    const req = request({ hostname: "127.0.0.1", port, path, headers: { host } }, res => {
      res.resume();
      res.on("end", () => resolve({ status: res.statusCode, location: res.headers.location }));
    });
    req.on("error", reject); req.end();
  });
}
async function probe(url) {
  const hops = [];
  try {
    for (let i = 0; i < 6; i++) {
      const response = await fetch(url, { redirect: "manual", signal: AbortSignal.timeout(20000) });
      const location = response.headers.get("location");
      hops.push({ url, status: response.status, location });
      await response.body?.cancel();
      if (!location || response.status < 300 || response.status >= 400) break;
      url = new URL(location, url).href;
    }
    return { hops, final: url };
  } catch (error) { return { hops, error: error.message }; }
}
export async function audit({ live = false } = {}) {
  const { server, base, port } = live ? { base: origin } : await startServer();
  let browser;
  const result = { generatedAt: new Date().toISOString(), mode: live ? "live" : "local", base, pages: [], brokenLinks: [], orphanPages: [], duplicates: {}, browser: [], redirects: [], liveRedirects: [], invalidPaths: [] };
  try {
    browser = await chromium.launch({ channel: "chromium" });
    const context = await browser.newContext();
    const page = await context.newPage();
    const robotsResponse = await fetch(`${base}/robots.txt`, { redirect: "manual" });
    result.robotsStatus = robotsResponse.status;
    result.robotsText = await robotsResponse.text();
    result.robotsSitemapPresent = result.robotsText.includes(`Sitemap: ${origin}/sitemap.xml`);
    const sitemapResponse = await fetch(`${base}/sitemap.xml`, { redirect: "manual" });
    result.sitemapStatus = sitemapResponse.status;
    const xml = await sitemapResponse.text();
    const urls = [...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map(m => m[1]);
    result.invalidSitemapUrls = urls.filter(url => { const parsed = new URL(url); return parsed.origin !== origin || parsed.search || parsed.hash; });
    const linked = new Set(); const targets = new Set();
    for (const url of urls) {
      const path = new URL(url).pathname;
      const response = await page.goto(`${base}${path}`, { waitUntil: "domcontentloaded" });
      const details = await page.evaluate(() => {
        const schemas = []; const schemaErrors = [];
        for (const element of document.querySelectorAll('script[type="application/ld+json"]')) {
          try { schemas.push(JSON.parse(element.textContent)); } catch (e) { schemaErrors.push(e.message); }
        }
        return { title: document.title, description: document.querySelector('meta[name="description"]')?.content, robots: document.querySelector('meta[name="robots"]')?.content, canonical: document.querySelector('link[rel="canonical"]')?.href, h1: [...document.querySelectorAll("h1")].map(e => e.textContent.trim()), schemas, schemaErrors, imagesMissingAlt: document.querySelectorAll("img:not([alt])").length, links: [...document.querySelectorAll("a[href]")].map(e => e.getAttribute("href")) };
      });
      result.pages.push({ url, path, status: response.status(), ...details });
      for (const href of details.links) {
        const target = new URL(href, `${origin}${path}`);
        if (target.origin === origin) { linked.add(target.pathname); targets.add(target.pathname + target.search); }
      }
    }
    for (const target of targets) {
      const response = await fetch(`${base}${target}`, { redirect: "manual" });
      if (response.status >= 400) result.brokenLinks.push({ target, status: response.status });
      await response.body?.cancel();
    }
    result.orphanPages = result.pages.filter(p => p.path !== "/" && !linked.has(p.path)).map(p => p.path);
    for (const field of ["title", "description"]) {
      const groups = new Map();
      for (const p of result.pages) groups.set(p[field], [...(groups.get(p[field]) ?? []), p.path]);
      result.duplicates[field] = [...groups].filter(([, paths]) => paths.length > 1).map(([value, paths]) => ({ value, paths }));
    }
    for (const width of [375, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      for (const path of priority) {
        const errors = [];
        const onError = error => errors.push(error.message);
        const onConsole = message => { if (message.type() === "error") errors.push(message.text()); };
        page.on("pageerror", onError); page.on("console", onConsole);
        const response = await page.goto(`${base}${path}`, { waitUntil: "networkidle" });
        const details = await page.evaluate(() => ({ overflow: document.documentElement.scrollWidth > innerWidth + 1, h1Count: document.querySelectorAll("h1").length, invalidPatterns: [...document.querySelectorAll("input[pattern]")].flatMap(input => {
          try { new RegExp(input.getAttribute("pattern"), "v"); return []; }
          catch (error) { return [{ name: input.name, pattern: input.getAttribute("pattern"), error: error.message }]; }
        }), headings: [...document.querySelectorAll("h1,h2,h3,h4")].map(e => ({ level: Number(e.tagName.slice(1)), text: e.textContent.trim() })) }));
        result.browser.push({ path, width, status: response.status(), errors, ...details });
        page.off("pageerror", onError); page.off("console", onConsole);
      }
    }
    for (const path of ["/services/residential-removals/anything", "/pricing/anything", "/interstate/adelaide-sydney/anything"]) {
      const response = await fetch(`${base}${path}`, { redirect: "manual" });
      result.invalidPaths.push({ path, status: response.status, location: response.headers.get("location") });
      await response.body?.cancel();
    }
    if (!live) for (const host of ["hfremovalsadelaide.com.au", "www.hfremovalsadelaide.com.au"]) {
      for (const path of ["/?seo_probe=1", "/contact-us/?seo_probe=1", "/about-us/?seo_probe=1", "/services/packing-unpacking/?seo_probe=1"]) result.redirects.push({ host, path, ...await hostRequest(port, path, host) });
    }
    for (const protocol of ["http", "https"]) for (const host of ["hfremovalsadelaide.com.au", "www.hfremovalsadelaide.com.au"]) for (const path of ["/", "/contact-us/", "/about-us/"]) result.liveRedirects.push({ requested: `${protocol}://${host}${path}`, ...await probe(`${protocol}://${host}${path}`) });
    result.failures = result.pages.filter(p => p.status !== 200 || p.canonical !== new URL(p.url).href || !p.title || !p.description || p.h1.length !== 1 || !p.schemas.length || p.schemaErrors.length || /noindex/i.test(p.robots ?? "") || p.imagesMissingAlt).map(p => p.path);
    await writeFile(live ? "audit/seo/live-validation-results.json" : "audit/seo/validation-results.json", JSON.stringify(result, null, 2));
    console.log(JSON.stringify({ mode: result.mode, pages: result.pages.length, robotsStatus: result.robotsStatus, robotsSitemapPresent: result.robotsSitemapPresent, invalidPaths: result.invalidPaths, invalidSitemapUrls: result.invalidSitemapUrls, failures: result.failures, brokenLinks: result.brokenLinks, orphans: result.orphanPages, duplicates: result.duplicates, browserFailures: result.browser.filter(p => p.overflow || p.h1Count !== 1 || p.errors.length || p.invalidPatterns.length), liveRedirects: result.liveRedirects }, null, 2));
    return result;
  } finally { await browser?.close(); server?.kill(); }
}
if (process.argv[1]?.replaceAll("\\", "/").endsWith("/validate-seo.mjs")) {
  const result = await audit({ live: process.argv.includes("--live") });
  if (result.sitemapStatus !== 200 || !result.pages.length || result.invalidSitemapUrls.length || result.robotsStatus !== 200 || !result.robotsSitemapPresent || result.invalidPaths.some(p => p.status !== 404) || result.failures.length || result.brokenLinks.length || result.orphanPages.length || Object.values(result.duplicates).some(entries => entries.length) || result.browser.some(p => p.status !== 200 || p.overflow || p.h1Count !== 1 || p.errors.length || p.invalidPatterns.length)) process.exitCode = 1;
}
