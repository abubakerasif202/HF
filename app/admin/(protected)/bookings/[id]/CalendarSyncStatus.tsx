"use client";

import { useTransition } from "react";
import { retryCalendarSyncAction } from "./actions.ts";
import { AdminStatusBadge } from "../../../_components/AdminStatusBadge";
import { Icon } from "../../../_components/Icon";

export function CalendarSyncStatus({ bookingId, status, error }: { bookingId: string; status: string; error: string | null }) {
  const [pending, startTransition] = useTransition();

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <AdminStatusBadge kind="sync" status={status} />
        {status === "failed" && (
          <button
            type="button"
            disabled={pending}
            onClick={() => startTransition(() => retryCalendarSyncAction(bookingId))}
            className="admin-btn admin-btn--primary admin-btn--sm"
          >
            <Icon name="sync" size={15} />
            {pending ? "Retrying…" : "Retry calendar sync"}
          </button>
        )}
      </div>
      {status === "not_applicable" && <p className="admin-help">Google Calendar isn&apos;t connected, so bookings aren&apos;t copied to it.</p>}
      {error && <p className="text-xs font-semibold text-[var(--admin-danger)]">{error}</p>}
    </div>
  );
}
