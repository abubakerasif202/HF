export type QuoteStatus = "new" | "quote_sent" | "follow_up" | "booked" | "completed" | "lost";
export interface MauticLead {
  firstName?: string; lastName?: string; email?: string; phone?: string;
  pickupSuburb?: string; dropoffSuburb?: string; moveDate?: string;
  serviceType?: string; propertySize?: string; accessDetails?: string;
  quoteStatus?: QuoteStatus; bookingStatus?: string; estimatedValue?: number;
  source?: string; utmSource?: string; utmMedium?: string; utmCampaign?: string;
  utmContent?: string; utmTerm?: string; gclid?: string; fbclid?: string;
  landingPage?: string; referrer?: string; returningCustomer?: boolean;
}
export interface MauticContact {
  id: number;
  fields: { all: Record<string, unknown> };
}
export type SyncResult = { status: "disabled" | "skipped" | "failed" } | { status: "synced"; contactId: number };
