// Google Calendar mirror for confirmed bookings — the pure parts: event
// content, the deterministic event id and the reconcile decision. The
// Google API client is injected, so every lifecycle path is unit-testable
// without Google. lib/server/google-calendar.ts wires in the real client.
//
// Supabase stays authoritative. The Google event is an operational mirror
// only, and a failure here never changes the booking itself.

export const CALENDAR_TIME_ZONE = "Australia/Adelaide";

/** Bookings that should have a visible Google event. */
const LIVE_STATUSES = new Set(["confirmed", "assigned", "in_progress", "completed"]);
/** Bookings whose Google event must be removed. */
const REMOVED_STATUSES = new Set(["cancelled", "expired"]);

interface Address {
  formattedAddress?: string;
  addressLine?: string;
  suburb?: string;
}

export interface CalendarBooking {
  id: string;
  booking_number: string;
  booking_status: string;
  starts_at: string;
  ends_at: string;
  crew_size: number;
  pickup_address: Address | null;
  destination_address: Address | null;
  pricing_snapshot: { package?: string } | null;
  google_calendar_event_id: string | null;
  customer: { name?: string | null; email?: string | null; phone?: string | null } | null;
}

export interface CalendarEventBody {
  summary: string;
  description: string;
  location: string;
  start: { dateTime: string; timeZone: string };
  end: { dateTime: string; timeZone: string };
  status: "confirmed";
}

/**
 * Google allows client-chosen event ids (base32hex: 0-9 and a-v, 5-1024
 * chars). A UUID's hex digits are a subset, so "hf" + the booking UUID is
 * a valid, stable id. Because the id is derived from the booking, a
 * retried insert — after a restart, a lost response, a concurrent retry —
 * hits a 409 instead of creating a second event.
 */
export function googleEventIdForBooking(bookingId: string): string {
  return `hf${bookingId.replace(/-/g, "").toLowerCase()}`;
}

function addressLabel(address: Address | null): string {
  if (!address) return "(not provided)";
  return address.formattedAddress ?? `${address.addressLine ?? ""} ${address.suburb ?? ""}`.trim();
}

function surname(name: string | null | undefined): string {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  return parts.length ? parts[parts.length - 1] : "Customer";
}

/**
 * Event content. Times are the booking's own stored starts_at/ends_at —
 * the operational job window. The billing call-out is a price add-on and
 * is never added to calendar occupancy. Internal notes are deliberately
 * excluded.
 */
export function buildCalendarEvent(booking: CalendarBooking, options: { adminBaseUrl: string }): CalendarEventBody {
  const packageName = booking.pricing_snapshot?.package ?? `${booking.crew_size} Men + Truck`;
  const customer = booking.customer;
  const description = [
    `Booking reference: ${booking.booking_number}`,
    `Customer: ${customer?.name ?? "—"}`,
    `Phone: ${customer?.phone ?? "—"}`,
    `Email: ${customer?.email ?? "—"}`,
    `Pickup: ${addressLabel(booking.pickup_address)}`,
    `Destination: ${addressLabel(booking.destination_address)}`,
    `Package: ${packageName}`,
    `Crew size: ${booking.crew_size}`,
    `Booking status: ${booking.booking_status.replace(/_/g, " ")}`,
    `Admin: ${options.adminBaseUrl.replace(/\/$/, "")}/admin/bookings/${booking.id}`,
    "",
    "Mirror of the HF booking system (Supabase is the source of truth). Edit the booking in the admin, not here.",
  ].join("\n");

  return {
    summary: `${booking.booking_number} — ${surname(customer?.name)} — ${packageName}`,
    description,
    location: addressLabel(booking.pickup_address),
    start: { dateTime: booking.starts_at, timeZone: CALENDAR_TIME_ZONE },
    end: { dateTime: booking.ends_at, timeZone: CALENDAR_TIME_ZONE },
    status: "confirmed",
  };
}

export interface CalendarClient {
  insert(eventId: string, body: CalendarEventBody): Promise<void>;
  update(eventId: string, body: CalendarEventBody): Promise<void>;
  remove(eventId: string): Promise<void>;
}

export type CalendarSyncOutcome =
  | { status: "not_applicable" }
  | { status: "skipped" }
  | { status: "synced"; eventId: string }
  | { status: "failed"; eventId: string | null; error: string };

function httpStatusOf(error: unknown): number | undefined {
  const e = error as { status?: unknown; code?: unknown; response?: { status?: unknown } };
  for (const candidate of [e?.status, e?.response?.status, e?.code]) {
    const n = Number(candidate);
    if (Number.isInteger(n) && n >= 100 && n < 600) return n;
  }
  return undefined;
}

/** Short, safe summaries — never raw API/OAuth error text or stacks. */
export function friendlyCalendarError(error: unknown): string {
  const e = error as { message?: unknown; response?: { data?: { error?: unknown } } };
  const text = `${String(e?.message ?? "")} ${JSON.stringify(e?.response?.data?.error ?? "")}`;
  if (/invalid_grant/i.test(text)) return "Google authorisation has expired or was revoked. Reconnect Google Calendar (new refresh token), then retry.";
  if (/invalid_client|unauthorized_client/i.test(text)) return "Google OAuth client credentials were rejected. Check the Google Calendar settings, then retry.";
  const status = httpStatusOf(error);
  if (status === 401) return "Google rejected the calendar credentials. Reconnect Google Calendar, then retry.";
  if (status === 403) return "No permission to edit this Google Calendar, or the API quota was hit. Check access, then retry.";
  if (status === 404) return "The Google Calendar wasn't found. Check GOOGLE_CALENDAR_ID, then retry.";
  if (status === 429 || (status !== undefined && status >= 500)) return "Google Calendar is temporarily unavailable. Retry in a few minutes.";
  return "Google Calendar sync failed. Retry, and check the calendar settings if it keeps failing.";
}

/**
 * Brings the Google event in line with the booking's CURRENT state:
 *  - live booking     -> create the event once, or update it in place
 *  - cancelled/expired -> delete the event (already gone counts as done)
 *  - held/pending     -> nothing yet
 * Never creates a second event for the same booking.
 */
export async function reconcileCalendarEvent(
  booking: CalendarBooking,
  client: CalendarClient | null,
  options: { adminBaseUrl: string },
): Promise<CalendarSyncOutcome> {
  if (!client) return { status: "not_applicable" };

  const eventId = booking.google_calendar_event_id ?? googleEventIdForBooking(booking.id);

  try {
    if (LIVE_STATUSES.has(booking.booking_status)) {
      const body = buildCalendarEvent(booking, options);
      if (booking.google_calendar_event_id) {
        try {
          await client.update(eventId, body);
        } catch (error) {
          const status = httpStatusOf(error);
          if (status !== 404 && status !== 410) throw error;
          await client.insert(eventId, body);
        }
      } else {
        try {
          await client.insert(eventId, body);
        } catch (error) {
          if (httpStatusOf(error) !== 409) throw error;
          // Already exists (earlier attempt succeeded but the id wasn't
          // saved, or a concurrent sync won) — update it instead.
          await client.update(eventId, body);
        }
      }
      return { status: "synced", eventId };
    }

    if (REMOVED_STATUSES.has(booking.booking_status)) {
      try {
        await client.remove(eventId);
      } catch (error) {
        const status = httpStatusOf(error);
        if (status !== 404 && status !== 410) throw error;
      }
      return { status: "synced", eventId };
    }

    return { status: "skipped" };
  } catch (error) {
    return { status: "failed", eventId: booking.google_calendar_event_id, error: friendlyCalendarError(error) };
  }
}
