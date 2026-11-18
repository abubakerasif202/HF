import { NextRequest, NextResponse } from "next/server";
import { cronConfig, googleCalendarConfig, supabaseConfig } from "../../../../lib/server/config.ts";
import { getSupabaseAdmin } from "../../../../lib/server/supabase.ts";
import { SYNCABLE_STATUSES } from "../../../../lib/calendar-sync.ts";
import { reconcileBookingCalendar } from "../../../../lib/server/google-calendar.ts";
import { importGoogleCalendarRange } from "../../../../lib/server/google-calendar-import.ts";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const DAY_MS = 86_400_000;
const PAST_DAYS = 1;
const FUTURE_DAYS = 120;
const RETRY_BATCH = 25;
const SYNCABLE = [...SYNCABLE_STATUSES];

/**
 * Scheduled two-way Google Calendar sync (Vercel Cron, every 15 minutes):
 *  1. pull events from the HF Google calendar into the database (shown on Calendar and Dispatch);
 *  2. push any booking whose own mirror is still pending or failed.
 * Each half is independent, so a Google outage in one never blocks the other.
 */
export async function GET(request: NextRequest) {
  if (!cronConfig.isConfigured()) return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 503 });
  if (request.headers.get("authorization") !== `Bearer ${cronConfig.secret()}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!supabaseConfig.isConfigured()) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  if (!googleCalendarConfig.isConfigured()) return NextResponse.json({ error: "Google Calendar is not configured" }, { status: 503 });

  const now = Date.now();
  const result: { imported: number | null; importError: string | null; pushed: number; pushFailed: number; tidied: number } = { imported: null, importError: null, pushed: 0, pushFailed: 0, tidied: 0 };

  try {
    result.imported = await importGoogleCalendarRange(new Date(now - PAST_DAYS * DAY_MS).toISOString(), new Date(now + FUTURE_DAYS * DAY_MS).toISOString());
  } catch (error) {
    result.importError = (error as { code?: unknown })?.code ? String((error as { code?: unknown }).code) : "import_failed";
    console.error("HF Google import (cron) failed:", result.importError);
  }

  try {
    const { data, error } = await getSupabaseAdmin().from("bookings")
      .select("id").in("calendar_sync_status", ["pending", "failed"]).in("booking_status", SYNCABLE)
      .order("created_at", { ascending: true }).limit(RETRY_BATCH);
    if (error) throw error;
    for (const row of (data ?? []) as Array<{ id: string }>) {
      try {
        await reconcileBookingCalendar(row.id);
        result.pushed += 1;
      } catch {
        result.pushFailed += 1;
      }
    }
  } catch (error) {
    console.error("HF Google push (cron) failed:", (error as { code?: unknown })?.code ?? "unknown");
    result.pushFailed = -1;
  }

  // Housekeeping (database only, no Google call): an expired hold never had a Google event, so it must not sit as "pending".
  try {
    const { data } = await getSupabaseAdmin().from("bookings")
      .update({ calendar_sync_status: "not_applicable", calendar_sync_error: null })
      .eq("booking_status", "expired").eq("calendar_sync_status", "pending").is("google_calendar_event_id", null).select("id");
    result.tidied = (data ?? []).length;
  } catch {
    result.tidied = -1;
  }

  const ok = result.importError === null && result.pushFailed <= 0;
  return NextResponse.json(result, { status: ok ? 200 : 207 });
}
