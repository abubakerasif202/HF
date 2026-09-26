"use client";

import { useTransition } from "react";
import { setVehicleActiveAction } from "./actions.ts";

export function VehicleToggle({ vehicleId, active }: { vehicleId: string; active: boolean }) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => startTransition(() => setVehicleActiveAction(vehicleId, !active))}
      className="admin-btn admin-btn--secondary admin-btn--sm"
    >
      {pending ? "Saving…" : active ? "Deactivate" : "Activate"}
    </button>
  );
}
