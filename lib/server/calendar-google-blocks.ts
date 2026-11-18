import "server-only";
import { getSupabaseAdmin } from "./supabase.ts";
import { googleEventToBlock, type GoogleBlock, type GoogleImportRow } from "../calendar-google-blocks.ts";

const COLUMNS = "id, summary, starts_at, ends_at, all_day_start, all_day_end, event_status";

/** Imported Google events overlapping [start, end). Never throws: a failure just means no Google events are shown. */
export async function loadGoogleBlocks(start: Date, end: Date, timeZone: string): Promise<GoogleBlock[]> {
  try {
    const admin = getSupabaseAdmin();
    const startDate = start.toISOString().slice(0, 10);
    const endDate = new Date(end.getTime() + 86_400_000).toISOString().slice(0, 10);
    const live = ["confirmed", "tentative"];
    const [timed, openEnded, allDay] = await Promise.all([
      admin.from("google_calendar_imports").select(COLUMNS).in("event_status", live).lt("starts_at", end.toISOString()).gt("ends_at", start.toISOString()),
      admin.from("google_calendar_imports").select(COLUMNS).in("event_status", live).is("ends_at", null).gte("starts_at", start.toISOString()).lt("starts_at", end.toISOString()),
      admin.from("google_calendar_imports").select(COLUMNS).in("event_status", live).lt("all_day_start", endDate).gt("all_day_end", startDate),
    ]);
    const rows = [...(timed.data ?? []), ...(openEnded.data ?? []), ...(allDay.data ?? [])] as GoogleImportRow[];
    const seen = new Set<string>();
    return rows.filter((row) => !seen.has(row.id) && seen.add(row.id)).flatMap((row) => googleEventToBlock(row, timeZone) ?? []);
  } catch {
    return [];
  }
}
