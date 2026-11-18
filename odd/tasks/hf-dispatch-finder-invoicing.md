# HF Dispatch: scheduling clarity, Booking Finder, Invoice Generator
Branch: feat/dispatch-finder-invoices (off feat/dispatch-release 7394ec8) | Delivery: local only; no push, no production migration, no deploy | Tests: node --test tests/*.test.mjs, typecheck, lint, build, Playwright

## Specs
1. S1 — "Make today's jobs, upcoming jobs, and jobs awaiting crew or truck assignment easy to find." Dispatch work queues.
2. S2 — Booking detail shows customer contact, move date and time, pickup and drop-off, agreed price, assigned crew, truck, status.
3. S3 — "Warn staff when the same crew, subcontractor, or truck is assigned to overlapping jobs. Show the conflicting booking. If a finish time is missing, label the conflict as possible." Use Australia/Adelaide incl. DST.
4. S4 — Booking Finder: visible "Find booking" in Dispatch; search by reference, name, phone, email, suburb, street; partial match; AU mobile local and +61; filters date range, status, crew, truck; exact reference and phone first; results show date, customer, route, status, assignment; opens original booking; server-enforced owner permission; paginated; loading/empty/error; mobile + keyboard.
5. S5 — Invoice Generator: "Create invoice" on booking detail and an "Invoices" view; prefill customer, ref, service date, agreed rate or fixed quote; missing pricing flagged before issue; historical bookings keep agreed prices; hourly and fixed; editable line items (call-out, travel, packing, surcharge, discount); deposits/payments separate from charges, balance due; GST inclusive/exclusive clear; integer cents; verified HF settings, missing ones identified and block issuance; draft, preview, issue, PDF; atomic numbers; retry-safe issue; issued snapshots immutable; auditable void-and-reissue (no existing correction workflow); PDF obeys invoice permissions; no email delivery.
6. S6 — Additive migration verified against legacy-shaped bookings. Tests: search/filters, conflicts, hourly/fixed, GST/rounding, deposits, retry-safe issue, unauthorised access; booking creation/editing unaffected. Synthetic-data desktop+mobile run: find older booking -> detail -> draft -> totals -> issue -> PDF.

## Decisions
- Rounding: per-line round-half-up on integer cents; GST once per invoice (incl: total/11, excl: subtotal x 10%), round-half-up. Discounts are negative lines and reduce GST.
- Settings live in new singleton `invoice_settings` (ABN, GST-registered tri-state, GST-inclusive rates flag, payment instructions, terms, prefix, counter). Never seeded. Missing => issuance blocked.
- Not invented: ABN, GST status, bank details, prefix, terms, logo confirmation, invoice template (none exists in repo).
- Migration 0019 is NOT applied to live Supabase. Preview deployment is build-only (Preview has no env vars).

## Tasks
- T1 [S4,S5,S6] inline; migration 0019 + real-PG tests (real chain 0001-0019, legacy rows, 400-case TS/SQL parity, concurrency); status: done, observed passing; commit: pending
- T2 [S3,S5] inline; pure libs (finder, invoice calc/prefill/readiness/ABN, conflicts+queues, PDF writer) + unit tests; status: done, observed passing
- T3 [S3,S4,S5] inline; routes (search, queues, PDF), invoice server actions, conflict naming on 409; authz tests; status: done, observed passing
- T4 [S1,S2,S3,S4,S5] inline; UI (queues, finder, detail price/trucks/conflicts, invoices list/editor/issued/settings); typecheck+lint clean; status: done
- T5 [S6] inline; mock-supabase harness extension, desktop+mobile workflow, full suite, report; status: in progress

## Log
- L1: "Improve the existing HF Removals Adelaide — Dispatch app. Implement and test the changes in the current codebase." (full brief in session; sections 1-4 map to S1-S6)
- L2 (2026-11-18): Real Dispatch code lives on feat/dispatch-release (migration 0018 already applied live). Current checkout seo/gsc-local-ctr-recovery has only stale dirty drafts, so work is in worktree HF-worktrees/dispatch-invoicing; the dirty SEO checkout is untouched.
