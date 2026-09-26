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
- **Booking confirmation:** a fixed $100 payment via Stripe Checkout, always credited toward the final job total, never added on top
- **Final price** is only known once the job is complete — the online booking total is always an estimate until staff finalise it in `/admin/bookings/[id]` ("Complete Job")
- **Booking hours:** earliest booking start 5am, last booking start 6pm (a job may run later than 6pm — this bounds when a job can *start*, not when the truck must be back)

Every booking freezes this policy into its own `pricing_snapshot` at payment time, so a later rate change never rewrites a historical booking's total.

### 1. Database (Supabase)

1. Create a Supabase project.
2. Apply the migrations in `supabase/migrations/` **in filename order** (`0001_...` through the latest). Either paste them into the Supabase SQL editor, or with the CLI:
   ```powershell
   supabase link --project-ref <your-project-ref>
   supabase db push
   ```
3. Create at least one **staff** account: create the user in Supabase Auth (dashboard → Authentication → Users, or the Admin API), then insert a matching row in the `staff` table with that user's `id`. Public sign-up is intentionally not wired up — staff accounts are provisioned this way only.
4. Add at least one row to `vehicles` (`active = true`) — with none, availability always reports "unavailable" and holds are refused with a clear 503.
5. `business_settings` and `pricing_rules` already seed the confirmed policy above (rates, 3-hour minimum, 1-hour call-out, $100 fixed booking confirmation, 5am–6pm hours). Adjust only if the real business policy changes.

### 2. Payments (Stripe)

Set `STRIPE_SECRET_KEY` and `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`. After first deploying, create a webhook endpoint in the Stripe dashboard pointing at `https://<your-domain>/api/stripe/webhook`, subscribed to `checkout.session.completed`, `checkout.session.async_payment_succeeded` and `checkout.session.expired`; copy its signing secret into `STRIPE_WEBHOOK_SECRET`. **The webhook — not the success-page redirect — is what confirms a booking**, so this step is required even in testing.

To test locally: `stripe listen --forward-to localhost:3000/api/stripe/webhook` prints a temporary webhook secret to use as `STRIPE_WEBHOOK_SECRET` for local dev.

### 3. Email (Resend) — optional

Set `RESEND_API_KEY`, `BOOKING_EMAIL_FROM` (a verified sending domain/address) and `BOOKING_ADMIN_EMAIL`. Without these, bookings still confirm normally; email sends are skipped and logged as failed rows in the `notifications` table instead of blocking anything.

### 4. Google Calendar — optional, operational view only

Set `GOOGLE_CALENDAR_ID`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN` (OAuth credentials for a Google account with edit access to the target calendar). Supabase remains the source of truth; a calendar sync failure is recorded on the booking (`calendar_sync_status`/`calendar_sync_error`) and never invalidates the booking itself.

### 5. Scheduled hold expiry

Set `CRON_SECRET` and add a Vercel Cron entry (`vercel.json`) hitting `/api/cron/expire-holds` every few minutes with that secret as a Bearer token. This is a backstop — holds also expire inline whenever the next customer tries to book the same vehicle/time — but without the cron job an abandoned hold can squat on a slot until someone else attempts that exact slot again.

### Admin dashboard

Once Supabase + Stripe are configured, staff sign in at `/admin/login`. All routes are `noindex` and excluded from `robots.txt`:

| Route | Purpose |
| --- | --- |
| `/admin` | Dashboard — today/tomorrow jobs, pending payment, confirmed, unassigned truck, outstanding balance, "needs attention" list |
| `/admin/bookings` | List, filter, assign vehicle/crew, cancel |
| `/admin/bookings/[id]` | Full detail: customer/move/schedule/resources/payment, reschedule (re-checks availability), status transitions, calendar sync retry, internal notes, event history, **Complete Job** (finalises the real price from actual duration) |
| `/admin/vehicles` | Add/activate/deactivate vehicles |
| `/admin/crews` | Add/activate/deactivate crews and crew members |
| `/admin/availability` | Block time (whole business, one vehicle, or one crew) |
| `/admin/pricing` | Per-crew-size rate CRUD (does not affect already-confirmed bookings — see pricing snapshots above) |
| `/admin/settings` | Hours, hold/lead/horizon/buffer, booking-number prefix, deposit policy |

No internal day/week/month calendar view exists yet — bookings are managed via the list and detail pages. The Google Calendar Appointment Scheduling widget on `/book` is a separate, supplementary contact/scheduling option (see below); it is not this admin calendar.

### Google Calendar — two distinct integrations

1. **Confirmed-booking sync** (`GOOGLE_CALENDAR_ID`/`GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`/`GOOGLE_REFRESH_TOKEN`, optional): every confirmed booking is pushed to a Google Calendar as an operational view. Supabase remains the source of truth; a sync failure is recorded (`calendar_sync_status`/`calendar_sync_error`) and never invalidates the booking — staff can retry from `/admin/bookings/[id]`.
2. **Appointment Scheduling widget** (`app/components/GoogleAppointmentSchedule.tsx`, on `/book` below the wizard): a supplied Google Calendar Appointments iframe for customers who'd rather schedule a call/consult than book online. It writes nothing to Supabase and never creates a hold, vehicle/crew lock, or payment — it is explicitly *not* a second booking database.

### What was verified vs. not

- Domain logic (pricing incl. the exact 3hr-minimum/1hr-callout/$100-confirmation formula, availability, Adelaide timezone incl. the DST-boundary bug found and fixed, the booking status state machine) has 31 passing unit tests: `npm test`.
- **Database-level verification was actually performed**, twice: once against a local Postgres 17 container (matching Supabase's engine version) with the Supabase standard roles/grants recreated, and again against the real hosted Supabase project this repo is linked to — every migration was applied via the Supabase MCP tool and re-verified with live queries (double-booking rejected for the same vehicle/crew, allowed for a different one, expired holds release their slot, concurrent requests for the same slot leave exactly one winner, RLS denies anon/non-staff and allows staff, RPCs are unreachable by anon/authenticated).
- A genuine Stripe test-mode checkout end-to-end run was **not completed** in this session (deprioritized mid-session in favor of finishing admin setup) — Stripe test keys are wired into `.env.local` and `stripe listen` was confirmed available, but no live webhook round-trip was captured. Do this once before relying on the payment flow in production.
- The full production build succeeds and all existing site tests still pass with the booking system fully configured (real Supabase project) as well as fully unconfigured (fallback state).
