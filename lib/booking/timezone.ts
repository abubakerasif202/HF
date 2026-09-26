// Timezone-aware wall-clock <-> instant conversion for the business
// timezone (Australia/Adelaide, ACST/ACDT, a +9:30/+10:30 half-hour-offset
// zone with DST). Scheduling must never rely on the browser's or server's
// local timezone — every wall-clock computation goes through here.
//
// No date library dependency (no luxon/date-fns-tz in package.json); this
// uses the standard Intl.DateTimeFormat offset-diffing technique instead,
// which is exact for any IANA zone Node's ICU data knows about.

const partsCache = new Map<string, Intl.DateTimeFormat>();

function formatterFor(timeZone: string): Intl.DateTimeFormat {
  let formatter = partsCache.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    partsCache.set(timeZone, formatter);
  }
  return formatter;
}

/** The UTC offset (ms) in effect for `instant` within `timeZone`. */
export function tzOffsetMs(instant: Date, timeZone: string): number {
  const parts = formatterFor(timeZone).formatToParts(instant);
  const map: Record<string, number> = {};
  for (const part of parts) {
    if (part.type !== "literal") map[part.type] = Number(part.value);
  }
  const asUtc = Date.UTC(
    map.year,
    map.month - 1,
    map.day,
    map.hour === 24 ? 0 : map.hour,
    map.minute,
    map.second,
  );
  return asUtc - instant.getTime();
}

/**
 * Converts a wall-clock date/time as it would read on a clock in
 * `timeZone` into the correct UTC instant. `hour`/`minute` are local
 * (0-23 / 0-59).
 */
export function zonedWallTimeToInstant(
  year: number,
  month1To12: number,
  day: number,
  hour: number,
  minute: number,
  timeZone: string,
): Date {
  // First guess: treat the wall time as if it were UTC, then correct by
  // the zone's offset. A single pass uses the offset *at the guess*,
  // which is wrong whenever the guess and the corrected instant fall on
  // opposite sides of a DST transition (e.g. any evening wall-clock time
  // on the Saturday before an Adelaide clock change). A second pass
  // re-reads the offset at the corrected instant and re-applies it,
  // which converges because DST transitions only ever shift the offset
  // by a fixed, bounded amount (1 hour here).
  const guess = new Date(Date.UTC(year, month1To12 - 1, day, hour, minute, 0));
  const offset1 = tzOffsetMs(guess, timeZone);
  const corrected = new Date(guess.getTime() - offset1);
  const offset2 = tzOffsetMs(corrected, timeZone);
  if (offset2 === offset1) return corrected;
  return new Date(guess.getTime() - offset2);
}

export function instantToZonedParts(
  instant: Date,
  timeZone: string,
): { year: number; month: number; day: number; hour: number; minute: number; weekday: number } {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    weekday: "short",
  });
  const parts = dtf.formatToParts(instant);
  const map: Record<string, string> = {};
  for (const part of parts) map[part.type] = part.value;
  const weekdayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour: Number(map.hour) === 24 ? 0 : Number(map.hour),
    minute: Number(map.minute),
    weekday: weekdayMap[map.weekday] ?? 0,
  };
}

/** Parses "HH:MM" into { hour, minute }. */
export function parseHm(hm: string): { hour: number; minute: number } {
  const [hour, minute] = hm.split(":").map(Number);
  return { hour, minute };
}
