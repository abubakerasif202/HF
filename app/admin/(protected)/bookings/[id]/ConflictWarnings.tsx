import Link from "next/link";
import { Icon } from "../../../_components/Icon";
import { formatAdelaide } from "../../../_components/ui";
import type { BookingConflictView } from "../../../../../lib/server/booking-conflicts.ts";

function windowText(startsAt: string | null, endsAt: string | null): string {
  if (!startsAt) return "time not recorded";
  const day = formatAdelaide(startsAt, { weekday: "short", day: "numeric", month: "short" });
  const from = formatAdelaide(startsAt, { timeStyle: "short" });
  return endsAt ? `${day}, ${from} – ${formatAdelaide(endsAt, { timeStyle: "short" })}` : `${day}, ${from} (no finish time recorded)`;
}

/** Overlap warnings for this booking's crew/trucks, naming the conflicting booking. "Possible" means a finish time is missing. */
export function ConflictWarnings({ conflicts }: { conflicts: BookingConflictView[] }) {
  if (conflicts.length === 0) return null;
  const definite = conflicts.some((c) => c.certainty === "definite");
  return (
    <section className="a-bk-conflicts" role="alert" aria-labelledby="bk-conflicts-title" data-tone={definite ? "danger" : "possible"}>
      <h2 id="bk-conflicts-title"><Icon name="alert" size={17} />{definite ? "Scheduling conflict" : "Possible scheduling conflict"}</h2>
      <ul>
        {conflicts.map((conflict, index) => (
          <li key={`${conflict.other.id}-${conflict.kind}-${index}`}>
            <strong>{conflict.label}</strong>
            {" with "}
            {conflict.other.isBooking
              ? <Link href={`/admin/bookings/${conflict.other.id}`} className="admin-link">{conflict.other.bookingNumber}</Link>
              : <span>{conflict.other.summary ?? "a Google Calendar event"}</span>}
            {conflict.other.customerName ? ` · ${conflict.other.customerName}` : ""}
            {` · ${windowText(conflict.other.startsAt, conflict.other.endsAt)}`}
            {conflict.certainty === "possible" && <small>A finish time is missing, so this overlap is inferred. Confirm the finish time.</small>}
          </li>
        ))}
      </ul>
    </section>
  );
}
