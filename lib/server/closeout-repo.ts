import "server-only";
import { resolveBookingContact } from "../booking/contact.ts";
import { getSupabaseAdmin } from "./supabase.ts";
import { CLOSEOUT_STATUSES } from "../admin/closeout.ts";

type AddressJson = { suburb?: string; addressLine?: string; formattedAddress?: string } | string | null;

export interface CloseoutJob {
  id: string;
  bookingNumber: string;
  startsAt: string;
  endsAt: string;
  status: string;
  paymentStatus: string;
  estimatedDurationMinutes: number | null;
  pickup: AddressJson;
  destination: AddressJson;
  customerName: string | null;
  customerPhone: string | null;
  crewAssigned: boolean;
  invoice: { id: string; status: string; invoiceNumber: string | null } | null;
}

interface Row {
  id: string;
  booking_number: string;
  starts_at: string;
  ends_at: string;
  booking_status: string;
  payment_status: string;
  estimated_duration_minutes: number | null;
  pickup_address: AddressJson;
  destination_address: AddressJson;
  crew_id: string | null;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  customers: { name: string | null; email: string | null; phone: string | null } | { name: string | null; email: string | null; phone: string | null }[] | null;
}

/**
 * Bookings whose end time has passed but are still confirmed / assigned /
 * in progress, oldest first. `total` is exact even when `limit` truncates rows.
 */
export async function listCloseoutJobs(limit: number, now: Date = new Date(), { withInvoices = true } = {}): Promise<{ jobs: CloseoutJob[]; total: number }> {
  const supabase = getSupabaseAdmin();
  const { data, count, error } = await supabase
    .from("bookings")
    .select(
      "id, booking_number, starts_at, ends_at, booking_status, payment_status, estimated_duration_minutes, pickup_address, destination_address, crew_id, contact_name, contact_email, contact_phone, customers(name, email, phone)",
      { count: "exact" },
    )
    .lt("ends_at", now.toISOString())
    .in("booking_status", [...CLOSEOUT_STATUSES])
    .order("ends_at", { ascending: true })
    .limit(limit);
  if (error) throw error;

  const rows = (data ?? []) as unknown as Row[];
  const invoices = new Map<string, CloseoutJob["invoice"]>();
  if (withInvoices && rows.length > 0) {
    const { data: invoiceRows, error: invoiceError } = await supabase
      .from("invoices")
      .select("id, booking_id, status, invoice_number")
      .in("booking_id", rows.map((row) => row.id))
      .neq("status", "void");
    if (invoiceError) throw invoiceError;
    for (const invoice of invoiceRows ?? []) {
      invoices.set(invoice.booking_id as string, {
        id: invoice.id as string,
        status: invoice.status as string,
        invoiceNumber: (invoice.invoice_number as string | null) ?? null,
      });
    }
  }

  return {
    total: count ?? rows.length,
    jobs: rows.map((row) => {
      const customer = resolveBookingContact(row);
      return {
        id: row.id,
        bookingNumber: row.booking_number,
        startsAt: row.starts_at,
        endsAt: row.ends_at,
        status: row.booking_status,
        paymentStatus: row.payment_status,
        estimatedDurationMinutes: row.estimated_duration_minutes,
        pickup: row.pickup_address,
        destination: row.destination_address,
        customerName: customer?.name ?? null,
        customerPhone: customer?.phone ?? null,
        crewAssigned: Boolean(row.crew_id),
        invoice: invoices.get(row.id) ?? null,
      };
    }),
  };
}

/** Exact count for the sidebar badge. Returns null if the query fails so the shell never breaks. */
export async function countCloseoutJobs(now: Date = new Date()): Promise<number | null> {
  try {
    const { count, error } = await getSupabaseAdmin()
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .lt("ends_at", now.toISOString())
      .in("booking_status", [...CLOSEOUT_STATUSES]);
    return error ? null : (count ?? 0);
  } catch {
    return null;
  }
}
