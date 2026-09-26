"use client";

import { useTransition } from "react";
import { deleteBlockedTimeAction } from "./actions.ts";

export function DeleteBlockedTimeButton({ id }: { id: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (confirm("Remove this blocked time?")) startTransition(() => deleteBlockedTimeAction(id));
      }}
      className="admin-btn admin-btn--danger admin-btn--sm"
    >
      {pending ? "Removing…" : "Remove"}
    </button>
  );
}
