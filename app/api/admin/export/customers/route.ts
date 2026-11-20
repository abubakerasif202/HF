import "server-only";
import { csvResponse, denyUnlessAdmin, exportUnavailable, exportCustomers } from "../../../../../lib/server/export-data.ts";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Owner-only CSV export of customers matching an optional name, email or phone search. Authorization runs on the server before any data is read. */
export async function GET(request: Request) {
  const denied = await denyUnlessAdmin();
  if (denied) return denied;
  const params = new URL(request.url).searchParams;
  try {
    const file = await exportCustomers(params.get("q"));
    return csvResponse("customers", file.csv, file.truncated);
  } catch (error) {
    console.error("HF customers export failed:", (error as { code?: unknown })?.code ?? "unknown");
    return exportUnavailable();
  }
}