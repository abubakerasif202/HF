import { useId, useState, type FormEvent } from "react";
import { instantToZonedParts, zonedWallTimeToInstant } from "../../../../lib/booking/timezone.ts";
import type { DispatchBooking } from "./DispatchClient";

interface Resource { id: string; name: string }
interface Props {
  booking: DispatchBooking;
  crews: Resource[];
  vehicles: Resource[];
  timezone: string;
  onSaved: (message: string) => void;
}

function wallTime(value: string, timezone: string): string {
  const p = instantToZonedParts(new Date(value), timezone);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${p.year}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}`;
}

export function buildDispatchPatch(data: FormData, booking: DispatchBooking, timezone: string): Record<string, unknown> {
  const text = (key: string) => String(data.get(key) ?? "").trim();
  const number = (key: string) => text(key) === "" ? null : Number(text(key));
  const boolean = (key: string) => text(key) === "" ? null : text(key) === "true";
  const checklist = text("checklist").split("\n").map((label) => label.trim()).filter(Boolean).map((label, index) => {
    const existing = booking.dispatch_checklist.find((item) => item.label === label);
    return { id: existing?.id ?? `new-${Date.now()}-${index}`, label, done: existing ? data.has(`done-${existing.id}`) : false };
  });
  const patch: Record<string, unknown> = {
    bookingId: booking.id, crewId: text("crewId") || null, vehicleId: text("vehicleId") || null,
    additionalVehicleIds: data.getAll("additionalVehicleIds").map(String), truckCount: number("truckCount"),
    durationMinutes: number("durationMinutes"), travelMinutes: number("travelMinutes"),
    overnight: boolean("overnight"), truckLeftOnsite: boolean("truckLeftOnsite"),
    pricingType: text("pricingType") || null, fixedPriceCents: text("fixedPrice") ? Math.round(Number(text("fixedPrice")) * 100) : null,
    customerRequirements: text("customerRequirements").split("\n").map((line) => line.trim()).filter(Boolean),
    checklist, customerNotes: text("customerNotes") || null, internalNotes: text("internalNotes") || null,
  };
  if (text("startsAt") !== wallTime(booking.starts_at, timezone) || text("endsAt") !== wallTime(booking.ends_at, timezone)) {
    for (const field of ["startsAt", "endsAt"] as const) {
      const parts = text(field).split(/[-T:]/).map(Number);
      patch[field] = zonedWallTimeToInstant(parts[0], parts[1], parts[2], parts[3], parts[4], timezone).toISOString();
    }
  }
  return patch;
}

export function DispatchEditor({ booking, crews, vehicles, timezone, onSaved }: Props) {
  const id = useId();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setSaving(true); setError(""); setSaved("");
    try {
      const response = await fetch("/api/admin/dispatch", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(buildDispatchPatch(new FormData(event.currentTarget), booking, timezone)) });
      const result = await response.json() as { error?: string; warning?: string };
      if (!response.ok) throw new Error(result.error ?? "Dispatch update failed.");
      const message = result.warning ?? "Dispatch saved.";
      setSaved(message); onSaved(message);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Dispatch update failed.");
    } finally { setSaving(false); }
  }
  const nullableBoolean = (name: string, label: string, value: boolean | null) => (
    <label className="admin-field"><span className="admin-label">{label}</span><select className="admin-input" name={name} defaultValue={value === null ? "" : String(value)}><option value="">Not recorded</option><option value="true">Yes</option><option value="false">No</option></select></label>
  );
  const resourceOptions = (options: Resource[], current: string | null) => <>{current && !options.some((item) => item.id === current) && <option value={current}>Previously assigned resource</option>}{options.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</>;
  return (
    <details className="a-dispatch-editor">
      <summary>Edit dispatch</summary>
      <form onSubmit={(event) => void save(event)} aria-labelledby={`${id}-title`}>
        <h3 id={`${id}-title`}>Dispatch · {booking.booking_number}</h3>
        <p className="admin-help">Times are in {timezone}. Set the actual occupied end time for overnight work or a truck remaining onsite. Flags and travel minutes alone do not extend the reservation. Pricing labels do not change the existing quote or payment record.</p>
        <fieldset disabled={saving} className="a-dispatch-editor-fields">
          <legend className="admin-label">Schedule and allocation</legend>
          <label className="admin-field"><span className="admin-label">Occupied start</span><input className="admin-input" name="startsAt" type="datetime-local" required defaultValue={wallTime(booking.starts_at, timezone)} /></label>
          <label className="admin-field"><span className="admin-label">Occupied end</span><input className="admin-input" name="endsAt" type="datetime-local" required defaultValue={wallTime(booking.ends_at, timezone)} /></label>
          <label className="admin-field"><span className="admin-label">Job duration (minutes)</span><input className="admin-input" name="durationMinutes" type="number" required min="1" max="1440" defaultValue={booking.estimated_duration_minutes} /></label>
          <label className="admin-field"><span className="admin-label">Travel (minutes)</span><input className="admin-input" name="travelMinutes" type="number" min="0" max="1440" defaultValue={booking.dispatch_travel_minutes ?? ""} /></label>
          <label className="admin-field"><span className="admin-label">Subcontractor crew</span><select className="admin-input" name="crewId" defaultValue={booking.crew_id ?? ""}><option value="">Unassigned</option>{resourceOptions(crews, booking.crew_id)}</select></label>
          <label className="admin-field"><span className="admin-label">Trucks required</span><input className="admin-input" name="truckCount" type="number" min="1" max="4" defaultValue={booking.dispatch_truck_count ?? ""} /></label>
          <label className="admin-field"><span className="admin-label">Primary truck</span><select className="admin-input" name="vehicleId" defaultValue={booking.vehicle_id ?? ""}><option value="">Unassigned</option>{resourceOptions(vehicles, booking.vehicle_id)}</select></label>
          <fieldset className="a-dispatch-editor-trucks"><legend className="admin-label">Additional trucks</legend>{[...vehicles, ...booking.dispatch_additional_vehicle_ids.filter((vehicleId) => !vehicles.some((vehicle) => vehicle.id === vehicleId)).map((vehicleId) => ({ id: vehicleId, name: "Previously assigned truck" }))].map((vehicle) => <label key={vehicle.id}><input type="checkbox" name="additionalVehicleIds" value={vehicle.id} defaultChecked={booking.dispatch_additional_vehicle_ids.includes(vehicle.id)} />{vehicle.name}</label>)}</fieldset>
          {nullableBoolean("overnight", "Overnight work", booking.dispatch_overnight)}
          {nullableBoolean("truckLeftOnsite", "Truck remains onsite", booking.dispatch_truck_left_onsite)}
          <label className="admin-field"><span className="admin-label">Pricing label</span><select className="admin-input" name="pricingType" defaultValue={booking.dispatch_pricing_type ?? ""}><option value="">Not recorded</option><option value="fixed">Fixed</option><option value="hourly">Hourly</option></select></label>
          <label className="admin-field"><span className="admin-label">Recorded fixed price (AUD)</span><input className="admin-input" name="fixedPrice" type="number" min="0" step="0.01" defaultValue={booking.dispatch_fixed_price_cents === null ? "" : (booking.dispatch_fixed_price_cents / 100).toFixed(2)} /></label>
          <label className="admin-field a-dispatch-editor-wide"><span className="admin-label">Customer requirements (one per line)</span><textarea className="admin-input" name="customerRequirements" rows={3} defaultValue={booking.dispatch_customer_requirements.join("\n")} /></label>
          <label className="admin-field a-dispatch-editor-wide"><span className="admin-label">Checklist items (one per line)</span><textarea className="admin-input" name="checklist" rows={3} defaultValue={booking.dispatch_checklist.map((item) => item.label).join("\n")} /></label>
          {booking.dispatch_checklist.length > 0 && <fieldset className="a-dispatch-editor-trucks a-dispatch-editor-wide"><legend className="admin-label">Completed checklist items</legend>{booking.dispatch_checklist.map((item) => <label key={item.id}><input type="checkbox" name={`done-${item.id}`} defaultChecked={item.done} />{item.label}</label>)}</fieldset>}
          <label className="admin-field a-dispatch-editor-wide"><span className="admin-label">Customer notes</span><textarea className="admin-input" name="customerNotes" rows={3} maxLength={3000} defaultValue={booking.customer_notes ?? ""} /></label>
          <label className="admin-field a-dispatch-editor-wide"><span className="admin-label">Internal notes</span><textarea className="admin-input" name="internalNotes" rows={3} maxLength={5000} defaultValue={booking.internal_notes ?? ""} /></label>
        </fieldset>
        {error && <p className="a-dispatch-warning" role="alert">{error}</p>}
        {saved && <p className="admin-help" role="status">{saved}</p>}
        <button className="admin-btn admin-btn--primary" type="submit" disabled={saving}>{saving ? "Saving…" : "Save dispatch"}</button>
      </form>
    </details>
  );
}
