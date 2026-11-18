"use client";

import { useTransition } from "react";
import { retryCalendarSyncAction } from "./actions.ts";
import { AdminStatusBadge } from "../../../_components/AdminStatusBadge";
import { Icon } from "../../../_components/Icon";
import type { CalendarSyncReason } from "../../../../../lib/calendar-sync.ts";

interface Props {
  bookingId: string;
  status: string;
  /** Friendly, pre-sanitised summary written by the server — never raw API text. */
  error: string | null;
  /** Whether this booking's state is one that is mirrored to Google. */
  canSync: boolean;
  eventLink: string | null;
  /** Why the calendar is in this state (valid "nothing to sync" vs a real failure). */
  reason: CalendarSyncReason;
}

export function CalendarSyncStatus({ bookingId, status, canSync, eventLink, reason }: Props) {
  const [pending, startTransition] = useTransition();
  const showRetry = canSync && (status === "failed" || status === "pending");

  return (
    <div className="grid gap-3">
      <div className="a-bk-sync">
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
            <Icon name="externalLink" size={14} />Open in Google Calendar
          </a>
        )}
      </div>
      <p className={reason.tone === "failed" ? "text-xs font-semibold text-[var(--admin-danger)]" : "admin-help"} data-sync-tone={reason.tone}>
        <strong>{reason.label}.</strong> {reason.detail}
      </p>
    </div>
  );
}
