"use client";

import { useTransition } from "react";
import { retryCalendarSyncAction } from "./actions.ts";
import { AdminStatusBadge } from "../../../_components/AdminStatusBadge";
import { Icon } from "../../../_components/Icon";

interface Props {
  bookingId: string;
  status: string;
  /** Friendly, pre-sanitised summary written by the server — never raw API text. */
  error: string | null;
  /** Whether this booking's state is one that is mirrored to Google. */
  canSync: boolean;
  eventLink: string | null;
}

export function CalendarSyncStatus({ bookingId, status, error, canSync, eventLink }: Props) {
  const [pending, startTransition] = useTransition();
  const showRetry = canSync && (status === "failed" || status === "pending");

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <AdminStatusBadge kind="sync" status={status} />
        {showRetry && (
          <button
            type="button"
            disabled={pending}
            onClick={() => startTransition(() => retryCalendarSyncAction(bookingId))}
            className="admin-btn admin-btn--primary admin-btn--sm"
          >
            <Icon name="sync" size={15} />
            {pending ? "Retrying…" : "Retry sync"}
          </button>
        )}
        {eventLink && (
          <a href={eventLink} target="_blank" rel="noopener noreferrer" className="admin-link text-sm font-semibold">
            Open in Google Calendar
          </a>
        )}
      </div>
      {status === "not_applicable" && (
        <p className="admin-help">Google Calendar isn&apos;t connected, so bookings aren&apos;t mirrored to it. Bookings work normally without it.</p>
      )}
      {status === "failed" && error && <p className="text-xs font-semibold text-[var(--admin-danger)]">{error}</p>}
    </div>
  );
}
