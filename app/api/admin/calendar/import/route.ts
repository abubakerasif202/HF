import "server-only";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminAuthState } from "../../../../../lib/server/supabase-ssr.ts";
import { supabaseConfig } from "../../../../../lib/server/config.ts";
import { friendlyCalendarError } from "../../../../../lib/calendar-sync.ts";
import { importGoogleCalendarRange } from "../../../../../lib/server/google-calendar-import.ts";
import { getBusinessSettings } from "../../../../../lib/server/booking-repo.ts";
import { zonedWallTimeToInstant } from "../../../../../lib/booking/timezone.ts";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const privateHeaders = { "Cache-Control": "private, no-store, max-age=0" };
const inputSchema = z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }).strict();

/** Owner-only pull from the already configured calendar; never writes to Google. */
export async function POST(request: Request) {
  if (!supabaseConfig.isConfigured()) {
    return NextResponse.json({ error: "Not authorized" }, { status: 401, headers: privateHeaders });
  }
  const auth = await getAdminAuthState();
  if (auth.status !== "authorized") {
    const status = auth.status === "forbidden" ? 403 : 401;
    return NextResponse.json({ error: status === 403 ? "Forbidden" : "Not authorized" }, { status, headers: privateHeaders });
  }

  const origin = request.headers.get("origin");
  if (!origin || origin !== new URL(request.url).origin) {
    return NextResponse.json({ error: "Invalid origin" }, { status: 403, headers: privateHeaders });
  }
  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > 2048) return NextResponse.json({ error: "Request too large" }, { status: 413, headers: privateHeaders });

  try {
    const text = await request.text();
    if (text.length > 2048) return NextResponse.json({ error: "Request too large" }, { status: 413, headers: privateHeaders });
    const parsed = inputSchema.safeParse(JSON.parse(text));
    if (!parsed.success) return NextResponse.json({ error: "Provide a valid date in YYYY-MM-DD format." }, { status: 400, headers: privateHeaders });
    const [year, month, day] = parsed.data.date.split("-").map(Number);
    if (!year || !month || !day || new Date(Date.UTC(year, month - 1, day)).toISOString().slice(0, 10) !== parsed.data.date) {
      return NextResponse.json({ error: "Invalid import date." }, { status: 400, headers: privateHeaders });
    }
    const settings = await getBusinessSettings();
    const start = zonedWallTimeToInstant(year, month, day, 0, 0, settings.timezone);
    const end = zonedWallTimeToInstant(year, month, day + 1, 0, 0, settings.timezone);
    const imported = await importGoogleCalendarRange(start.toISOString(), end.toISOString());
    return NextResponse.json({ imported }, { headers: privateHeaders });
  } catch (error) {
    if ((error as Error)?.message === "Google Calendar is not configured.") {
      return NextResponse.json({ error: "Google Calendar is not connected." }, { status: 503, headers: privateHeaders });
    }
    console.error("HF Google Calendar import failed:", (error as { code?: unknown })?.code ?? "unknown");
    return NextResponse.json({ error: friendlyCalendarError(error) }, { status: 503, headers: privateHeaders });
  }
}
