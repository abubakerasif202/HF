import type { QuoteDeliveryResult } from "./delivery.ts";
import type { QuoteInput } from "./schema.ts";
import type { MauticLead } from "../integrations/mautic/types.ts";
import { safePage } from "../marketing-attribution.ts";
export function quoteToLead(quote: QuoteInput): MauticLead {
  const acquisition = quote.attribution_consent ? quote.attribution : undefined;
  return {
    // The form collects one full name; do not guess a surname.
    firstName: quote.name, email: quote.email || undefined, phone: quote.phone,
    pickupSuburb: quote.moving_from, dropoffSuburb: quote.moving_to,
    moveDate: quote.preferred_moving_date || undefined, propertySize: quote.property_size,
    serviceType: quote.move_type, accessDetails: [quote.floor_access, quote.parking_access, quote.details].filter(Boolean).join("\n"),
    quoteStatus: "new", source: "hf-website",
    utmSource: acquisition?.utm_source, utmMedium: acquisition?.utm_medium, utmCampaign: acquisition?.utm_campaign,
    utmContent: acquisition?.utm_content, utmTerm: acquisition?.utm_term, gclid: acquisition?.gclid, fbclid: acquisition?.fbclid,
    landingPage: acquisition?.landing_page ? safePage(acquisition.landing_page) : undefined,
    referrer: acquisition?.referrer ? safePage(acquisition.referrer) : undefined,
  };
}
export interface QuoteDependencies {
  save: (quote: QuoteInput) => Promise<"created" | "existing">;
  deliver: (quote: QuoteInput) => Promise<QuoteDeliveryResult>;
  recordDelivery: (id: string, delivery: QuoteDeliveryResult) => Promise<void>;
  schedule: (lead: MauticLead) => void;
  onError: (code: string) => void;
}
export async function acceptQuote(quote: QuoteInput, deps: QuoteDependencies): Promise<{ success: true }> {
  const outcome = await deps.save(quote); // Critical: failure prevents acceptance.
  if (outcome === "existing") return { success: true }; // Do not resend ambiguous provider deliveries.
  let delivery: QuoteDeliveryResult = { status: "unknown", attemptedAt: new Date().toISOString(), failureCategory: "network" };
  try { delivery = await deps.deliver(quote); } catch { deps.onError("delivery_unknown"); }
  try { await deps.recordDelivery(quote.request_id, delivery); } catch { deps.onError("delivery_record_failed"); }
  // Saved leads remain accepted even if notification delivery needs reconciliation.
  try { deps.schedule(quoteToLead(quote)); } catch { deps.onError("crm_schedule_failed"); }
  return { success: true };
}
