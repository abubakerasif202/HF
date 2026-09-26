"use client";

import { useTransition } from "react";
import { setVehicleActiveAction } from "./actions.ts";

export function VehicleToggle({ vehicleId, active }: { vehicleId: string; active: boolean }) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      disabled={pending}
      onClick={() => startTransition(() => setVehicleActiveAction(vehicleId, !active))}
      className={`rounded-full px-3 py-1 text-xs ${active ? "bg-green-100 text-green-700" : "bg-neutral-100 text-neutral-500"}`}
    >
      {active ? "Active" : "Inactive"}
    </button>
  );
}
