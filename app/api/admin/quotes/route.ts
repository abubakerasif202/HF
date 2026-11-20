import "server-only";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminAuthState } from "../../../../lib/server/supabase-ssr.ts";
import { getSupabaseAdmin } from "../../../../lib/server/supabase.ts";
import { supabaseConfig } from "../../../../lib/server/config.ts";
import { loadQuoteSummary, QUOTE_SELECT } from "../../../../lib/server/quote-crm-repo.ts";
import { adelaideDay } from "../../../../lib/admin/dates.ts";
import {
  LOST_REASON_VALUES,
  OPEN_QUOTE_STATUSES,
  QUOTED_AMOUNT_MAX_CENTS,
  QUOTE_NOTES_MAX,
  QUOTE_STATUS_VALUES,
  followUpInstant,
  isQuoteStatus,
  isValidYmd,
  statusChangeFields,
} from "../../../../lib/admin/quote-crm.ts";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const TABS = ["all", "needs_reply", "due", "overdue"] as const;
const MAX_BODY_BYTES = 16_384;

const privateHeaders = { "Cache-Control": "private, no-store, max-age=0" };

/** Returns a 401/403 response when the caller is not the authorized owner, else null. */
async function denyUnlessAdmin(): Promise<NextResponse | null> {
  if (!supabaseConfig.isConfigured()) {
    return NextResponse.json({ error: "Not authorized" }, { status: 401, headers: privateHeaders });
  }
  const state = await getAdminAuthState();
  if (state.status === "authorized") return null;
  const status = state.status === "forbidden" ? 403 : 401;
  return NextResponse.json({ error: status === 403 ? "Forbidden" : "Not authorized" }, { status, headers: privateHeaders });
}

export async function GET(request: Request) {
  try {
    const denied = await denyUnlessAdmin();
    if (denied) return denied;
    const url = new URL(request.url);
    const rawPage = Number(url.searchParams.get("page") ?? "1");
    const rawSize = Number(url.searchParams.get("pageSize") ?? "20");
    const page = Number.isSafeInteger(rawPage) ? Math.max(1, Math.min(rawPage, 100000)) : 1;
    const size = Number.isSafeInteger(rawSize) ? Math.max(1, Math.min(rawSize, 50)) : 20;
    const filter = url.searchParams.get("status");
    if (filter && !isQuoteStatus(filter)) {
      return NextResponse.json({ error: "Invalid quote status" }, { status: 400, headers: privateHeaders });
    }
    const tab = url.searchParams.get("tab") ?? "all";
    if (!(TABS as readonly string[]).includes(tab)) {
      return NextResponse.json({ error: "Invalid quote tab" }, { status: 400, headers: privateHeaders });
    }
    const sort = url.searchParams.get("sort") ?? "newest";
    if (sort !== "newest" && sort !== "oldest") {
      return NextResponse.json({ error: "Invalid sort order" }, { status: 400, headers: privateHeaders });
    }

    let query = getSupabaseAdmin()
      .from("quote_requests")
      .select(QUOTE_SELECT, { count: "exact" })
      .order("created_at", { ascending: sort === "oldest" })
      .range((page - 1) * size, page * size - 1);
    if (filter) query = query.eq("quote_status", filter);
    if (tab === "needs_reply") query = query.eq("quote_status", "new");
    if (tab === "due" || tab === "overdue") {
      const today = adelaideDay(0);
      query = query
        .in("quote_status", [...OPEN_QUOTE_STATUSES])
        .not("follow_up_at", "is", null)
        .lt("follow_up_at", tab === "due" ? today.end : today.start);
    }
    const [{ data, count, error }, summary] = await Promise.all([query, loadQuoteSummary()]);
    if (error) {
      console.error("HF quote dashboard query failed:", error.code);
      return NextResponse.json({ error: "Quote records unavailable. Check migrations 0014 and 0021 and staff configuration." }, { status: 503, headers: privateHeaders });
    }
    return NextResponse.json({ data: data ?? [], total: count ?? 0, summary }, { headers: privateHeaders });
  } catch {
    return NextResponse.json({ error: "Unable to load quotes" }, { status: 503, headers: privateHeaders });
  }
}

const patchSchema = z
  .strictObject({
    id: z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i),
    quote_status: z.enum(QUOTE_STATUS_VALUES).optional(),
    notes: z.string().max(QUOTE_NOTES_MAX).nullable().optional(),
    // Date picker value (YYYY-MM-DD); stored as 9am Adelaide on that date.
    follow_up_at: z.string().refine(isValidYmd, "Invalid follow-up date").nullable().optional(),
    quoted_amount_cents: z.number().int().min(0).max(QUOTED_AMOUNT_MAX_CENTS).nullable().optional(),
    lost_reason: z.enum(LOST_REASON_VALUES).nullable().optional(),
  })
  .refine((value) => Object.keys(value).some((key) => key !== "id"), "Nothing to update");

export async function PATCH(request: Request) {
  try {
    const denied = await denyUnlessAdmin();
    if (denied) return denied;
    // Authenticated mutation: prevent cross-site requests even if browser cookie policy changes.
    const origin = request.headers.get("origin");
    if (!origin || origin !== new URL(request.url).origin) {
      return NextResponse.json({ error: "Invalid origin" }, { status: 403, headers: privateHeaders });
    }
    if (Number(request.headers.get("content-length") ?? 0) > MAX_BODY_BYTES) {
      return NextResponse.json({ error: "Request too large" }, { status: 413, headers: privateHeaders });
    }
    const body: unknown = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400, headers: privateHeaders });
    }
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid quote update", issues: parsed.error.issues.map((issue) => ({ path: issue.path, message: issue.message })) }, { status: 400, headers: privateHeaders });
    }
    const input = parsed.data;

    const supabase = getSupabaseAdmin();
    const { data: current, error: readError } = await supabase
      .from("quote_requests")
      .select("quote_status, first_response_at")
      .eq("id", input.id)
      .maybeSingle();
    if (readError) {
      console.error("HF quote read failed:", readError.code);
      return NextResponse.json({ error: "Unable to update quote" }, { status: 503, headers: privateHeaders });
    }
    if (!current) return NextResponse.json({ error: "Quote not found" }, { status: 404, headers: privateHeaders });

    const effectiveStatus = input.quote_status ?? current.quote_status;
    if (input.lost_reason && effectiveStatus !== "lost") {
      return NextResponse.json({ error: "A lost reason only applies to lost enquiries" }, { status: 400, headers: privateHeaders });
    }

    const update: Record<string, unknown> = {};
    if (input.quote_status !== undefined && input.quote_status !== current.quote_status) {
      Object.assign(update, statusChangeFields(current, input.quote_status, new Date().toISOString(), input.lost_reason ?? null));
    } else if (input.lost_reason !== undefined) {
      update.lost_reason = input.lost_reason;
    }
    if (input.notes !== undefined) update.notes = input.notes?.trim() ? input.notes.trim() : null;
    if (input.follow_up_at !== undefined) update.follow_up_at = input.follow_up_at ? followUpInstant(input.follow_up_at) : null;
    if (input.quoted_amount_cents !== undefined) update.quoted_amount_cents = input.quoted_amount_cents;

    const result = Object.keys(update).length > 0
      ? await supabase.from("quote_requests").update(update).eq("id", input.id).select(QUOTE_SELECT).maybeSingle()
      : await supabase.from("quote_requests").select(QUOTE_SELECT).eq("id", input.id).maybeSingle();
    if (result.error) {
      console.error("HF quote update failed:", result.error.code);
      return NextResponse.json({ error: "Unable to update quote" }, { status: 503, headers: privateHeaders });
    }
    if (!result.data) return NextResponse.json({ error: "Quote not found" }, { status: 404, headers: privateHeaders });
    return NextResponse.json({ data: result.data }, { headers: privateHeaders });
  } catch {
    return NextResponse.json({ error: "Unable to update quote" }, { status: 400, headers: privateHeaders });
  }
}
