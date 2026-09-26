"use client";

import { useTransition } from "react";
import { retryCalendarSyncAction } from "./actions.ts";

export function CalendarSyncStatus({ bookingId, status, error }: { bookingId: string; status: string; error: string | null }) {
  const [pending, startTransition] = useTransition();
  const label: Record<string, string> = { synced: "Synced", pending: "Pending", failed: "Failed", not_applicable: "Disabled (Google Calendar not configured)" };

  return (
    <div className="flex items-center gap-3 text-sm">
      <span>{label[status] ?? status}</span>
      {error && <span className="text-xs text-red-600">{error}</span>}
      {status === "failed" && (
        <button disabled={pending} onClick={() => startTransition(() => retryCalendarSyncAction(bookingId))} className="rounded-full border px-3 py-1 text-xs">
          {pending ? "Retrying…" : "Retry sync"}
        </button>
      )}
    </div>
  );
}
