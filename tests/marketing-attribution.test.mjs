import test from 'node:test';
import assert from 'node:assert/strict';
import { captureAttribution, mergeAttribution, safePage } from '../lib/marketing-attribution.ts';
test('capture bounded campaign/click fields without URL query PII', () => {
 const result = captureAttribution('https://hf.example/contact?utm_source=google&gclid=123&fbclid=456&email=private', 'https://google.com/search?q=private');
 assert.deepEqual(result, { landing_page: 'https://hf.example/contact', referrer: 'https://google.com/search', utm_source: 'google', gclid: '123', fbclid: '456' });
 assert.equal(safePage('javascript:alert(1)'), undefined);
});
test('first meaningful source persists across navigation and later campaigns', () => {
 const first = captureAttribution('https://hf.example/?utm_source=google', '');
 assert.deepEqual(mergeAttribution(first, captureAttribution('https://hf.example/contact?utm_source=facebook', 'https://hf.example/')), first);
 assert.deepEqual(mergeAttribution({ landing_page: 'https://hf.example/' }, first), first);
});
test('storage requires opt-in, survives navigation and clears on withdrawal/privacy signal', async () => {
 const { recordAttribution, readAttribution, ATTRIBUTION_KEY } = await import('../lib/marketing-attribution.ts');
 const descriptors = Object.fromEntries(['window', 'document', 'navigator', 'sessionStorage'].map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
 const storage = new Map();
 const browser = { location: { href: 'https://hf.example/?utm_source=google' } };
 const privacy = {};
 Object.defineProperties(globalThis, {
  window: { configurable: true, value: browser }, document: { configurable: true, value: { referrer: '' } },
  navigator: { configurable: true, value: privacy },
  sessionStorage: { configurable: true, value: { getItem: (key) => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: (key) => storage.delete(key) } },
 });
 try {
  recordAttribution(false); assert.equal(storage.size, 0);
  recordAttribution(true); assert.equal(readAttribution().utm_source, 'google');
  browser.location.href = 'https://hf.example/contact?utm_source=facebook';
  recordAttribution(true); assert.equal(readAttribution().utm_source, 'google');
  assert.equal(JSON.parse(storage.get(ATTRIBUTION_KEY)).latest.utm_source, 'facebook');
  recordAttribution(false); assert.equal(storage.size, 0);
  privacy.globalPrivacyControl = true; recordAttribution(true); assert.equal(storage.size, 0);
 } finally {
  for (const [key, descriptor] of Object.entries(descriptors)) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key]; }
 }
});
