"use client";

import { useRef, useTransition } from "react";
import { addInternalNoteAction } from "../../actions.ts";

export function NoteForm({ bookingId }: { bookingId: string }) {
  const [pending, startTransition] = useTransition();
  const ref = useRef<HTMLTextAreaElement>(null);

  return (
    <form
      className="mt-3 flex gap-2"
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
      <textarea ref={ref} rows={2} placeholder="Add an internal note (never shown to the customer)" className="flex-1 rounded-lg border px-3 py-2 text-sm" />
      <button type="submit" disabled={pending} className="rounded-full border px-4 py-2 text-sm">Add</button>
    </form>
  );
}
