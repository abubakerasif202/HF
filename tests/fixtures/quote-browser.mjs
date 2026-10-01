// Run against a LOCAL HF server. HF_BRIDGE_EXPECTED=false tests the legacy build.
// All quote/backend and third-party traffic is intercepted; no live lead is sent.
import { chromium, expect } from '@playwright/test';
import assert from 'node:assert/strict';
const bridge = process.env.HF_BRIDGE_EXPECTED !== 'false';
const browser = await chromium.launch(process.env.HF_BROWSER_EXECUTABLE ? { executablePath: process.env.HF_BROWSER_EXECUTABLE } : {});
try {
 for (const width of [375, 1440]) {
  const page = await browser.newPage({ viewport: { width, height: 900 } });
  let submitted;
  await page.route('**/*', async (route) => {
   const url = new URL(route.request().url());
   if (url.hostname === 'api.web3forms.com' && !bridge) { submitted = route.request().postData(); return route.fulfill({ json: { success: true } }); }
   if (!['127.0.0.1', 'localhost'].includes(url.hostname)) return route.abort();
   if (url.pathname === '/api/quote') { submitted = route.request().postDataJSON(); return route.fulfill({ json: { success: true } }); }
   return route.continue();
  });
  await page.goto('http://127.0.0.1:3114/?utm_source=google&utm_medium=cpc&gclid=test-click');
  await expect(page.locator('form').filter({ has: page.locator('input[name="moving_from"]') })).toHaveAttribute('action', bridge ? '/api/quote' : 'https://api.web3forms.com/submit');
  const consent = page.getByRole('checkbox', { name: /Allow HF to remember/ });
  if (bridge) { await expect(consent).toBeEnabled(); await consent.check(); }
  else await expect(consent).toHaveCount(0);
  await page.goto('http://127.0.0.1:3114/contact?utm_source=facebook');
  if (bridge) await expect(consent).toBeChecked();
  else await expect(consent).toHaveCount(0);
  await page.locator('input[name="name"]').fill('Test Customer');
  await page.locator('input[name="phone"]').fill('0400000000');
  await page.locator('input[name="moving_from"]').fill('Adelaide');
  await page.locator('input[name="moving_to"]').fill('Marion');
  await page.locator('input[name="email"]').fill('test@example.com');
  await page.getByRole('button', { name: 'Get My Free Quote' }).click();
  await page.getByText('Thank you. Your move details have been sent').waitFor();
  if (bridge) {
  assert.equal(submitted.attribution.utm_source, 'google');
  assert.equal(submitted.attribution.gclid, 'test-click');
  assert.equal(submitted.attribution_consent, true);
  assert.match(submitted.request_id, /^[0-9a-f-]{36}$/);
  } else { assert.match(submitted, /Adelaide/); assert.match(submitted, /Marion/); }
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `${width}px overflow`);
  console.log(`${bridge ? "bridge" : "legacy"} browser check passed at ${width}px`);
  await page.close();
 }
} finally { await browser.close(); }
