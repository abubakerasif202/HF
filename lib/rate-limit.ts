// Per-IP rate limiting for the public booking API — the pure parts: client
// IP extraction/normalisation, privacy-preserving hashing and the
// allow/deny decision. No Next.js/Supabase imports and no `server-only`,
// so this is unit-testable with plain `node --test`. The Supabase-backed
// counter store (the authoritative, atomic part) is injected as `consume`;
// see lib/server/rate-limit.ts and migration 0012.
//
// Privacy: the raw IP never leaves this module. Only
// HMAC-SHA256(RATE_LIMIT_SECRET, normalized IP) is passed to storage, and
// nothing here logs either value.

import { createHmac } from "node:crypto";
import { isIP } from "node:net";

export type RateLimitAction = "availability" | "hold" | "confirm";

/**
 * Technical abuse limits, not customer-facing business rules. Sized so a
 * household or office sharing one public IP never hits them in normal use:
 *  - availability: a customer checking several dates makes ~5-10 calls;
 *    30 per 5 minutes only stops scraping/hammering.
 *  - hold: one hold per wizard completion; 6 per 30 minutes allows a few
 *    retries and more than one person booking from the same network.
 *  - confirm: one call per booking (the wizard already guards double
 *    clicks); 10 per 30 minutes. Idempotent repeats for an already-
 *    confirmed booking are answered successfully even when limited.
 */
export const RATE_LIMITS: Record<RateLimitAction, { limit: number; windowSeconds: number }> = {
  availability: { limit: 30, windowSeconds: 5 * 60 },
  hold: { limit: 6, windowSeconds: 30 * 60 },
  confirm: { limit: 10, windowSeconds: 30 * 60 },
};

export const RATE_LIMITED_MESSAGE = "Too many booking attempts. Please wait a few minutes and try again.";

export interface HeaderReader {
  get(name: string): string | null;
}

/**
 * Header precedence. On Vercel, the edge network sets
 * `x-vercel-forwarded-for`, `x-real-ip` and `x-forwarded-for` itself and
 * overwrites any client-supplied values, so they can be trusted there.
 * Production runs only on Vercel. Off Vercel (local dev / self-hosting)
 * we fall back to the first `x-forwarded-for` hop, which is only safe
 * behind a reverse proxy that overwrites that header — documented in the
 * README.
 */
const VERCEL_HEADERS = ["x-vercel-forwarded-for", "x-real-ip", "x-forwarded-for"];
const OTHER_HEADERS = ["x-forwarded-for", "x-real-ip"];

export function getClientIp(headers: HeaderReader, options: { onVercel: boolean }): string | null {
  for (const name of options.onVercel ? VERCEL_HEADERS : OTHER_HEADERS) {
    const value = headers.get(name);
    if (!value) continue;
    const firstHop = value.split(",")[0];
    const normalized = normalizeIp(firstHop);
    if (normalized) return normalized;
  }
  return null;
}

/**
 * Canonical form for rate-limit keying, or null if not a valid IP:
 *  - trims, strips brackets/ports and IPv6 zone ids;
 *  - IPv4-mapped IPv6 (::ffff:1.2.3.4) becomes plain IPv4;
 *  - IPv6 is bucketed to its /64, because a single subscriber normally
 *    controls a whole /64 and could otherwise rotate addresses freely.
 */
export function normalizeIp(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let value = raw.trim().replace(/^"|"$/g, "");
  if (!value) return null;

  if (value.startsWith("[")) {
    const end = value.indexOf("]");
    if (end === -1) return null;
    value = value.slice(1, end);
  } else if (/^\d{1,3}(\.\d{1,3}){3}:\d+$/.test(value)) {
    value = value.slice(0, value.lastIndexOf(":"));
  }

  value = value.split("%")[0].toLowerCase();

  const version = isIP(value);
  if (version === 4) return value;
  if (version !== 6) return null;

  const mapped = value.match(/^(?:0{0,4}:){0,5}:?ffff:(\d{1,3}(?:\.\d{1,3}){3})$/);
  if (mapped && isIP(mapped[1]) === 4) return mapped[1];

  const hextets = expandIpv6(value);
  if (!hextets) return null;
  return `${hextets.slice(0, 4).join(":")}::/64`;
}

function expandIpv6(address: string): string[] | null {
  let addr = address;
  // Embedded IPv4 tail (e.g. 64:ff9b::1.2.3.4) -> two hextets.
  const v4 = addr.match(/(\d{1,3}(?:\.\d{1,3}){3})$/);
  if (v4) {
    const [a, b, c, d] = v4[1].split(".").map(Number);
    addr = addr.slice(0, -v4[1].length) + `${((a << 8) | b).toString(16)}:${((c << 8) | d).toString(16)}`;
  }
  const [head, tail] = addr.split("::");
  const headParts = head ? head.split(":") : [];
  const tailParts = tail !== undefined && tail !== "" ? tail.split(":") : [];
  const missing = addr.includes("::") ? 8 - headParts.length - tailParts.length : 0;
  if (missing < 0) return null;
  const parts = [...headParts, ...Array(missing).fill("0"), ...tailParts];
  if (parts.length !== 8) return null;
  return parts.map((part) => part.padStart(4, "0"));
}

/** HMAC-SHA256 hex digest — the only IP-derived value that is ever stored. */
export function hashClientKey(normalizedIp: string, secret: string): string {
  return createHmac("sha256", secret).update(normalizedIp).digest("hex");
}

export interface ConsumeResult {
  allowed: boolean;
  retryAfterSeconds: number;
}

export type ConsumeFn = (keyHash: string, action: RateLimitAction, limit: number, windowSeconds: number) => Promise<ConsumeResult>;

export type RateLimitDecision =
  | { allowed: true; skipped?: "no_secret" | "no_ip" | "store_error" }
  | { allowed: false; retryAfterSeconds: number };

/**
 * Fails OPEN: a missing secret, an unusable IP or a storage error skips
 * the limiter rather than blocking a real customer's booking. The other
 * anti-abuse layers (honeypot, per-email caps, duplicate guard) still apply.
 */
export async function checkRateLimit(input: {
  headers: HeaderReader;
  action: RateLimitAction;
  secret: string | null;
  onVercel: boolean;
  consume: ConsumeFn;
}): Promise<RateLimitDecision> {
  if (!input.secret) return { allowed: true, skipped: "no_secret" };
  const ip = getClientIp(input.headers, { onVercel: input.onVercel });
  if (!ip) return { allowed: true, skipped: "no_ip" };

  const { limit, windowSeconds } = RATE_LIMITS[input.action];
  try {
    const result = await input.consume(hashClientKey(ip, input.secret), input.action, limit, windowSeconds);
    return result.allowed ? { allowed: true } : { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil(result.retryAfterSeconds)) };
  } catch {
    return { allowed: true, skipped: "store_error" };
  }
}
