"use client";

import { useState, useTransition } from "react";
import { rescheduleBookingAction } from "./actions.ts";

export function RescheduleForm({ bookingId, currentStartsAt }: { bookingId: string; currentStartsAt: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [value, setValue] = useState("");

  return (
    <form
      className="mt-3 flex flex-wrap items-end gap-2"
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
      <label className="text-sm">
        Reschedule to
        <input type="datetime-local" value={value} onChange={(e) => setValue(e.target.value)} className="mt-1 block rounded-lg border px-3 py-2" />
      </label>
      <button type="submit" disabled={pending || !value} className="rounded-full border px-4 py-2 text-sm disabled:opacity-40">
        {pending ? "Checking availability…" : "Reschedule"}
      </button>
      {error && <p className="w-full text-xs text-red-600">{error}</p>}
      <p className="w-full text-xs text-neutral-400">Current: {new Date(currentStartsAt).toLocaleString("en-AU", { timeZone: "Australia/Adelaide" })}. This re-checks availability before moving the booking; it does not currently email the customer automatically.</p>
    </form>
  );
}
