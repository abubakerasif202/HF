import "server-only";
import { getSupabaseAdmin } from "./supabase.ts";
import { adelaideDay } from "../admin/dates.ts";
import { summariseQuotes, type LostReason, type QuoteStatusValue, type QuoteSummary } from "../admin/quote-crm.ts";

/** Columns the CRM list and detail views read. `booking` is the linked booking (migration 0021). */
export const QUOTE_SELECT =
  "id, payload, quote_status, delivery_status, created_at, notes, follow_up_at, status_changed_at, first_response_at, quoted_amount_cents, lost_reason, booking_id, booking:bookings(id, booking_number)";

/** Status totals plus follow-ups due/overdue, from one lightweight query. Null when it fails. */
export async function loadQuoteSummary(now: Date = new Date()): Promise<QuoteSummary | null> {
  try {
    const { data, error } = await getSupabaseAdmin().from("quote_requests").select("quote_status, follow_up_at").limit(20000);
    if (error) return null;
    return summariseQuotes(data ?? [], now);
  } catch {
    return null;
  }
}

/** Sidebar badge: untouched enquiries plus open (not new) enquiries whose follow-up date has passed. Null on failure. */
export async function countQuotesNeedingAttention(now: Date = new Date()): Promise<number | null> {
  try {
    const supabase = getSupabaseAdmin();
    const startOfToday = adelaideDay(0, now).start;
    const [fresh, overdue] = await Promise.all([
      supabase.from("quote_requests").select("id", { count: "exact", head: true }).eq("quote_status", "new"),
      supabase
        .from("quote_requests")
        .select("id", { count: "exact", head: true })
        .in("quote_status", ["quote_sent", "follow_up"])
        .lt("follow_up_at", startOfToday),
    ]);
    // Migration 0021 may not be applied yet: still show the untouched count.
    if (fresh.error) return null;
    return (fresh.count ?? 0) + (overdue.error ? 0 : (overdue.count ?? 0));
  } catch {
    return null;
  }
}

/**
 * Moves many enquiries to one status. first_response_at is stamped only for rows leaving "new"
 * for the first time; the stamp is written after the status change so a failed change never
 * records a response that did not happen.
 */
export async function bulkSetQuoteStatus(ids: string[], next: QuoteStatusValue, lostReason: LostReason | null, now: Date = new Date()): Promise<{ updated: number } | { error: string }> {
  const supabase = getSupabaseAdmin();
  const nowIso = now.toISOString();
  const stamp = next === "new"
    ? { data: [] as { id: string }[], error: null }
    : await supabase.from("quote_requests").select("id").in("id", ids).eq("quote_status", "new").is("first_response_at", null);
  if (stamp.error) return { error: "Unable to read enquiries" };
  const firstResponseIds = (stamp.data ?? []).map((row) => row.id as string);

  const { data, error } = await supabase
    .from("quote_requests")
    .update({ quote_status: next, status_changed_at: nowIso, lost_reason: next === "lost" ? lostReason : null })
    .in("id", ids)
    .neq("quote_status", next)
    .select("id");
  if (error) return { error: "Unable to update enquiries" };
  const updatedIds = new Set((data ?? []).map((row) => row.id as string));

  const toStamp = firstResponseIds.filter((id) => updatedIds.has(id));
  if (toStamp.length > 0) {
    const stampResult = await supabase.from("quote_requests").update({ first_response_at: nowIso }).in("id", toStamp).is("first_response_at", null);
    if (stampResult.error) console.error("HF quote first_response_at stamp failed:", stampResult.error.code);
  }
  return { updated: updatedIds.size };
}
