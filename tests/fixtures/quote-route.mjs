import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
const events = []; let dbFails = false; let crmFails = false; let saved;
mock.module('../../lib/server/quote-repo.ts', { namedExports: {
 saveQuote: async (quote) => { events.push('supabase'); saved = quote; if (dbFails) throw Error('secret'); return 'created'; },
 recordQuoteDelivery: async () => events.push('delivery-record'),
} });
mock.module('../../lib/server/quote-notifications.ts', { namedExports: { sendQuoteNotification: async () => { events.push('notification'); return { status: 'sent', attemptedAt: new Date().toISOString() }; } } });
mock.module('../../lib/integrations/mautic/schedule-sync.ts', { namedExports: { scheduleMauticSync: () => { events.push('mautic'); if (crmFails) throw Error('secret'); } } });
mock.module('../../lib/server/rate-limit.ts', { namedExports: { enforceRateLimit: async () => null } });
mock.module('../../lib/server/config.ts', { namedExports: { supabaseConfig: { isConfigured: () => true } } });
const { POST } = await import('../../app/api/quote/route.ts');
const input = { request_id: '33333333-3333-4333-8333-333333333333', name: 'Alex', phone: '0400000000', moving_from: 'Adelaide', moving_to: 'Marion', move_type: 'Residential (House / Unit)', move_category: 'Local Adelaide Move', source_page: 'https://hf.example/' };
function request(body = input, origin = 'https://hf.example') { return new Request('https://hf.example/api/quote', { method: 'POST', headers: { origin, 'content-type': 'application/json' }, body: JSON.stringify(body) }); }
test('disabled bridge never touches integrations', async () => {
 process.env.NEXT_PUBLIC_HF_QUOTE_BRIDGE_ENABLED = 'false'; events.length = 0;
 assert.equal((await POST(request())).status, 503); assert.deepEqual(events, []);
});
test('quote endpoint succeeds when Mautic scheduler throws after storage/notification', async () => {
 process.env.NEXT_PUBLIC_HF_QUOTE_BRIDGE_ENABLED = 'true'; events.length = 0; crmFails = true;
 const result = await POST(request());
 assert.equal(result.status, 200); assert.deepEqual(await result.json(), { success: true });
 assert.deepEqual(events, ['supabase', 'notification', 'delivery-record', 'mautic']); crmFails = false;
});
test('quote endpoint database failure never calls CRM or notification and reveals no exception', async () => {
 events.length = 0; dbFails = true;
 const result = await POST(request()); assert.equal(result.status, 503);
 assert.deepEqual(events, ['supabase']); assert.doesNotMatch(await result.text(), /secret/); dbFails = false;
});
test('cross-origin, invalid and oversized submissions rejected', async () => {
 events.length = 0;
 assert.equal((await POST(request(input, 'https://evil.example'))).status, 403);
 assert.equal((await POST(request({ ...input, email: 'invalid' }))).status, 400);
 assert.equal((await POST(request({ ...input, details: 'x'.repeat(33000) }))).status, 413);
 assert.deepEqual(events, []);
});
test('native multipart submission preserves critical fields without client credentials', async () => {
 const form = new FormData(); for (const [key, value] of Object.entries(input)) form.set(key, value);
 form.set('access_key', 'attacker'); form.append('services[]', 'Packing');
 const response = await POST(new Request('https://hf.example/api/quote', { method: 'POST', headers: { origin: 'https://hf.example' }, body: form }));
 assert.equal(response.status, 200); assert.equal(saved.access_key, undefined); assert.deepEqual(saved['services[]'], ['Packing']);
});

test('honeypot accepts quietly without saving or delivering a lead', async () => {
 events.length = 0;
 const response = await POST(request({ ...input, _gotcha: 'spam' }));
 assert.equal(response.status, 200); assert.deepEqual(await response.json(), { success: true }); assert.deepEqual(events, []);
});
