"use client";

import { useTransition } from "react";
import { setCrewActiveAction, setCrewMemberActiveAction } from "./actions.ts";

export function CrewToggle({ crewId, active }: { crewId: string; active: boolean }) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => startTransition(() => setCrewActiveAction(crewId, !active))}
      className="admin-btn admin-btn--secondary admin-btn--sm"
    >
      {pending ? "Saving…" : active ? "Deactivate crew" : "Activate crew"}
    </button>
  );
}

export function CrewMemberToggle({ memberId, active, name }: { memberId: string; active: boolean; name: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => startTransition(() => setCrewMemberActiveAction(memberId, !active))}
      className="admin-btn admin-btn--ghost admin-btn--sm"
      aria-label={`${active ? "Deactivate" : "Activate"} ${name}`}
    >
      {pending ? "Saving…" : active ? "Deactivate" : "Activate"}
    </button>
  );
}
