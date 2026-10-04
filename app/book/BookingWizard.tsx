"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { trackBookingEvent } from "../../lib/booking-analytics";
import { findMovingPackage, localPricing, minimumServiceMinutes } from "../../lib/site-data";

type Step = "details" | "locations" | "schedule" | "customer" | "review";

interface Address {
  addressLine: string;
  suburb: string;
  state: string;
  postcode: string;
  country: string;
}

interface Slot {
  startsAt: string;
  endsAt: string;
  state: "available" | "limited" | "unavailable";
  reason?: string;
}

const emptyAddress: Address = { addressLine: "", suburb: "", state: "SA", postcode: "", country: "Australia" };

const SERVICES = [
  { slug: "residential-removals", label: "Residential removals" },
  { slug: "furniture-removals", label: "Furniture removals" },
  { slug: "office-commercial-removals", label: "Office & commercial removals" },
];

const STEPS: { key: Step; label: string }[] = [
  { key: "details", label: "Move Details" },
  { key: "locations", label: "Pickup & Destination" },
  { key: "schedule", label: "Date & Availability" },
  { key: "customer", label: "Your Details" },
  { key: "review", label: "Review & Confirm" },
];

export function BookingWizard() {
  const [step, setStep] = useState<Step>("details");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const searchParams = useSearchParams();
  // crewSize is the stable package key shared with the booking API and the
  // pricing_rules table; only sizes that exist in the canonical package table count.
  const preselectedCrewSize = findMovingPackage({ crewSize: Number(searchParams.get("crewSize")) })?.crewSize ?? null;
  const [serviceSlug, setServiceSlug] = useState(SERVICES[0].slug);
  // Optional preselection from a "Book Now" link on a specific package
  // card (e.g. /book?crewSize=3) — a UX nicety only; the customer can
  // still change it on this step, and no separate booking path exists.
  const [crewSize, setCrewSize] = useState<number>(preselectedCrewSize ?? localPricing[0].crewSize);
  const selectedPackage = localPricing.find((item) => item.crewSize === crewSize) ?? localPricing[0];
  const [propertySize, setPropertySize] = useState("");
  const [customerNotes, setCustomerNotes] = useState("");

  const [pickupAddress, setPickupAddress] = useState<Address>(emptyAddress);
  const [destinationAddress, setDestinationAddress] = useState<Address>(emptyAddress);

  const [date, setDate] = useState("");
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);

  const [customer, setCustomer] = useState({ name: "", email: "", phone: "" });
  const [website, setWebsite] = useState(""); // honeypot; real customers never see or fill this

  interface Quote {
    packageName: string;
    ratePer30MinCents: number;
    minimumBookingMinutes: number;
    calloutMinutes: number;
    serviceChargeCents: number;
    calloutFeeCents: number;
    finalTotalCents: number;
  }

  // The slot the current hold was created for, so going Back and then
  // Continue again never creates a second hold for the same choice.
  const [hold, setHold] = useState<{ bookingId: string; accessToken: string; quote: Quote; startsAt: string } | null>(null);
  // Synchronous double-submit guard: React state updates are async, so a
  // fast double-click could otherwise fire two confirm requests. (The
  // server is idempotent regardless — this just avoids the wasted call.)
  const confirmInFlight = useRef(false);

  useEffect(() => {
    trackBookingEvent("booking_started");
  }, []);

  const stepIndex = STEPS.findIndex((s) => s.key === step);

  async function loadSlots(nextDate: string) {
    setDate(nextDate);
    setSelectedSlot(null);
    setError(null);
    if (!nextDate) {
      setSlots([]);
      return;
    }
    setLoadingSlots(true);
    try {
      const res = await fetch(`/api/booking/availability?date=${nextDate}&crewSize=${crewSize}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not load availability");
      setSlots(data.slots);
      trackBookingEvent("availability_checked", {
        slots_available: (data.slots as Slot[]).filter((s) => s.state !== "unavailable").length,
      });
    } catch (err) {
      setError((err as Error).message);
      setSlots([]);
    } finally {
      setLoadingSlots(false);
    }
  }

  async function submitHold() {
    if (!selectedSlot) return;
    if (hold && hold.startsAt === selectedSlot.startsAt) {
      trackBookingEvent("booking_reviewed", { package: crewSize });
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/booking/hold", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serviceSlug,
          crewSize,
          startsAt: selectedSlot.startsAt,
          pickupAddress,
          destinationAddress,
          moveDetails: { propertySize, service: serviceSlug },
          customer,
          customerNotes,
          website,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        trackBookingEvent("booking_failed", { step: "hold", code: data.code ?? res.status });
        if (data.code === "slot_unavailable") {
          setError("That time slot was just taken — please pick another time.");
          setStep("schedule");
          await loadSlots(date);
          return;
        }
        throw new Error(data.error ?? "Could not hold this booking");
      }
      setHold({ bookingId: data.bookingId, accessToken: data.accessToken, quote: data.quote, startsAt: selectedSlot.startsAt });
      trackBookingEvent("booking_hold_created", { package: crewSize, service: serviceSlug });
      trackBookingEvent("booking_reviewed", { package: crewSize });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  async function confirmBooking() {
    if (!hold || confirmInFlight.current) return;
    confirmInFlight.current = true;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/booking/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookingId: hold.bookingId, accessToken: hold.accessToken }),
      });
      const data = await res.json();
      if (!res.ok) {
        trackBookingEvent("booking_failed", { step: "confirm", code: data.code ?? res.status });
        if (data.code === "hold_expired") {
          // Never silently re-create the booking — send the customer back
          // to pick a currently-available time.
          setHold(null);
          setSelectedSlot(null);
          setStep("schedule");
          confirmInFlight.current = false;
          setSubmitting(false);
          if (date) await loadSlots(date).catch(() => {});
          setError(data.error ?? "Your selected time is no longer being held. Please choose an available time again.");
          return;
        }
        throw new Error(data.error ?? "Could not confirm your booking");
      }
      trackBookingEvent("booking_confirmed", { package: crewSize, service: serviceSlug });
      window.location.href = data.successUrl;
    } catch (err) {
      setError((err as Error).message);
      confirmInFlight.current = false;
      setSubmitting(false);
    }
  }

  const canContinueLocations = useMemo(
    () =>
      Boolean(
        pickupAddress.addressLine && pickupAddress.suburb && pickupAddress.postcode &&
        destinationAddress.addressLine && destinationAddress.suburb && destinationAddress.postcode,
      ),
    [pickupAddress, destinationAddress],
  );

  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="text-3xl font-semibold">Book Your Move</h1>
      <ol className="mt-6 flex flex-wrap gap-2 text-sm">
        {STEPS.map((s, i) => (
          <li
            key={s.key}
            className={`rounded-full border px-3 py-1 ${i === stepIndex ? "border-neutral-900 bg-neutral-900 text-white" : i < stepIndex ? "border-neutral-400 text-neutral-500" : "border-neutral-200 text-neutral-400"}`}
          >
            {i + 1}. {s.label}
          </li>
        ))}
      </ol>

      {error && <p className="mt-6 rounded-lg bg-red-50 px-4 py-3 text-red-700">{error}</p>}

      {step === "details" && (
        <section className="mt-8 space-y-4">
          <label className="block">
            <span className="text-sm font-medium">Service</span>
            <select className="mt-1 w-full rounded-lg border px-3 py-2" value={serviceSlug} onChange={(e) => setServiceSlug(e.target.value)}>
              {SERVICES.map((s) => (
                <option key={s.slug} value={s.slug}>{s.label}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-sm font-medium">Package</span>
            <select className="mt-1 w-full rounded-lg border px-3 py-2" value={crewSize} onChange={(e) => setCrewSize(Number(e.target.value))}>
              {localPricing.map((item) => (
                <option key={item.id} value={item.crewSize}>{item.name} — {item.halfHour} / 30 min ({item.hourly}/hr)</option>
              ))}
            </select>
          </label>
          <div className="rounded-lg bg-neutral-50 px-4 py-3 text-sm text-neutral-600">
            <p><strong>Minimum service:</strong> {minimumServiceMinutes / 60} hours</p>
            <p className="mt-1">
              <strong>Call-out:</strong> 1 hour — {selectedPackage.callout}
              <br />Includes truck fuel and basic transport charges
            </p>
          </div>
          <label className="block">
            <span className="text-sm font-medium">Property size / notes</span>
            <input className="mt-1 w-full rounded-lg border px-3 py-2" value={propertySize} onChange={(e) => setPropertySize(e.target.value)} placeholder="e.g. 3-bedroom house, 2nd floor, lift access" />
          </label>
          <label className="block">
            <span className="text-sm font-medium">Anything else we should know?</span>
            <textarea className="mt-1 w-full rounded-lg border px-3 py-2" rows={3} value={customerNotes} onChange={(e) => setCustomerNotes(e.target.value)} />
          </label>
          <button className="button button-ruby" onClick={() => setStep("locations")}>Continue</button>
        </section>
      )}

      {step === "locations" && (
        <section className="mt-8 space-y-6">
          <AddressForm title="Pickup address" value={pickupAddress} onChange={setPickupAddress} />
          <AddressForm title="Destination address" value={destinationAddress} onChange={setDestinationAddress} />
          <div className="flex gap-3">
            <button className="button button-outline" onClick={() => setStep("details")}>Back</button>
            <button disabled={!canContinueLocations} className="button button-ruby" onClick={() => setStep("schedule")}>Continue</button>
          </div>
        </section>
      )}

      {step === "schedule" && (
        <section className="mt-8 space-y-4">
          <label className="block max-w-xs">
            <span className="text-sm font-medium">Choose a date</span>
            <input type="date" className="mt-1 w-full rounded-lg border px-3 py-2" value={date} onChange={(e) => loadSlots(e.target.value)} />
          </label>
          {loadingSlots && <p className="text-neutral-500">Checking availability…</p>}
          {!loadingSlots && date && slots.length === 0 && <p className="text-neutral-500">No available times on this date.</p>}
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {slots.map((slot) => {
              const time = new Date(slot.startsAt).toLocaleTimeString("en-AU", { hour: "numeric", minute: "2-digit", timeZone: "Australia/Adelaide" });
              const isUnavailable = slot.state === "unavailable";
              const isSelected = selectedSlot?.startsAt === slot.startsAt;
              return (
                <button
                  key={slot.startsAt}
                  disabled={isUnavailable}
                  aria-pressed={isSelected}
                  onClick={() => setSelectedSlot(slot)}
                  title={slot.reason}
                  className={`rounded-lg border px-2 py-2 text-sm ${isUnavailable ? "cursor-not-allowed border-neutral-100 text-neutral-300" : isSelected ? "border-neutral-900 bg-neutral-900 text-white" : slot.state === "limited" ? "border-amber-400" : "border-neutral-300"}`}
                >
                  {time}
                </button>
              );
            })}
          </div>
          <div className="flex gap-3">
            <button className="button button-outline" onClick={() => setStep("locations")}>Back</button>
            <button disabled={!selectedSlot} className="button button-ruby" onClick={() => setStep("customer")}>Continue</button>
          </div>
        </section>
      )}

      {step === "customer" && (
        <section className="mt-8 space-y-4">
          <label className="block">
            <span className="text-sm font-medium">Full name</span>
            <input autoComplete="name" className="mt-1 w-full rounded-lg border px-3 py-2" value={customer.name} onChange={(e) => setCustomer({ ...customer, name: e.target.value })} />
          </label>
          <label className="block">
            <span className="text-sm font-medium">Email</span>
            <input type="email" autoComplete="email" className="mt-1 w-full rounded-lg border px-3 py-2" value={customer.email} onChange={(e) => setCustomer({ ...customer, email: e.target.value })} />
          </label>
          <label className="block">
            <span className="text-sm font-medium">Phone (optional)</span>
            <input type="tel" inputMode="tel" autoComplete="tel" className="mt-1 w-full rounded-lg border px-3 py-2" value={customer.phone} onChange={(e) => setCustomer({ ...customer, phone: e.target.value })} />
          </label>
          <input
            type="text"
            name="website"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            tabIndex={-1}
            autoComplete="off"
            aria-hidden="true"
            className="absolute -left-[9999px] h-0 w-0 opacity-0"
          />
          <div className="flex gap-3">
            <button className="button button-outline" onClick={() => setStep("schedule")}>Back</button>
            <button
              disabled={!customer.name || !customer.email}
              className="button button-ruby"
              onClick={async () => {
                setStep("review");
                await submitHold();
              }}
            >
              Continue
            </button>
          </div>
        </section>
      )}

      {step === "review" && (
        <section className="mt-8 space-y-4">
          <h2 className="text-xl font-semibold">Your Move</h2>
          <dl className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Row label="Pickup" value={`${pickupAddress.addressLine}, ${pickupAddress.suburb}`} />
            <Row label="Destination" value={`${destinationAddress.addressLine}, ${destinationAddress.suburb}`} />
            <Row label="Date" value={selectedSlot ? new Date(selectedSlot.startsAt).toLocaleString("en-AU", { timeZone: "Australia/Adelaide" }) : ""} />
            <Row label="Service" value={SERVICES.find((s) => s.slug === serviceSlug)?.label ?? ""} />
          </dl>

          {!hold && !submitting && !error && <p>Preparing your reservation…</p>}
          {!hold && !submitting && error && (
            <button className="button button-outline" onClick={() => setStep("customer")}>Back</button>
          )}
          {submitting && !hold && <p>Holding your time slot…</p>}

          {hold && (
            <div className="rounded-xl border p-4">
              <h3 className="font-medium">Booking summary</h3>
              <dl className="mt-3 space-y-2 text-sm">
                <Row label="Package" value={hold.quote.packageName} />
                <Row label="Rate" value={`$${(hold.quote.ratePer30MinCents / 100).toFixed(0)} / 30 min ($${((hold.quote.ratePer30MinCents * 2) / 100).toFixed(0)}/hr)`} />
                <Row label="Minimum service" value={`${hold.quote.minimumBookingMinutes / 60} hours`} />
                <Row label="Call-out" value={`1 hour — $${(hold.quote.calloutFeeCents / 100).toFixed(0)}`} />
                <Row label="Estimated minimum" value={`$${(hold.quote.finalTotalCents / 100).toFixed(2)}`} />
                <Row label="Advance payment" value="Not required" />
              </dl>
              <p className="mt-4 text-xs text-neutral-500">
                No advance payment required. 3-hour minimum service + 1-hour call-out fee. The call-out covers truck
                fuel and basic transport charges. Additional service time is billed in 30-minute increments at your
                selected package rate. Your final price is calculated after your move is completed.
              </p>
            </div>
          )}

          {hold && (
            <button disabled={submitting} aria-busy={submitting} className="button button-ruby" onClick={confirmBooking}>
              {submitting ? "Confirming your booking…" : "Confirm Booking"}
            </button>
          )}
        </section>
      )}
    </main>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border px-3 py-2">
      <dt className="text-xs uppercase text-neutral-400">{label}</dt>
      <dd className="text-sm">{value || "—"}</dd>
    </div>
  );
}

function AddressForm({ title, value, onChange }: { title: string; value: Address; onChange: (a: Address) => void }) {
  const section = title.toLowerCase().includes("pickup") ? "section-pickup" : "section-destination";
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium">{title}</legend>
      <input className="w-full rounded-lg border px-3 py-2" aria-label={`${title}: street address`} autoComplete={`${section} address-line1`} placeholder="Street address" value={value.addressLine} onChange={(e) => onChange({ ...value, addressLine: e.target.value })} />
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <input className="col-span-2 rounded-lg border px-3 py-2 sm:col-span-1" aria-label={`${title}: suburb`} autoComplete={`${section} address-level2`} placeholder="Suburb" value={value.suburb} onChange={(e) => onChange({ ...value, suburb: e.target.value })} />
        <input className="rounded-lg border px-3 py-2" aria-label={`${title}: state`} autoComplete={`${section} address-level1`} placeholder="State" value={value.state} onChange={(e) => onChange({ ...value, state: e.target.value })} />
        <input className="rounded-lg border px-3 py-2" aria-label={`${title}: postcode`} autoComplete={`${section} postal-code`} inputMode="numeric" placeholder="Postcode" value={value.postcode} onChange={(e) => onChange({ ...value, postcode: e.target.value })} />
      </div>
    </fieldset>
  );
}
