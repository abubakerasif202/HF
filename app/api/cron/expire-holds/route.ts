import { NextRequest, NextResponse } from "next/server";
import { cronConfig, supabaseConfig } from "../../../../lib/server/config.ts";
import { getSupabaseAdmin } from "../../../../lib/server/supabase.ts";

export const dynamic = "force-dynamic";

/**
 * Scheduled sweep (Vercel Cron) that expires stale `held`/`pending_payment`
 * bookings whose hold has lapsed. `create_booking_hold` already does this
 * inline on every new hold attempt, so this route is a backstop for the
 * case where nobody tries to book that vehicle/slot again for a while —
 * without it, an abandoned checkout could squat on a slot indefinitely.
 *
 * Configure in vercel.json with a "crons" entry pointing at
 * /api/cron/expire-holds on an every-5-minutes schedule, and set
 * CRON_SECRET; Vercel Cron sends it as a Bearer token automatically.
 */
export async function GET(request: NextRequest) {
  if (!cronConfig.isConfigured()) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 503 });
  }
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${cronConfig.secret()}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!supabaseConfig.isConfigured()) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  const { data, error } = await getSupabaseAdmin().rpc("expire_stale_holds");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ expired: data });
}
