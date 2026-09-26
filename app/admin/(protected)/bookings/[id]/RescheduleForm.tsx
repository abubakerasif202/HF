"use client";

import { useState, useTransition } from "react";
import { rescheduleBookingAction } from "./actions.ts";
import { AdminAlert, formatAdelaide } from "../../../_components/ui";

export function RescheduleForm({ bookingId, currentStartsAt }: { bookingId: string; currentStartsAt: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [value, setValue] = useState("");

  return (
    <form
      className="mt-4 grid gap-3 border-t pt-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (!value) return;
        setError(null);
        startTransition(async () => {
          const result = await rescheduleBookingAction(bookingId, new Date(value).toISOString());
          if (result?.error) setError(result.error);
        });
      }}
    >
      <div className="flex flex-wrap items-end gap-3">
        <label className="admin-field min-w-[220px] flex-1">
          <span className="admin-label">Reschedule to</span>
          <input type="datetime-local" value={value} onChange={(e) => setValue(e.target.value)} className="admin-input" />
        </label>
        <button type="submit" disabled={pending || !value} className="admin-btn admin-btn--primary">
          {pending ? "Checking availability…" : "Reschedule"}
        </button>
      </div>
      {error && <AdminAlert tone="error">{error}</AdminAlert>}
      <p className="admin-help">
        Current: {formatAdelaide(currentStartsAt)}. Availability is re-checked before the booking moves. The customer is not emailed automatically.
      </p>
    </form>
  );
}
