"use client";

import { useTransition } from "react";
import { setCrewActiveAction, setCrewMemberActiveAction } from "./actions.ts";

export function CrewToggle({ crewId, active }: { crewId: string; active: boolean }) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      disabled={pending}
      onClick={() => startTransition(() => setCrewActiveAction(crewId, !active))}
      className={`rounded-full px-3 py-1 text-xs ${active ? "bg-green-100 text-green-700" : "bg-neutral-100 text-neutral-500"}`}
    >
      {active ? "Active" : "Inactive"}
    </button>
  );
}

export function CrewMemberToggle({ memberId, active }: { memberId: string; active: boolean }) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      disabled={pending}
      onClick={() => startTransition(() => setCrewMemberActiveAction(memberId, !active))}
      className={`text-xs underline ${active ? "text-neutral-500" : "text-neutral-300"}`}
    >
      {active ? "active" : "inactive"}
    </button>
  );
}
