import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { checkRateLimit, getClientIp, normalizeIp, hashClientKey, RATE_LIMITS, RATE_LIMITED_MESSAGE } from "../lib/rate-limit.ts";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const SECRET = "test-rate-limit-secret";

function headers(map) {
  const lower = Object.fromEntries(Object.entries(map).map(([k, v]) => [k.toLowerCase(), v]));
  return { get: (name) => lower[name.toLowerCase()] ?? null };
}

/**
 * In-memory model of consume_booking_rate_limit (migration 0012): fixed
 * epoch-aligned windows per (key_hash, action), atomic increment, and the
 * same 64-hex key check the DB enforces. `stored` records every key the
 * limiter ever persisted, to prove no raw IP is written.
 */
function createStore(clock) {
  const rows = new Map();
  const stored = [];
  const consume = async (keyHash, action, limit, windowSeconds) => {
    if (!/^[0-9a-f]{64}$/.test(keyHash)) throw new Error("invalid_key_hash");
    await new Promise((resolve) => setImmediate(resolve));
    const nowS = clock.now / 1000;
    const windowStart = Math.floor(nowS / windowSeconds) * windowSeconds;
    const key = `${keyHash}|${action}|${windowStart}`;
    const count = (rows.get(key) ?? 0) + 1; // atomic in the DB via ON CONFLICT DO UPDATE
    rows.set(key, count);
    stored.push(keyHash);
    return { allowed: count <= limit, retryAfterSeconds: Math.max(Math.ceil(windowStart + windowSeconds - nowS), 1) };
  };
  return { consume, stored, rows };
}

const ipA = headers({ "x-forwarded-for": "203.0.113.10" });
const ipB = headers({ "x-forwarded-for": "198.51.100.7" });

function limit(store, h, action = "hold", secret = SECRET) {
  return checkRateLimit({ headers: h, action, secret, onVercel: false, consume: store.consume });
}

test("rate limit: the first request is allowed", async () => {
  const store = createStore({ now: Date.UTC(2026, 9, 1) });
  assert.deepEqual(await limit(store, ipA), { allowed: true });
});

test("rate limit: requests up to the limit succeed and the next one is blocked with a Retry-After", async () => {
  const store = createStore({ now: Date.UTC(2026, 9, 1, 0, 5) });
  const { limit: max } = RATE_LIMITS.hold;
  for (let i = 0; i < max; i += 1) assert.equal((await limit(store, ipA)).allowed, true, `request ${i + 1}`);
  const blocked = await limit(store, ipA);
  assert.equal(blocked.allowed, false);
  assert.ok(blocked.retryAfterSeconds > 0 && blocked.retryAfterSeconds <= RATE_LIMITS.hold.windowSeconds);
});

test("rate limit: different IPs have independent counters", async () => {
  const store = createStore({ now: Date.UTC(2026, 9, 1, 1) });
  for (let i = 0; i <= RATE_LIMITS.hold.limit; i += 1) await limit(store, ipA);
  assert.equal((await limit(store, ipA)).allowed, false);
  assert.equal((await limit(store, ipB)).allowed, true);
});

test("rate limit: different actions have independent buckets", async () => {
  const store = createStore({ now: Date.UTC(2026, 9, 1, 2) });
  for (let i = 0; i <= RATE_LIMITS.hold.limit; i += 1) await limit(store, ipA, "hold");
  assert.equal((await limit(store, ipA, "hold")).allowed, false);
  assert.equal((await limit(store, ipA, "confirm")).allowed, true);
  assert.equal((await limit(store, ipA, "availability")).allowed, true);
});

test("rate limit: the counter resets once the window has passed", async () => {
  const clock = { now: Date.UTC(2026, 9, 1, 3) };
  const store = createStore(clock);
  for (let i = 0; i <= RATE_LIMITS.hold.limit; i += 1) await limit(store, ipA);
  assert.equal((await limit(store, ipA)).allowed, false);
  clock.now += RATE_LIMITS.hold.windowSeconds * 1000;
  assert.equal((await limit(store, ipA)).allowed, true);
});

test("rate limit: a burst of concurrent requests cannot exceed the limit", async () => {
  const store = createStore({ now: Date.UTC(2026, 9, 1, 4) });
  const results = await Promise.all(Array.from({ length: 40 }, () => limit(store, ipA, "availability")));
  assert.equal(results.filter((r) => r.allowed).length, RATE_LIMITS.availability.limit);
  assert.equal(results.filter((r) => !r.allowed).length, 40 - RATE_LIMITS.availability.limit);
});

test("privacy: only an HMAC-SHA256 digest is stored — never the raw IP", async () => {
  const store = createStore({ now: Date.UTC(2026, 9, 1, 5) });
  await limit(store, ipA);
  assert.equal(store.stored.length, 1);
  assert.match(store.stored[0], /^[0-9a-f]{64}$/);
  assert.equal(store.stored[0], hashClientKey("203.0.113.10", SECRET));
  assert.ok(!store.stored[0].includes("203.0.113.10"));
});

test("privacy: the hash depends on the secret, so it can't be reversed by hashing candidate IPs without it", () => {
  assert.notEqual(hashClientKey("203.0.113.10", "secret-a"), hashClientKey("203.0.113.10", "secret-b"));
});

test("fail open: no usable IP skips the limiter instead of blocking the booking", async () => {
  const store = createStore({ now: Date.UTC(2026, 9, 1, 6) });
  for (const h of [headers({}), headers({ "x-forwarded-for": "not-an-ip" }), headers({ "x-forwarded-for": "" })]) {
    assert.deepEqual(await limit(store, h), { allowed: true, skipped: "no_ip" });
  }
  assert.equal(store.stored.length, 0);
});

test("fail open: a missing RATE_LIMIT_SECRET skips the limiter", async () => {
  const store = createStore({ now: Date.UTC(2026, 9, 1, 7) });
  assert.deepEqual(await limit(store, ipA, "hold", null), { allowed: true, skipped: "no_secret" });
  assert.equal(store.stored.length, 0);
});

test("fail open: a storage error never blocks a booking", async () => {
  const decision = await checkRateLimit({
    headers: ipA,
    action: "confirm",
    secret: SECRET,
    onVercel: false,
    consume: async () => {
      throw new Error("db down");
    },
  });
  assert.deepEqual(decision, { allowed: true, skipped: "store_error" });
});

// --- IP extraction / normalisation --------------------------------------

test("ip: on Vercel the edge-set x-vercel-forwarded-for wins over other headers", () => {
  const h = headers({ "x-vercel-forwarded-for": "203.0.113.1", "x-real-ip": "203.0.113.2", "x-forwarded-for": "203.0.113.3" });
  assert.equal(getClientIp(h, { onVercel: true }), "203.0.113.1");
});

test("ip: only the first (client) hop of x-forwarded-for is used", () => {
  assert.equal(getClientIp(headers({ "x-forwarded-for": "203.0.113.9, 10.0.0.1, 10.0.0.2" }), { onVercel: false }), "203.0.113.9");
});

test("ip: normalisation handles ports, brackets, zone ids and IPv4-mapped IPv6", () => {
  assert.equal(normalizeIp("203.0.113.5:44321"), "203.0.113.5");
  assert.equal(normalizeIp(" 203.0.113.5 "), "203.0.113.5");
  assert.equal(normalizeIp("::ffff:203.0.113.5"), "203.0.113.5");
  assert.equal(normalizeIp("[2001:db8::1]:443"), "2001:0db8:0000:0000::/64");
  assert.equal(normalizeIp("fe80::1%eth0"), "fe80:0000:0000:0000::/64");
  assert.equal(normalizeIp("garbage"), null);
  assert.equal(normalizeIp("999.1.1.1"), null);
});

test("ip: IPv6 addresses in the same /64 share one bucket (no address-rotation bypass)", () => {
  assert.equal(normalizeIp("2001:db8:1:2::a"), normalizeIp("2001:db8:1:2:ffff:ffff:ffff:ffff"));
  assert.notEqual(normalizeIp("2001:db8:1:2::a"), normalizeIp("2001:db8:1:3::a"));
});

// --- Route wiring, 429 shape, idempotency, existing limits ---------------

test("routes: availability, hold and confirm are all rate limited per IP", async () => {
  assert.match(await read("app/api/booking/availability/route.ts"), /enforceRateLimit\(request, "availability"\)/);
  assert.match(await read("app/api/booking/hold/route.ts"), /enforceRateLimit\(request, "hold"\)/);
  assert.match(await read("app/api/booking/confirm/route.ts"), /enforceRateLimit\(request, "confirm"\)/);
});

test("429: friendly JSON with code rate_limited and a Retry-After header, revealing nothing internal", async () => {
  const src = await read("lib/server/rate-limit.ts");
  assert.equal(RATE_LIMITED_MESSAGE, "Too many booking attempts. Please wait a few minutes and try again.");
  assert.match(src, /\{ error: RATE_LIMITED_MESSAGE, code: "rate_limited" \}/);
  assert.match(src, /status: 429, headers: \{ "Retry-After"/);
  assert.doesNotMatch(src, /console\.\w+\([^)]*(ip|hash|keyHash)\b/i);
});

test("idempotency: a rate-limited confirm for an already-confirmed booking still returns the confirmed result", async () => {
  const src = await read("app/api/booking/confirm/route.ts");
  assert.match(src, /if \(limited\) \{\s*if \(booking && ownsBooking && CONFIRMED_STATUSES\.has\(booking\.booking_status\)\) \{\s*return confirmedResponse\(booking, true\);/);
});

test("existing per-email protections are still in place alongside the IP limiter", async () => {
  const src = await read("app/api/booking/hold/route.ts");
  assert.match(src, /MAX_ACTIVE_HOLDS_PER_EMAIL = 3/);
  assert.match(src, /MAX_RECENT_CONFIRMED_PER_EMAIL = 3/);
  assert.match(src, /code: "duplicate_booking"/);
  assert.match(src, /if \(input\.website\)/);
});

test("migration 0012: hashed keys only, atomic upsert, service-role only, additive", async () => {
  const sql = await read("supabase/migrations/0012_booking_rate_limits.sql");
  assert.match(sql, /key_hash text not null check \(key_hash ~ '\^\[0-9a-f\]\{64\}\$'\)/);
  assert.match(sql, /on conflict \(key_hash, action, window_started_at\)\s+do update set request_count = booking_rate_limits\.request_count \+ 1\s+returning request_count/);
  assert.match(sql, /enable row level security/);
  assert.match(sql, /revoke execute on function consume_booking_rate_limit\(text, text, integer, integer\) from public, anon, authenticated;/);
  assert.match(sql, /grant execute on function consume_booking_rate_limit\(text, text, integer, integer\) to service_role;/);
  assert.match(sql, /revoke execute on function purge_expired_booking_rate_limits\(\) from public, anon, authenticated;/);
  assert.doesNotMatch(sql, /drop\s+table|drop\s+column|truncate/i);
});

test("cron: expired rate-limit windows are purged without being able to fail the hold sweep", async () => {
  const src = await read("app/api/cron/expire-holds/route.ts");
  assert.match(src, /rpc\("purge_expired_booking_rate_limits"\)/);
  assert.match(src, /purge\.error \? null : purge\.data/);
  assert.match(src, /Bearer \$\{cronConfig\.secret\(\)\}/);
});

test("migration 0013: revokes API-role access to the exposed Stripe foreign table without dropping it", async () => {
  const sql = await read("supabase/migrations/0013_revoke_public_stripe_fdw_access.sql");
  assert.match(sql, /revoke all on table public\.s from anon, authenticated/);
  assert.doesNotMatch(sql, /drop\s/i);
});
