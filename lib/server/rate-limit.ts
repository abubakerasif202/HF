import "server-only";
import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "./supabase.ts";
import { rateLimitConfig } from "./config.ts";
import { checkRateLimit, RATE_LIMITED_MESSAGE, type ConsumeFn, type RateLimitAction } from "../rate-limit.ts";

/** Atomic Postgres counter (migration 0012), service-role only. */
const consumeViaSupabase: ConsumeFn = async (keyHash, action, limit, windowSeconds) => {
  const { data, error } = await getSupabaseAdmin().rpc("consume_booking_rate_limit", {
    p_key_hash: keyHash,
    p_action: action,
    p_limit: limit,
    p_window_seconds: windowSeconds,
  });
  if (error) throw error;
  const result = data as { allowed: boolean; retry_after_seconds: number };
  return { allowed: Boolean(result.allowed), retryAfterSeconds: Number(result.retry_after_seconds) };
};

let warnedNoSecret = false;

/**
 * Per-IP limiter for a public booking endpoint. Returns a 429 response
 * when the caller is over the limit, otherwise null (continue). Never
 * logs the IP or its hash, and never reveals counters in the response.
 */
export async function enforceRateLimit(request: Request, action: RateLimitAction): Promise<NextResponse | null> {
  const decision = await checkRateLimit({
    headers: request.headers,
    action,
    secret: rateLimitConfig.secret(),
    onVercel: Boolean(process.env.VERCEL),
    consume: consumeViaSupabase,
  });

  if (decision.allowed) {
    if (decision.skipped === "no_secret" && !warnedNoSecret) {
      warnedNoSecret = true;
      console.warn("booking rate limiting disabled: RATE_LIMIT_SECRET is not set");
    } else if (decision.skipped === "store_error") {
      console.warn(`booking rate limit check failed open (action=${action})`);
    }
    return null;
  }

  return rateLimitedResponse(decision.retryAfterSeconds);
}

export function rateLimitedResponse(retryAfterSeconds: number): NextResponse {
  return NextResponse.json(
    { error: RATE_LIMITED_MESSAGE, code: "rate_limited" },
    { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } },
  );
}
