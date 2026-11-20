/**
 * Per-booking contact snapshot.
 *
 * A booking stores the name / email / phone the customer typed when they made
 * it (`bookings.contact_*`, migration 0020). The shared `customers` row is only
 * a fallback: it is keyed by email and is never overwritten from a public
 * request, so it can hold an older name or phone than the booking.
 */

export interface BookingContact {
  name: string | null;
  email: string | null;
  phone: string | null;
}

type CustomerJoin = Partial<BookingContact> | Array<Partial<BookingContact>> | null | undefined;

export interface ContactSource {
  contact_name?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  customers?: CustomerJoin;
}

function clean(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

/**
 * The contact to show or use for a booking: the booking snapshot when it has
 * one, otherwise the joined `customers` row. Returns null when neither has
 * anything. A snapshot (name or email present) is authoritative as a whole, so
 * a customer who left the phone blank is not shown an older phone number.
 */
export function resolveBookingContact(booking: ContactSource): BookingContact | null {
  const snapshotName = clean(booking.contact_name);
  const snapshotEmail = clean(booking.contact_email);
  if (snapshotName || snapshotEmail) {
    return { name: snapshotName, email: snapshotEmail, phone: clean(booking.contact_phone) };
  }
  const joined = Array.isArray(booking.customers) ? booking.customers[0] : booking.customers;
  if (!joined) return null;
  const contact = { name: clean(joined.name), email: clean(joined.email), phone: clean(joined.phone) };
  return contact.name || contact.email || contact.phone ? contact : null;
}

/** Returns the row with `customers` replaced by the resolved contact (same shape consumers already read). */
export function applyContactSnapshot<T extends ContactSource>(booking: T): Omit<T, "customers"> & { customers: BookingContact | null } {
  return { ...booking, customers: resolveBookingContact(booking) };
}
