# Admin visual QA harness

Renders the real, unmodified `/admin/*` pages against a local mock Supabase that serves
obviously SYNTHETIC fixtures ("Sample Customer 01", `@example.invalid`, `0400 000 0xx`).
No production credentials, no real Supabase, no app source changes. Only node built-ins
and the already-installed `@playwright/test`.

## Run (from the repo root, after `npm ci`)

```bash
# terminal 1: mock Supabase (:54399) + production build + `next start` on :3200
node audit/admin-visual/run-app.mjs            # add --rebuild to force `next build`

# terminal 2: screenshots -> audit/admin-visual/screens/<label>/<route>-<width>.png + report.json
node audit/admin-visual/shoot.mjs before
# after changing CSS/components: rebuild (stop terminal 1, rerun with --rebuild), then
node audit/admin-visual/shoot.mjs after
```

Options: `shoot.mjs <label> [--base URL] [--widths 390,768,1440,1920] [--only dashboard,quotes]`.
Env: `MOCK_PORT` (default 54399), `APP_PORT` (default 3200, run-app only; pass `--base` to shoot if changed).
Exit code is non-zero if any page is non-200 or redirects to `/admin/login` (auth mock failure).
Mock alone: `node audit/admin-visual/mock-supabase.mjs` (`/__health`, `/__log` show recent requests).

## How it works

- `run-app.mjs` sets `NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54399`, `NEXT_PUBLIC_SUPABASE_ANON_KEY=mock-anon-key`,
  `SUPABASE_SERVICE_ROLE_KEY=mock-service-role-key`, `RATE_LIMIT_SECRET=mock` (so `isBookingSystemLive()` is true),
  runs `next build` with them (NEXT_PUBLIC_* are inlined at build) and `next start`. Production build, not dev, to avoid dev overlays.
- `mock-supabase.mjs` emulates GoTrue (`/auth/v1/user|token|logout`) and a PostgREST subset: select + many-to-one embeds,
  eq/neq/gt/gte/lt/lte/in/is/not.*/like/ilike, order, limit/offset, `count=exact` (+HEAD), `.single()/.maybeSingle()`,
  POST/PATCH/DELETE (in-memory, reset on restart) and `/rpc/*` stubs. `or()` is not used by the app and not supported.
- `shoot.mjs` injects the cookie `sb-127-auth-token` (`base64-` + base64url session JSON, chunked like `@supabase/ssr` if large)
  so the owner appears signed in. `/admin/login` is shot without cookies.
- `fixtures.mjs` has ~25 bookings (-14..+30 days, Adelaide time, all statuses plus one legacy `pending_payment`),
  5 vehicles, 3 crews + members, blocked times, settings, pricing rules, 14 quote requests across all 6 statuses.
- `screens/` is git-ignored (large); `before/` was generated from the unmodified code at `d8bd08c`.
