import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { getAdminAuthState } from "../../../../../../lib/server/supabase-ssr.ts";
import { buildInvoiceDocument, getInvoice, getInvoiceSettings } from "../../../../../../lib/server/invoice-repo.ts";
import { renderInvoicePdf } from "../../../../../../lib/invoice-pdf.ts";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const privateHeaders = { "Cache-Control": "private, no-store, max-age=0" };

/**
 * Owner-only invoice PDF. Same authorization as the invoice pages: no session
 * is 401, a signed-in non-owner is 403, and neither learns whether the invoice
 * exists. Issued and voided invoices render from their frozen snapshot; drafts
 * render the current editor state stamped DRAFT.
 */
export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await getAdminAuthState();
  if (auth.status !== "authorized") {
    const status = auth.status === "forbidden" ? 403 : 401;
    return NextResponse.json({ error: status === 403 ? "Forbidden" : "Not authorized" }, { status, headers: privateHeaders });
  }
  const { id } = await context.params;
  if (!UUID.test(id)) return NextResponse.json({ error: "Not found" }, { status: 404, headers: privateHeaders });

  try {
    const invoice = await getInvoice(id);
    if (!invoice) return NextResponse.json({ error: "Not found" }, { status: 404, headers: privateHeaders });
    const document = await buildInvoiceDocument(invoice, invoice.status === "draft" ? await getInvoiceSettings() : null);
    const bytes = renderInvoicePdf(document);
    const stem = invoice.invoiceNumber ? invoice.invoiceNumber : `draft-${invoice.bookingReference}`;
    const filename = `HF-${invoice.status === "void" ? "VOID-" : ""}${stem}`.replace(/[^A-Za-z0-9._-]/g, "_");
    return new NextResponse(bytes as unknown as BodyInit, {
      headers: {
        ...privateHeaders,
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}.pdf"`,
        "Content-Length": String(bytes.byteLength),
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("HF invoice PDF failed:", (error as { code?: unknown })?.code ?? "unknown");
    return NextResponse.json({ error: "The PDF is unavailable. Try again shortly." }, { status: 503, headers: privateHeaders });
  }
}
