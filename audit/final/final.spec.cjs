const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const baseURL = 'http://127.0.0.1:3100';
const out = __dirname;
const findings = [];

function diagnostics(page, label) {
  page.on('console', msg => { if (['error', 'warning'].includes(msg.type())) findings.push({ label, type: `console-${msg.type()}`, text: msg.text() }); });
  page.on('pageerror', error => findings.push({ label, type: 'pageerror', text: error.message }));
  page.on('requestfailed', request => findings.push({ label, type: 'requestfailed', text: `${request.method()} ${request.url()} :: ${request.failure()?.errorText}` }));
  page.on('response', response => { if (response.status() >= 400) findings.push({ label, type: `http-${response.status()}`, text: response.url() }); });
}

async function goto(page, route, label) {
  diagnostics(page, label);
  const response = await page.goto(`${baseURL}${route}`, { waitUntil: 'networkidle' });
  expect(response?.status()).toBeLessThan(400);
  const metrics = await page.evaluate(() => ({
    viewport: [innerWidth, innerHeight], clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth, bodyScrollWidth: document.body.scrollWidth,
    title: document.title, h1Count: document.querySelectorAll('h1').length,
    canonical: document.querySelector('link[rel="canonical"]')?.href || null,
  }));
  findings.push({ label, route, type: 'metrics', ...metrics });
}

test.afterAll(() => fs.writeFileSync(path.join(out, 'browser-findings.json'), JSON.stringify(findings, null, 2)));

test('desktop visual states and dropdown', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
  const page = await context.newPage();
  await goto(page, '/', 'home-desktop-1440');
  await page.screenshot({ path: path.join(out, 'home-desktop-1440.png'), fullPage: true });
  for (const [selector, file] of [
    ['#services', 'services-desktop-1440.png'], ['.process-section', 'process-desktop-1440.png'],
    ['#reviews', 'reviews-desktop-1440.png'], ['#quote', 'quote-form-desktop-1440.png'],
    ['#faq', 'faq-desktop-1440.png'], ['.site-footer', 'footer-desktop-1440.png']
  ]) await page.locator(selector).screenshot({ path: path.join(out, file) });

  const services = page.getByRole('button', { name: 'Services' });
  await expect(services).toHaveAttribute('aria-expanded', 'false');
  await services.click();
  await expect(services).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('#services-menu')).toBeVisible();
  await page.screenshot({ path: path.join(out, 'desktop-services-dropdown-1440.png') });
  await page.keyboard.press('Escape');
  await expect(services).toHaveAttribute('aria-expanded', 'false');
  await context.close();
});

test('mobile visuals and menu interaction', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  const page = await context.newPage();
  await goto(page, '/', 'home-mobile-390');
  await page.screenshot({ path: path.join(out, 'home-mobile-390.png'), fullPage: true });
  const toggle = page.getByRole('button', { name: 'Open menu' });
  await toggle.click();
  await expect(page.getByRole('dialog', { name: 'Mobile navigation' })).toBeVisible();
  const entryFocus = await page.evaluate(() => ({ tag: document.activeElement?.tagName, text: document.activeElement?.textContent?.trim(), inert: document.querySelector('#mobile-menu')?.hasAttribute('inert') }));
  findings.push({ label: 'mobile-menu-entry-focus', type: 'interaction', ...entryFocus });
  await expect(page.locator('body')).toHaveCSS('overflow', 'hidden');
  await page.waitForFunction(() => getComputedStyle(document.querySelectorAll('#mobile-menu nav > a')[7]).opacity === '1');
  await page.screenshot({ path: path.join(out, 'mobile-menu-390.png') });
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Open menu' })).toBeFocused();

  await toggle.click();
  const backdropTarget = await page.evaluate(() => ({ tag: document.elementFromPoint(4, 400)?.tagName, id: document.elementFromPoint(4, 400)?.id, className: document.elementFromPoint(4, 400)?.className }));
  await page.mouse.click(4, 400);
  const backdropClosed = await page.getByRole('dialog', { name: 'Mobile navigation' }).isHidden();
  findings.push({ label: 'mobile-menu-backdrop', type: 'interaction', backdropTarget, closed: backdropClosed });
  if (!backdropClosed) {
    await page.locator('#mobile-menu').dispatchEvent('pointerdown');
    await expect(page.getByRole('dialog', { name: 'Mobile navigation' })).not.toBeVisible();
  }

  await toggle.click();
  await page.setViewportSize({ width: 844, height: 390 });
  await expect(page.getByRole('dialog', { name: 'Mobile navigation' })).toBeVisible();
  const landscape = await page.evaluate(() => ({ width: innerWidth, scrollWidth: document.documentElement.scrollWidth }));
  findings.push({ label: 'mobile-orientation-landscape', type: 'metrics', ...landscape });
  await page.setViewportSize({ width: 1280, height: 800 });
  await expect(page.getByRole('dialog', { name: 'Mobile navigation' })).not.toBeVisible();
  await context.close();
});

test('contact visual desktop and mobile', async ({ browser }) => {
  for (const cfg of [{ width: 1440, height: 1000, label: 'desktop-1440' }, { width: 390, height: 844, label: 'mobile-390' }]) {
    const context = await browser.newContext({ viewport: { width: cfg.width, height: cfg.height }, reducedMotion: 'reduce' });
    const page = await context.newPage();
    await goto(page, '/contact', `contact-${cfg.label}`);
    await page.screenshot({ path: path.join(out, `contact-${cfg.label}.png`), fullPage: true });
    await context.close();
  }
});

for (const width of [320,360,375,390,412,430,768,820,1024,1280,1366,1440,1536,1920]) {
  test(`overflow ${width}`, async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width, height: width <= 430 ? 844 : 900 }, reducedMotion: 'reduce' });
    const page = await context.newPage();
    await goto(page, '/', `overflow-${width}`);
    const over = await page.evaluate(() => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - document.documentElement.clientWidth);
    findings.push({ label: `overflow-${width}`, type: 'overflow', pixels: over });
    expect(over).toBeLessThanOrEqual(0);
    await context.close();
  });
}

test('form radio keyboard behavior and FAQ', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  const page = await context.newPage();
  await goto(page, '/', 'form-keyboard');
  const local = page.getByRole('radio', { name: 'Local Adelaide Move' });
  const interstate = page.getByRole('radio', { name: 'Interstate Move' });
  await local.focus();
  await page.keyboard.press('ArrowRight');
  await expect(interstate).toHaveAttribute('aria-checked', 'true');
  await expect(interstate).toBeFocused();
  await page.keyboard.press('ArrowLeft');
  await expect(local).toHaveAttribute('aria-checked', 'true');
  const faq = page.locator('.faq-item').first();
  await faq.locator('summary').click();
  await expect(faq).toHaveAttribute('open', '');
  await faq.screenshot({ path: path.join(out, 'faq-open-mobile-390.png') });
  await context.close();
});

test('quote form validation, package selection, success, failure and double-submit guard', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  const page = await context.newPage();
  await goto(page, '/', 'quote-form-states');
  const form = page.locator('#quote');
  const submit = form.getByRole('button', { name: 'Get My Free Quote' });

  await submit.click();
  await expect(form.locator('.form-status')).toContainText('Please complete the required fields');

  const packageThree = form.getByRole('radio', { name: /3 Men \+ Truck/ });
  await packageThree.check({ force: true });
  await expect(packageThree).toBeChecked();
  await form.getByText('More Details', { exact: false }).click();
  const email = form.getByLabel('Email Address');
  await email.fill('invalid-email');
  expect(await email.evaluate((input) => input.validity.typeMismatch)).toBe(true);
  await email.fill('qa@example.com');

  await form.getByLabel('Your Name').fill('QA Test');
  await form.getByLabel('Phone Number').fill('0400 000 000');
  await form.getByLabel('Moving From (Suburb)').fill('Elizabeth Vale SA');
  await form.getByLabel('Moving To (Suburb/City)').fill('Marion SA');

  let requests = 0;
  await page.route('https://api.web3forms.com/submit', async (route) => {
    requests += 1;
    await new Promise((resolve) => setTimeout(resolve, 150));
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true }) });
  });
  await form.evaluate((element) => {
    element.requestSubmit();
    element.requestSubmit();
  });
  await expect(form.locator('.form-status')).toContainText('Your move details have been sent');
  expect(requests).toBe(1);

  await form.getByLabel('Your Name').fill('QA Test');
  await form.getByLabel('Phone Number').fill('0400 000 000');
  await form.getByLabel('Moving From (Suburb)').fill('Elizabeth Vale SA');
  await form.getByLabel('Moving To (Suburb/City)').fill('Marion SA');
  await page.unroute('https://api.web3forms.com/submit');
  await page.route('https://api.web3forms.com/submit', (route) =>
    route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ success: false, message: 'Controlled QA failure' }) })
  );
  await submit.click();
  await expect(form.locator('.form-status')).toContainText('We couldn’t send your request');
  await context.close();
});

test('internal links and unknown route', async ({ browser, request }) => {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
  const page = await context.newPage();
  await goto(page, '/', 'links-home');
  const links = await page.locator('a').evaluateAll(els => [...new Set(els.map(el => el.getAttribute('href')).filter(Boolean))]);
  const internal = [...new Set(links.filter(h => h.startsWith('/')).map(h => h.split('#')[0]).filter(Boolean))];
  for (const href of internal) {
    const response = await request.get(`${baseURL}${href}`);
    findings.push({ label: 'internal-link', type: 'status', href, status: response.status() });
    expect(response.status(), href).toBeLessThan(400);
  }
  const unknown = await request.get(`${baseURL}/qa-definitely-missing`);
  expect(unknown.status()).toBe(404);
  findings.push({ label: 'unknown-route', type: 'status', status: unknown.status() });
  await context.close();
});
