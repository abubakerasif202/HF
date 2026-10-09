"use client";

import { useState, useTransition } from "react";
import { deleteBlockedTimeAction } from "./actions.ts";
import { ConfirmationDialog } from "../../_components/ConfirmationDialog";
import { Icon } from "../../_components/Icon";

export function DeleteBlockedTimeButton({ id, summary }: { id: string; summary?: string }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function confirmRemove() {
    startTransition(async () => {
      await deleteBlockedTimeAction(id);
      setOpen(false);
    });
  }

  return (
    <>
      <button type="button" disabled={pending} onClick={() => setOpen(true)} className="admin-btn admin-btn--danger a-av-remove" aria-haspopup="dialog">
        <Icon name="trash" size={15} />
        {pending ? "Removing…" : "Remove"}
      </button>
      <span className="sr-only" role="status" aria-live="polite">{pending ? "Removing blocked time" : ""}</span>
      <ConfirmationDialog
        open={open}
        title="Remove this blocked time?"
        confirmLabel="Remove block"
        destructive
        pending={pending}
        onConfirm={confirmRemove}
        onCancel={() => setOpen(false)}
      >
        {summary ? <strong>{summary}</strong> : null}
        {summary ? " " : null}
        Once removed, this time can be booked online again wherever nothing else is scheduled.
      </ConfirmationDialog>
    </>
  );
}
