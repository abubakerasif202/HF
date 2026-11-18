import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { getAdminAuthState } from "../../../../../lib/server/supabase-ssr.ts";
import { getSupabaseAdmin } from "../../../../../lib/server/supabase.ts";
import { ADMIN_TIME_ZONE } from "../../../../../lib/admin/dates.ts";
import { buildFinderArgs, toFinderResult, type FinderRow } from "../../../../../lib/booking-finder.ts";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const privateHeaders = { "Cache-Control": "private, no-store, max-age=0" };

/** Owner-only Booking Finder. Authorization is enforced here, on the server, for every request. */
export async function GET(request: NextRequest) {
  const auth = await getAdminAuthState();
  if (auth.status !== "authorized") {
    const status = auth.status === "forbidden" ? 403 : 401;
    return NextResponse.json({ error: status === 403 ? "Forbidden" : "Not authorized" }, { status, headers: privateHeaders });
  }

  const params = request.nextUrl.searchParams;
  const number = (name: string) => (params.has(name) ? Number(params.get(name)) : undefined);
  const built = buildFinderArgs({
    q: params.get("q") ?? undefined,
    from: params.get("from") || undefined,
    to: params.get("to") || undefined,
    status: params.get("status") || undefined,
    crewId: params.get("crewId") || undefined,
    vehicleId: params.get("vehicleId") || undefined,
    page: number("page"),
    pageSize: number("pageSize"),
  }, ADMIN_TIME_ZONE);
  if (!built.ok) return NextResponse.json({ error: built.error }, { status: 400, headers: privateHeaders });

  try {
    const admin = getSupabaseAdmin();
    const [search, vehicles, crews] = await Promise.all([
      admin.rpc("admin_search_bookings", built.args),
      admin.from("vehicles").select("id, name").order("name"),
      admin.from("crews").select("id, name").eq("active", true).order("name"),
    ]);
    if (search.error) throw search.error;
    if (vehicles.error) throw vehicles.error;
    if (crews.error) throw crews.error;
    const rows = (search.data ?? []) as FinderRow[];
    const names = new Map(((vehicles.data ?? []) as Array<{ id: string; name: string }>).map((v) => [v.id, v.name]));
    const total = rows.length ? Number(rows[0]?.total_count ?? rows.length) : 0;
    return NextResponse.json({
      results: rows.map((row) => toFinderResult(row, names)),
      total,
      page: built.page,
      pageSize: built.pageSize,
      hasMore: built.page * built.pageSize < total,
      crews: crews.data ?? [],
      vehicles: vehicles.data ?? [],
    }, { headers: privateHeaders });
  } catch (error) {
    console.error("HF booking finder failed:", (error as { code?: unknown })?.code ?? "unknown");
    return NextResponse.json({ error: "Booking search is unavailable. Try again shortly." }, { status: 503, headers: privateHeaders });
  }
}
