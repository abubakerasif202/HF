import test from 'node:test';
import assert from 'node:assert/strict';
import { syncLeadToMautic } from '../../lib/integrations/mautic/sync-contact.ts';
import { mapLead, leadTags } from '../../lib/integrations/mautic/mapper.ts';
import { mauticConfig } from '../../lib/integrations/mautic/client.ts';
const env = { MAUTIC_ENABLED: 'true', MAUTIC_BASE_URL: 'https://marketing.hfremovalsadelaide.com', MAUTIC_USERNAME: 'test', MAUTIC_PASSWORD: 'secret' };
const lead = { email: 'alex@example.com', firstName: 'Alex', quoteStatus: 'new', pickupSuburb: 'Adelaide', gclid: 'click', utmSource: 'google', source: 'hf-website' };
const contact = { id: 42, fields: { all: { email: lead.email } } };
const json = (data, status = 200) => new Response(JSON.stringify(data), { status });
test('disabled never fetches even with missing configuration', async () => {
 assert.deepEqual(await syncLeadToMautic(lead, { env: {}, fetcher: () => { throw Error('called'); } }), { status: 'disabled' });
});
test('no email skips safely', async () => assert.equal((await syncLeadToMautic({ phone: '0400000000' }, { env })).status, 'skipped'));
for (const existing of [false, true]) test(existing ? 'existing contact PATCH preserves acquisition' : 'new contact POST with mapped fields', async () => {
 const calls = [];
 const fetcher = async (url, init) => {
  calls.push({ url, ...init });
  return calls.length === 1 ? json({ total: existing ? 1 : 0, contacts: existing ? { 42: { ...contact, fields: { all: { email: lead.email, gclid: 'first' } } } } : {} }) : json({ contact });
 };
 assert.deepEqual(await syncLeadToMautic(lead, { env, fetcher }), { status: 'synced', contactId: 42 });
 assert.equal(calls[1].method, existing ? 'PATCH' : 'POST');
 assert.match(calls[1].url, existing ? /contacts\/42\/edit$/ : /contacts\/new$/);
 const payload = JSON.parse(calls[1].body);
 assert.equal(payload.pickup_suburb, 'Adelaide');
 assert.equal(payload.gclid, existing ? undefined : 'click');
 assert.equal(calls[0].redirect, 'error');
 assert.equal(new URL(calls[0].url).searchParams.get('where[0][val]'), lead.email);
});
for (const status of [500, 401, 403]) test(`HTTP ${status} is noncritical and does not retry`, async () => {
 let count = 0;
 assert.equal((await syncLeadToMautic(lead, { env, fetcher: async () => { count++; return json({}, status); } })).status, 'failed');
 assert.equal(count, 1);
});
test('timeout aborts the request', async () => {
 const fetcher = async (_url, { signal }) => new Promise((_resolve, reject) => signal.addEventListener('abort', () => reject(Error('aborted')), { once: true }));
 assert.equal((await syncLeadToMautic(lead, { env, fetcher, timeoutMs: 5 })).status, 'failed');
});
for (const data of [{}, { total: 0 }, { total: 2, contacts: { 42: contact } }, { total: 1, contacts: { 42: { ...contact, fields: { all: { email: 'other@example.com' } } } } }]) test('invalid or ambiguous response never creates a contact', async () => {
 let count = 0;
 assert.equal((await syncLeadToMautic(lead, { env, fetcher: async () => { count++; return json(data); } })).status, 'failed');
 assert.equal(count, 1);
});
test('invalid write response handled safely', async () => {
 let count = 0;
 assert.equal((await syncLeadToMautic(lead, { env, fetcher: async () => ++count === 1 ? json({ total: 0, contacts: {} }) : json({ contact: {} }) })).status, 'failed');
});
test('aliases, zero value and attribution mapping; blank fields omitted', () => {
 const payload = mapLead({ ...lead, lastName: '', estimatedValue: 0, fbclid: 'fb', landingPage: 'https://example.com/', referrer: 'https://google.com/' });
 assert.equal(payload.lastname, undefined); assert.equal(payload.estimated_value, 0);
 assert.equal(payload.fbclid, 'fb'); assert.equal(payload.landing_page, 'https://example.com/');
 assert.equal(payload.referrer, 'https://google.com/');
 assert.deepEqual(leadTags(lead), ['hf-website', 'quote-lead', 'google-ads']);
 assert.ok(!leadTags({ bookingStatus: 'held' }).includes('booked-customer'));
 assert.ok(leadTags({ bookingStatus: 'confirmed' }).includes('booked-customer'));
 assert.ok(!leadTags({ utmSource: 'google' }).includes('google-ads'));
});
test('SSRF and URL credential rejection', () => {
 for (const url of ['http://127.0.0.1', 'https://evil.example', `${env.MAUTIC_BASE_URL}/api`, `https://user:pass@marketing.hfremovalsadelaide.com`, `${env.MAUTIC_BASE_URL}?x=1`]) assert.throws(() => mauticConfig({ ...env, MAUTIC_BASE_URL: url }));
});

test('accepted quote remains successful when background sync or scheduler fails', async () => {
 const { scheduleMauticSync } = await import('../../lib/integrations/mautic/schedule-sync.ts');
 const previous = process.env.MAUTIC_ENABLED;
 process.env.MAUTIC_ENABLED = 'true';
 try {
  const events = []; let work;
  async function accept() {
   events.push('supabase', 'existing-email');
   scheduleMauticSync(lead, (callback) => { work = callback; }, async () => { throw Error('secret payload'); });
   return { success: true };
  }
  assert.deepEqual(await accept(), { success: true });
  assert.deepEqual(events, ['supabase', 'existing-email']);
  await assert.doesNotReject(work());
  assert.doesNotThrow(() => scheduleMauticSync(lead, () => { throw Error('host unavailable'); }));
 } finally { if (previous === undefined) delete process.env.MAUTIC_ENABLED; else process.env.MAUTIC_ENABLED = previous; }
});
test('failures never log provider text, credentials, or lead payload', async () => {
 const messages = []; const original = console.warn;
 console.warn = (...args) => messages.push(JSON.stringify(args));
 try {
  await syncLeadToMautic(lead, { env, fetcher: async () => { throw Error(`secret ${lead.email}`); } });
  assert.ok(messages.length);
  assert.doesNotMatch(messages.join(''), /secret|alex@example|Basic /);
 } finally { console.warn = original; }
});
test('first meaningful acquisition remains coherent across later campaigns', () => {
 const payload = mapLead({ ...lead, fbclid: 'later-facebook', utmCampaign: 'later-campaign' }, { utm_source: 'organic-search', utm_medium: 'organic', landing_page: 'https://hf.example/first' });
 assert.equal(payload.utm_source, undefined); assert.equal(payload.gclid, undefined);
 assert.equal(payload.fbclid, undefined); assert.equal(payload.utm_campaign, undefined);
});

test('disabled scheduler never registers background work or contacts Mautic', async () => {
 const { scheduleMauticSync } = await import('../../lib/integrations/mautic/schedule-sync.ts');
 const previous = process.env.MAUTIC_ENABLED; process.env.MAUTIC_ENABLED = 'false';
 try { assert.doesNotThrow(() => scheduleMauticSync(lead, () => { throw Error('scheduled'); }, async () => { throw Error('network'); })); }
 finally { if (previous === undefined) delete process.env.MAUTIC_ENABLED; else process.env.MAUTIC_ENABLED = previous; }
});
