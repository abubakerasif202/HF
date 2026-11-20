import "server-only";
import { badRequest, csvResponse, denyUnlessAdmin, exportUnavailable, exportBookings, parseBookingStatus } from "../../../../../lib/server/export-data.ts";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Owner-only CSV export of bookings for the selected status. Authorization runs on the server before any data is read. */
export async function GET(request: Request) {
  const denied = await denyUnlessAdmin();
  if (denied) return denied;
  const params = new URL(request.url).searchParams;
  const status = parseBookingStatus(params.get("status"));
  if (!status.ok) return badRequest(status.error);
  try {
    const file = await exportBookings(status.value);
    return csvResponse("bookings", file.csv, file.truncated);
  } catch (error) {
    console.error("HF bookings export failed:", (error as { code?: unknown })?.code ?? "unknown");
    return exportUnavailable();
  }
}