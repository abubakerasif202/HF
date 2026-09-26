"use client";

import { useState, useTransition } from "react";
import { finalizeJobAction } from "./actions.ts";

export function FinalizeJobForm({ bookingId, bookingStatus }: { bookingId: string; bookingStatus: string }) {
  const [minutes, setMinutes] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (bookingStatus !== "in_progress") {
    return (
      <p className="text-xs text-neutral-400">
        Job finalisation is available once the booking is marked &quot;in progress&quot;.
      </p>
    );
  }

  return (
    <form
      className="flex flex-wrap items-end gap-2"
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
      <label className="text-sm">
        Actual job duration (minutes)
        <input type="number" min={1} value={minutes} onChange={(e) => setMinutes(e.target.value)} required className="mt-1 block w-40 rounded-lg border px-3 py-2" />
      </label>
      <button type="submit" disabled={pending} className="rounded-full bg-neutral-900 px-4 py-2 text-sm text-white disabled:opacity-40">
        {pending ? "Calculating…" : "Complete Job"}
      </button>
      {error && <p className="w-full text-xs text-red-600">{error}</p>}
      <p className="w-full text-xs text-neutral-400">
        The final price is calculated server-side from this booking&apos;s frozen pricing snapshot — never from live
        rates, and never from a client-supplied dollar amount.
      </p>
    </form>
  );
}
