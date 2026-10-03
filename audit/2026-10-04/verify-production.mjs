import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";
import { origin, startServer } from "../seo/validate-seo.mjs";

const directory = fileURLToPath(new URL("./", import.meta.url));
const widths = [320, 360, 375, 390, 412, 430, 768, 820, 1024, 1280, 1440, 1920];
const paths = ["/", ...["residential-removals", "furniture-removals", "office-commercial-removals", "interstate-removals", "backloading", "packing-unpacking"].map(slug => `/services/${slug}`), "/areas/unley-park", "/areas", "/contact", "/pricing"];
await mkdir(`${directory}/screenshots`, { recursive: true });
const result = process.argv.includes("--browser-only") ? { ...JSON.parse(await readFile(`${directory}/production-verification.json`, "utf8")), generatedAt: new Date().toISOString(), browser: [], screenshots: [], rerun: "browser-only; SEO evidence retained from final-build crawl" } : { generatedAt: new Date().toISOString(), mode: "local-production-build", widths, pages: [], brokenLinks: [], brokenFragments: [], orphans: [], duplicates: {}, browser: [], screenshots: [] };
let server;
let browser;
try {
  const running = await startServer();
  server = running.server;
  const base = running.base;
  result.base = base;
  browser = await chromium.launch({ channel: "chromium" });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  if (!process.argv.includes("--browser-only")) {
  const sitemapResponse = await fetch(`${base}/sitemap.xml`);
  result.sitemapStatus = sitemapResponse.status;
  const sitemap = await sitemapResponse.text();
  const urls = [...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map(match => match[1].replaceAll("&amp;", "&"));
  result.invalidSitemapUrls = urls.filter(url => new URL(url).origin !== origin || new URL(url).search || new URL(url).hash);
  const robotsResponse = await fetch(`${base}/robots.txt`);
  result.robotsStatus = robotsResponse.status;
  result.robotsSitemapPresent = (await robotsResponse.text()).includes(`Sitemap: ${origin}/sitemap.xml`);
  const incoming = new Map();
  const targets = new Map();
  for (const url of urls) {
    const path = new URL(url).pathname;
    const response = await page.goto(`${base}${path}`, { waitUntil: "domcontentloaded" });
    const details = await page.evaluate(() => {
      const schemas = [];
      const schemaErrors = [];
      for (const element of document.querySelectorAll('script[type="application/ld+json"]')) {
        try { schemas.push(JSON.parse(element.textContent)); } catch (error) { schemaErrors.push(error.message); }
      }
      return { title: document.title, description: document.querySelector('meta[name="description"]')?.content, canonical: document.querySelector('link[rel="canonical"]')?.href, robots: document.querySelector('meta[name="robots"]')?.content, h1: [...document.querySelectorAll("h1")].map(element => element.textContent.trim()), schemaCount: schemas.length, schemaErrors, imagesMissingAlt: document.querySelectorAll("img:not([alt])").length, links: [...document.querySelectorAll("a[href]")].map(element => element.getAttribute("href")), ids: [...document.querySelectorAll("[id]")].map(element => element.id) };
    });
    result.pages.push({ path, status: response?.status(), ...details });
    for (const href of details.links) {
      const target = new URL(href, `${origin}${path}`);
      if (target.origin !== origin) continue;
      if (target.pathname !== path) incoming.set(target.pathname, true);
      const key = `${target.pathname}${target.search}`;
      if (!targets.has(key)) targets.set(key, new Set());
      if (target.hash) targets.get(key).add(decodeURIComponent(target.hash.slice(1)));
    }
  }
  for (const [target, fragments] of targets) {
    const response = await fetch(`${base}${target}`, { redirect: "manual" });
    const html = await response.text();
    if (response.status >= 400) result.brokenLinks.push({ target, status: response.status });
    if (response.status === 200 && fragments.size) {
      const ids = await page.evaluate(source => [...new DOMParser().parseFromString(source, "text/html").querySelectorAll("[id]")].map(element => element.id), html);
      for (const fragment of fragments) if (!ids.includes(fragment)) result.brokenFragments.push({ target, fragment });
    }
  }
  result.orphans = result.pages.filter(entry => entry.path !== "/" && !incoming.has(entry.path)).map(entry => entry.path);
  for (const field of ["title", "description"]) {
    const groups = new Map();
    for (const entry of result.pages) groups.set(entry[field], [...(groups.get(entry[field]) ?? []), entry.path]);
    result.duplicates[field] = [...groups].filter(([, entries]) => entries.length > 1).map(([value, entries]) => ({ value, paths: entries }));
  }
  }
  for (const width of process.argv.includes("--crawl-only") ? [] : widths) {
    const responsiveContext = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: "reduce" });
    const page = await responsiveContext.newPage();
    for (const path of paths) {
      const errors = [];
      const onError = error => errors.push({ type: "pageerror", message: error.message });
      const onConsole = message => { if (message.type() === "error") errors.push({ type: "console", message: message.text(), location: message.location() }); };
      const requestFailures = [];
      const responseFailures = [];
      const onRequestFailed = request => requestFailures.push({ url: request.url(), failure: request.failure() });
      const onResponse = response => { if (response.status() >= 400) responseFailures.push({ url: response.url(), status: response.status() }); };
      page.on("pageerror", onError);
      page.on("console", onConsole);
      page.on("requestfailed", onRequestFailed);
      page.on("response", onResponse);
      try {
        const response = await page.goto(`${base}${path}`, { waitUntil: "networkidle" });
        // Scroll through the page to trigger every lazy image before inspecting loads.
        await page.evaluate(async () => {
          document.documentElement.style.scrollBehavior = "auto";
          for (const image of document.querySelectorAll("img")) {
            if (!image.getBoundingClientRect().width || !image.getBoundingClientRect().height) continue;
            image.scrollIntoView({ behavior: "instant", block: "center" });
            await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
            await Promise.race([image.decode().catch(() => {}), new Promise(resolve => setTimeout(resolve, 5000))]);
          }
          scrollTo({ top: 0, behavior: "instant" });
        });
        await page.waitForTimeout(250);
        const details = await page.evaluate(() => {
          const images = [...document.querySelectorAll("img")].filter(image => image.getBoundingClientRect().width > 0 && image.getBoundingClientRect().height > 0).map(image => ({ alt: image.alt, src: image.getAttribute("src"), currentSrc: image.currentSrc, renderedWidth: Math.round(image.getBoundingClientRect().width), naturalWidth: image.naturalWidth, loaded: image.complete && image.naturalWidth > 0 }));
          return { overflow: document.documentElement.scrollWidth > innerWidth + 1, scrollWidth: document.documentElement.scrollWidth, h1Count: document.querySelectorAll("h1").length, failedImages: images.filter(image => !image.loaded), images, overflowElements: [...document.querySelectorAll("body *")].filter(element => { const rectangle = element.getBoundingClientRect(); return rectangle.width > 0 && (rectangle.right > innerWidth + 1 || rectangle.left < -1); }).slice(0, 12).map(element => ({ tag: element.tagName, className: String(element.className), text: element.textContent?.trim().slice(0, 80) })) };
        });
        result.browser.push({ path, width, status: response?.status(), errors, requestFailures, responseFailures, ...details });
        if ([375, 1440].includes(width)) {
          const filename = `${width}-${path === "/" ? "home" : path.slice(1).replaceAll("/", "-")}.png`;
          await page.screenshot({ path: `${directory}/screenshots/${filename}`, fullPage: true });
          result.screenshots.push(filename);
          await page.screenshot({ path: `${directory}/screenshots/viewport-${filename}` });
          result.screenshots.push(`viewport-${filename}`);
        }
      } finally { page.off("pageerror", onError); page.off("console", onConsole); page.off("requestfailed", onRequestFailed); page.off("response", onResponse); }
    }
    await responsiveContext.close();
  }
  result.pageFailures = result.pages.filter(entry => entry.status !== 200 || !entry.title || !entry.description || entry.canonical !== new URL(entry.path, origin).href || entry.h1.length !== 1 || !entry.schemaCount || entry.schemaErrors.length || entry.imagesMissingAlt || /noindex/i.test(entry.robots ?? "")).map(entry => entry.path);
  result.browserFailures = result.browser.filter(entry => entry.status !== 200 || entry.overflow || entry.h1Count !== 1 || entry.failedImages.length || entry.errors.length).map(entry => ({ path: entry.path, width: entry.width, status: entry.status, overflow: entry.overflow, failedImages: entry.failedImages, errors: entry.errors }));
  result.summary = { sitemapPages: result.pages.length, browserChecks: result.browser.length, screenshots: result.screenshots.length, pageFailures: result.pageFailures.length, browserFailures: result.browserFailures.length, brokenLinks: result.brokenLinks.length, brokenFragments: result.brokenFragments.length, orphans: result.orphans.length, duplicateTitles: result.duplicates.title.length, duplicateDescriptions: result.duplicates.description.length, mobileOptimizedImages: result.browser.filter(entry => entry.width < 768).flatMap(entry => entry.images.filter(image => image.currentSrc.includes("/_next/image")).map(image => ({ path: entry.path, viewport: entry.width, renderedWidth: image.renderedWidth, naturalWidth: image.naturalWidth, requestedWidth: new URL(image.currentSrc).searchParams.get("w") }))) };
  console.log(JSON.stringify(result.summary, null, 2));
  if (result.pageFailures.length || result.browserFailures.length || result.brokenLinks.length || result.brokenFragments.length || result.orphans.length || result.duplicates.title.length || result.duplicates.description.length || result.invalidSitemapUrls.length || result.sitemapStatus !== 200 || result.robotsStatus !== 200 || !result.robotsSitemapPresent) process.exitCode = 1;
} catch (error) {
  result.fatalError = error.stack;
  process.exitCode = 1;
  console.error(error);
} finally {
  const outputName = process.argv.includes("--crawl-only") ? "production-crawl.json" : process.argv.includes("--browser-only") ? "browser-verification.json" : "production-verification.json";
  await writeFile(`${directory}/${outputName}`, JSON.stringify(result, null, 2));
  await browser?.close();
  server?.kill();
}
