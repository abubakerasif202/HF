"use client";

import { useState, type FormEvent } from "react";
import { AdminAlert } from "../../_components/ui";
import { ADMIN_TIME_ZONE } from "../../../../lib/admin/dates";
import { zonedWallTimeToInstant } from "../../../../lib/booking/timezone";
import { isBookablePackageId, movingPackages } from "../../../../lib/site-data";
import { field, hasValue, type Quote } from "./quoteTypes";

const SERVICES = [
  { slug: "residential-removals", label: "Residential removals" },
  { slug: "furniture-removals", label: "Furniture removals" },
  { slug: "office-commercial-removals", label: "Office & commercial removals" },
];

function ymdFrom(value: string): string {
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(value);
  return match ? match[1] : "";
}

function optional(value: string): string {
  return hasValue(value) ? value : "";
}

/** Prefilled booking-draft form. Submits to the owner-only convert route, which re-validates everything server-side. */
export function ConvertToBookingForm({ quote, onConverted, onCancel }: {
  quote: Quote;
  onConverted: (quote: Quote, bookingNumber: string) => void;
  onCancel: () => void;
}) {
  const suggestedPackage = field(quote, "truck_package_id");
  const [name, setName] = useState(optional(field(quote, "name")));
  const [email, setEmail] = useState(optional(field(quote, "email")));
  const [phone, setPhone] = useState(optional(field(quote, "phone")));
  const [serviceSlug, setServiceSlug] = useState(SERVICES[0].slug);
  const [packageId, setPackageId] = useState(isBookablePackageId(suggestedPackage) ? suggestedPackage : "");
  const [date, setDate] = useState(ymdFrom(field(quote, "preferred_moving_date")));
  const [time, setTime] = useState("08:00");
  const [duration, setDuration] = useState("");
  const [pickup, setPickup] = useState({ addressLine: optional(field(quote, "moving_from")), suburb: "", state: "SA", postcode: "" });
  const [dropoff, setDropoff] = useState({ addressLine: optional(field(quote, "moving_to")), suburb: "", state: "SA", postcode: "" });
  const [notes, setNotes] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    const [year, month, day] = date.split("-").map(Number);
    const [hour, minute] = time.split(":").map(Number);
    if (!year || !month || !day || !Number.isFinite(hour) || !Number.isFinite(minute)) {
      setError("Choose the move date and start time.");
      return;
    }
    const startsAt = zonedWallTimeToInstant(year, month, day, hour, minute, ADMIN_TIME_ZONE).toISOString();
    const minutes = duration.trim() ? Number(duration) : undefined;
    setPending(true);
    try {
      const response = await fetch("/api/admin/quotes/convert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quoteId: quote.id,
          serviceSlug,
          packageId,
          startsAt,
          ...(minutes !== undefined ? { estimatedDurationMinutes: minutes } : {}),
          pickupAddress: { ...pickup },
          destinationAddress: { ...dropoff },
          customer: { name, email, ...(phone.trim() ? { phone } : {}) },
          ...(notes.trim() ? { customerNotes: notes.trim() } : {}),
        }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(body.error || "Could not create the booking draft.");
        return;
      }
      onConverted(body.quote as Quote, String(body.bookingNumber));
    } catch {
      setError("Could not reach the server. Try again.");
    } finally {
      setPending(false);
    }
  }

  const addressFields = (label: string, value: typeof pickup, set: (next: typeof pickup) => void) => (
    <fieldset className="admin-fieldset a-q-wide">
      <legend className="admin-label">{label}</legend>
      <div className="a-q-form-grid" style={{ marginTop: 8 }}>
        <label className="admin-field a-q-wide">
          <span className="admin-label">Street address</span>
          <input className="admin-input" required maxLength={300} value={value.addressLine} onChange={(event) => set({ ...value, addressLine: event.target.value })} autoComplete="off" />
        </label>
        <label className="admin-field">
          <span className="admin-label">Suburb</span>
          <input className="admin-input" required maxLength={120} value={value.suburb} onChange={(event) => set({ ...value, suburb: event.target.value })} autoComplete="off" />
        </label>
        <label className="admin-field">
          <span className="admin-label">State</span>
          <input className="admin-input" required maxLength={60} value={value.state} onChange={(event) => set({ ...value, state: event.target.value })} autoComplete="off" />
        </label>
        <label className="admin-field">
          <span className="admin-label">Postcode</span>
          <input className="admin-input" required maxLength={12} inputMode="numeric" value={value.postcode} onChange={(event) => set({ ...value, postcode: event.target.value })} autoComplete="off" />
        </label>
      </div>
    </fieldset>
  );

  return (
    <form className="a-q-form" onSubmit={submit} aria-label="Convert enquiry to a booking draft">
      <p className="admin-help" style={{ margin: 0 }}>
        Creates a held booking using the same availability checks as the public booking flow, then links it to this enquiry. The truck is reserved for 48 hours.
      </p>
      <div className="a-q-form-grid">
        <label className="admin-field">
          <span className="admin-label">Customer name</span>
          <input className="admin-input" required maxLength={200} value={name} onChange={(event) => setName(event.target.value)} autoComplete="off" />
        </label>
        <label className="admin-field">
          <span className="admin-label">Phone</span>
          <input className="admin-input" type="tel" maxLength={40} value={phone} onChange={(event) => setPhone(event.target.value)} autoComplete="off" />
        </label>
        <label className="admin-field a-q-wide">
          <span className="admin-label">Email</span>
          <input className="admin-input" type="email" required maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="off" />
        </label>
        <label className="admin-field">
          <span className="admin-label">Service</span>
          <select className="admin-input" value={serviceSlug} onChange={(event) => setServiceSlug(event.target.value)}>
            {SERVICES.map((service) => <option key={service.slug} value={service.slug}>{service.label}</option>)}
          </select>
        </label>
        <label className="admin-field">
          <span className="admin-label">Package</span>
          <select className="admin-input" required value={packageId} onChange={(event) => setPackageId(event.target.value)}>
            <option value="" disabled>Choose a package</option>
            {movingPackages.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </label>
        <label className="admin-field">
          <span className="admin-label">Move date</span>
          <input className="admin-input" type="date" required value={date} onChange={(event) => setDate(event.target.value)} />
        </label>
        <label className="admin-field">
          <span className="admin-label">Start time (Adelaide)</span>
          <input className="admin-input" type="time" required value={time} onChange={(event) => setTime(event.target.value)} />
        </label>
        <label className="admin-field a-q-wide">
          <span className="admin-label">Estimated duration in minutes (optional)</span>
          <input className="admin-input" type="number" min={30} max={600} step={30} inputMode="numeric" value={duration} onChange={(event) => setDuration(event.target.value)} placeholder="Business default" />
        </label>
        {addressFields("Pickup address", pickup, setPickup)}
        {addressFields("Destination address", dropoff, setDropoff)}
        <label className="admin-field a-q-wide">
          <span className="admin-label">Notes on the booking (optional)</span>
          <textarea className="admin-input" maxLength={2000} value={notes} onChange={(event) => setNotes(event.target.value)} />
        </label>
      </div>
      {error && <AdminAlert tone="error">{error}</AdminAlert>}
      <div className="a-q-actions">
        <button type="submit" className="admin-btn admin-btn--primary admin-btn--sm" disabled={pending}>{pending ? "Creating…" : "Create booking draft"}</button>
        <button type="button" className="admin-btn admin-btn--ghost admin-btn--sm" onClick={onCancel} disabled={pending}>Cancel</button>
      </div>
    </form>
  );
}
