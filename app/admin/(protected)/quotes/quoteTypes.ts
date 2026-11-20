import type { LostReason } from "../../../../lib/admin/quote-crm";
import type { QuoteStatus } from "./quoteStatus";

export type DeliveryStatus = "pending" | "sent" | "failed" | "unknown";

export type Quote = {
  id: string;
  payload: Record<string, string | string[]>;
  quote_status: QuoteStatus;
  delivery_status: DeliveryStatus;
  created_at: string;
  notes: string | null;
  follow_up_at: string | null;
  status_changed_at: string | null;
  first_response_at: string | null;
  quoted_amount_cents: number | null;
  lost_reason: LostReason | null;
  booking_id: string | null;
  booking: { id: string; booking_number: string } | null;
};

/** Fields the PATCH /api/admin/quotes endpoint accepts (besides the id). */
export type QuotePatch = {
  quote_status?: QuoteStatus;
  notes?: string | null;
  /** YYYY-MM-DD from the date picker, or null to clear. */
  follow_up_at?: string | null;
  quoted_amount_cents?: number | null;
  lost_reason?: LostReason | null;
};

export const MISSING = "—";

export function field(quote: Pick<Quote, "payload">, name: string): string {
  const value = quote.payload?.[name];
  if (typeof value === "string") return value.trim() || MISSING;
  return Array.isArray(value) ? value.join(", ") || MISSING : MISSING;
}

export function hasValue(value: string): boolean {
  return value !== MISSING;
}

export function displayName(quote: Pick<Quote, "payload">): string {
  const name = field(quote, "name");
  return hasValue(name) ? name : "Unnamed enquiry";
}
