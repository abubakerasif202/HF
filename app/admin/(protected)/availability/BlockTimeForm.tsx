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
  const noun = scope === "vehicle" ? "vehicle" : "crew";

  return (
    <form action={createBlockedTimeAction} className="a-av-form">
      <fieldset className="a-av-scope">
        <legend className="admin-label">What are you blocking?</legend>
        <div className="a-av-scope-grid">
          {SCOPES.map((option) => (
            <label key={option.value} className="a-av-scope-option" data-checked={scope === option.value}>
              <input type="radio" name="scope" value={option.value} checked={scope === option.value} onChange={() => setScope(option.value)} />
              <span className="a-av-scope-icon"><Icon name={option.icon} size={18} /></span>
              <span className="a-av-scope-text">
                <span className="a-av-scope-label">{option.label}</span>
                <span className="a-av-scope-hint">{option.hint}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      {scope !== "all" && (
        <label className="admin-field">
          <span className="admin-label">{scope === "vehicle" ? "Vehicle" : "Crew"}</span>
          <select name="resource_id" required className="admin-input" defaultValue="" key={scope}>
            <option value="" disabled>Select a {noun}…</option>
            {resources.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
          {resources.length === 0 && <span className="admin-help">There are no active {noun === "vehicle" ? "vehicles" : "crews"} to block.</span>}
        </label>
      )}

      <div className="a-av-when">
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

      <button type="submit" className="admin-btn admin-btn--primary a-av-submit">
        <Icon name="plus" size={16} />
        Create block
      </button>
    </form>
  );
}
