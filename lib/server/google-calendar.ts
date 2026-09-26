import "server-only";
import { google } from "googleapis";
import { googleCalendarConfig } from "./config.ts";
import { getSupabaseAdmin } from "./supabase.ts";

interface BookingRow {
  id: string;
  booking_number: string;
  starts_at: string;
  ends_at: string;
  pickup_address: { formattedAddress?: string; addressLine?: string; suburb?: string } | null;
  destination_address: { formattedAddress?: string; addressLine?: string; suburb?: string } | null;
  google_calendar_event_id: string | null;
}

function addressLabel(address: BookingRow["pickup_address"]): string {
  if (!address) return "(address not provided)";
  return address.formattedAddress ?? `${address.addressLine ?? ""} ${address.suburb ?? ""}`.trim();
}

function getCalendarClient() {
  const auth = new google.auth.OAuth2(googleCalendarConfig.clientId(), googleCalendarConfig.clientSecret());
  auth.setCredentials({ refresh_token: googleCalendarConfig.refreshToken() });
  return google.calendar({ version: "v3", auth });
}

/**
 * Synchronizes a confirmed booking to the configured Google Calendar.
 * Supabase remains authoritative — this is a synchronized OPERATIONAL
 * VIEW only. A failure here must never invalidate the booking; it is
 * recorded on the booking row (`calendar_sync_status` /
 * `calendar_sync_error`) so an admin can retry, per AGENTS: "If Calendar
 * API fails: booking must remain valid... allow retry."
 *
 * No-ops silently (calendar_sync_status = 'not_applicable') when Google
 * Calendar credentials are not configured — this is expected until an
 * admin supplies them, not an error.
 */
export async function syncBookingToCalendar(booking: BookingRow): Promise<void> {
  const supabase = getSupabaseAdmin();

  if (!googleCalendarConfig.isConfigured()) {
    await supabase.from("bookings").update({ calendar_sync_status: "not_applicable" }).eq("id", booking.id);
    return;
  }

  try {
    const calendar = getCalendarClient();
    const eventBody = {
      summary: `Move — ${booking.booking_number}`,
      description: [`Booking reference: ${booking.booking_number}`, `Pickup: ${addressLabel(booking.pickup_address)}`, `Destination: ${addressLabel(booking.destination_address)}`].join("\n"),
      start: { dateTime: booking.starts_at },
      end: { dateTime: booking.ends_at },
    };

    if (booking.google_calendar_event_id) {
      await calendar.events.update({
        calendarId: googleCalendarConfig.calendarId(),
        eventId: booking.google_calendar_event_id,
        requestBody: eventBody,
      });
    } else {
      const created = await calendar.events.insert({
        calendarId: googleCalendarConfig.calendarId(),
        requestBody: eventBody,
      });
      await supabase.from("bookings").update({ google_calendar_event_id: created.data.id }).eq("id", booking.id);
    }

    await supabase.from("bookings").update({ calendar_sync_status: "synced", calendar_sync_error: null }).eq("id", booking.id);
  } catch (error) {
    await supabase
      .from("bookings")
      .update({ calendar_sync_status: "failed", calendar_sync_error: (error as Error).message })
      .eq("id", booking.id);
  }
}

/** Cancels/removes the calendar event for a cancelled booking, if one was ever synced. */
export async function removeBookingFromCalendar(booking: Pick<BookingRow, "id" | "google_calendar_event_id">): Promise<void> {
  if (!googleCalendarConfig.isConfigured() || !booking.google_calendar_event_id) return;
  try {
    const calendar = getCalendarClient();
    await calendar.events.delete({ calendarId: googleCalendarConfig.calendarId(), eventId: booking.google_calendar_event_id });
  } catch {
    // Best-effort; the booking's own cancellation is already durable in Supabase.
  }
}
