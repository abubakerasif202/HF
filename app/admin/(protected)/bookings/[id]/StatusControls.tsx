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
    <div className="a-bk-next">
      <p className="a-bk-next-label">Next step</p>
      {options.map((next, index) => (
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
          className={`admin-btn ${next === "cancelled" ? "admin-btn--danger admin-btn--sm a-bk-next-cancel" : index === 0 ? "admin-btn--primary" : "admin-btn--secondary"}`}
        >
          {next === "cancelled" ? "Cancel booking" : `Mark as ${next.replace(/_/g, " ")}`}
        </button>
      ))}
      {error && <AdminAlert tone="error">{error}</AdminAlert>}
    </div>
  );
}
