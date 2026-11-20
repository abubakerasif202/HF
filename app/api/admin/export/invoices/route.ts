import "server-only";
import { badRequest, csvResponse, denyUnlessAdmin, exportUnavailable, exportInvoices, parseInvoiceStatus } from "../../../../../lib/server/export-data.ts";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Owner-only CSV export of invoices for the selected status. Authorization runs on the server before any data is read. */
export async function GET(request: Request) {
  const denied = await denyUnlessAdmin();
  if (denied) return denied;
  const params = new URL(request.url).searchParams;
  const status = parseInvoiceStatus(params.get("status"));
  if (!status.ok) return badRequest(status.error);
  try {
    const file = await exportInvoices(status.value);
    return csvResponse("invoices", file.csv, file.truncated);
  } catch (error) {
    console.error("HF invoices export failed:", (error as { code?: unknown })?.code ?? "unknown");
    return exportUnavailable();
  }
}