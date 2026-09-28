# HF Removals Adelaide

Premium multi-route website for HF Removals Adelaide, built with Next.js and deployed exclusively on Vercel.

## Local development

Requires Node.js 22.13 or newer.

```powershell
npm ci
npm run dev
npm run build
npm test
npm run lint
```

For the responsive Chromium QA suite, install the browser once and run:

```powershell
npx playwright install chromium
npm run test:browser
```

## Production domain

The canonical production origin is `https://www.hfremovalsadelaide.com.au`. Metadata, Open Graph URLs, structured data, robots.txt and the sitemap all read from the central site configuration in `lib/site-data.ts`. The `.com` hostname permanently redirects to the canonical Australian domain.

## Quote delivery

The homepage and Contact quote forms submit to Web3Forms. JavaScript submissions keep the customer on-site and provide accessible success/error feedback. Browser validation, duplicate-submit protection and the existing honeypot are enabled. The Web3Forms access key is a public form identifier used by the browser, not a server-side secret.

## Supplied facts and media

Business details and published pricing are centralized in `lib/site-data.ts`. The source JSON and CSV contained truncated currency values, so readable rates were transcribed from the supplied Markdown summary and project brief. The hero is a generated project asset based on the supplied HF logo and approved visual direction. The CEO section uses the supplied original portrait rather than an identity-altering generated replacement.

## Booking system

The site ships with an online booking system (`/book`) that is **disabled by default** and falls back to the existing "Get a Quote" form until it's configured. Nothing breaks, and no page requires the credentials below to build or deploy.

### Confirmed business rules

These are the real, verified HF Removals Adelaide policy, encoded server-side (`lib/booking/pricing.ts`) and in `business_settings`/`pricing_rules` — never invented, never duplicated as a second source of truth:

- **2 Men + Truck:** $79 / 30 min ($158/hr)
- **3 Men + Truck:** $99 / 30 min ($198/hr)
- **Minimum booking:** 3 hours (180 min), enforced regardless of actual job length
- **Call-out:** 1 hour, billed at the job's own per-30-minute rate (never a separate flat fee) — includes truck fuel and basic transport charges
- **No advance payment:** customers confirm their booking online without paying anything up-front — no deposit, no card, no Stripe. The final balance of a new booking is the full final job total
- **Final price** is only known once the job is complete — the online booking total is always an estimate until staff finalise it in `/admin/bookings/[id]` ("Complete Job")
- **Booking hours:** earliest booking start 5am, last booking start 6pm (a job may run later than 6pm — this bounds when a job can *start*, not when the truck must be back)

Every booking freezes this policy into its own `pricing_snapshot` when it is confirmed, so a later rate change never rewrites a booking's total.

**Booking flow:** Move Details → Pickup & Destination → Date & Availability → Your Details (creates a temporary server-side hold) → Review & Confirm → **Confirm Booking** (`POST /api/booking/confirm`) → `/booking/success`. Confirmation is done by the service-role-only RPC `confirm_booking_without_payment` (migration `0011`), which checks the booking's access token, `held` status and hold expiry in one atomic update, sets `payment_status = 'not_required'`, and is idempotent — a double-click confirms once and sends one email / one calendar sync.

**Historical bookings:** bookings made while the old $100 booking-confirmation payment was in place keep their real recorded payment (`deposit_paid_cents`, `payments`, `stripe_events`). Final billing always deducts the amount actually recorded on that booking — $100 for those, $0 for every new booking.

### 1. Database (Supabase)

1. Create a Supabase project.
2. Apply the migrations in `supabase/migrations/` **in filename order** (`0001_...` through the latest). Either paste them into the Supabase SQL editor, or with the CLI:
   ```powershell
   supabase link --project-ref <your-project-ref>
   supabase db push
   ```
3. Create at least one **staff** account: create the user in Supabase Auth (dashboard → Authentication → Users, or the Admin API), then insert a matching row in the `staff` table with that user's `id`. Public sign-up is intentionally not wired up — staff accounts are provisioned this way only.
4. Add at least one row to `vehicles` (`active = true`) — with none, availability always reports "unavailable" and holds are refused with a clear 503.
5. `business_settings` and `pricing_rules` already seed the confirmed policy above (rates, 3-hour minimum, 1-hour call-out, 5am–6pm hours). The `deposit_*` columns are legacy and are no longer read for new bookings. Adjust only if the real business policy changes.

### 2. Stripe — legacy / optional, not required for booking

Online booking takes **no advance payment**, so `STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` and `STRIPE_WEBHOOK_SECRET` are **not required** — the booking system goes live with Supabase alone. No new booking ever enters Stripe Checkout (`/api/booking/checkout` returns `410 Gone`).

`/api/stripe/webhook` is kept **dormant** for historical compatibility only: if all three Stripe variables are set, it still processes late events for genuine historical Checkout sessions, but it ignores any event whose session id doesn't match the booking's recorded `current_checkout_session_id` — which is always null for no-payment bookings — so it can never transition a new booking. If you no longer need it, leave the Stripe variables unset (the route then answers 503) and remove the endpoint from the Stripe dashboard. The `payments` and `stripe_events` tables and the old payment columns are intentionally kept so historical records stay readable.

If a Stripe secret key or webhook signing secret was ever pasted into a chat, a document, or any non-`.env.local` location, treat it as compromised and roll it in the Stripe dashboard.

### 3. Email (Resend) — optional

Set `RESEND_API_KEY`, `BOOKING_EMAIL_FROM` (a verified sending domain/address) and `BOOKING_ADMIN_EMAIL`. Without these, bookings still confirm normally; email sends are skipped and logged as failed rows in the `notifications` table instead of blocking anything.

### 4. Google Calendar — optional, operational mirror only

Supabase is the source of truth and `/admin/calendar` works without Google. When configured, every confirmed booking is mirrored to one Google Calendar event; without all four variables below, sync shows **Disabled** and bookings work normally.

**What it does** (`lib/server/google-calendar.ts` → `reconcileBookingCalendar`, pure logic in `lib/calendar-sync.ts`):

- **Confirm** → creates one event: title `HF-2026-00023 — Smith — 2 Men + Truck`; description with booking reference, customer name/phone/email, pickup, destination, package, crew size, status and the admin booking URL (never internal notes). Times are the booking's own `starts_at`/`ends_at` in `Australia/Adelaide` — the billing call-out never adds an hour.
- **Idempotent** → the Google event id is derived from the booking UUID (`hf` + hex), so a retry, double submit or restart hits "already exists" and updates instead of duplicating. The id is also stored in `bookings.google_calendar_event_id`.
- **Reschedule / vehicle / crew / status change / job completion** → the same event is updated in place.
- **Cancel** (list or detail page) → the event is deleted.
- **Failure** → the booking stays confirmed; `calendar_sync_status = failed` with a friendly summary (no raw API/OAuth text), and staff can press **Retry sync** on `/admin/bookings/[id]`. Status values: Synced / Pending / Failed / Disabled.

**Setup (one-time):**

1. In [Google Cloud Console](https://console.cloud.google.com/), create (or pick) a project and **enable the Google Calendar API** (APIs & Services → Library).
2. **OAuth consent screen**: choose *Internal* if the calendar account is in your Google Workspace, otherwise *External*. Add the scope `https://www.googleapis.com/auth/calendar.events`. For *External*, **publish the app (In production)** — while it stays in *Testing*, Google expires refresh tokens after 7 days and sync starts failing with "authorisation has expired".
3. **Credentials → Create credentials → OAuth client ID** → type *Web application*; add `https://developers.google.com/oauthplayground` as an authorised redirect URI. Note the client ID and client secret.
4. **Get a refresh token**: open the [OAuth 2.0 Playground](https://developers.google.com/oauthplayground), click the gear icon → *Use your own OAuth credentials* → paste the client ID/secret. In step 1 enter `https://www.googleapis.com/auth/calendar.events`, authorise **as the Google account that owns (or can edit) the target calendar**, then in step 2 *Exchange authorization code for tokens* and copy the **refresh token**.
5. **Choose the calendar**: `GOOGLE_CALENDAR_ID=primary` uses that account's main calendar. To keep jobs separate, create a dedicated calendar (e.g. "HF Removals Jobs") and use its ID from Google Calendar → Settings → *Integrate calendar* → *Calendar ID* (looks like `…@group.calendar.google.com`). With an explicit ID the admin also shows an "Open in Google Calendar" link.
6. Set `GOOGLE_CALENDAR_ID`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN` as **server-only** environment variables in Vercel (never `NEXT_PUBLIC_`), then redeploy. Confirm a test booking and check its detail page shows **Synced**.

This is separate from the **Google Appointment Scheduling** iframe on `/book`, which is a supplementary way to book a call — it never creates bookings, holds, or truck/crew locks.

### Per-IP rate limiting

`/api/booking/availability`, `/api/booking/hold` and `/api/booking/confirm` are limited per client IP (migration `0012`), on top of the honeypot, the per-email hold/confirmation caps and the duplicate-booking guard:

| Endpoint | Limit per IP |
| --- | --- |
| availability | 30 / 5 min |
| hold | 6 / 30 min |
| confirm | 10 / 30 min |

These are technical abuse limits sized so a household or office sharing one public IP never meets them. Over the limit returns `429 {"error": "Too many booking attempts. Please wait a few minutes and try again.", "code": "rate_limited"}` with `Retry-After`. A repeat confirm for a booking that is **already confirmed** always returns the confirmed result, never a 429.

- **Privacy**: only `HMAC-SHA256(RATE_LIMIT_SECRET, normalised IP)` is stored (a DB `CHECK` rejects anything else); raw IPs are never stored or logged. IPv6 is bucketed per /64.
- **Trusted IP source**: on Vercel, `x-vercel-forwarded-for` → `x-real-ip` → first `x-forwarded-for` hop (all set by Vercel's edge). Off Vercel the first `x-forwarded-for` hop is used, which is only safe behind a proxy that overwrites that header.
- **Storage**: atomic Postgres counters (`consume_booking_rate_limit`, service-role only) — safe across Vercel's distributed serverless instances. Expired windows are deleted on each check and by the `/api/cron/expire-holds` sweep.
- **Fails open**: without `RATE_LIMIT_SECRET`, without a usable IP, or if the counter store errors, the limiter is skipped and bookings continue under the other protections.

Set `RATE_LIMIT_SECRET` (server-only, e.g. `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`). Rotating it simply resets all counters.

### 5. Scheduled hold expiry

Holds are still required — they reserve the truck while the customer reviews and confirms (default 30 minutes, `business_settings.booking_hold_minutes`). Set `CRON_SECRET` and add a Vercel Cron entry (`vercel.json`) hitting `/api/cron/expire-holds` every few minutes with that secret as a Bearer token. This is a backstop — holds also expire inline whenever the next customer tries to book the same vehicle/time — but without the cron job an abandoned hold can squat on a slot until someone else attempts that exact slot again.

### Admin dashboard

Once Supabase is configured, staff sign in at `/admin/login`. All routes are `noindex` and excluded from `robots.txt`:

| Route | Purpose |
| --- | --- |
| `/admin` | Dashboard — today/tomorrow jobs, awaiting confirmation (live holds), confirmed, unassigned truck, outstanding final balance, "needs attention" list |
| `/admin/bookings` | List, filter, assign vehicle/crew, cancel |
| `/admin/bookings/[id]` | Full detail: customer/move/schedule/resources/payment, reschedule (re-checks availability), status transitions, calendar sync retry, internal notes, event history, **Complete Job** (finalises the real price from actual duration) |
| `/admin/calendar` | Internal operational calendar — day/week/month, reads from Supabase only (see below) |
| `/admin/vehicles` | Add/activate/deactivate vehicles |
| `/admin/crews` | Add/activate/deactivate crews and crew members |
| `/admin/availability` | Block time (whole business, one vehicle, or one crew) |
| `/admin/pricing` | Per-crew-size rate CRUD (does not affect already-confirmed bookings — see pricing snapshots above) |
| `/admin/settings` | Hours, hold/lead/horizon/buffer, booking-number prefix (no deposit settings — advance payment is not required) |

### Internal admin calendar (`/admin/calendar`)

Day/week/month views, queried directly from Supabase for the visible date range only (never the whole `bookings` table) — this works whether or not Google Calendar is configured. Week defaults to the current Mon–Sun week in `Australia/Adelaide`; each day is an agenda column showing time, customer, package, vehicle, crew and status (status is shown as text + border style, never colour alone). Filters: vehicle, crew, status, package. Blocked times render distinctly from bookings and correctly distinguish a global business closure from a vehicle- or crew-only block (a crew-only block never reads as "business closed"). Clicking any booking opens `/admin/bookings/[id]`; clicking a blocked time opens `/admin/availability`. This is a separate integration from both the Google Calendar API sync and the Google Appointment Scheduling widget — see below.

### Google Calendar — two distinct integrations

1. **Confirmed-booking sync** (`GOOGLE_CALENDAR_ID`/`GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`/`GOOGLE_REFRESH_TOKEN`, optional): every confirmed booking is pushed to a Google Calendar as an operational view. Supabase remains the source of truth; a sync failure is recorded (`calendar_sync_status`/`calendar_sync_error`) and never invalidates the booking — staff can retry from `/admin/bookings/[id]`.
2. **Appointment Scheduling widget** (`app/components/GoogleAppointmentSchedule.tsx`, on `/book` below the wizard): a supplied Google Calendar Appointments iframe for customers who'd rather schedule a call/consult than book online. It writes nothing to Supabase and never creates a hold, vehicle/crew lock, or payment — it is explicitly *not* a second booking database.

### What was verified vs. not

- Domain logic (pricing incl. the exact 3hr-minimum/1hr-callout formula, no-advance-payment confirmation, final billing for new vs historical $100 bookings, availability, Adelaide timezone incl. the DST-boundary bug found and fixed, the booking status state machine, webhook decision logic, calendar date-range/timezone math) is covered by unit tests: `npm test`.
- **Database-level verification was actually performed (migrations 0001–0010)**, twice: once against a local Postgres 17 container (matching Supabase's engine version) with the Supabase standard roles/grants recreated, and again against the real hosted Supabase project this repo is linked to — every migration was applied via the Supabase MCP tool and re-verified with live queries (double-booking rejected for the same vehicle/crew, allowed for a different one, expired holds release their slot, concurrent requests for the same slot leave exactly one winner, RLS denies anon/non-staff and allows staff, RPCs are unreachable by anon/authenticated).
- **Migration `0011_no_advance_payment.sql` was applied to the hosted project (2026-09-28) and verified live**: the RPC is executable by `service_role` only, and a real no-payment booking was made through the `/book` UI against it (confirmed, `payment_status = not_required`, $0 paid, balance = full total, one `booking_confirmed` event, one email, no `payments` row, no Stripe request). Five concurrent `POST /api/booking/confirm` calls on one hold produced exactly one confirmation/event/email; a wrong token returned 404; an expired hold returned 409 with the re-select message; `/api/booking/checkout` returned 410. The test bookings were then cancelled/expired and annotated.
- **Migration `0012_booking_rate_limits.sql` was applied to the hosted project (2026-09-28) and verified live**: service-role-only functions/table, raw-IP keys rejected by the DB, limit/isolation/window-reset/cleanup checked in SQL; against the API, 40 concurrent availability calls from one IP gave exactly 30 × 200 + 10 × 429 (another IP unaffected), the 7th hold attempt was blocked, and a re-confirm of an already-confirmed booking returned 200 while the IP was limited. Only 64-hex hashes were stored.
- **Google Calendar sync has NOT been verified against a real Google account** — no `GOOGLE_*` credentials exist locally or in Vercel. The disabled path was verified live (booking confirms, status "Disabled"); the create/update/reschedule/cancel/retry/no-duplicate logic is unit tested against a fake Google client. Do one real run after adding the credentials.
- The Stripe payment flow has been retired from booking; the dormant webhook's decision logic (including "never touch a booking without a recorded Checkout session") is unit tested.
- `/admin/calendar` was verified by code review and its underlying date-range/timezone/blocked-time-classification logic (10 unit tests), not by an interactive browser session — no visual/mobile-responsiveness check was performed this pass.
- The full production build succeeds and all existing site tests still pass with the booking system fully configured (real Supabase project) as well as fully unconfigured (fallback state).
