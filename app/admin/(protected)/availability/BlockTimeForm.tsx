"use client";

import { useState } from "react";
import { createBlockedTimeAction } from "./actions.ts";
import { Icon, type IconName } from "../../_components/Icon";

interface Resource {
  id: string;
  name: string;
}

type Scope = "all" | "vehicle" | "crew";

const SCOPES: { value: Scope; label: string; hint: string; icon: IconName }[] = [
  { value: "all", label: "Entire business", hint: "No bookings at all", icon: "ban" },
  { value: "vehicle", label: "A vehicle", hint: "e.g. servicing", icon: "truck" },
  { value: "crew", label: "A crew", hint: "e.g. leave", icon: "crew" },
];

/**
 * Posts the same fields the server action has always read (starts_at,
 * ends_at, scope, resource_id, reason). The only change is that the
 * resource picker now lists only vehicles OR crews to match the chosen
 * scope, so a crew can no longer be picked for a vehicle block.
 */
export function BlockTimeForm({ vehicles, crews }: { vehicles: Resource[]; crews: Resource[] }) {
  const [scope, setScope] = useState<Scope>("all");
  const resources = scope === "vehicle" ? vehicles : scope === "crew" ? crews : [];

  return (
    <form action={createBlockedTimeAction} className="grid gap-4">
      <fieldset className="admin-fieldset">
        <legend className="admin-label mb-2">What are you blocking?</legend>
        <div className="grid gap-2">
          {SCOPES.map((option) => (
            <label key={option.value} className="admin-check items-center">
              <input type="radio" name="scope" value={option.value} checked={scope === option.value} onChange={() => setScope(option.value)} />
              <span>
                <span className="flex items-center gap-1.5"><Icon name={option.icon} size={15} />{option.label}</span>
                <span className="admin-help block font-medium">{option.hint}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      {scope !== "all" && (
        <label className="admin-field">
          <span className="admin-label">{scope === "vehicle" ? "Vehicle" : "Crew"}</span>
          <select name="resource_id" required className="admin-input" defaultValue="" key={scope}>
            <option value="" disabled>Select a {scope === "vehicle" ? "vehicle" : "crew"}…</option>
            {resources.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        </label>
      )}

      <div className="admin-form-grid">
        <label className="admin-field">
          <span className="admin-label">Start</span>
          <input type="datetime-local" name="starts_at" required className="admin-input" />
        </label>
        <label className="admin-field">
          <span className="admin-label">End</span>
          <input type="datetime-local" name="ends_at" required className="admin-input" />
        </label>
      </div>

      <label className="admin-field">
        <span className="admin-label">Reason</span>
        <input name="reason" required placeholder="e.g. Truck maintenance" className="admin-input" />
        <span className="admin-help">Visible to staff only, never to customers.</span>
      </label>

      <div>
        <button type="submit" className="admin-btn admin-btn--primary">
          <Icon name="plus" size={16} />
          Create block
        </button>
      </div>
    </form>
  );
}
