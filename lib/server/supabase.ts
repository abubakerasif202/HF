import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { supabaseConfig } from "./config.ts";

let cached: SupabaseClient | null = null;

/**
 * Server-only Supabase client using the SERVICE ROLE key. This bypasses
 * RLS by design — the public booking flow is authorized entirely by this
 * server code's own validation (availability/hold/payment checks), not by
 * client-supplied credentials. Never import this from a Client Component
 * or expose the service role key to the browser.
 *
 * Constructed lazily (not at module scope) so the app still builds and
 * boots with no Supabase env vars configured; callers must check
 * `supabaseConfig.isConfigured()` first and handle the 503 case.
 */
export function getSupabaseAdmin(): SupabaseClient {
  if (cached) return cached;
  cached = createClient(supabaseConfig.url(), supabaseConfig.serviceRoleKey(), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return cached;
}
