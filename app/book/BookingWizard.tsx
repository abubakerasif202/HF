"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

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
  { key: "review", label: "Review & Pay" },
];

export function BookingWizard() {
  const [step, setStep] = useState<Step>("details");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const searchParams = useSearchParams();
  const preselectedCrewSize = searchParams.get("crewSize") === "3" ? 3 : searchParams.get("crewSize") === "2" ? 2 : null;
  const [serviceSlug, setServiceSlug] = useState(SERVICES[0].slug);
  // Optional preselection from a "Book Now" link on a specific package
  // card (e.g. /book?crewSize=3) — a UX nicety only; the customer can
  // still change it on this step, and no separate booking path exists.
  const [crewSize, setCrewSize] = useState(preselectedCrewSize ?? 2);
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
    bookingConfirmationCents: number;
    estimatedBalanceCents: number;
  }

  const [hold, setHold] = useState<{ bookingId: string; accessToken: string; quote: Quote } | null>(null);

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
    } catch (err) {
      setError((err as Error).message);
      setSlots([]);
    } finally {
      setLoadingSlots(false);
    }
  }

  async function submitHold() {
    if (!selectedSlot) return;
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
        if (data.code === "slot_unavailable") {
          setError("That time slot was just taken — please pick another time.");
          setStep("schedule");
          await loadSlots(date);
          return;
        }
        throw new Error(data.error ?? "Could not hold this booking");
      }
      setHold({ bookingId: data.bookingId, accessToken: data.accessToken, quote: data.quote });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  async function payDeposit() {
    if (!hold) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/booking/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookingId: hold.bookingId, accessToken: hold.accessToken }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not start payment");
      window.location.href = data.checkoutUrl;
    } catch (err) {
      setError((err as Error).message);
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
              <option value={2}>2 Men + Truck — $79 / 30 min ($158/hr)</option>
              <option value={3}>3 Men + Truck — $99 / 30 min ($198/hr)</option>
            </select>
          </label>
          <div className="rounded-lg bg-neutral-50 px-4 py-3 text-sm text-neutral-600">
            <p><strong>Minimum service:</strong> 3 hours</p>
            <p className="mt-1">
              <strong>Call-out:</strong> 1 hour — ${(crewSize === 3 ? 99 : 79) * 2}
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
          <button className="rounded-full bg-neutral-900 px-6 py-3 text-white" onClick={() => setStep("locations")}>Continue</button>
        </section>
      )}

      {step === "locations" && (
        <section className="mt-8 space-y-6">
          <AddressForm title="Pickup address" value={pickupAddress} onChange={setPickupAddress} />
          <AddressForm title="Destination address" value={destinationAddress} onChange={setDestinationAddress} />
          <div className="flex gap-3">
            <button className="rounded-full border px-6 py-3" onClick={() => setStep("details")}>Back</button>
            <button disabled={!canContinueLocations} className="rounded-full bg-neutral-900 px-6 py-3 text-white disabled:opacity-40" onClick={() => setStep("schedule")}>Continue</button>
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
            <button className="rounded-full border px-6 py-3" onClick={() => setStep("locations")}>Back</button>
            <button disabled={!selectedSlot} className="rounded-full bg-neutral-900 px-6 py-3 text-white disabled:opacity-40" onClick={() => setStep("customer")}>Continue</button>
          </div>
        </section>
      )}

      {step === "customer" && (
        <section className="mt-8 space-y-4">
          <label className="block">
            <span className="text-sm font-medium">Full name</span>
            <input className="mt-1 w-full rounded-lg border px-3 py-2" value={customer.name} onChange={(e) => setCustomer({ ...customer, name: e.target.value })} />
          </label>
          <label className="block">
            <span className="text-sm font-medium">Email</span>
            <input type="email" className="mt-1 w-full rounded-lg border px-3 py-2" value={customer.email} onChange={(e) => setCustomer({ ...customer, email: e.target.value })} />
          </label>
          <label className="block">
            <span className="text-sm font-medium">Phone (optional)</span>
            <input className="mt-1 w-full rounded-lg border px-3 py-2" value={customer.phone} onChange={(e) => setCustomer({ ...customer, phone: e.target.value })} />
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
            <button className="rounded-full border px-6 py-3" onClick={() => setStep("schedule")}>Back</button>
            <button
              disabled={!customer.name || !customer.email}
              className="rounded-full bg-neutral-900 px-6 py-3 text-white disabled:opacity-40"
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

          {!hold && !submitting && <p>Preparing your reservation…</p>}
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
                <Row label="Booking confirmation" value={`$${(hold.quote.bookingConfirmationCents / 100).toFixed(2)} payable now`} />
                <Row label="Estimated minimum balance after booking payment" value={`$${(hold.quote.estimatedBalanceCents / 100).toFixed(2)}`} />
              </dl>
              <p className="mt-4 text-xs text-neutral-500">
                3-hour minimum service + 1-hour call-out fee. The call-out covers truck fuel and basic transport
                charges. Additional service time is billed in 30-minute increments at your selected package rate.
                Your final price is calculated when the job is completed. The $100 booking confirmation payment is
                credited toward your final balance.
              </p>
            </div>
          )}

          {hold && (
            <button disabled={submitting} className="rounded-full bg-neutral-900 px-6 py-3 text-white disabled:opacity-40" onClick={payDeposit}>
              {submitting ? "Redirecting to secure payment…" : "Pay $100 Booking Confirmation & Reserve My Move"}
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
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium">{title}</legend>
      <input className="w-full rounded-lg border px-3 py-2" placeholder="Street address" value={value.addressLine} onChange={(e) => onChange({ ...value, addressLine: e.target.value })} />
      <div className="grid grid-cols-3 gap-2">
        <input className="rounded-lg border px-3 py-2" placeholder="Suburb" value={value.suburb} onChange={(e) => onChange({ ...value, suburb: e.target.value })} />
        <input className="rounded-lg border px-3 py-2" placeholder="State" value={value.state} onChange={(e) => onChange({ ...value, state: e.target.value })} />
        <input className="rounded-lg border px-3 py-2" placeholder="Postcode" value={value.postcode} onChange={(e) => onChange({ ...value, postcode: e.target.value })} />
      </div>
    </fieldset>
  );
}
