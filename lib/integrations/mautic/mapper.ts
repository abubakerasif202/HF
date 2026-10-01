import "server-only";
import type { MauticLead } from "./types.ts";

export const FIELD_ALIASES = {
  firstName: "firstname", lastName: "lastname", email: "email", phone: "mobile",
  pickupSuburb: "pickup_suburb", dropoffSuburb: "dropoff_suburb", moveDate: "move_date",
  propertySize: "property_size", serviceType: "service_type", accessDetails: "access_details",
  source: "quote_source", quoteStatus: "quote_status", bookingStatus: "booking_status",
  estimatedValue: "estimated_value", utmSource: "utm_source", utmMedium: "utm_medium",
  utmCampaign: "utm_campaign", utmContent: "utm_content", utmTerm: "utm_term",
  gclid: "gclid", fbclid: "fbclid", landingPage: "landing_page", referrer: "referrer",
} as const;
export const ACQUISITION_FIELDS = new Set<string>([
  "quote_source", "utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term",
  "gclid", "fbclid", "landing_page", "referrer",
]);
export function leadTags(lead: MauticLead): string[] {
  const tags = ["hf-website"];
  if (lead.quoteStatus) tags.push("quote-lead");
  if (lead.gclid || (lead.utmSource?.toLowerCase() === "google" && /^(cpc|ppc|paidsearch)$/i.test(lead.utmMedium ?? ""))) tags.push("google-ads");
  if (lead.utmMedium?.toLowerCase() === "organic") tags.push("organic");
  if (lead.returningCustomer === true) tags.push("returning-customer");
  if (["confirmed", "assigned", "in_progress", "completed"].includes(lead.bookingStatus ?? "")) tags.push("booked-customer");
  return tags;
}
export function mapLead(lead: MauticLead, existing: Record<string, unknown> = {}) {
  const fields: Record<string, string | number | string[]> = { tags: leadTags(lead) };
  const hasAcquisition = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "gclid", "fbclid", "referrer"].some((key) => typeof existing[key] === "string" && Boolean((existing[key] as string).trim()));
  for (const [key, alias] of Object.entries(FIELD_ALIASES)) {
    const value = lead[key as keyof typeof FIELD_ALIASES];
    if (value === undefined || value === "" || (typeof value === "number" && !Number.isFinite(value))) continue;
    if (ACQUISITION_FIELDS.has(alias) && (hasAcquisition || (existing[alias] !== undefined && existing[alias] !== null && existing[alias] !== ""))) continue;
    if (typeof value === "string" && !value.trim()) continue;
    fields[alias] = typeof value === "string" ? value.trim().slice(0, alias === "access_details" ? 4000 : 500) : value;
  }
  return fields;
}
