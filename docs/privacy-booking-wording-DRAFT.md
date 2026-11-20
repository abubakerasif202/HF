# DRAFT: Privacy wording covering bookings (for owner approval)

> Draft only. Not legal advice. Nothing here is published; the live privacy page (`app/components/Site.tsx` `StaticPage`, rendered via `app/[...slug]/page.tsx`) is unchanged.
> Every factual statement below is derived from the code in this worktree (see section 2). Anything the code cannot establish is marked **[OWNER TO CONFIRM]** and must be decided by the owner (ideally with advice from a lawyer or the OAIC guidance) before publishing.
> Code state: branch `feat-admin-ops-upgrade`, checked 2026-11-21.

## 0. What the current page says (for comparison)

`Site.tsx:1442-1469`. Title "How enquiry information is handled". Three short sections: "Enquiry information", "Contact and delivery", "Contact". It says only that quote-form details go to HF through Web3Forms. It does not mention: bookings, the Supabase copy of quote enquiries (`app/api/quote/capture/route.ts`), booking emails, Google Calendar, analytics, or retention. Tone: short, plain, second person, no legal terms. The proposed text keeps that style.

Page metadata (`app/[...slug]/page.tsx:15`) also says "quote enquiry" only; suggested replacement is in section 1.7.

## 1. Proposed text (ready to paste, plain text)

### 1.1 Page title, hero and description (replace)

Hero title: How enquiry and booking information is handled
Hero description: A concise explanation of the information used to respond to move enquiries and to make and run bookings.
Meta description: How HF Removals Adelaide uses the contact, route, date and move details you submit in a quote enquiry or an online booking, and who it is shared with.

### 1.2 Section: Enquiry information (keep, lightly extended)

When you submit a quote enquiry, the details you provide are used to review and respond to your move request. The form includes contact, route, date, property and move-scope information. A copy of each enquiry is also saved in HF's booking system so it can be followed up.

### 1.3 Section: Booking information (new)

When you book online, we collect and store:
- your name, email address and phone number (phone is optional);
- your pickup and destination addresses (street, suburb, state, postcode);
- the date and time you choose, the truck package you select, the service type, and the property size or notes you enter;
- anything you type into "Anything else we should know?";
- a record of the price calculation for your booking (package, hourly rate, minimum hours and call-out) and, later, the final job details and any invoice for your move.

We use this to hold and confirm your time slot, send your booking confirmation, schedule and carry out your move, prepare the invoice, and keep business records. Online bookings do not require an advance payment, so we do not collect card details through the website. Older bookings made before advance payment was retired [OWNER TO CONFIRM: date] may have a payment record from Stripe, our former payment provider. [OWNER TO CONFIRM: wording about what Stripe held; not determinable from current code.]

If you start a booking but do not confirm it, the held time slot is released automatically after a short time, but the details you entered are still kept in our booking system. [OWNER TO CONFIRM: retention of unconfirmed bookings; see section 3.]

### 1.4 Section: Who we share information with (new)

Information is shared only with the services we use to run the business:
- Supabase hosts our booking database. The database project is in the Sydney region (ap-southeast-2) [OWNER TO CONFIRM against the Supabase dashboard; not visible in the code]. Our website is served from Vercel, configured to run its server functions in Sydney (syd1).
- Resend sends our booking emails. Each confirmed booking sends you one confirmation email, and sends a short notice to HF. The confirmation email shows your booking reference, move date and time, pickup and destination addresses, package, rates and estimated minimum price. It does not include your phone number.
- Google Calendar: confirmed bookings are copied to HF's Google Calendar so the crew can be scheduled. The calendar event includes your name, phone, email, pickup and destination addresses, booking reference, package and crew size. It does not include your notes. [OWNER TO CONFIRM: who can see this calendar (owner only, or crew/subcontractors).]
- Web3Forms delivers quote-form emails to HF (see "Contact and delivery"). Web3Forms is also used for the job completion form you may be asked to sign at the end of a move.
- Google (Calendar appointment scheduling, if you choose to use it on the booking page, and an embedded Google map on the contact page) and the analytics services below receive information directly from your browser when you use those parts of the site.

We do not sell your information. [OWNER TO CONFIRM: owner to approve this statement; the code contains no sale or marketing use, and no marketing emails are sent by the booking system.]

Some of these providers may store or process information outside Australia. [OWNER TO CONFIRM: which providers, which countries, and the exact APP 8 / overseas disclosure wording.]

### 1.5 Section: Website analytics and cookies (new)

This website uses Google Analytics (GA4) and Ahrefs Analytics to understand how the site is used. They run in your browser on all public pages. During online booking, we record anonymous steps in the booking process (for example "booking started" and "booking confirmed", with the truck package and service type). We do not send your name, email, phone number or address to analytics.

Google Analytics and Ahrefs may set cookies or similar identifiers and collect technical information such as device, browser and approximate location. [OWNER TO CONFIRM: exact cookies set, and whether a notice/opt-out is wanted; the code has no cookie banner.]

Your browser also remembers the truck you picked, for the current visit only, so it is still selected when you reach the booking page. It is not sent to us.

### 1.6 Section: Security, access and retention (new)

Booking records can be viewed and changed only by the HF owner after logging in to a private admin area. Customers do not have accounts. After you confirm a booking you get a private link to view it; keep that link private, because anyone with the link can see the booking addresses and price. [OWNER TO CONFIRM: owner is comfortable stating this.] To limit abuse of the booking form, we store a scrambled (hashed) version of your network address for a short time; the plain address is not stored by the website's own code.

We keep booking, customer and invoice records for as long as needed to run the business and meet record-keeping obligations. [OWNER TO CONFIRM: actual retention period for bookings, customers, enquiries, notification logs and invoices. The code has no deletion schedule.]

### 1.7 Section: Contact (extend)

To ask for a copy of your information, correct it, or ask that it be deleted or de-identified, contact [OWNER TO CONFIRM: privacy contact, e.g. the existing email shown on the page] at ${business.emails[0]} or ${business.phones[0].display}. [OWNER TO CONFIRM: response timeframe, how identity is verified, and complaint route, e.g. OAIC.]

## 2. Claim -> evidence (file:line)

All paths relative to the worktree root.

| # | Claim | Evidence |
|---|---|---|
| 1 | Existing page only discloses Web3Forms for quote-form delivery | `app/components/Site.tsx:1462`; `lib/site-data.ts:17` (endpoint `https://api.web3forms.com/submit`) |
| 2 | Quote enquiries are also copied to Supabase `quote_requests` (full submitted fields, up to 4000-char details) | `app/api/quote/capture/route.ts:13-18, 30, 69-71`; `app/components/SiteClient.tsx:526-560`; `supabase/migrations/0014_quote_requests.sql:2-12` |
| 3 | Booking collects name, email (required), phone (optional) | `app/api/booking/hold/route.ts:54-58` |
| 4 | Booking collects pickup/destination: street, suburb, state, postcode, country; optional formatted address, lat/long, placeId accepted by the API | `app/api/booking/hold/route.ts:25-35` |
| 5 | The wizard UI only collects manual street/suburb/state/postcode fields; it does not send lat/long/placeId and no Google Places lookup was found in `app/` or `lib/` | `app/book/BookingWizard.tsx:468-481, 182-191`; grep for `google.maps` / `places` / `maps.googleapis` in app and lib returned no usage (only a `preconnect` hint at `app/layout.tsx:60-62`) |
| 6 | Move details are `propertySize` + `service`; free-text notes up to 2000 chars | `app/book/BookingWizard.tsx:188-190, 309-316`; `app/api/booking/hold/route.ts:52-53, 59` |
| 7 | Honeypot field `website` is rejected and not stored | `app/api/booking/hold/route.ts:62, 96-100`; `app/book/BookingWizard.tsx:113` |
| 8 | Contact snapshot (name, email, phone) is stored on the booking itself, plus a shared `customers` row keyed by email | `lib/server/booking-repo.ts:127-147, 181-201`; `supabase/migrations/0020_booking_contact_snapshot.sql:12-14`; `supabase/migrations/0001_booking_system.sql:229-235` |
| 9 | A `customers` row is created at hold time, before confirmation (so abandoned holds still leave a customer record) | `app/api/booking/hold/route.ts:187-208`; `lib/server/booking-repo.ts:127-147` |
| 10 | Booking row stores addresses, move details, customer notes, internal notes, pricing snapshot, booking and payment status, access token, calendar sync fields | `supabase/migrations/0001_booking_system.sql:261-320` |
| 11 | Pricing snapshot is frozen at confirmation: package, truck, crew, rate, minimum, call-out, advance payment flags | `lib/booking/types.ts:99-114`; `app/api/booking/confirm/route.ts:78-87` |
| 12 | No advance payment for online bookings; checkout route is retired (HTTP 410) | `app/api/booking/checkout/route.ts:5-16`; `lib/booking/types.ts:11-14, 90-93` |
| 13 | Stripe webhook code still exists for historical sessions; `payments` table holds Stripe ids and amounts, not card data | `app/api/stripe/webhook/route.ts:1-12`; `supabase/migrations/0001_booking_system.sql:372-391` |
| 14 | What Stripe collected in the old checkout is not established by current code (route is a stub) | `app/api/booking/checkout/route.ts` (retired); needs owner or git history |
| 15 | Invoices store a customer name/email/phone snapshot, booking ref, service date, lines, payments (method, reference) and are generated as PDF by the owner-only admin route; no code emails invoices | `supabase/migrations/0019_booking_finder_and_invoicing.sql:183-253`; `lib/server/invoice-repo.ts:108-130`; `app/api/admin/invoices/[id]/pdf/route.ts:20`; only `emails.send` callers are in `lib/server/notifications.ts:116, 126, 147` |
| 16 | Issued invoices cannot be deleted with their booking (FK `on delete restrict`); only drafts are deleted | `supabase/migrations/0019_booking_finder_and_invoicing.sql:185`; `lib/server/invoice-repo.ts:246` |
| 17 | Supabase region: project region ap-southeast-2 is from the task brief; not in the repo | not in code; **[OWNER TO CONFIRM]** |
| 18 | Vercel functions region is `syd1` | `vercel.json:2` |
| 19 | Emails: (a) booking confirmed to customer; (b) copy notice to business admin address; (c) payment-conflict alert to admin (historical Stripe path only) | `lib/server/notifications.ts:77-137, 139-157` |
| 20 | Customer email fields: booking number, move date/time, pickup, destination, package, crew, rate, minimum hours, call-out, estimated minimum, payment line; no name and no phone | `lib/server/notifications.ts:96-115` |
| 21 | Admin copy email contains only booking number, date/time and payment line | `lib/server/notifications.ts:126-131` |
| 22 | Confirmation email is sent once at confirmation, from the confirm route (and from the historical Stripe webhook) | `app/api/booking/confirm/route.ts:78-89`; `lib/booking/confirmation.ts:47`; `app/api/stripe/webhook/route.ts:6` |
| 23 | Every email attempt is logged in `notifications` with recipient email, template, status, provider message id and error text | `lib/server/notifications.ts:43-61`; `supabase/migrations/0001_booking_system.sql:435-446` |
| 24 | No cancellation, reminder or marketing emails are sent by the code | only three `emails.send` call sites (`lib/server/notifications.ts:116, 126, 147`) |
| 25 | Google Calendar event content: summary (booking no, surname, package); description (booking ref, customer name, phone, email, pickup, destination, package, rate, crew size, status, admin link); location (pickup); start/end times | `lib/calendar-sync.ts:77-106` |
| 26 | Calendar event excludes internal notes and customer notes | `lib/calendar-sync.ts:71-76` (comment) and the field list at `:82-96`; the load query selects no `customer_notes` (`lib/server/google-calendar.ts:49`) |
| 27 | Event is created when status is confirmed/assigned/in_progress/completed, updated in place, and deleted on cancel/expiry | `lib/calendar-sync.ts:16-18, 190-240` |
| 28 | Calendar sync is optional and uses OAuth refresh-token credentials from env; the calendar id is an env value | `lib/server/google-calendar.ts:23-28`; `lib/server/config.ts:54-59` |
| 29 | Who can see the Google Calendar is not established by code (crews table has named subcontractor slots) | `supabase/migrations/0018_dispatch_google_calendar.sql:129-135` (crews seed); calendar sharing is a Google setting |
| 30 | Inbound sync copies events from HF's Google calendar: summary, start/end, all-day dates, location, status only (not description or attendees) | `lib/server/google-calendar-import.ts:37-47`; `supabase/migrations/0018_dispatch_google_calendar.sql:103-121` |
| 31 | Cron jobs: `expire-holds` every 5 min (marks stale holds `expired`; purges expired rate-limit rows); `google-sync` every 15 min (calendar import + retry of pending/failed pushes) | `vercel.json:3-10`; `app/api/cron/expire-holds/route.ts:30-39`; `app/api/cron/google-sync/route.ts:19-22, 35-58` |
| 32 | Expiry only changes status to `expired`; the row (contact, addresses, notes) is kept | `supabase/migrations/0001_booking_system.sql:459-476` |
| 33 | Cron endpoints require a bearer secret | `app/api/cron/expire-holds/route.ts:22-25`; `app/api/cron/google-sync/route.ts:26-28` |
| 34 | No code deletes bookings, customers, quote requests, notifications or booking events; only blocked times, draft invoices and expired rate-limit rows are deleted | grep of `.delete(` / `delete from` / `purge` across `app`, `lib`, `supabase`: `app/admin/(protected)/availability/actions.ts:40`, `lib/server/invoice-repo.ts:246`, `supabase/migrations/0012_booking_rate_limits.sql:71-100`, `0014_quote_requests.sql:59` |
| 35 | Admin edits to a customer's contact details keep before/after copies in `admin_audit` (so old details persist after a correction) | `lib/server/customer-repo.ts:169-183`; `supabase/migrations/0022_admin_audit.sql:8-18` |
| 36 | Rate limiting stores only an HMAC-SHA256 hash of the normalised IP, never the raw IP, and it is not logged | `lib/rate-limit.ts:8-10`; `lib/server/rate-limit.ts:22-26`; `supabase/migrations/0012_booking_rate_limits.sql:35`; `README.md:121` |
| 37 | Hashing only applies to app code; hosting platform logs (Vercel, Supabase) are not covered by the code | not determinable from code; **[OWNER TO CONFIRM]** |
| 38 | Single owner login: one allow-listed admin email, staff row with role `owner`; customers do not log in | `lib/admin-access.ts:1-13`; `lib/server/supabase-ssr.ts:55-63`; `app/admin/actions.ts:20` |
| 39 | Database access is owner-only via RLS; browsers do not talk to the database directly | `supabase/migrations/0017_owner_only_rls_and_grants.sql:1-18` |
| 40 | Admin session cookies are httpOnly, secure in production, sameSite lax | `lib/server/supabase-ssr.ts:15-20` |
| 41 | Admin stores a theme/nav preference in browser localStorage (admin only, no personal data) | `app/admin/layout.tsx:20`; `app/admin/_components/shell/AdminShell.tsx:28, 36` |
| 42 | Owner can export CSV of bookings, customers, invoices and quotes | `app/api/admin/export/{bookings,customers,invoices,quotes}/route.ts`; `lib/server/export-data.ts:80-145` |
| 43 | Public booking link carries a private token: `/booking/success?token=...`; lookup by token returns addresses, status and amounts (not contact details) | `app/api/booking/confirm/route.ts:101-107`; `app/api/booking/lookup/route.ts:19-37`; `supabase/migrations/0001_booking_system.sql:301-303` |
| 44 | Google Analytics (GA4, default id in code) and Ahrefs Analytics script load on all public pages, no consent gating | `app/layout.tsx:54-83` |
| 45 | Booking funnel events send only step/package/service/code, never name/email/phone/address | `lib/booking-analytics.ts:1-21`; `app/book/BookingWizard.tsx:173, 196, 206, 243`; `app/components/SiteClient.tsx:19-24, 560` |
| 46 | No cookie consent banner or cookie-setting code of HF's own was found on the public site (cookies set by Google/Ahrefs scripts are not visible in code) | grep for `cookie|consent` across `app`: only admin-related hits |
| 47 | Truck choice is kept in sessionStorage in the browser only | `lib/truck-selection.ts:8-45` |
| 48 | Google appointment-scheduling widget is opt-in (iframe mounts only after a click); data entered there goes to Google, not to HF's booking tables | `app/components/GoogleAppointmentSchedule.tsx:8-17, 31-50` |
| 49 | Embedded Google map on the contact page | `app/components/Site.tsx:580`; `lib/site-data.ts:85` |
| 50 | CSP allowlists third parties: Web3Forms, Stripe, Google Tag Manager/Analytics, Ahrefs, Google (frames) | `next.config.ts:21-34` |
| 51 | Job completion form (noindex) sends customer name, phone, email, addresses, job times, charges, comments and a drawn signature image to Web3Forms, not to Supabase | `app/job-completion/JobCompletionForm.tsx:24-52, 63`; `app/job-completion/page.tsx:7` |

## 3. Needs owner confirmation

1. **Retention periods.** The code has no deletion or anonymisation job for bookings, customers, unconfirmed (expired) holds, quote enquiries, notification logs, audit logs, or invoices (claims 32, 34, 35). Owner to decide: how long each is kept, what is done with unconfirmed holds, and whether a manual purge process will be used. Issued invoices likely have separate record-keeping duties (ask your accountant). Do not publish a period until a process exists to enforce it.
2. **Privacy contact and data requests.** Which email/phone receives access, correction and deletion requests; response timeframe; how identity is checked; complaint path (e.g. OAIC). Note correction is possible in the admin (claim 35), but deletion has no tool, and old values persist in `admin_audit`.
3. **Legal basis / consent wording.** Whether to state consent, contract performance or legitimate business interest; whether a collection notice at the point of booking (a short line above "Confirm booking" linking to this page) is wanted. Not determinable from code.
4. **Australian Privacy Act / APP wording.** Whether HF is covered by the APPs (small business exemption turns on annual turnover and other factors), and if so the APP 1/5/8 required content. Take advice before using any "we comply with" statement. None is used in the draft.
5. **Overseas processing (APP 8).** Where Resend, Google (Calendar, Analytics), Web3Forms, Ahrefs, Supabase and Vercel actually store or process data. Only the Vercel function region (`syd1`, claim 18) and the stated Supabase region (claim 17) are known; everything else is unknown from code. Confirm Supabase region in the dashboard.
6. **Google Calendar visibility.** Who is shared on the calendar named in `GOOGLE_CALENDAR_ID`, and whether crew or subcontractors see customer names, phones, emails and addresses (claims 25, 29).
7. **Analytics and cookies.** Which cookies GA4 and Ahrefs set on this domain, whether Google Signals or advertising features are enabled in the GA4 property, whether a consent banner or opt-out is wanted (claims 44-46). The draft says "may set cookies" rather than listing them.
8. **Stripe history.** Date advance payment was retired, and what the old checkout sent to Stripe (claims 12-14). Wording about historic bookings is a placeholder.
9. **"We do not sell your information."** Confirm the owner is happy to state it. Code shows no sale and no marketing use, but business practice outside the code is unknown.
10. **Job completion form.** It uses Web3Forms and carries a signature image (claim 51). Decide whether to describe it on this page and whether it should stay on Web3Forms. Not a booking-table flow, but it handles booking/job data.
11. **Quote enquiries stored in Supabase.** The current page does not say this (claim 2). The draft adds one sentence; confirm.
12. **Booking link sentence (1.6).** The private booking link shows addresses to anyone holding it. Confirm the owner wants that stated, or change the product behaviour instead.
13. **Hashed IP statement.** Accurate for app code only (claim 36); platform logs at Vercel/Supabase may hold IPs (claim 37).
14. **Page title and metadata.** Changing `staticPages.privacy.description` (`app/[...slug]/page.tsx:15`) and the hero copy affects SEO snippets and existing tests (`tests/rendered-html.test.mjs`); coordinate with the SEO work on this branch before publishing.
