import "server-only";
import { google } from "googleapis";
import { googleCalendarConfig } from "./config.ts";
import { getSupabaseAdmin } from "./supabase.ts";
import { business } from "../site-data.ts";
import { reconcileCalendarEvent, type CalendarBooking, type CalendarClient } from "../calendar-sync.ts";

/**
 * Google Calendar is an OPTIONAL operational mirror of confirmed bookings.
 * Supabase remains authoritative; nothing here can change a booking's
 * status, and every failure is recorded on the booking row
 * (`calendar_sync_status` / `calendar_sync_error`, friendly text only) so
 * staff can retry from /admin/bookings/[id].
 *
 * Distinct from the Google Appointment Scheduling iframe on /book, which
 * never touches bookings at all.
 *
 * `calendar_sync_status` values: `not_applicable` (shown as "Disabled" —
 * credentials not configured), `pending`, `synced`, `failed`.
 */

function getCalendarClient(): CalendarClient | null {
  if (!googleCalendarConfig.isConfigured()) return null;
  const auth = new google.auth.OAuth2(googleCalendarConfig.clientId(), googleCalendarConfig.clientSecret());
  auth.setCredentials({ refresh_token: googleCalendarConfig.refreshToken() });
  const calendar = google.calendar({ version: "v3", auth });
  const calendarId = googleCalendarConfig.calendarId();
  return {
    insert: async (eventId, body) => {
      await calendar.events.insert({ calendarId, requestBody: { id: eventId, ...body } });
    },
    update: async (eventId, body) => {
      await calendar.events.update({ calendarId, eventId, requestBody: body });
    },
    remove: async (eventId) => {
      await calendar.events.delete({ calendarId, eventId });
    },
  };
}

function adminBaseUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL ?? business.domain;
}

async function loadCalendarBooking(bookingId: string): Promise<CalendarBooking | null> {
  const { data, error } = await getSupabaseAdmin()
    .from("bookings")
    .select("id, booking_number, booking_status, starts_at, ends_at, crew_size, package_id, pickup_address, destination_address, pricing_snapshot, google_calendar_event_id, customers(name, email, phone)")
    .eq("id", bookingId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const customer = Array.isArray(data.customers) ? data.customers[0] : data.customers;
  return { ...data, customer: customer ?? null } as CalendarBooking;
}

/**
 * Re-reads the booking and brings its Google event in line with the
 * current state (create once / update in place / delete on cancel). Safe
 * to call repeatedly from any write path. Never throws for a Google or
 * configuration problem — the booking must stay valid regardless.
 */
export async function reconcileBookingCalendar(bookingId: string): Promise<void> {
  const booking = await loadCalendarBooking(bookingId);
  if (!booking) return;

  const outcome = await reconcileCalendarEvent(booking, getCalendarClient(), { adminBaseUrl: adminBaseUrl() });
  const bookings = getSupabaseAdmin().from("bookings");

  if (outcome.status === "skipped") return;
  if (outcome.status === "not_applicable") {
    await bookings.update({ calendar_sync_status: "not_applicable", calendar_sync_error: null }).eq("id", booking.id);
    return;
  }
  if (outcome.status === "synced") {
    await bookings
      .update({ calendar_sync_status: "synced", calendar_sync_error: null, google_calendar_event_id: outcome.eventId })
      .eq("id", booking.id);
    return;
  }
  await bookings.update({ calendar_sync_status: "failed", calendar_sync_error: outcome.error }).eq("id", booking.id);
}

/** Kept for existing callers (confirmation flow, dormant Stripe webhook). */
export async function syncBookingToCalendar(booking: { id: string }): Promise<void> {
  await reconcileBookingCalendar(booking.id);
}

/**
 * Link to open a synced event in Google Calendar. Only possible when the
 * calendar id is an explicit address — Google's event URL can't resolve
 * the "primary" alias.
 */
export function googleCalendarEventLink(eventId: string | null): string | null {
  if (!eventId || !googleCalendarConfig.isConfigured()) return null;
  const calendarId = googleCalendarConfig.calendarId();
  if (calendarId === "primary") return null;
  const eid = Buffer.from(`${eventId} ${calendarId}`).toString("base64").replace(/=+$/, "");
  return `https://calendar.google.com/calendar/event?eid=${eid}`;
}
