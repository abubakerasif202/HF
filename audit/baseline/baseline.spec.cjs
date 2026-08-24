const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const baseURL = 'http://127.0.0.1:3100';
const out = path.resolve(__dirname);
const findings = [];

function attachDiagnostics(page, label) {
  page.on('console', msg => {
    if (['error', 'warning'].includes(msg.type())) findings.push({ label, type: `console-${msg.type()}`, text: msg.text() });
  });
  page.on('pageerror', error => findings.push({ label, type: 'pageerror', text: error.message }));
  page.on('requestfailed', request => findings.push({ label, type: 'requestfailed', text: `${request.method()} ${request.url()} :: ${request.failure()?.errorText}` }));
  page.on('response', response => {
    if (response.status() >= 400) findings.push({ label, type: `http-${response.status()}`, text: response.url() });
  });
}

async function auditPage(page, route, label, screenshot, fullPage = true) {
  attachDiagnostics(page, label);
  const response = await page.goto(`${baseURL}${route}`, { waitUntil: 'networkidle' });
  expect(response && response.status(), `${route} response`).toBeLessThan(400);
  const metrics = await page.evaluate(() => ({
    innerWidth: window.innerWidth,
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    bodyScrollWidth: document.body.scrollWidth,
    title: document.title,
    h1: [...document.querySelectorAll('h1')].map(el => el.textContent.trim()),
    canonical: document.querySelector('link[rel="canonical"]')?.href || null,
  }));
  findings.push({ label, route, type: 'metrics', ...metrics });
  await page.screenshot({ path: path.join(out, screenshot), fullPage });
}

test.afterAll(() => {
  fs.writeFileSync(path.join(out, 'browser-findings.json'), JSON.stringify(findings, null, 2));
});

test('desktop homepage and representative routes', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
  const page = await context.newPage();
  await auditPage(page, '/', 'home-desktop-1440', 'home-desktop-1440.png');
  await auditPage(page, '/contact', 'contact-desktop-1440', 'contact-desktop-1440.png');
  await auditPage(page, '/services/residential-removals', 'service-desktop-1440', 'service-desktop-1440.png');
  await auditPage(page, '/privacy', 'privacy-desktop-1440', 'privacy-desktop-1440.png');
  await auditPage(page, '/terms', 'terms-desktop-1440', 'terms-desktop-1440.png');
  const response = await page.goto(`${baseURL}/definitely-not-a-real-route`, { waitUntil: 'networkidle' });
  findings.push({ label: '404-desktop-1440', route: '/definitely-not-a-real-route', type: 'status', status: response?.status() });
  await expect(page.getByRole('heading', { level: 1 })).toContainText('moved on');
  await page.screenshot({ path: path.join(out, '404-desktop-1440.png'), fullPage: true });
  await context.close();
});

for (const width of [320, 360, 375, 390, 412, 430, 768, 1024, 1366, 1920]) {
  test(`homepage responsive ${width}`, async ({ browser }) => {
    const height = width < 600 ? 844 : 900;
    const context = await browser.newContext({ viewport: { width, height }, reducedMotion: 'reduce' });
    const page = await context.newPage();
    await auditPage(page, '/', `home-${width}`, `home-${width}.png`, width === 390);
    if (width === 390) {
      const toggle = page.getByRole('button', { name: 'Open menu' });
      await expect(toggle).toBeVisible();
      await toggle.click();
      await expect(page.getByRole('dialog', { name: 'Mobile navigation' })).toBeVisible();
      await page.waitForFunction(() => {
        const links = document.querySelectorAll('#mobile-menu nav > a');
        return links.length === 8 && getComputedStyle(links[7]).opacity === '1';
      });
      const focused = await page.evaluate(() => document.activeElement?.textContent?.trim());
      const bodyOverflow = await page.evaluate(() => getComputedStyle(document.body).overflow);
      findings.push({ label: 'mobile-menu-390', type: 'interaction', focused, bodyOverflow });
      await page.screenshot({ path: path.join(out, 'mobile-menu-390.png'), fullPage: false });
      await page.keyboard.press('Escape');
      await expect(page.getByRole('dialog', { name: 'Mobile navigation' })).not.toBeVisible();
    }
    await context.close();
  });
}

test('internal links and contact semantics', async ({ browser, request }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await page.goto(`${baseURL}/`, { waitUntil: 'networkidle' });
  const links = await page.locator('a').evaluateAll(els => [...new Set(els.map(el => el.getAttribute('href')).filter(Boolean))]);
  const internal = links.filter(href => href.startsWith('/') && !href.startsWith('//')).map(href => href.split('#')[0]).filter(Boolean);
  for (const href of [...new Set(internal)]) {
    const response = await request.get(`${baseURL}${href}`);
    findings.push({ label: 'internal-link', type: 'status', href, status: response.status() });
  }
  findings.push({ label: 'contact-links', type: 'semantics', tel: links.filter(h => h.startsWith('tel:')).length, mailto: links.filter(h => h.startsWith('mailto:')).length });
  await context.close();
});
