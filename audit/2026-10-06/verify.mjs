import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { startServer, origin } from '../seo/validate-seo.mjs';

const output = 'audit/2026-10-06';
await mkdir(output, { recursive: true });
const { server, base } = await startServer();
let browser;
const result = { generatedAt: new Date().toISOString(), mode: 'local production build', pages: [], browser: [], probes: [], brokenLinks: [], orphans: [], duplicates: {} };
try {
  browser = await chromium.launch({ channel: 'chromium' });
  const page = await browser.newPage();
  const robots = await fetch(`${base}/robots.txt`);
  result.robots = { status: robots.status, text: await robots.text() };
  const sitemap = await fetch(`${base}/sitemap.xml`);
  result.sitemapStatus = sitemap.status;
  const urls = [...(await sitemap.text()).matchAll(/<loc>(.*?)<\/loc>/g)].map(m => m[1]);
  result.sitemapErrors = urls.filter(url => { const parsed = new URL(url); return parsed.origin !== origin || parsed.search || parsed.hash; });
  result.sitemapDuplicates = urls.filter((url, index) => urls.indexOf(url) !== index);
  const linked = new Set(), targets = new Set();
  for (const url of urls) {
    const path = new URL(url).pathname;
    const response = await fetch(`${base}${path}`);
    const html = await response.text();
    const details = await page.evaluate(html => {
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const schemas = [], schemaErrors = [];
      for (const script of doc.querySelectorAll('script[type="application/ld+json"]')) {
        try { schemas.push(JSON.parse(script.textContent)); } catch (error) { schemaErrors.push(error.message); }
      }
      return { title: doc.title, description: doc.querySelector('meta[name="description"]')?.content, canonical: doc.querySelector('link[rel="canonical"]')?.getAttribute('href'), robots: doc.querySelector('meta[name="robots"]')?.content, h1: [...doc.querySelectorAll('h1')].map(e => e.textContent.trim()), schemas, schemaErrors, missingAlt: doc.querySelectorAll('img:not([alt])').length, links: [...doc.querySelectorAll('a[href]')].map(e => e.getAttribute('href')) };
    }, html);
    result.pages.push({ path, url, status: response.status, ...details });
    for (const href of details.links) {
      const target = new URL(href, url);
      if (target.origin === origin) { linked.add(target.pathname); targets.add(target.pathname + target.search); }
    }
  }
  for (const target of targets) {
    const response = await fetch(`${base}${target}`, { redirect: 'manual' });
    if (response.status >= 400) result.brokenLinks.push({ target, status: response.status });
    await response.body?.cancel();
  }
  result.orphans = result.pages.filter(p => p.path !== '/' && !linked.has(p.path)).map(p => p.path);
  for (const field of ['title', 'description']) {
    const groups = new Map();
    for (const p of result.pages) groups.set(p[field], [...(groups.get(p[field]) ?? []), p.path]);
    result.duplicates[field] = [...groups].filter(([, paths]) => paths.length > 1).map(([value, paths]) => ({ value, paths }));
  }
  for (const path of ['/book', '/admin', '/admin/login', '/booking/success', '/booking/cancel', '/job-completion', '/not-a-real-service-20261006', '/services/residential-removals?utm_source=verification']) {
    const response = await fetch(`${base}${path}`, { redirect: 'manual' });
    const html = await response.text();
    result.probes.push({ path, status: response.status, location: response.headers.get('location'), robots: html.match(/<meta name="robots" content="([^"]*)"/)?.[1], canonical: html.match(/<link rel="canonical" href="([^"]*)"/)?.[1] });
  }
  const routes = ['/', '/services/residential-removals', '/services/furniture-removals', '/services/office-commercial-removals', '/services/interstate-removals', '/pricing', '/contact', '/areas/unley-park', '/book'];
  for (const width of [320, 375, 390, 430, 768, 1440, 1920]) for (const path of routes) {
    const errors = [], failedImages = [];
    const onError = error => errors.push(error.message);
    const onConsole = message => { if (message.type() === 'error') errors.push(message.text()); };
    const onResponse = response => { if (response.request().resourceType() === 'image' && response.status() >= 400) failedImages.push({ url: response.url(), status: response.status() }); };
    page.on('pageerror', onError); page.on('console', onConsole); page.on('response', onResponse);
    await page.setViewportSize({ width, height: 900 });
    const response = await page.goto(`${base}${path}`, { waitUntil: 'networkidle' });
    const screenshotCase = (width === 375 && ['/', '/services/residential-removals'].includes(path)) || (width === 1440 && path === '/');
    await page.evaluate(async delay => {
      for (let y = 0; y < document.documentElement.scrollHeight; y += 650) { window.scrollTo(0, y); await new Promise(resolve => setTimeout(resolve, delay)); }
      window.scrollTo(0, 0);
    }, screenshotCase ? 300 : 30);
    await page.waitForTimeout(250);
    const details = await page.evaluate(() => ({ overflow: document.documentElement.scrollWidth > innerWidth + 1, scrollWidth: document.documentElement.scrollWidth, h1Count: document.querySelectorAll('h1').length, brokenImages: [...document.images].filter(img => img.complete && img.naturalWidth === 0).map(img => img.currentSrc), oversizedImages: [...document.images].filter(img => img.naturalWidth > img.clientWidth * devicePixelRatio * 2 && img.clientWidth > 200).map(img => ({ src: img.currentSrc, naturalWidth: img.naturalWidth, renderedWidth: img.clientWidth })), telephoneLinks: [...document.querySelectorAll('a[href^="tel:"]')].map(a => a.getAttribute('href')) }));
    result.browser.push({ path, width, status: response.status(), ...details, errors, failedImages });
    if (screenshotCase) await page.screenshot({ path: `${output}/${path === '/' ? 'home' : 'house'}-${width}.png`, fullPage: true });
    page.off('pageerror', onError); page.off('console', onConsole); page.off('response', onResponse);
    console.log(`Browser ${width} ${path}: ${details.overflow || errors.length || details.brokenImages.length ? 'CHECK' : 'OK'}`);
  }
  result.failures = result.pages.filter(p => p.status !== 200 || p.canonical !== p.url || !p.title || !p.description || p.h1.length !== 1 || !p.schemas.length || p.schemaErrors.length || p.missingAlt || /noindex/i.test(p.robots ?? '')).map(p => p.path);
  result.probeFailures = result.probes.filter(p => {
    if (p.path === '/admin') return ![307, 308].includes(p.status) || !p.location?.includes('/admin/login');
    if (p.path.includes('not-a-real')) return p.status !== 404;
    if (p.path.includes('?')) return p.status !== 200 || p.canonical !== `${origin}/services/residential-removals`;
    return p.status !== 200 || !/noindex/i.test(p.robots ?? '');
  });
  result.browserFailures = result.browser.filter(p => p.status !== 200 || p.overflow || p.h1Count !== 1 || !p.telephoneLinks.length || p.errors.length || p.brokenImages.length || p.failedImages.length);
  result.infrastructureFailure = result.robots.status !== 200 || !result.robots.text.includes(`Sitemap: ${origin}/sitemap.xml`) || result.sitemapStatus !== 200 || !urls.length || result.sitemapErrors.length > 0 || result.sitemapDuplicates.length > 0;
  await writeFile(`${output}/runtime.json`, JSON.stringify(result, null, 2));
  console.log(JSON.stringify({ pages: result.pages.length, failures: result.failures, brokenLinks: result.brokenLinks, orphans: result.orphans, duplicates: result.duplicates, browserChecks: result.browser.length, browserFailures: result.browserFailures, probes: result.probes }, null, 2));
  if (result.infrastructureFailure || result.probeFailures.length || result.failures.length || result.brokenLinks.length || result.orphans.length || Object.values(result.duplicates).some(x => x.length) || result.browserFailures.length) process.exitCode = 1;
} finally { await browser?.close(); server.kill(); }
