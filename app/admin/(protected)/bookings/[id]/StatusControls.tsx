"use client";

import { useState, useTransition } from "react";
import { transitionBookingStatusAction } from "./actions.ts";
import type { BookingStatus } from "../../../../../lib/booking/types.ts";
import { AdminAlert } from "../../../_components/ui";

const NEXT_STATUS_OPTIONS: Record<string, BookingStatus[]> = {
  confirmed: ["assigned", "cancelled"],
  assigned: ["in_progress", "cancelled"],
  in_progress: ["completed", "cancelled"],
  held: ["cancelled"],
  pending_payment: ["cancelled"],
};

export function StatusControls({ bookingId, currentStatus }: { bookingId: string; currentStatus: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const options = NEXT_STATUS_OPTIONS[currentStatus] ?? [];

  if (options.length === 0) return null;

  return (
    <div className="mt-4 flex flex-wrap items-center gap-2">
      {options.map((next) => (
        <button
          key={next}
          type="button"
          disabled={pending}
          onClick={() => {
            if (next === "cancelled" && !confirm("Cancel this booking?")) return;
            setError(null);
            startTransition(async () => {
              const result = await transitionBookingStatusAction(bookingId, next);
              if (result?.error) setError(result.error);
            });
          }}
          className={`admin-btn admin-btn--sm ${next === "cancelled" ? "admin-btn--danger" : "admin-btn--secondary"}`}
        >
          {next === "cancelled" ? "Cancel booking" : `Mark as ${next.replace(/_/g, " ")}`}
        </button>
      ))}
      {error && <div className="w-full"><AdminAlert tone="error">{error}</AdminAlert></div>}
    </div>
  );
}
