"use client";

import { useTransition } from "react";
import { deleteBlockedTimeAction } from "./actions.ts";

export function DeleteBlockedTimeButton({ id }: { id: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      disabled={pending}
      onClick={() => {
        if (confirm("Remove this blocked time?")) startTransition(() => deleteBlockedTimeAction(id));
      }}
      className="text-xs text-red-600 underline"
    >
      Remove
    </button>
  );
}
