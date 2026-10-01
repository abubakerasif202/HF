import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
let configured = true; let recipient = 'admin@example.com'; let from = 'HF <quotes@example.com>'; let send = async () => ({ data: { id: 'synthetic-message' }, error: null });
const rows = new Map(); const calls = []; let secret = 'synthetic-hmac-secret'; let rpcFails = false; let dbFails = false;
mock.module('../../lib/server/supabase.ts', { namedExports: { getSupabaseAdmin: () => ({
 rpc: async (name, args) => { calls.push({ name, args }); if (rpcFails) return { error: { code: 'synthetic' } }; return { data: { allowed: calls.filter((call) => call.name === name).length <= 6, retry_after_seconds: 60 } }; },
 from: (name) => {
  assert.equal(name, 'quote_requests');
  return {
   insert: async (row) => {
    if (dbFails) return { error: { code: 'synthetic-db-error' } };
    if (rows.has(row.id)) return { error: { code: '23505' } };
    rows.set(row.id, { ...row, delivery_status: 'pending' }); return { error: null };
   },
   select: () => ({ eq: (_key, id) => ({ single: async () => ({ data: rows.get(id) ?? null, error: rows.has(id) ? null : { code: 'not_found' } }) }) }),
   update: (values) => ({ eq: async (_key, id) => { Object.assign(rows.get(id), values); return { error: null }; } }),
  };
 },
}) } });
mock.module('../../lib/server/config.ts', { namedExports: { rateLimitConfig: { secret: () => secret }, resendConfig: { isConfigured: () => configured, adminEmail: () => recipient, from: () => from } } });
mock.module('../../lib/server/resend.ts', { namedExports: { getResend: () => ({ emails: { send: (...args) => send(...args) } }) } });
const { sendQuoteNotification } = await import('../../lib/server/quote-notifications.ts');
const { saveQuote, recordQuoteDelivery } = await import('../../lib/server/quote-repo.ts');
const { enforceRateLimit } = await import('../../lib/server/rate-limit.ts');
const { quoteSchema } = await import('../../lib/quotes/schema.ts');
const { acceptQuote } = await import('../../lib/quotes/workflow.ts');
const quote = quoteSchema.parse({ request_id: '33333333-3333-4333-8333-333333333333', name: 'Synthetic HF QA', phone: '0400000000', moving_from: 'Adelaide', moving_to: 'Marion', move_type: 'Residential (House / Unit)', move_category: 'Local Adelaide Move', source_page: 'https://hf.example/' });
const request = () => new Request('https://hf.example/api/quote', { headers: { 'x-forwarded-for': '203.0.113.4' } });
test('quote limiter uses a separate atomic RPC and blocks the seventh attempt', async () => {
 calls.length = 0;
 for (let i = 0; i < 6; i++) assert.equal(await enforceRateLimit(request(), 'quote'), null);
 const blocked = await enforceRateLimit(request(), 'quote'); assert.equal(blocked.status, 429); assert.equal(blocked.headers.get('retry-after'), '60');
 assert.ok(calls.every((call) => call.name === 'consume_quote_rate_limit' && call.args.p_action === 'quote' && /^[0-9a-f]{64}$/.test(call.args.p_key_hash)));
 assert.ok(!JSON.stringify(calls).includes('203.0.113.4'));
});
test('existing booking limiter still uses its original RPC', async () => {
 calls.length = 0; await enforceRateLimit(request(), 'hold'); assert.equal(calls[0].name, 'consume_booking_rate_limit');
});
test('quote protection fails closed on missing secret, IP or store; booking policy remains unchanged', async () => {
 secret = null;
 assert.equal((await enforceRateLimit(request(), 'quote')).status, 503);
 assert.equal(await enforceRateLimit(request(), 'hold'), null);
 secret = 'synthetic-hmac-secret';
 assert.equal((await enforceRateLimit(new Request('https://hf.example'), 'quote')).status, 503);
 rpcFails = true;
 assert.equal((await enforceRateLimit(request(), 'quote')).status, 503);
 assert.equal(await enforceRateLimit(request(), 'hold'), null); rpcFails = false;
});
test('actual repository guards idempotency and rejects conflicting payload reuse', async () => {
 rows.clear(); assert.equal(await saveQuote(quote), 'created'); assert.equal(await saveQuote(quote), 'existing');
 assert.equal(rows.size, 1); await assert.rejects(saveQuote({ ...quote, phone: '0400000001' }), /quote_request_conflict/);
 dbFails = true; await assert.rejects(saveQuote({ ...quote, request_id: '44444444-4444-4444-8444-444444444444' }), /quote_save_failed/); dbFails = false;
});
for (const [body, expected, category] of [
 [{ data: { id: 'synthetic-message' }, error: null }, 'sent', null],
 [{ data: null, error: { statusCode: 422, message: 'private provider data' } }, 'failed', 'rejected'],
 [{ data: null, error: { statusCode: 500 } }, 'unknown', 'provider'],
 [{ data: null, error: { statusCode: 401 } }, 'failed', 'authentication'],
 [{ data: null, error: { statusCode: 403 } }, 'failed', 'authentication'],
 [{ data: {}, error: null }, 'unknown', 'invalid_response'],
]) test(`Resend result ${expected}/${category} preserves accepted quote and idempotency`, async () => {
 rows.clear(); let count = 0;
 send = async (payload, options) => {
  count++; assert.equal(payload.to, 'admin@example.com'); assert.equal(payload.from, 'HF <quotes@example.com>');
  assert.equal(options.idempotencyKey, `hf-quote/${quote.request_id}`); assert.ok(options.signal instanceof AbortSignal);
  assert.match(payload.subject, new RegExp(quote.request_id)); assert.ok(!payload.html.includes('Estimated price'));
  return body;
 };
 const deps = { save: saveQuote, deliver: sendQuoteNotification, recordDelivery: recordQuoteDelivery, schedule: () => {}, onError: () => {} };
 assert.deepEqual(await acceptQuote(quote, deps), { success: true });
 const row = rows.get(quote.request_id);
 assert.equal(row.delivery_status, expected); assert.equal(row.delivery_provider, 'resend');
 assert.equal(row.delivery_failure_category, category); assert.ok(!Number.isNaN(Date.parse(row.notification_attempted_at)));
 await acceptQuote(quote, deps); assert.equal(count, 1); assert.equal(rows.size, 1);
});
test('ambiguous Resend network error is sanitized and never resends accepted quote', async () => {
 rows.clear(); let count = 0;
 send = async () => { count++; throw Error('synthetic secret provider payload'); };
 assert.deepEqual(await acceptQuote(quote, { save: saveQuote, deliver: sendQuoteNotification, recordDelivery: recordQuoteDelivery, schedule: () => {}, onError: () => {} }), { success: true });
 assert.equal(rows.get(quote.request_id).delivery_status, 'unknown'); assert.equal(count, 1);
 assert.equal(rows.get(quote.request_id).delivery_failure_category, 'network');
});
test('quote email escapes HTML, preserves genuine details and sends only to configured admin', async () => {
 let message;
 send = async (payload) => { message = payload; return { data: { id: 'synthetic' }, error: null }; };
 const supplied = { ...quote, name: '<script>bad</script>', email: '', details: 'Line one\nLine two <img src=x>\u0000', 'services[]': ['Packing'], attribution_consent: true, attribution: { utm_source: 'google', gclid: 'synthetic-click' } };
 assert.equal((await sendQuoteNotification(supplied)).status, 'sent');
 assert.match(message.html, /&lt;script&gt;/); assert.doesNotMatch(message.html, /<script>|<img/);
 assert.match(message.text, /Line one\nLine two/); assert.ok(!message.text.includes('\u0000'));
 assert.match(message.html, /Packing/); assert.match(message.html, /synthetic-click/); assert.ok(!('replyTo' in message));
 await sendQuoteNotification({ ...supplied, attribution_consent: false }); assert.doesNotMatch(message.html, /synthetic-click/);
});
test('missing or unsafe server recipient/sender never contacts Resend', async () => {
 let count = 0; send = async () => { count++; return { data: { id: 'bad' } }; };
 configured = false; assert.equal((await sendQuoteNotification(quote)).failureCategory, 'configuration'); configured = true;
 recipient = 'attacker@example.com\r\nBcc: other@example.com'; assert.equal((await sendQuoteNotification(quote)).status, 'failed'); recipient = 'admin@example.com';
 from = 'HF\r\nBcc: other@example.com'; assert.equal((await sendQuoteNotification(quote)).status, 'failed'); from = 'HF <quotes@example.com>';
 assert.equal(count, 0);
});
test('Resend timeout aborts its request and preserves uncertainty', async () => {
 const original = AbortSignal.timeout;
 AbortSignal.timeout = () => AbortSignal.abort(new Error('synthetic timeout'));
 send = async (_payload, options) => { assert.equal(options.signal.aborted, true); throw options.signal.reason; };
 try { const result = await sendQuoteNotification(quote); assert.equal(result.status, 'unknown'); assert.equal(result.failureCategory, 'timeout'); }
 finally { AbortSignal.timeout = original; }
});
