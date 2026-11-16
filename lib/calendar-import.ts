export interface GoogleCalendarEventInput {
  id?: string | null;
  status?: string | null;
  summary?: string | null;
  location?: string | null;
  start?: { dateTime?: string | null; date?: string | null } | null;
  end?: { dateTime?: string | null; date?: string | null } | null;
}

export interface ImportedCalendarEvent {
  eventId: string;
  summary: string | null;
  startsAt: string | null;
  endsAt: string | null;
  allDayStart: string | null;
  allDayEnd: string | null;
  location: string | null;
  status: "confirmed" | "tentative" | "cancelled";
}

function validDate(value: string | null | undefined): string | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value ? null : value;
}

function validInstant(value: string | null | undefined): string | null {
  if (!value) return null;
  const time = Date.parse(value);
  return Number.isFinite(time) ? new Date(time).toISOString() : null;
}

/** Converts Google event fields without guessing customer, pricing, crew, or job data. */
export function normalizeGoogleCalendarEvent(event: GoogleCalendarEventInput): ImportedCalendarEvent | null {
  const eventId = event.id?.trim();
  if (!eventId || /^hf[0-9a-f]{32}$/i.test(eventId)) return null;

  const startDate = validDate(event.start?.date);
  const endDate = validDate(event.end?.date);
  const allDay = Boolean(startDate || endDate);
  const startsAt = allDay ? null : validInstant(event.start?.dateTime);
  const endsAt = allDay ? null : validInstant(event.end?.dateTime);
  const validRange = startsAt && endsAt && Date.parse(endsAt) > Date.parse(startsAt);
  const validAllDayRange = startDate && endDate && endDate > startDate;
  const status = event.status === "cancelled" ? "cancelled" : event.status === "tentative" ? "tentative" : "confirmed";

  return {
    eventId,
    summary: event.summary?.trim() || null,
    startsAt: validRange ? startsAt : null,
    endsAt: validRange ? endsAt : null,
    allDayStart: validAllDayRange ? startDate : null,
    allDayEnd: validAllDayRange ? endDate : null,
    location: event.location?.trim() || null,
    status,
  };
}

export interface CalendarImportAdapter {
  list(pageToken?: string): Promise<{ items?: GoogleCalendarEventInput[] | null; nextPageToken?: string | null }>;
  get(eventId: string): Promise<GoogleCalendarEventInput>;
  loadExisting(): Promise<string[]>;
  save(events: ImportedCalendarEvent[]): Promise<void>;
}

/** Date bounds for overlapping all-day events; Google's all-day end is exclusive. */
export function calendarImportDateRange(timeMin: string, timeMax: string): { startDate: string; endDate: string } {
  const start = Date.parse(timeMin);
  const end = Date.parse(timeMax);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) throw new Error("Invalid calendar import range.");
  const dateAt = (instant: number) => {
    const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Australia/Adelaide", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(instant);
    const part = (name: string) => parts.find((value) => value.type === name)?.value;
    return `${part("year")}-${part("month")}-${part("day")}`;
  };
  const finalDate = dateAt(end - 1);
  const endDate = new Date(Date.parse(`${finalDate}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10);
  return { startDate: dateAt(start), endDate };
}

/** Stage a complete refresh before saving, so partial Google failures never erase reservations. */
export async function reconcileCalendarImport(timeMin: string, timeMax: string, adapter: CalendarImportAdapter): Promise<number> {
  calendarImportDateRange(timeMin, timeMax);
  const existingIds = await adapter.loadExisting();
  const events = new Map<string, ImportedCalendarEvent>();
  const returnedIds = new Set<string>();
  let pageToken: string | undefined;
  let pages = 0;
  do {
    if (pages >= 32) throw new Error("Google Calendar import exceeded the page limit.");
    const page = await adapter.list(pageToken);
    pages += 1;
    for (const event of page.items ?? []) {
      if (event.id) returnedIds.add(event.id);
      const normalized = normalizeGoogleCalendarEvent(event);
      if (normalized) events.set(normalized.eventId, normalized);
    }
    pageToken = page.nextPageToken ?? undefined;
  } while (pageToken);

  for (const eventId of new Set(existingIds)) {
    if (returnedIds.has(eventId) || /^hf[0-9a-f]{32}$/i.test(eventId)) continue;
    let event: GoogleCalendarEventInput;
    try {
      event = await adapter.get(eventId);
    } catch (error) {
      const failure = error as { code?: unknown; status?: unknown; response?: { status?: unknown } };
      const status = Number(failure.response?.status ?? failure.status ?? failure.code);
      if (status !== 404 && status !== 410) throw error;
      event = { id: eventId, status: "cancelled" };
    }
    if (event.id !== eventId) throw new Error("Google Calendar event identity mismatch.");
    const normalized = normalizeGoogleCalendarEvent(event);
    if (normalized) events.set(eventId, normalized);
  }

  if (events.size) await adapter.save([...events.values()]);
  return events.size;
}
