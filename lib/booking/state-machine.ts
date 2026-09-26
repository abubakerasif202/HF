import type { BookingStatus } from "./types.ts";

/**
 * Valid booking_status transitions. Anything not listed here (e.g.
 * `completed -> pending_payment`) is rejected. This mirrors the CHECK
 * constraint in the DB migration but is enforced here too so an invalid
 * transition never reaches Postgres, and so pure unit tests can cover it
 * without a database.
 */
const ALLOWED_TRANSITIONS: Record<BookingStatus, BookingStatus[]> = {
  draft: ["held", "cancelled", "expired"],
  held: ["pending_payment", "cancelled", "expired"],
  pending_payment: ["confirmed", "cancelled", "expired"],
  confirmed: ["assigned", "cancelled"],
  assigned: ["in_progress", "cancelled"],
  in_progress: ["completed", "cancelled"],
  completed: [],
  cancelled: [],
  expired: ["held"], // a customer may retry booking the same held row after expiry cleanup re-opens it
};

export function canTransition(from: BookingStatus, to: BookingStatus): boolean {
  if (from === to) return false;
  return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;
}

export function assertTransition(from: BookingStatus, to: BookingStatus): void {
  if (!canTransition(from, to)) {
    throw new Error(`Invalid booking status transition: ${from} -> ${to}`);
  }
}

export const LIVE_STATUSES: BookingStatus[] = ["held", "pending_payment", "confirmed", "assigned", "in_progress"];
