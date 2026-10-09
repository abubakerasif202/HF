# HF Removals — Refine Quote CRM

A narrowly scoped Refine CORE v5 integration inside the **existing** Next.js staff admin.
It does not replace the booking, crew, vehicle, pricing, calendar or marketing systems.

## Staff usage

1. Sign in using the existing `/admin/login` staff account.
2. Open `/admin/quotes` (Quote enquiries in the sidebar).
3. Filter by status and update an enquiry to New, Quote sent, Follow up, Booked, Completed or Lost.
4. Expand a quote to read the details. Use customer contact details to respond through existing channels.

Refine handles data queries, cache invalidation and mutations. The existing admin design remains in use.
The quote API authenticates each request independently using `getStaffSession()` before accessing the server-only Supabase service role. The browser never receives the service-role key.

## Prerequisites

- `npm ci` installs pinned `@refinedev/core` version 5.0.12 using the committed lockfile.
- Existing Supabase booking/admin credentials must be configured.
- Apply **all existing** Supabase migrations, including `0014_quote_requests.sql`.
- Set a strong server-only `RATE_LIMIT_SECRET` for the existing rate limiter.
- Provision a staff user through existing Supabase Auth and the `staff` table.
- Keep the current `NEXT_PUBLIC_WEB3FORMS_ACCESS_KEY` configured for original quote delivery.

No additional Supabase migration is introduced by this feature.

## How quotes get into the CRM

The existing homepage/contact quote form continues posting directly to Web3Forms. **Only after** Web3Forms returns a successful response, the browser makes a best-effort, same-origin request to `POST /api/quote/capture`.

The capture endpoint accepts an allowlisted, length-limited subset of fields; accepts only a v4 UUID reference; enforces existing server-side IP rate limiting; hashes the stored payload and inserts into the existing `quote_requests` table with duplicate-safe conflict handling. No Web3Forms access key, honeypot content or arbitrary form field is stored.

**Important limitations:**

- This endpoint cannot independently verify Web3Forms delivery. Its `delivery_status` is deliberately `unknown`. **Use the original inbox email as the delivery source of truth.**
- Capture is best-effort; if Supabase, the rate limiter or the browser capture request fails, Web3Forms email delivery still succeeds but the quote **may not appear** in the CRM.
- Older enquiries and no-JavaScript form submissions are not automatically imported.
- No new email, prices, booking records, deposits, invoices or customer promises are generated.
- This endpoint is not a fully reliable transactional lead pipeline. For that, migrate to a validated server-owned quote submission flow with durable delivery/retry support in a subsequent change.

## Verify before deployment

Run:

```powershell
npm ci
npm run typecheck
npm run lint
npm test
npm run test:browser
```

Manual verification with a test/staging Supabase project:
- Unauthenticated GET/PATCH to `/api/admin/quotes` must return 401.
- Authenticated staff can filter quotes and change status; unapproved status values return 400.
- A non-staff logged-in account cannot read any customer details.
- Web3Forms success followed by capture produces exactly one CRM row per quote UUID; a repeat capture does not reset an existing status.
- Web3Forms failure produces **no** CRM row.
- Missing Supabase/migration/rate-limit config does not break original Web3Forms quote delivery.
- Check the existing booking and price flows for regressions.

The app's existing admin guard must stay enforced both server-side and per API request. Never grant browser access to the service-role key or open quote records to public/anonymous users.
