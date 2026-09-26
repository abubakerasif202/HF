"use client";

import { useState, useTransition } from "react";
import { finalizeJobAction } from "./actions.ts";
import { AdminAlert } from "../../../_components/ui";

export function FinalizeJobForm({ bookingId, bookingStatus }: { bookingId: string; bookingStatus: string }) {
  const [minutes, setMinutes] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (bookingStatus !== "in_progress") {
    return (
      <AdminAlert tone="info">
        Job completion becomes available once the booking is marked &quot;in progress&quot;.
      </AdminAlert>
    );
  }

  return (
    <form
      className="grid gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        const value = Number(minutes);
        if (!value) return;
        if (!confirm(`Finalise this job at ${value} actual minutes? This calculates the final price and marks the booking completed.`)) return;
        setError(null);
        startTransition(async () => {
          const result = await finalizeJobAction(bookingId, value);
          if (result?.error) setError(result.error);
        });
      }}
    >
      <div className="flex flex-wrap items-end gap-3">
        <label className="admin-field w-full sm:w-56">
          <span className="admin-label">Actual service time (minutes)</span>
          <input type="number" min={1} inputMode="numeric" value={minutes} onChange={(e) => setMinutes(e.target.value)} required className="admin-input" />
        </label>
        <button type="submit" disabled={pending} className="admin-btn admin-btn--primary">
          {pending ? "Calculating…" : "Complete Job"}
        </button>
      </div>
      {error && <AdminAlert tone="error">{error}</AdminAlert>}
      <p className="admin-help">
        Enter the actual time on the job only — the 1-hour call-out is added separately. Billable time is never less than the
        3-hour minimum. The final price is calculated server-side from this booking&apos;s locked pricing snapshot.
      </p>
    </form>
  );
}
