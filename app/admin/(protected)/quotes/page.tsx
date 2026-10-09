import { requireAdmin } from "../../../../lib/server/admin-dal.ts";
import { getSupabaseAdmin } from "../../../../lib/server/supabase.ts";
import QuotesClient from "./QuotesClient";
import { QUOTE_STATUS_ORDER, type StatusCounts } from "./quoteStatus";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };

/** Real per-status totals for the CRM summary. Falls back to null (hidden) if the query fails. */
async function loadCounts(): Promise<StatusCounts | null> {
  try {
    const supabase = getSupabaseAdmin();
    const results = await Promise.all(
      QUOTE_STATUS_ORDER.map((status) => supabase.from("quote_requests").select("id", { count: "exact", head: true }).eq("quote_status", status)),
    );
    if (results.some((result) => result.error)) return null;
    const counts = {} as StatusCounts;
    QUOTE_STATUS_ORDER.forEach((status, index) => {
      counts[status] = results[index].count ?? 0;
    });
    return counts;
  } catch {
    return null;
  }
}

export default async function QuotesPage() {
  await requireAdmin();
  const initialCounts = await loadCounts();
  return <QuotesClient initialCounts={initialCounts} />;
}
