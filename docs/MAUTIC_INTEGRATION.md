# HF → Mautic integration

## Original repository audit (before integration)

Audited the working tree, including existing uncommitted booking and website work. No production services or credentials were inspected. No live Mautic deployment is assumed.

| Area | Current path and behavior |
| --- | --- |
| Quote/contact forms | `app/components/SiteClient.tsx`: shared `QuoteForm`, mounted on homepage and `/contact` in `Site.tsx`; compact variant has the same submission logic. Fields: name, phone, pickup/destination suburb, move type, package/category, optional email/date, property size, floor/parking access, boxes, services, notes. |
| Exact quote submission | `QuoteForm.submit` → browser `FormData` → `quoteFormEndpoint` (`https://api.web3forms.com/submit`, `lib/site-data.ts`) → require HTTP success and `success: true` → reset/display confirmation. Native form action uses the same provider. There was no HF quote API, server action, quote table or Resend quote notification. |
| Quote validation/spam | HTML required fields/lengths/email/phone/date checks, client submission lock and `_gotcha` honeypot; Web3Forms handles delivery. Client validation is not a trusted server boundary. |
| Job completion | Separate `app/job-completion/JobCompletionForm.tsx` sends details/signature/payment acknowledgements to Web3Forms. This is not a CRM lead or authoritative booking transition; do not infer booked/completed from it. |
| Booking | `BookingWizard.tsx` → `/api/booking/availability` → `/api/booking/hold` → `/api/booking/confirm`. Hold writes customers and held bookings; confirm authenticates UUID access token and recomputes existing price snapshot, then atomic `confirm_booking_without_payment` RPC (0011). `runNoPaymentConfirmation` preserves email/calendar effects only for the caller that transitions state. |
| Supabase | `lib/server/booking-repo.ts`, lazy service-role client and staff session client; migrations 0001–0013 cover staff/settings/services/pricing/vehicles/crews/blocked times/customers/bookings/assignments/payments/Stripe events/booking events/notifications, grants/RLS, scheduling, finalisation and rate limiting. No original quote/lead table; the new bridge adds `quote_requests` only. Supabase is authoritative for bookings. |
| Resend | `lib/server/notifications.ts` sends booking confirmation to customer and optional admin, records notifications; legacy payment conflict alert retained. Optional configuration. No quote Resend flow exists to preserve or migrate. |
| Stripe | Checkout endpoint returns 410; current bookings take no advance payment. Signed legacy webhook retains historical checkout/session/amount/currency/idempotency safeguards. No changes needed. |
| Google | Root layout loads GA4 `gtag`, default `G-C1L7YK52TM`; booking funnel events and CTA clicks send non-personal context. Calendar OAuth mirror runs after booking confirmation; Maps/appointment links remain separate. No dedicated GTM container/Ads conversion or first-party GCLID handling found. |
| Attribution/consent | No UTM/GCLID/FBCLID capture/persistence or consent manager found. Quote `source_page` identifies submission page only. Supabase auth cookies belong to staff authentication. No existing acquisition localStorage/sessionStorage. |
| Environment | `.env.example`: public site/Web3Forms/GA/site URL, Supabase URL/anon key; server service-role key, optional legacy Stripe keys, Resend sender/admin, HMAC rate-limit secret, Google Calendar OAuth and cron secret. No existing Mautic configuration. |
| Validation/errors | Booking routes use Zod, explicit API statuses, configuration guards and database state/token checks. Email/calendar failures are logged; some existing logs use raw error messages. New Mautic code never logs response bodies, auth, customer fields or raw exception messages. |
| Abuse protection | Booking rate limiter uses HMAC IP keys and atomic Postgres RPC (0012), with existing fail-open policy if secret/store unavailable; holds also have email caps and honeypot. Quote provider protection is separate. |
| Tests | Node type-stripping domain/confirmation/webhook/calendar/rate-limit/analytics tests; rendered HTML tests require build; Playwright baseline/final suites exist. Tests do not establish live credentials, delivery or migration state. |

## Architecture and activation boundary

Prepared server-only modules under `lib/integrations/mautic/`:

- `types.ts`: optional HF contact fields and statuses.
- `mapper.ts`: centralized aliases, acquisition preservation and data-supported tag rules.
- `client.ts`: lazy configuration, HTTPS origin allowlist, Basic API authentication, deadline/AbortController, sanitized errors.
- `sync-contact.ts`: exact email lookup using documented advanced filters, POST new or PATCH existing contact; status update interface.
- `schedule-sync.ts`: guarded Next.js `after()` background scheduling after authoritative acceptance.

The audited original quote path bypassed HF's backend. The new single `POST /api/quote` bridge is wired into the existing shared QuoteForm when `NEXT_PUBLIC_HF_QUOTE_BRIDGE_ENABLED=true`. Both JSON submissions and native multipart form actions are supported. Disabled deployments retain the original Web3Forms path; no endpoint duplication or client claim of successful acceptance is used.

Migration `0014_quote_requests.sql` adds a service-role-only/RLS-protected `quote_requests` table plus a separate service-role-only `quote_rate_limits` table and atomic `consume_quote_rate_limit` RPC. Existing booking constraints and RPCs are untouched. It is NOT applied by this work. Existing booking/customer/payment schemas and flows are preserved. The bridge refuses requests unless the Supabase client and working rate limiter are available. The new quote action is limited to six attempts per IP per 30 minutes, reusing existing HMAC IP handling and secret with its own database counter. Existing booking fail-open policy is unchanged.

The backend enforces same-origin requests, validates with Zod, strips unknown/provider credential fields, bounds actual request bytes to 32 KiB, and handles the honeypot. Only the configured server Resend sender and HF admin recipient are used; client input cannot control either address. Client request UUIDs and a payload digest make repeat accepted JSON requests idempotent and detect ID reuse with different data; they reveal no stored customer record. Native submissions without a request UUID receive a server-generated ID; resubmitting a native/no-JavaScript form can create another quote, so inspect genuine duplicates before contacting the customer.

Resend notification failure does not discard an already stored quote. Delivery statuses `pending`, `sent`, `failed`, `unknown` support operator reconciliation; pending/unknown must NOT be blindly resent because the provider may have accepted them. A retry of the same accepted request does not resend notifications or repeat CRM scheduling. The dedicated `sendQuoteNotification` helper reuses `getResend()` and `resendConfig`; existing Resend booking emails are unchanged. No customer quote email is added.

Intended accepted-quote sequence: validated HF request → Supabase quote write → HF Resend notification attempt → delivery metadata write → customer success, with `scheduleMauticSync` registering `after()` work only after durable acceptance. Supabase/HF remains authoritative. Resend is the transactional booking and quote notification system; Mautic must not send duplicate transaction emails or automatically accept bookings.

`syncLeadToMautic` returns `disabled`, `skipped`, `failed`, or `synced` with contact ID. No email means skip: existing quote email is optional; phone is not a safe unique identity. Do not fabricate email or split a full name into a guessed surname. Store the provided full name in firstname unless actual structured names are collected.

## Environment variables

```
MAUTIC_ENABLED=false
MAUTIC_BASE_URL=https://marketing.hfremovalsadelaide.com
MAUTIC_USERNAME=
MAUTIC_PASSWORD=
NEXT_PUBLIC_HF_QUOTE_BRIDGE_ENABLED=false
```

`NEXT_PUBLIC_HF_QUOTE_BRIDGE_ENABLED` is a public boolean, not a secret; changing it requires a rebuild and matching server environment. Apply migration 0014 before enabling it. Roll back to false to restore original Web3Forms forms. RATE_LIMIT_SECRET is also required for the bridge (already documented in `.env.example`).

Only Basic API authentication is implemented; no unused OAuth variables. Enable the Basic authentication option in Mautic API settings and use a dedicated least-privilege API user. Store credentials in server environment/secrets manager only. Never use `NEXT_PUBLIC_`. URL must be the exact above HTTPS origin, root path only, without credentials/query/hash; redirects are refused. To change hosts, review/update `MAUTIC_ORIGIN` and tests deliberately.

Leave `MAUTIC_ENABLED=false` until setup and the accepted-submission hook are verified. Only literal `true` enables calls. Missing/invalid configuration produces a sanitized failure and never impacts critical workflows. Disable by setting false and restarting/redeploying the HF application.

## Custom contact fields

Aliases are centralized in `FIELD_ALIASES`; custom fields are not provisioned automatically. Before activation create published API-writable contact fields (not publicly editable tracking fields):

| Alias | Suggested type |
| --- | --- |
| pickup_suburb, dropoff_suburb | Text |
| move_date | Date |
| property_size, service_type | Text |
| access_details | Text area |
| quote_source | Text |
| quote_status | Select: new, quote_sent, follow_up, booked, completed, lost |
| booking_status | Text; actual HF state only |
| estimated_value | Number/decimal, AUD dollars; omit if no genuine estimate |
| utm_source, utm_medium, utm_campaign, utm_content, utm_term | Text |
| gclid, fbclid | Text |
| landing_page, referrer | Text/URL |

Core aliases: `firstname`, `lastname`, `email`, `mobile`. Email MUST be configured as a unique identifier in Mautic to prevent cross-instance create races. Preserve existing do-not-contact flags and subscriptions: adapter does not subscribe anyone or clear DNC. Contact existence and an enquiry are not marketing email consent.

## Attribution preparation

`lib/marketing-attribution.ts` provides bounded campaign/click capture and first meaningful acquisition merging. URLs discard query strings/fragments to avoid storing incidental personal data. Internal navigation referrers do not replace external acquisition. First direct visit may be replaced by a later meaningful source; useful first acquisition is retained. Latest acquisition is available in session storage for future extensions, but is not mapped to additional Mautic fields.

Storage is opt-in, session/tab scoped, expires after 24 hours, and honors Do Not Track/Global Privacy Control. Storage failure must not affect forms. `app/components/MarketingAttribution.tsx` provides an optional consent checkbox at the bottom of the page and captures consenting visits across root navigation. It is enabled only with the quote bridge. Quote submission reads the stored first acquisition. No pre-consent persistence or consent is inferred from existing GA loading. This does not constitute permission for marketing emails. Existing GA behavior is unchanged.

## Tags and future status updates

Rules live in `leadTags`: `hf-website`; `quote-lead` only with an actual quote status; `google-ads` only GCLID or Google paid-search UTM medium; `organic` only explicit organic medium; `returning-customer` only verified boolean; `booked-customer` only actual confirmed/assigned/in_progress/completed booking state. No inference from user-typed job completion or form defaults. Create these tags on Mautic for predictable operation.

`updateMauticQuoteStatus(contactId, status)` is prepared for future authorized server callers. No public status endpoint, automatic booking sync, two-way sync, price generator, SMS/invoice automation or automated replies are introduced. HF remains the source of truth.

## Reliability and security

One 2.5-second deadline covers Mautic contact lookup/write/body read. Quote Resend delivery gets a separate 8-second AbortSignal timeout forwarded by the installed SDK before background scheduling. No write retries: ambiguous network failures may already have committed. Exact normalized-email lookup and unique Mautic email identity prevent duplicates; more than one result or mismatched email fails safely. In-process calls for the same email serialize; uniqueness on the server is still required. PATCH omits missing fields and retains stored first acquisition. Core/contact updates do not clear existing tags or DNC.

Background work uses supported Next.js `after()` and must be scheduled only after critical success. Scheduler failures are also caught. It is best effort, not a durable queue: process termination/platform timeout/outage may miss a sync. Reconcile from authoritative HF records later; do not resubmit customer quotes to recover Mautic. No Redis/queue/database connection to Mautic is used.

Logs contain only static error codes and HTTP status. No auth headers/passwords/tokens/customer payloads. API credentials never belong in client components. Fixed outbound destination and redirect refusal reduce SSRF; operator-controlled DNS/TLS for that hostname is a trust requirement. Mock tests use injected fetch; production does not accept a fetcher/URL from users.

## Testing procedure

From PowerShell in `C:\Users\abuba\HF`:

```powershell
npm.cmd run typecheck
npm.cmd run lint
node --test tests/mautic.test.mjs tests/marketing-attribution.test.mjs
npm.cmd test
npm.cmd run build
```

No npm install is needed. Tests mock Mautic; `tests/mautic.test.mjs` runs its server-only fixture in an isolated Node process with `--conditions=react-server --experimental-strip-types`. Coverage includes disabled mode, create/update, no-email skip, timeout, 500/401/403, invalid/ambiguous responses, mapping/first acquisition, SSRF, background failure containment, and server-only boundaries. Mocked route tests verify acceptance despite CRM failure, database failure containment, origin/validation/body bounds and native multipart submission. Live Supabase/Resend/Mautic delivery and migration application remain external release checks. Run existing browser suite separately for real UI regression evidence.

## Production verification and rollback

1. Validate installed Mautic version/API behavior on staging. Official 7.2 contact API documentation marks legacy content as needing updates; verify filters, contact envelopes, PATCH/tag semantics and uniqueness against the exact installed release.
2. Configure custom fields, unique email and least-privilege API access. Make a server-side staging request without printing credentials.
3. Apply migration 0014 through the normal reviewed Supabase process, verify RLS/grants and rate-limit RPC, set RATE_LIMIT_SECRET and ensure the trusted deployment proxy supplies client IPs. Set `NEXT_PUBLIC_HF_QUOTE_BRIDGE_ENABLED=true` and rebuild HF. This switches both existing forms to the new bridge; Mautic can still remain disabled.
4. Deploy HF only when authorized, with Mautic disabled initially. Verify unchanged quote delivery, Supabase, booking Resend and Google behavior.
5. Enable Mautic, submit a controlled email quote, then repeat it: confirm one contact updates, expected tags/fields/first acquisition, Supabase records and provider emails remain correct.
6. Simulate Mautic 500/timeout/auth failures: customers must still see accepted quotes; verify transaction records/email results independently. Test optional-email leads skip CRM safely.
7. Set Mautic disabled to roll back calls immediately. For complete quote-bridge rollback, set `NEXT_PUBLIC_HF_QUOTE_BRIDGE_ENABLED=false` and rebuild to restore direct Web3Forms delivery; retain migration/table and accepted HF records. Do not delete existing data, migrations or legacy integrations. Roll back code through normal reviewed deployment if needed; no destructive database rollback.

Troubleshooting: `invalid_configuration` → enable flag/base URL/user/password; `authentication_failed` → API Basic option and user permissions; `http_error` → Mautic health/proxy/API permissions; `timeout` → server latency; `invalid_response` → installed API schema/custom field compatibility; `ambiguous_identity` → resolve duplicate emails; `identity_mismatch` → inspect exact filter compatibility securely. Do not add customer data or credentials to logs.

## Mautic Setup Checklist

- [ ] Deploy stable Mautic 7.x release
- [ ] Configure marketing.hfremovalsadelaide.com
- [ ] Enable HTTPS
- [ ] Configure cron/workers
- [ ] Configure mail transport
- [ ] Enable/configure API access
- [ ] Create API credentials
- [ ] Add HF custom contact fields
- [ ] Create HF tags
- [ ] Add production environment variables
- [ ] Set MAUTIC_ENABLED=true
- [ ] Submit test HF quote
- [ ] Confirm Mautic contact created
- [ ] Confirm Supabase quote still created
- [ ] Confirm Resend emails still send
- [ ] Test Mautic outage behaviour

Additional gates: unique email identifier, API user contact view/create/edit permissions, exact installed release API staging verification, HF quote migration and feature flag, attribution consent and privacy notice review, delivery reconciliation monitoring and existing booking regression tests. Choose cron/worker/mail transport commands from the installed release documentation and server deployment layout; do not assume container paths or PHP executable versions.

Sources: [Mautic 7.2 Contacts API](https://devdocs.mautic.org/en/7.2/rest_api/contacts.html), [API setup](https://devdocs.mautic.org/en/7.2/rest_api/getting_started.html), [Mautic 7.2 contact management](https://docs.mautic.org/en/7.2/contacts/manage_contacts.html). Next.js scheduling follows the installed `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/after.md` guide.

## Quote delivery reconciliation

There is no new admin quote dashboard in this phase. Before enabling the bridge, assign an operator to review unsent/uncertain quotes using authorized Supabase tooling. Read-only query:

```sql
select id, created_at, quote_status, delivery_status, delivery_provider, notification_attempted_at, delivery_failure_category
from public.quote_requests
where delivery_status in ('pending', 'failed', 'unknown')
order by created_at;
```

Inspect the private payload only in authorized tooling when necessary. A saved quote is accepted even when delivery is uncertain; compare its UUID quote reference in the Resend subject against HF's received notifications and Resend's dashboard before any manual resend. Configure operational monitoring/retention for this table before rollout. Do not print payloads to application logs. The Mautic outage path does not change provider delivery or booking Resend behavior.

## Files added or updated for this integration

Existing dirty work was retained. Integration edits to existing files are limited to the shared quote form, root attribution mount, conditional privacy explanation, quote rate-limit action/fail-closed rule and environment placeholders.

```
.env.example
app/api/quote/route.ts
app/components/MarketingAttribution.tsx
app/components/SiteClient.tsx
app/components/Site.tsx
app/layout.tsx
lib/marketing-attribution.ts
lib/marketing-attribution-types.d.ts
lib/quotes/schema.ts
lib/quotes/workflow.ts
lib/server/quote-repo.ts
lib/rate-limit.ts
lib/server/rate-limit.ts
lib/integrations/mautic/client.ts
lib/integrations/mautic/types.ts
lib/integrations/mautic/mapper.ts
lib/integrations/mautic/sync-contact.ts
lib/integrations/mautic/schedule-sync.ts
supabase/migrations/0014_quote_requests.sql
tests/marketing-attribution.test.mjs
tests/mautic.test.mjs
tests/quote-workflow.test.mjs
tests/quote-route.test.mjs
tests/fixtures/mautic.mjs
tests/fixtures/quote-route.mjs
tests/fixtures/quote-server.mjs
tests/fixtures/quote-browser.mjs
tests/fixtures/quote-migration.sql
docs/MAUTIC_INTEGRATION.md
```

The browser smoke fixture targets a local dev server on port 3114 with the bridge flag enabled; it intercepts all backend/third-party traffic. Run `node tests/fixtures/quote-browser.mjs`; if the installed Playwright browser revision is unavailable, `HF_BROWSER_EXECUTABLE` may point to an existing local Chromium executable. This is a test-process variable, not an HF application setting. It verifies optional consent, cross-page acquisition preservation and successful bridge payloads at 375/1440px.

Migration verification uses a fresh disposable PostgreSQL 17 container with no published ports, then existing migration 0012, new migration 0014 and `tests/fixtures/quote-migration.sql`. This checks the new schema with its rate-limit dependency, not a fresh replay of every historical booking migration. No existing local or production database is used.

## Server jobs to configure next

After installing Mautic and selecting its application directory/PHP executable, configure the three required tasks at staggered intervals:

```
mautic:segments:update
mautic:campaigns:update
mautic:campaigns:trigger
```

These are arguments to the installed `php bin/console` command. For queued mail, configure a supervised email worker or bounded scheduled consumer using `messenger:consume email --time-limit=160`. Configure mail transport and verify its authentication separately. Use the installed release's scheduler/container layout, actual absolute application path and service user; none is assumed here. See [Mautic 7.2 cron jobs](https://docs.mautic.org/en/7.2/configuration/cron_jobs.html).

## Verification from the original implementation phase

- Windows Node 22.23.1: `npm.cmd run typecheck`, `npm.cmd run lint`, `npm.cmd test`, `npm.cmd run build` all passed on the final implementation.
- `npm test`: 161 top-level project tests passed; the mocked integration wrappers also execute 18 Mautic fixture tests and 5 quote-route fixture tests.
- Enabled-bridge Chromium smoke: passed at 375px and 1440px with all backend/third-party traffic intercepted; consent, cross-page first acquisition, payload and horizontal overflow checked. Full existing Playwright regression suite was not run.
- Disposable PostgreSQL 17: migrations 0012 and 0014 plus quote-migration assertions passed (RLS/grants, service-role writes, duplicate IDs, quote and existing hold rate-limit RPC actions). Not applied to HF's existing local/production project.
- Production client chunks contain no privileged Mautic credential variable names or integration error marker.
- Live Supabase/Web3Forms/Resend/Mautic delivery, installed Mautic API behavior and production deployment remain NOT TESTED. No push/deployment performed; both new feature flags remain disabled in the example.

## Historical quote bridge release audit — before Resend transition

**Historical blocker, superseded by the Resend transition below.** Web3Forms documents that server-side API calls need a paid plan and a safelisted server IP. HF's paid subscription and Vercel outbound-IP safelisting are not confirmed; the owner explicitly instructed keeping production unchanged. The bridge was held pending a notification architecture change; that server-side Web3Forms dependency has now been removed. Earlier provider tests mocked HTTP responses; they did not prove server-side delivery is supported.

Source: [Web3Forms server-side restrictions](https://docs.web3forms.com/getting-started/troubleshooting#403-this-method-is-not-allowed).

Confirmed production Supabase reference: `wtyafqwmbcpzphgltdwk`, corroborated by HF production Vercel Supabase URL configuration and owner confirmation. The local CLI is now linked. Production history contains all 13 baseline migration names under timestamp versions. Migrations 0002–0013 match fetched production SQL ignoring comments/whitespace; 0001's initial hours differ, with the later business-hours migration present. No old migration is replayed or rewritten.

A temporary CLI migration workspace contains fetched production history plus pending `0014_quote_requests.sql`; `supabase db push --linked --include-all --skip-vault --dry-run` reported only 0014. No migration history repair or production application was performed. The original numeric filenames remain unchanged.

The revised 0014 is additive: it creates `quote_requests` and a separate `quote_rate_limits` table, two explicit indexes plus their primary-key indexes, and `consume_quote_rate_limit(text,text,integer,integer)`. Both tables use RLS with no public policies, explicit anon/authenticated/public revocation, and service-role grants. The RPC has a fixed search path and service-role-only execution. Existing booking tables, constraints, RPCs and grants are untouched. Expired technical quote counters are pruned inside the new RPC; accepted quote records are never deleted by it.

Production Vercel required variables are present: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY and RATE_LIMIT_SECRET. Secret values are not reported or changed. Neither bridge/Mautic flag nor Mautic base URL is currently configured in production, so the implemented defaults remain disabled. MAUTIC_USERNAME/MAUTIC_PASSWORD are absent and no credentials have been created.

New server fixture tests exercise the actual quote repository/provider helper and limiter with mocked dependencies: distinct quote RPC, unchanged booking RPC, fail-closed quote protection, idempotency/conflict rejection, provider success/failure/uncertainty, and no duplicate notifications. Route tests add honeypot containment; scheduler tests explicitly prove MAUTIC_ENABLED=false registers no work and makes no request.

Disposable PostgreSQL 17 validation of migrations 0012/0014 passed: quote RLS/grants, service-role insert/update, duplicate quote IDs, six allowed quote requests and a blocked seventh, unchanged existing hold RPC, and public RPC revocation. These synthetic tests rolled back and did not use the production database.

No changes are staged, committed or pushed in this release audit. No Vercel environment updates, deployments, production quote submissions or provider emails were performed. The subsequent owner-authorized Resend transition removes that gate; production remains unchanged pending a separate release instruction. Existing booking/Resend/Stripe/Google behavior has not been changed.

### Fresh local verification on 2026-10-02

Typecheck, lint, all 161 top-level tests (including nested mocked integration fixtures), and the production build passed. The build used the bridge enabled and Mautic disabled in the local process only. Mocked browser checks passed at 375px and 1440px, including consent, first attribution across navigation, submission, success UI, and overflow checks. Privileged Mautic markers were absent from browser JavaScript. Baseline hashes confirmed unrelated files unchanged; the staging index remains empty. Disposable PostgreSQL validation passed, including service-role operations, public access restrictions, idempotency, and rate limiting. No live provider delivery or production quote was tested. Production migration, environment changes, commit, push, and deployment remain on hold at the owner request.

## Resend quote bridge transition

Legacy mode (`NEXT_PUBLIC_HF_QUOTE_BRIDGE_ENABLED=false`): browser → Web3Forms. This includes the existing native form action and remains the rollback path.

Bridge mode (`NEXT_PUBLIC_HF_QUOTE_BRIDGE_ENABLED=true`): browser → `/api/quote` → validation/spam/rate limit → Supabase → Resend notification to HF → record delivery → successful customer response, with independent background Mautic work after acceptance. The server bridge makes no Web3Forms request and needs no Web3Forms paid plan or fixed outbound IP. The job-completion Web3Forms flow is unchanged.

`lib/server/quote-notifications.ts::sendQuoteNotification` uses the existing cached `getResend()` client and `resendConfig` accessors. Required existing variables: `RESEND_API_KEY`, `BOOKING_EMAIL_FROM`, `BOOKING_ADMIN_EMAIL`, Supabase server configuration, and `RATE_LIMIT_SECRET`. No duplicate configuration or quote recipient variable was added. Production variable-name inspection confirms all are configured without printing values; sender domain verification, API permissions and real inbox delivery still require controlled production verification. No customer acknowledgement email is introduced.

The notification includes only nonempty submitted fields, the UUID reference, optional email, source page and consented attribution. Body values are HTML-escaped and control characters stripped; multiline notes are preserved. Subject uses only the validated UUID; sender/recipient come exclusively from server configuration. Missing or unsafe configuration fails delivery without discarding a stored quote.

Pending migration 0014 now includes `delivery_provider` (`resend`), `notification_attempted_at`, and a constrained sanitized `delivery_failure_category` in the existing quote table definition. It is still unapplied. No booking schema is changed. No complete email body, provider error message, credentials or raw provider response is stored.

Delivery states:
- `pending`: stored but completion not recorded (including interruption or metadata-write failure).
- `sent`: Resend returned an email ID; this means provider acceptance, not guaranteed inbox delivery.
- `failed`: configuration, authentication or other explicit 4xx rejection.
- `unknown`: timeout/network uncertainty, provider 5xx or invalid response. Do not blindly resend.

Every accepted duplicate request UUID with the same payload returns success without another notification or CRM sync. Conflicting payload reuse fails. Resend receives `hf-quote/<UUID>` as an idempotency key, an extra safeguard; database idempotency persists beyond the provider's key-retention window. There are no automatic retries. The eight-second request signal covers SDK fetch/body handling. A successful database save remains accepted even if notification, delivery metadata recording or CRM scheduling fails. Reconcile `pending`/`failed`/`unknown` in authorized tooling; notification failure is not surfaced to customers.

Rollback: set `NEXT_PUBLIC_HF_QUOTE_BRIDGE_ENABLED=false`, rebuild and redeploy via the normal Git workflow. Preserve quote records/migration. Keep `MAUTIC_ENABLED=false` until Mautic is installed and separately verified. This task does not apply migrations, update production environment, commit, push or deploy.

Tests mock Resend and Supabase. The actual installed SDK is also tested against mocked fetch for timeout-signal and idempotency-header forwarding. Notification tests cover acceptance, rejection, authentication failure, 5xx, invalid response, network uncertainty, timeout, escaped bodies, optional email, consented attribution, safe fixed recipient/sender, idempotency, conflicts and unchanged booking limiter routing. Existing quote endpoint and Mautic disabled/outage fixtures remain active. `HF_BRIDGE_EXPECTED=false` runs the local browser fixture against a legacy build; default runs it against a bridge build. No test sends provider emails.

### Resend transition verification results

Fresh Windows checks passed: `npm.cmd run typecheck`, `npm.cmd run lint`, `npm.cmd test` (162 top-level tests; zero failures or skips), and `npm.cmd run build` with the bridge enabled and Mautic disabled in the process only. Legacy and enabled builds each passed mocked Chromium checks at both 375px and 1440px, including native form action, submitted fields, success UI and overflow; the enabled path also verified consent and first attribution across navigation. All external requests were intercepted. A stale task-owned server was identified by its command line, stopped, and checks rerun against the correct build.

All 25 generated browser JavaScript files were scanned: zero matches for `RESEND_API_KEY`, `MAUTIC_USERNAME`, `MAUTIC_PASSWORD`, `SUPABASE_SERVICE_ROLE_KEY`, or configured local secret values. Disposable PostgreSQL 17 migration assertions passed, including new delivery metadata constraints, public access restrictions, service-role writes, idempotency and rate-limit behavior. Baseline hashes confirm unrelated dirty files unchanged and the staging index is empty. Production configuration inspection was read-only and reported variable presence only.

Ready for an authorized controlled release, with live sender-domain/API permissions and actual HF inbox delivery still unverified. Before production application, refresh migration history and a dry-run using the revised 0014; apply only that migration, configure feature flags and run one controlled quote after deployment. Keep Mautic disabled. Production migration, env, commit, push and deployment actions were not performed in this task.

## Controlled production release preparation

On 2026-10-02, production project identity and all 13 baseline migrations were refreshed, and a new dry-run selected only revised 0014. Migration 0014 was applied through the Supabase CLI migration process. Both quote tables, delivery columns, indexes, RLS and service-role-only RPC were verified; anonymous/authenticated reads failed. A synthetic service-role insert/update and rate-limit call were rolled back. Existing public schema fingerprints before and after were identical. Production flags are now quote bridge true and Mautic false; these affect the next production build. Privacy wording follows the active quote delivery provider, preserving legacy wording when disabled. Git deployment and the live synthetic test are the next release checks.
