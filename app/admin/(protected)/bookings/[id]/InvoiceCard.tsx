"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { AdminAlert, AdminCard } from "../../../_components/ui";
import { AdminStatusBadge } from "../../../_components/AdminStatusBadge";
import { Icon } from "../../../_components/Icon";
import { createInvoiceDraftAction } from "../../invoices/actions";

interface Props {
  bookingId: string;
  invoice: { id: string; status: string; invoiceNumber: string | null } | null;
}

/** "Create invoice" on the booking detail screen. Creating twice opens the same draft (one live invoice per booking). */
export function InvoiceCard({ bookingId, invoice }: Props) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  return (
    <AdminCard icon="dollar" title="Invoice" description="Billing document for this booking. The booking's price and payment record are not changed.">
      {error && <AdminAlert tone="error">{error}</AdminAlert>}
      {invoice ? (
        <div className="a-bk-invoice">
          <p><AdminStatusBadge kind="invoice" status={invoice.status} />{" "}<strong>{invoice.invoiceNumber ?? "Draft invoice"}</strong></p>
          <Link href={`/admin/invoices/${invoice.id}`} className="admin-btn admin-btn--secondary">{invoice.status === "draft" ? "Continue draft" : "View invoice"}</Link>
        </div>
      ) : (
        <button
          type="button"
          className="admin-btn admin-btn--primary"
          disabled={pending}
          onClick={() => {
            setError("");
            startTransition(async () => {
              const result = await createInvoiceDraftAction(bookingId);
              if (result?.error) setError(result.error);
            });
          }}
        >
          <Icon name="plus" size={16} />{pending ? "Creating draft…" : "Create invoice"}
        </button>
      )}
    </AdminCard>
  );
}
