// GA4 funnel events for the no-advance-payment booking wizard. Only
// non-personal context is ever sent (step, package, service slug, error
// code) — never names, emails, phone numbers or addresses. Safe to call
// when GA hasn't loaded or is blocked.

export type BookingFunnelEvent =
  | "booking_started"
  | "availability_checked"
  | "booking_hold_created"
  | "booking_reviewed"
  | "booking_confirmed"
  | "booking_failed";

export type BookingFunnelParams = Partial<Record<"package" | "service" | "step" | "code" | "slots_available", string | number>>;

export function trackBookingEvent(event: BookingFunnelEvent, params: BookingFunnelParams = {}): void {
  if (typeof window === "undefined") return;
  const gtag = (window as unknown as { gtag?: (...args: unknown[]) => void }).gtag;
  if (typeof gtag !== "function") return;
  gtag("event", event, params);
}
