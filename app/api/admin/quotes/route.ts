import "server-only";
import { NextResponse } from "next/server";
import { getAdminAuthState } from "../../../../lib/server/supabase-ssr.ts";
import { getSupabaseAdmin } from "../../../../lib/server/supabase.ts";
import { supabaseConfig } from "../../../../lib/server/config.ts";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const STATUSES = ["new", "quote_sent", "follow_up", "booked", "completed", "lost"] as const;
type QuoteStatus = (typeof STATUSES)[number];
function isStatus(value: unknown): value is QuoteStatus {
  return typeof value === "string" && STATUSES.some((status) => status === value);
}

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
    if (filter && !isStatus(filter)) {
      return NextResponse.json({ error: "Invalid quote status" }, { status: 400, headers: privateHeaders });
    }
    let query = getSupabaseAdmin()
      .from("quote_requests")
      .select("id, payload, quote_status, delivery_status, created_at", { count: "exact" })
      .order("created_at", { ascending: false })
      .range((page - 1) * size, page * size - 1);
    if (filter) query = query.eq("quote_status", filter);
    const { data, count, error } = await query;
    if (error) {
      console.error("HF quote dashboard query failed:", error.code);
      return NextResponse.json({ error: "Quote records unavailable. Check migration 0014 and staff configuration." }, { status: 503, headers: privateHeaders });
    }
    return NextResponse.json({ data: data ?? [], total: count ?? 0 }, { headers: privateHeaders });
  } catch {
    return NextResponse.json({ error: "Unable to load quotes" }, { status: 503, headers: privateHeaders });
  }
}

export async function PATCH(request: Request) {
  try {
    const denied = await denyUnlessAdmin();
    if (denied) return denied;
    // Authenticated mutation: prevent cross-site requests even if browser cookie policy changes.
    const origin = request.headers.get("origin");
    if (!origin || origin !== new URL(request.url).origin) {
      return NextResponse.json({ error: "Invalid origin" }, { status: 403, headers: privateHeaders });
    }
    if (Number(request.headers.get("content-length") ?? 0) > 2048) {
      return NextResponse.json({ error: "Request too large" }, { status: 413, headers: privateHeaders });
    }
    const body: unknown = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400, headers: privateHeaders });
    }
    const input = body as Record<string, unknown>;
    if (typeof input.id !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(input.id) || !isStatus(input.quote_status)) {
      return NextResponse.json({ error: "Invalid quote ID or status" }, { status: 400, headers: privateHeaders });
    }
    const { data, error } = await getSupabaseAdmin()
      .from("quote_requests")
      .update({ quote_status: input.quote_status })
      .eq("id", input.id)
      .select("id, payload, quote_status, delivery_status, created_at")
      .maybeSingle();
    if (error) {
      console.error("HF quote status update failed:", error.code);
      return NextResponse.json({ error: "Unable to update quote" }, { status: 503, headers: privateHeaders });
    }
    if (!data) return NextResponse.json({ error: "Quote not found" }, { status: 404, headers: privateHeaders });
    return NextResponse.json({ data }, { headers: privateHeaders });
  } catch {
    return NextResponse.json({ error: "Unable to update quote" }, { status: 400, headers: privateHeaders });
  }
}
