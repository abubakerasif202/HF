import test from 'node:test';
import assert from 'node:assert/strict';
import { quoteSchema } from '../lib/quotes/schema.ts';
import { acceptQuote, quoteToLead } from '../lib/quotes/workflow.ts';
const quote = quoteSchema.parse({ request_id: '33333333-3333-4333-8333-333333333333', name: 'Alex Smith', phone: '0400000000', moving_from: 'Adelaide', moving_to: 'Glenelg', move_type: 'Residential (House / Unit)', move_category: 'Local Adelaide Move', source_page: 'https://hf.example/', email: 'alex@example.com' });
test('accepted quote saves and notifies before CRM; Mautic failure never fails acceptance', async () => {
 const events = [];
 const result = await acceptQuote(quote, {
  save: async () => { events.push('supabase'); return 'created'; },
  deliver: async () => { events.push('resend'); return { status: 'sent', attemptedAt: new Date().toISOString() }; },
  recordDelivery: async () => events.push('delivery-record'),
  schedule: () => { events.push('mautic'); throw Error('outage'); }, onError: () => {},
 });
 assert.deepEqual(result, { success: true });
 assert.deepEqual(events, ['supabase', 'resend', 'delivery-record', 'mautic']);
});
test('database rejection never sends provider notification or Mautic', async () => {
 let sideEffects = 0;
 await assert.rejects(acceptQuote(quote, { save: async () => { throw Error('DB down'); }, deliver: async () => { sideEffects++; }, schedule: () => { sideEffects++; } }));
 assert.equal(sideEffects, 0);
});
test('repeat accepted request does not resend notification or schedule CRM', async () => {
 assert.deepEqual(await acceptQuote(quote, { save: async () => 'existing', deliver: () => { throw Error('called'); }, schedule: () => { throw Error('called'); } }), { success: true });
});
test('provider ambiguity remains saved and records reconciliation status', async () => {
 let status;
 assert.deepEqual(await acceptQuote(quote, { save: async () => 'created', deliver: async () => { throw Error('timeout'); }, recordDelivery: async (_id, value) => { status = value; }, schedule: () => {}, onError: () => {} }), { success: true });
 assert.equal(status.status, 'unknown');
});
test('exact optional quote and attribution mapping without invented surname, booking, price', () => {
 const lead = quoteToLead({ ...quote, attribution_consent: true, attribution: { utm_source: 'google', gclid: 'click', fbclid: 'fb', landing_page: 'https://hf.example/?email=private', referrer: 'https://google.com/?q=private' } });
 assert.equal(lead.firstName, 'Alex Smith'); assert.equal(lead.lastName, undefined);
 assert.equal(lead.bookingStatus, undefined); assert.equal(lead.estimatedValue, undefined);
 assert.equal(lead.gclid, 'click'); assert.equal(lead.fbclid, 'fb');
 assert.equal(lead.landingPage, 'https://hf.example/');
 assert.equal(quoteToLead({ ...quote, attribution_consent: false, attribution: { gclid: 'click' } }).gclid, undefined);
});
test('invalid input rejected and extraneous provider credentials stripped', () => {
 assert.equal(quoteSchema.safeParse({ ...quote, email: 'bad', details: 'x'.repeat(3001) }).success, false);
 assert.equal(quoteSchema.parse({ ...quote, access_key: 'attacker' }).access_key, undefined);
 assert.equal(quoteSchema.safeParse({ ...quote, preferred_moving_date: '2026-02-31' }).success, false);
});
