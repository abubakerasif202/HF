import "server-only";
import { NextResponse } from "next/server";
import { denyUnlessAdmin, exportHeaders } from "../../../../lib/server/export-data.ts";
import { searchAdmin } from "../../../../lib/server/admin-search.ts";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Owner-only global search (Ctrl/Cmd+K) across bookings, quote enquiries and customers. */
export async function GET(request: Request) {
  const denied = await denyUnlessAdmin();
  if (denied) return denied;
  const q = new URL(request.url).searchParams.get("q") ?? "";
  try {
    return NextResponse.json(await searchAdmin(q.slice(0, 200)), { headers: exportHeaders });
  } catch (error) {
    console.error("HF admin search failed:", (error as { code?: unknown })?.code ?? "unknown");
    return NextResponse.json({ error: "Search is unavailable. Try again shortly." }, { status: 503, headers: exportHeaders });
  }
}
