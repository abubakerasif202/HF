import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
mock.module('../../lib/server/config.ts', { namedExports: { resendConfig: { apiKey: () => 'synthetic-test-key' } } });
const { getResend } = await import('../../lib/server/resend.ts');
test('existing Resend SDK forwards timeout signal and idempotency key to mocked fetch', async () => {
 const previous = globalThis.fetch; let count = 0;
 const signal = AbortSignal.abort();
 globalThis.fetch = async (url, options) => {
  count++; assert.equal(url, 'https://api.resend.com/emails');
  assert.equal(options.signal, signal); assert.equal(options.headers.get('Idempotency-Key'), 'hf-quote/synthetic');
  return new Response(JSON.stringify({ id: 'synthetic-message' }), { status: 200 });
 };
 try {
  const result = await getResend().emails.send({ from: 'sender@example.com', to: 'admin@example.com', subject: 'Synthetic', text: 'Synthetic' }, { signal, idempotencyKey: 'hf-quote/synthetic' });
  assert.equal(result.data.id, 'synthetic-message'); assert.equal(count, 1);
 } finally { globalThis.fetch = previous; }
});
