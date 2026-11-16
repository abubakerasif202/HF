# HF dispatch backend integration
Branch: feat/dispatch-release | Delivery: single-pr; validated authorized push/merge/migration/deploy | Tests: Node test suite, typecheck, lint, build

## Specs
1. S1 — “sync with existince bookimg system and add google calender bookings”; “yes”. Keep existing HF bookings authoritative, import Google Calendar events into backend records with unknown details blank, and avoid frontend edits. Checks: importer upsert/cancel/all-day tests, owner-only route tests, typecheck/build.
2. S2 — “in crew optin update their name but keep these all changes backend dont change anything front”; “QASim SUBY MUbashir Sabi”. Keep crew resources as subcontractor assignment slots; provision QASim SUBY and Mubashir Sabi without overwriting historical crew assignments. Checks: migration idempotency and backend-only diff audit.
3. S3 — “leave details”. Store missing imported customer/job/payment fields as null; do not infer crew size, pricing, address, or staff notes. Checks: tests assert unknown fields remain null.
4. S4 — Original requirement: “Include calendar and list views for all bookings, double-booking warnings, assigned crew, truck requirements, job duration, travel time, overnight work, customer notes, quote status, and completion status. Let me add or edit a booking with customer name, date, start time, pickup and delivery locations, estimated duration, number of trucks, number of movers, fixed-price or hourly pricing, assigned subcontractor, notes, and files. Add filters by date, subcontractor, status, and truck count, plus a daily dispatch view that highlights conflicts and suggests balanced workload allocation. Include a booking detail view with timeline, checklist, customer requirements, payment record, and assignment history. Preserve the known HF Removals context that there are two subcontractors, the goal is to identify double bookings and divide work more effectively, and some jobs may involve two trucks, overnight time, or a truck remaining at the customer site. Leave unknown details blank rather than inventing them. Keep the wording concise and direct, and make the app easy to use on desktop and mobile.” Scope: backend persistence and authorized API support plus a desktop/mobile dispatch view styled with the existing HF admin components, typography, dark emerald/gold palette, and road artwork. Reuse current bookings, crews, vehicles, booking_events, payments, and Google Calendar configuration. Checks: migration review, authorization and sync tests, typecheck/build.

## Tasks
- T1 [S1-S4] inline; status: in progress; commit: pending authorized release checks.

## Log
- L1: “add these changes in existing Hf repo sync them make one setup”
- L2: “in crew optin update their name but keep these all changes backend dont change anything front”
- L3: “QASim SUBY MUbashir Sabi”
- L4: “leave details”
- Discovery: existing HF schema already has bookings, crews, vehicles, booking_events, payment rows, and an owner-only Supabase→Google Calendar mirror. Imported Google events must be identifiable separately from HF-created events to prevent feedback loops. Multi-truck assignments cannot be represented by bookings.vehicle_id alone; use an explicit join table.
- Scope note: do not run migrations against Supabase or publish/push. Existing unrelated working-tree edits are preserved.

- L5 (2026-11-14): “make same graphics like existance in repo” — front-end dispatch view is now authorized; match the existing HF admin visual system and assets, with no unrelated public-site redesign.

- L6 (2026-11-16): User requests continue dispatch integration and finish authorized release; explicitly approved connected GitHub, Vercel and Supabase accounts after validation. Supabase target wtyafqwmbcpzphgltdwk; Vercel hf-removals-adelaide. Preserve original dirty checkout; perform source work in isolated release worktree. Previous local-only restriction is superseded.
- Verification: remote main c88f0c0; release HEAD 5d3b631, no remote feature branch. Supabase migration 0018 absent and both new tables absent; zero live primary-vehicle overlaps. Dependency junction preserved by rename; locked worktree-local install running.
- T2 [S1-S4] inline; status: in progress; scope: reservation/history/import fixes and regression coverage; Risk: items 1, 3, 4, 5. Independent safety verifier required.
- T3 [S4] inline; status: pending; scope: authenticated responsive QA and original functionality gap assessment.
- T4 [S1-S4] inline; status: pending; scope: validated release and live proof. No release until checks and repository review gates satisfied.

- L7 (2026-11-17): Release base fast-forwarded to origin/main c88f0c0. Original unrelated source untouched. Dependency junction preserved intact outside project at sibling dispatch-release-node_modules-preserved; worktree-local npm ci --ignore-scripts completed.
- Implemented row-locked service-role update_dispatch_booking RPC: merged truck validation, assignment/reschedule history atomic rollback; dispatch invokes existing Calendar reconciliation. Status trigger/backfill exactly held/pending_payment/confirmed/assigned/in_progress. Scoped importer re-fetches missing prior events before single monotonic locked batch persistence. Partial upstream failure preserves stored events.
- Added dispatch operational editor and detail-card integration; actual occupied times support overnight/onsite reservation. Shared legacy truck counts fix filtering/allocation. Postcommit Calendar failure returns saved-state warning retained in parent notice. New dispatch page uses existing requireAdmin; detail link selects correct Adelaide day.
- Tests observed RED then GREEN: PostgreSQL missing RPC/history atomicity, postcommit503, effective truck-count helpers. Independent safety review and scoped recheck passed after one correction batch (persistent warning fix rechecked). Initial fresh build/typecheck/lint PASS, full Node254 pass2 skipped; final after-correction rerun pending.
- Live read-only preflight: migration0018/new tables absent, btree_gist present, owner RLS/exclusions present,22 bookings,0 active primary overlaps; requested crew names not yet provisioned. No production writes or customer data exposure.
- Authenticated desktop/mobile dispatch/editor QA BLOCKED: browser access host unavailable and release worktree has no auth configuration/session. No bypass. Public browser regression is separate proof.
- Original S4 remains incomplete: admin booking creation, full customer/address/mover editing, attachments. Do not claim the full original brief complete. Dispatch metadata/details now locally covered.
- Route: parent inline backend+detail; delegated importer and editor as independent disjoint behavior units, independent safety verifier for risk1/3/4/5, delegated long build/suites. Strategy single coherent PR: availability reader/new reservation trigger/RPC contracts require coordinated migration-before-app release; not arbitrary line-count slices. Forecast approximately1700 authored lines incl recovered prior implementation.
- No commit, push, merge, migration or deployment performed. Staged only intended feature files. Native review enabled; consent/check gates remain pending. Logs confined to ignored qa-artifacts/dispatch-release.
