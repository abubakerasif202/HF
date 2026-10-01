export type QuoteDeliveryStatus = "sent" | "failed" | "unknown";
export type QuoteDeliveryFailure = "configuration" | "authentication" | "rejected" | "provider" | "network" | "timeout" | "invalid_response";
export interface QuoteDeliveryResult {
  status: QuoteDeliveryStatus;
  attemptedAt: string;
  failureCategory?: QuoteDeliveryFailure;
}
