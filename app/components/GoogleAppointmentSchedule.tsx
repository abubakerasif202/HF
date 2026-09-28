"use client";

import { useState } from "react";

const APPOINTMENT_SRC =
  "https://calendar.google.com/calendar/appointments/schedules/AcZssZ3dL_Ddmh8REqk-avAU1fh0bqZ6gUfKXNbmxzoF-CU2HC81rbt7xn5OP-hDojEsQk34dBT7awiy?gv=true";

/**
 * Google Calendar Appointment Scheduling widget. This is a SUPPLEMENTARY
 * scheduling/contact option, never the booking system of record — the
 * Supabase-backed /book wizard remains the only thing that creates a
 * database hold, locks a vehicle/crew, or confirms a booking. Nothing
 * here writes to `bookings`.
 *
 * Lazy: the iframe only mounts after the person opts in, so it never
 * costs the page a network request or third-party cookie unless used.
 */
export function GoogleAppointmentSchedule() {
  const [expanded, setExpanded] = useState(false);

  return (
    <section aria-labelledby="google-appointment-heading" className="mx-auto w-full max-w-3xl">
      <h2 id="google-appointment-heading" className="text-lg font-semibold">
        Prefer to schedule with our team?
      </h2>
      <p className="mt-1 text-sm text-neutral-500">
        You can also book a time directly on our calendar to talk through your move. This is a scheduling option
        only — to confirm a booking instantly (no advance payment required), use Book Your Move above.
      </p>

      {!expanded ? (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="mt-4 rounded-full border px-5 py-2 text-sm font-medium hover:bg-neutral-50"
        >
          Show scheduling calendar
        </button>
      ) : (
        <div className="mt-4 w-full overflow-hidden rounded-xl border">
          <iframe
            src={APPOINTMENT_SRC}
            title="Book an appointment with HF Removals Adelaide"
            style={{ border: 0 }}
            width="100%"
            height={600}
            loading="lazy"
            className="block h-[600px] w-full min-h-[480px]"
          />
        </div>
      )}
    </section>
  );
}
