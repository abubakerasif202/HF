"use client";

import Link from "next/link";
import { useId, useState, useTransition } from "react";
import { AdminAlert, formatAdelaide } from "../../_components/ui";
import { AdminStatusBadge } from "../../_components/AdminStatusBadge";
import { ConfirmationDialog } from "../../_components/ConfirmationDialog";
import { Icon } from "../../_components/Icon";
import { createInvoiceDraftAction } from "../invoices/actions";
import { cancelCloseoutJobAction, finaliseCloseoutJobAction } from "./actions";
import { MAX_ACTUAL_MINUTES, type CloseoutCancelReason } from "../../../../lib/admin/closeout.ts";

export interface CloseoutRowJob {
  id: string;
  bookingNumber: string;
  endsAt: string;
  status: string;
  customerName: string | null;
  customerPhone: string | null;
  route: string;
  daysOverdue: number;
  estimatedDurationMinutes: number | null;
  crewAssigned: boolean;
  invoice: { id: string; status: string; invoiceNumber: string | null } | null;
}

type Pending = { kind: "finalise"; minutes: number } | { kind: "cancel"; reason: CloseoutCancelReason } | null;

export function CloseoutRow({ job }: { job: CloseoutRowJob }) {
  const inputId = useId();
  const [minutes, setMinutes] = useState("");
  const [pendingAction, setPendingAction] = useState<Pending>(null);
  const [error, setError] = useState<string | null>(null);
  const [working, startTransition] = useTransition();
  const [creating, startInvoice] = useTransition();

  const value = Number(minutes);
  const minutesValid = Number.isInteger(value) && value >= 1 && value <= MAX_ACTUAL_MINUTES;

  function run() {
    const action = pendingAction;
    if (!action) return;
    setError(null);
    startTransition(async () => {
      const result = action.kind === "finalise"
        ? await finaliseCloseoutJobAction(job.id, action.minutes)
        : await cancelCloseoutJobAction(job.id, action.reason);
      setPendingAction(null);
      if (result?.error) setError(result.error);
    });
  }

  const overdue = job.daysOverdue === 0 ? "Ended today" : `${job.daysOverdue} ${job.daysOverdue === 1 ? "day" : "days"} overdue`;

  return (
    <li className="a-closeout-row">
      <div className="a-closeout-main">
        <div className="a-closeout-title">
          <Link href={`/admin/bookings/${job.id}`} className="admin-link a-id">{job.bookingNumber}</Link>
          <span>{job.customerName || "Customer"}</span>
          <AdminStatusBadge status={job.status} />
        </div>
        <div className="a-closeout-route">{job.route}</div>
        <div className="a-closeout-meta">
          <span><Icon name="clock" size={13} />Ended {formatAdelaide(job.endsAt, { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}</span>
          <span className="a-closeout-age" data-stale={job.daysOverdue >= 7}>{overdue}</span>
          <span data-missing={!job.crewAssigned}><Icon name="crew" size={13} />{job.crewAssigned ? "Crew assigned" : "No crew recorded"}</span>
          {job.customerPhone && <a className="admin-link" href={`tel:${job.customerPhone.replace(/[^\d+]/g, "")}`}><Icon name="phone" size={13} />{job.customerPhone}</a>}
        </div>
      </div>

      <div className="a-closeout-actions">
        <div className="a-closeout-finalise">
          <label className="admin-field" htmlFor={inputId}>
            <span className="admin-label">Actual time (minutes)</span>
            <input
              id={inputId}
              className="admin-input"
              type="number"
              inputMode="numeric"
              min={1}
              max={MAX_ACTUAL_MINUTES}
              placeholder={job.estimatedDurationMinutes ? `Booked ${job.estimatedDurationMinutes}` : "e.g. 240"}
              value={minutes}
              onChange={(event) => setMinutes(event.target.value)}
              aria-describedby={`${inputId}-help`}
            />
          </label>
          <button type="button" className="admin-btn admin-btn--primary" disabled={!minutesValid || working} onClick={() => setPendingAction({ kind: "finalise", minutes: value })}>
            <Icon name="check" size={16} />Finalise
          </button>
        </div>
        <p id={`${inputId}-help`} className="admin-help">Time on the job only. The price is recalculated from this booking&apos;s locked snapshot.</p>

        <div className="a-closeout-secondary">
          {job.invoice ? (
            <Link href={`/admin/invoices/${job.invoice.id}`} className="admin-btn admin-btn--secondary admin-btn--sm">
              <Icon name="dollar" size={15} />{job.invoice.status === "draft" ? "Continue invoice draft" : `Invoice ${job.invoice.invoiceNumber ?? ""}`.trim()}
            </Link>
          ) : (
            <button
              type="button"
              className="admin-btn admin-btn--secondary admin-btn--sm"
              disabled={creating || working}
              onClick={() => {
                setError(null);
                startInvoice(async () => {
                  const result = await createInvoiceDraftAction(job.id);
                  if (result?.error) setError(result.error);
                });
              }}
            >
              <Icon name="plus" size={15} />{creating ? "Creating draft…" : "Create invoice"}
            </button>
          )}
          <button type="button" className="admin-btn admin-btn--secondary admin-btn--sm" disabled={working} onClick={() => setPendingAction({ kind: "cancel", reason: "no_show" })}>
            <Icon name="ban" size={15} />No-show
          </button>
          <button type="button" className="admin-btn admin-btn--danger admin-btn--sm" disabled={working} onClick={() => setPendingAction({ kind: "cancel", reason: "cancelled" })}>
            <Icon name="x" size={15} />Cancel booking
          </button>
        </div>
        {error && <AdminAlert tone="error">{error}</AdminAlert>}
      </div>

      <ConfirmationDialog
        open={pendingAction !== null}
        title={pendingAction?.kind === "finalise" ? `Finalise ${job.bookingNumber}?` : pendingAction?.reason === "no_show" ? `Mark ${job.bookingNumber} as a no-show?` : `Cancel ${job.bookingNumber}?`}
        confirmLabel={pendingAction?.kind === "finalise" ? "Finalise job" : pendingAction?.reason === "no_show" ? "Mark no-show" : "Cancel booking"}
        cancelLabel="Back"
        destructive={pendingAction?.kind === "cancel"}
        pending={working}
        onConfirm={run}
        onCancel={() => setPendingAction(null)}
      >
        {pendingAction?.kind === "finalise"
          ? `This records ${pendingAction.minutes} actual minutes, calculates the final price and marks the booking completed.${job.status !== "in_progress" ? " The booking is first moved to in progress so the status history stays valid." : ""}`
          : "The booking moves to cancelled and its calendar event is removed. This cannot be undone."}
      </ConfirmationDialog>
    </li>
  );
}
