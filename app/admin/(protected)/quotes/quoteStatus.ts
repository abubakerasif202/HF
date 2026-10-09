/** Shared (server + client safe) quote-enquiry status definitions. */
export const QUOTE_STATUS_ORDER = ["new", "quote_sent", "follow_up", "booked", "completed", "lost"] as const;
export type QuoteStatus = (typeof QUOTE_STATUS_ORDER)[number];
export type StatusCounts = Record<QuoteStatus, number>;
