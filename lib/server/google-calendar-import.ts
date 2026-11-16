import "server-only";
import { google } from "googleapis";
import { googleCalendarConfig } from "./config.ts";
import { getSupabaseAdmin } from "./supabase.ts";
import { calendarImportDateRange, reconcileCalendarImport } from "../calendar-import.ts";

export async function importGoogleCalendarRange(timeMin: string, timeMax: string): Promise<number> {
  if (!googleCalendarConfig.isConfigured()) throw new Error("Google Calendar is not configured.");
  const startedAt = new Date().toISOString();
  const { startDate, endDate } = calendarImportDateRange(timeMin, timeMax);
  const auth = new google.auth.OAuth2(googleCalendarConfig.clientId(), googleCalendarConfig.clientSecret());
  auth.setCredentials({ refresh_token: googleCalendarConfig.refreshToken() });
  const calendar = google.calendar({ version: "v3", auth });
  const calendarId = googleCalendarConfig.calendarId();
  const admin = getSupabaseAdmin();
  let persisted = 0;

  await reconcileCalendarImport(timeMin, timeMax, {
    list: async (pageToken) => {
      const response = await calendar.events.list({ calendarId, timeMin, timeMax, maxResults: 2500, singleEvents: true, showDeleted: true, pageToken });
      return response.data;
    },
    get: async (eventId) => (await calendar.events.get({ calendarId, eventId })).data,
    loadExisting: async () => {
      const ids: string[] = [];
      for (let offset = 0; ; offset += 1000) {
        const { data, error } = await admin.from("google_calendar_imports")
          .select("event_id").eq("calendar_id", calendarId)
          .in("event_status", ["confirmed", "tentative"])
          .or(`and(starts_at.lt.${timeMax},ends_at.gt.${timeMin}),and(all_day_start.lt.${endDate},all_day_end.gt.${startDate})`)
          .order("event_id").range(offset, offset + 999);
        if (error) throw error;
        ids.push(...(data ?? []).map((event) => event.event_id));
        if (!data || data.length < 1000) return ids;
      }
    },
    save: async (events) => {
      const rows = events.map((event) => ({
        event_id: event.eventId,
        summary: event.summary,
        starts_at: event.startsAt,
        ends_at: event.endsAt,
        all_day_start: event.allDayStart,
        all_day_end: event.allDayEnd,
        location: event.location,
        event_status: event.status,
      }));
      const { data, error } = await admin.rpc("apply_google_calendar_import_batch", {
        p_calendar_id: calendarId,
        p_started_at: startedAt,
        p_events: rows,
      });
      if (error) throw error;
      persisted = typeof data === "number" ? data : 0;
    },
  });
  return persisted;
}
