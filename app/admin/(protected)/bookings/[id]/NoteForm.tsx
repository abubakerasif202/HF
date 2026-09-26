"use client";

import { useRef, useTransition } from "react";
import { addInternalNoteAction } from "../../../actions.ts";

export function NoteForm({ bookingId }: { bookingId: string }) {
  const [pending, startTransition] = useTransition();
  const ref = useRef<HTMLTextAreaElement>(null);

  return (
    <form
      className="mt-4 grid gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        const note = ref.current?.value.trim();
        if (!note) return;
        startTransition(async () => {
          await addInternalNoteAction(bookingId, note);
          if (ref.current) ref.current.value = "";
        });
      }}
    >
      <label className="admin-field">
        <span className="admin-label">Add a note</span>
        <textarea ref={ref} rows={3} placeholder="Access details, customer requests, follow-ups…" className="admin-input" />
      </label>
      <div>
        <button type="submit" disabled={pending} className="admin-btn admin-btn--secondary admin-btn--sm">
          {pending ? "Saving…" : "Add note"}
        </button>
      </div>
    </form>
  );
}
