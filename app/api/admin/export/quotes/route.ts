import "server-only";
import { badRequest, csvResponse, denyUnlessAdmin, exportUnavailable, exportQuotes, parseQuoteStatus } from "../../../../../lib/server/export-data.ts";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Owner-only CSV export of quote enquiries for the selected status and search. Authorization runs on the server before any data is read. */
export async function GET(request: Request) {
  const denied = await denyUnlessAdmin();
  if (denied) return denied;
  const params = new URL(request.url).searchParams;
  const status = parseQuoteStatus(params.get("status"));
  if (!status.ok) return badRequest(status.error);
  try {
    const file = await exportQuotes(status.value, params.get("q"));
    return csvResponse("quotes", file.csv, file.truncated);
  } catch (error) {
    console.error("HF quotes export failed:", (error as { code?: unknown })?.code ?? "unknown");
    return exportUnavailable();
  }
}