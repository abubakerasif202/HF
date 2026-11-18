// Pure mapping from imported Google Calendar events to the Calendar page's "blocked period" shape,
// so external events appear on the HF calendar next to bookings. Display only: nothing here writes anywhere.
import { zonedWallTimeToInstant } from "./booking/timezone.ts";

export interface GoogleImportRow {
  id: string;
  summary: string | null;
  starts_at: string | null;
  ends_at: string | null;
  all_day_start: string | null;
  all_day_end: string | null;
  event_status: string;
}

export interface GoogleBlock {
  id: string;
  startsAt: string;
  endsAt: string;
  vehicleId: null;
  crewId: null;
  reason: string;
  vehicleName: undefined;
  crewName: undefined;
}

const NO_FINISH_MINUTES = 60;

function dayStart(ymd: string, timeZone: string): Date {
  const [y, m, d] = ymd.split("-").map(Number) as [number, number, number];
  return zonedWallTimeToInstant(y, m, d, 0, 0, timeZone);
}

/** Cancelled events never display. All-day events span local midnight to midnight; timed events with no end show one hour. */
export function googleEventToBlock(event: GoogleImportRow, timeZone: string): GoogleBlock | null {
  if (event.event_status === "cancelled") return null;
  let start: Date | null = null;
  let end: Date | null = null;
  let note = "";
  if (event.starts_at) {
    start = new Date(event.starts_at);
    if (event.ends_at) end = new Date(event.ends_at);
    else { end = new Date(start.getTime() + NO_FINISH_MINUTES * 60_000); note = " (no finish time)"; }
  } else if (event.all_day_start && event.all_day_end) {
    start = dayStart(event.all_day_start, timeZone);
    end = dayStart(event.all_day_end, timeZone);
    note = " (all day)";
  }
  if (!start || !end || !(end > start)) return null;
  const title = (event.summary ?? "").trim() || "Busy";
  return {
    id: `google-${event.id}`,
    startsAt: start.toISOString(),
    endsAt: end.toISOString(),
    vehicleId: null,
    crewId: null,
    reason: `Google Calendar: ${title}${note}${event.event_status === "tentative" ? " (tentative)" : ""}`,
    vehicleName: undefined,
    crewName: undefined,
  };
}
