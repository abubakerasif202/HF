// Obviously SYNTHETIC fixture data for the admin visual QA harness.
// Every name is "Sample ...", every email is @example.invalid, every phone is 0400 000 0xx,
// every address is "N Sample St, Adelaide SA". Nothing here is real customer data.
// Dates are computed relative to "now" in Australia/Adelaide so pages always look populated.

export const OWNER_ID = "00000000-0000-4000-8000-000000000001";
export const OWNER_EMAIL = "admin@hfremovalsadelaide.com.au";
const TZ = "Australia/Adelaide";

export function uuid(group, n) {
  return `${group.toString(16).padStart(8, "0")}-0000-4000-8000-${String(n).padStart(12, "0")}`;
}

// ---------- Adelaide time helpers ----------
function tzOffsetMinutes(instant) {
  const part = new Intl.DateTimeFormat("en-US", { timeZone: TZ, timeZoneName: "longOffset" })
    .formatToParts(instant)
    .find((p) => p.type === "timeZoneName").value; // "GMT+10:30"
  const m = /GMT([+-])(\d{2}):(\d{2})/.exec(part);
  if (!m) return 0;
  return (m[1] === "-" ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3]));
}

function adelaideToday() {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" })
      .formatToParts(new Date())
      .map((x) => [x.type, x.value]),
  );
  return { y: Number(p.year), m: Number(p.month), d: Number(p.day) };
}

/** ISO instant for Adelaide wall-clock (today + dayOffset) at hour:minute. */
export function adelaideIso(dayOffset, hour, minute = 0) {
  const t = adelaideToday();
  const guessUtc = Date.UTC(t.y, t.m - 1, t.d + dayOffset, hour, minute);
  const off = tzOffsetMinutes(new Date(guessUtc));
  return new Date(guessUtc - off * 60_000).toISOString();
}

const plusMinutes = (iso, minutes) => new Date(Date.parse(iso) + minutes * 60_000).toISOString();
const minutesAgo = (minutes) => new Date(Date.now() - minutes * 60_000).toISOString();

// ---------- reference tables ----------
export const services = [
  { id: uuid(0x10, 1), slug: "residential-removals", name: "Residential removals", description: "Home, apartment and townhouse removals.", active: true, bookable: true, default_crew_size: 2, created_at: minutesAgo(60 * 24 * 200) },
  { id: uuid(0x10, 2), slug: "furniture-removals", name: "Furniture removals", description: "Household furniture and bulky item removals.", active: true, bookable: true, default_crew_size: 2, created_at: minutesAgo(60 * 24 * 200) },
  { id: uuid(0x10, 3), slug: "office-commercial-removals", name: "Office & commercial removals", description: "Workplace relocation.", active: true, bookable: true, default_crew_size: 2, created_at: minutesAgo(60 * 24 * 200) },
];

export const vehicles = [
  { id: uuid(0x20, 1), name: "Sample HR Truck 1", vehicle_type: "HR", active: true, created_at: minutesAgo(60 * 24 * 190) },
  { id: uuid(0x20, 2), name: "Sample MR Truck 1", vehicle_type: "MR", active: true, created_at: minutesAgo(60 * 24 * 180) },
  { id: uuid(0x20, 3), name: "Sample Small Truck 1", vehicle_type: "Small", active: true, created_at: minutesAgo(60 * 24 * 170) },
  { id: uuid(0x20, 4), name: "Sample HR Truck 2 (in workshop)", vehicle_type: "HR", active: false, created_at: minutesAgo(60 * 24 * 160) },
  { id: uuid(0x20, 5), name: "Sample Legacy Van", vehicle_type: "Van", active: false, created_at: minutesAgo(60 * 24 * 150) },
];

export const crews = [
  { id: uuid(0x30, 1), name: "Sample Crew Alpha", active: true, created_at: minutesAgo(60 * 24 * 190) },
  { id: uuid(0x30, 2), name: "Sample Crew Bravo", active: true, created_at: minutesAgo(60 * 24 * 180) },
  { id: uuid(0x30, 3), name: "Sample Crew Charlie (paused)", active: false, created_at: minutesAgo(60 * 24 * 170) },
];

export const crew_members = [
  ["Sample Mover 01", "Team leader", 1, true], ["Sample Mover 02", "Mover", 1, true], ["Sample Mover 03", "Mover", 1, true],
  ["Sample Mover 04", "Team leader", 2, true], ["Sample Mover 05", "Mover", 2, true], ["Sample Mover 06", "Mover", 2, false],
  ["Sample Mover 07", "Team leader", 3, true], ["Sample Mover 08", "Mover", 3, true], ["Sample Mover 09", "Casual driver", null, true],
].map(([name, role, crewN, active], i) => ({
  id: uuid(0x31, i + 1), crew_id: crewN ? uuid(0x30, crewN) : null, name, role, active, created_at: minutesAgo(60 * 24 * (150 - i)),
}));

export const business_settings = [{
  id: true, timezone: TZ, booking_number_prefix: "HF",
  business_open_time: "05:00:00", business_close_time: "18:00:00",
  booking_hold_minutes: 30, min_booking_lead_hours: 24, max_booking_horizon_days: 90,
  default_estimated_duration_minutes: 180, scheduling_buffer_minutes: 30,
  deposit_type: null, deposit_fixed_amount_cents: null, deposit_percentage: null, min_deposit_amount_cents: null,
  booking_admin_email: "bookings-sample@example.invalid", reminder_hours_before: [],
  minimum_booking_minutes: 180, callout_minutes: 60, updated_at: minutesAgo(60 * 24 * 3),
}];

export const pricing_rules = [
  ["hr-16t-2men", "HR", 16, 2, 7900], ["mr-12t-2men", "MR", 12, 2, 7400], ["small-8t-2men", "Small", 8, 2, 6900],
  ["3-men", null, null, 3, 9900], ["2-men", null, null, 2, 7900],
].map(([package_id, truck_class, tonnage, crew_size, rate], i) => ({
  id: uuid(0x40, i + 1), package_id, truck_class, tonnage, crew_size,
  rate_per_30_min_cents: rate, minimum_billable_minutes: 60, call_out_fee_cents: 0,
  weekend_multiplier: "1.00", public_holiday_multiplier: "1.00", active: package_id !== "2-men", updated_at: minutesAgo(60 * 24 * 10),
}));

export const staff = [{ id: OWNER_ID, full_name: "HF Removals Admin", role: "owner", active: true, created_at: minutesAgo(60 * 24 * 365) }];

// ---------- customers ----------
export const customers = Array.from({ length: 22 }, (_, i) => {
  const n = String(i + 1).padStart(2, "0");
  return { id: uuid(0x50, i + 1), name: `Sample Customer ${n}`, email: `sample.customer${n}@example.invalid`, phone: `0400 000 0${n}`, created_at: minutesAgo(60 * 24 * (40 - i)) };
});

// ---------- bookings ----------
const SUBURBS = ["Norwood", "Glenelg", "Prospect", "Mawson Lakes", "Unley", "Henley Beach", "Salisbury", "Marion", "Modbury", "Burnside"];
const PKG = {
  hr: { id: "hr-16t-2men", cls: "HR", crew: 2, rate: 7900, name: "HR Truck", vehicle: 1 },
  mr: { id: "mr-12t-2men", cls: "MR", crew: 2, rate: 7400, name: "MR Truck", vehicle: 2 },
  sm: { id: "small-8t-2men", cls: "Small", crew: 2, rate: 6900, name: "Small Truck", vehicle: 3 },
  m3: { id: "3-men", cls: null, crew: 3, rate: 9900, name: "3 Movers + Truck", vehicle: 1 },
};

// [dayOffset, startHour, status, pkgKey, hasVehicle, crewN|null, extra]
const PLAN = [
  [-14, 8, "completed", "hr", true, 1, { finalised: 240 }],
  [-12, 9, "completed", "mr", true, 2, { finalised: 195 }],
  [-10, 7, "cancelled", "sm", false, null, {}],
  [-9, 10, "completed", "sm", true, 1, { finalised: 180 }],
  [-7, 8, "completed", "hr", true, 2, { finalised: 300 }],
  [-5, 9, "completed", "mr", true, 1, { unfinalised: true }],
  [-4, 6, "expired", "mr", false, null, {}],
  [-2, 8, "completed", "m3", true, 2, { finalised: 210 }],
  [-1, 13, "cancelled", "hr", false, null, {}],
  [0, 8, "in_progress", "hr", true, 1, {}],
  [0, 13, "assigned", "mr", true, 2, {}],
  [1, 9, "confirmed", "sm", false, null, {}],
  [1, 12, "assigned", "hr", true, 1, {}],
  [2, 7, "confirmed", "mr", true, null, {}],
  [3, 10, "held", "sm", false, null, {}],
  [4, 8, "confirmed", "hr", false, null, { calFailed: true }],
  [5, 9, "assigned", "m3", true, 2, {}],
  [6, 11, "confirmed", "mr", true, 1, {}],
  [8, 8, "pending_payment", "hr", false, null, {}],
  [9, 9, "confirmed", "sm", true, 2, {}],
  [12, 10, "held", "mr", false, null, {}],
  [15, 8, "assigned", "hr", true, 1, {}],
  [19, 9, "confirmed", "mr", false, null, {}],
  [24, 8, "confirmed", "hr", true, 2, {}],
  [29, 10, "confirmed", "sm", true, 1, {}],
];

const addr = (n, suburb) => ({
  formattedAddress: `${n} Sample St, ${suburb} SA`, addressLine: `${n} Sample St`, suburb, state: "SA", postcode: "5000",
});

export const bookings = PLAN.map(([day, hour, status, pk, hasVehicle, crewN, extra], i) => {
  const p = PKG[pk];
  const starts = adelaideIso(day, hour);
  const durationMin = extra.finalised ? extra.finalised : 180 + (i % 3) * 30;
  const ends = plusMinutes(starts, durationMin);
  const customer = customers[i % customers.length];
  const subtotal = Math.round((p.rate * (durationMin + 60)) / 30);
  const finalised = Boolean(extra.finalised);
  const service = extra.finalised ? 0 : 1;
  const confirmedLike = ["confirmed", "assigned", "in_progress", "completed"].includes(status);
  const calendar_sync_status = extra.calFailed ? "failed" : confirmedLike ? (i % 4 === 0 ? "pending" : "synced") : status === "cancelled" ? "synced" : "not_applicable";
  const created = plusMinutes(starts, -60 * 24 * (3 + (i % 9)));
  return {
    id: uuid(0x60, i + 1),
    booking_number: `HF-${String(1001 + i)}`,
    customer_id: customer.id,
    service_id: services[service].id,
    starts_at: starts,
    ends_at: ends,
    estimated_duration_minutes: durationMin,
    crew_size: p.crew,
    vehicle_id: hasVehicle ? vehicles[p.vehicle - 1].id : null,
    crew_id: crewN ? crews[crewN - 1].id : null,
    pickup_address: addr(10 + i, SUBURBS[i % SUBURBS.length]),
    destination_address: addr(200 + i, SUBURBS[(i + 3) % SUBURBS.length]),
    additional_stops: [],
    move_details: { bedrooms: 2 + (i % 3), stairs: i % 2 === 0 },
    subtotal_cents: subtotal,
    deposit_required_cents: 0,
    deposit_paid_cents: 0,
    balance_due_cents: status === "cancelled" || status === "expired" ? 0 : finalised ? (i % 3 === 0 ? 0 : Math.round((p.rate * (extra.finalised + 60)) / 30)) : subtotal,
    currency: "aud",
    pricing_snapshot: { package: p.name, ratePer30MinCents: p.rate },
    booking_status: status,
    payment_status: status === "cancelled" || status === "expired" ? "not_required" : finalised && i % 3 === 0 ? "paid" : "not_required",
    hold_expires_at: status === "held" ? plusMinutes(new Date().toISOString(), 25) : status === "expired" ? plusMinutes(created, 30) : null,
    access_token: uuid(0x61, i + 1),
    customer_notes: i % 3 === 0 ? "Sample note: please call on arrival. Narrow driveway." : null,
    internal_notes: i % 4 === 0 ? `[${created.slice(0, 10)}] Sample internal note: confirmed access with customer.` : null,
    google_calendar_event_id: calendar_sync_status === "synced" ? `sample-event-${i + 1}` : null,
    calendar_sync_status,
    calendar_sync_error: extra.calFailed ? "Sample error: calendar API returned 503" : null,
    created_at: created,
    updated_at: created,
    confirmed_at: confirmedLike ? plusMinutes(created, 20) : null,
    cancelled_at: status === "cancelled" ? plusMinutes(created, 600) : null,
    current_checkout_session_id: null,
    actual_duration_minutes: finalised ? extra.finalised : null,
    billable_duration_minutes: finalised ? Math.max(180, Math.ceil(extra.finalised / 30) * 30) : null,
    service_charge_cents: finalised ? Math.round((p.rate * Math.max(180, Math.ceil(extra.finalised / 30) * 30)) / 30) : null,
    callout_fee_cents: finalised ? p.rate * 2 : null,
    final_total_cents: finalised ? Math.round((p.rate * (Math.max(180, Math.ceil(extra.finalised / 30) * 30) + 60)) / 30) : null,
    finalised_at: finalised ? plusMinutes(ends, 45) : null,
    finalised_by: finalised ? OWNER_ID : null,
    package_id: p.id,
    truck_class: p.cls,
  };
});

/** A confirmed/assigned booking with a rich detail page (events + notifications, resources assigned). */
export const FEATURED_BOOKING_ID = bookings.find((b) => b.booking_number === "HF-1013").id; // assigned, tomorrow
/** A completed + finalised booking (shows the billing breakdown). */
export const FINALISED_BOOKING_ID = bookings.find((b) => b.booking_number === "HF-1001").id;

// ---------- events / notifications / assignments / payments ----------
export const booking_events = bookings.flatMap((b, i) => {
  const rows = [{ event: "hold_created", actor: "customer", at: plusMinutes(b.created_at, 0) }];
  if (b.confirmed_at) rows.push({ event: "booking_confirmed", actor: "customer", at: b.confirmed_at });
  if (b.vehicle_id) rows.push({ event: "vehicle_assigned", actor: OWNER_ID, at: plusMinutes(b.created_at, 60 * 5) });
  if (b.booking_status === "assigned" || b.booking_status === "in_progress" || b.booking_status === "completed") {
    if (b.crew_id) rows.push({ event: "crew_assigned", actor: OWNER_ID, at: plusMinutes(b.created_at, 60 * 6) });
  }
  if (b.finalised_at) rows.push({ event: "job_finalised", actor: OWNER_ID, at: b.finalised_at });
  if (b.booking_status === "cancelled") rows.push({ event: "booking_cancelled", actor: OWNER_ID, at: b.cancelled_at });
  if (b.booking_status === "expired") rows.push({ event: "hold_expired", actor: "system", at: b.hold_expires_at });
  return rows.map((r, k) => ({ id: uuid(0x70, i * 10 + k + 1), booking_id: b.id, event: r.event, actor: r.actor, metadata: {}, created_at: r.at }));
});

export const notifications = bookings.flatMap((b, i) => {
  if (!b.confirmed_at) return [];
  const customer = customers.find((c) => c.id === b.customer_id);
  const rows = [
    { template: "booking_confirmation_customer", recipient: customer.email, status: "sent", error: null },
    { template: "booking_alert_admin", recipient: "bookings-sample@example.invalid", status: i % 5 === 0 ? "failed" : "sent", error: i % 5 === 0 ? "Sample error: mailbox unavailable" : null },
  ];
  return rows.map((r, k) => ({
    id: uuid(0x80, i * 10 + k + 1), booking_id: b.id, channel: "email", ...r,
    provider_message_id: r.status === "sent" ? `sample-msg-${i}-${k}` : null,
    created_at: plusMinutes(b.confirmed_at, k), sent_at: r.status === "sent" ? plusMinutes(b.confirmed_at, k) : null,
  }));
});

export const booking_assignments = [];
export const payments = [];
export const stripe_events = [];

// ---------- blocked times ----------
export const blocked_times = [
  { day: 3, h1: 0, h2: 23, vehicle: null, crew: null, reason: "Sample public holiday closure" },
  { day: 6, h1: 8, h2: 17, vehicle: 4, crew: null, reason: "Sample scheduled truck service" },
  { day: 10, h1: 7, h2: 15, vehicle: null, crew: 2, reason: "Sample crew training day" },
  { day: 14, h1: 5, h2: 18, vehicle: 2, crew: null, reason: "Sample registration inspection" },
  { day: 21, h1: 0, h2: 23, vehicle: null, crew: null, reason: "Sample staff event closure" },
].map((b, i) => ({
  id: uuid(0x90, i + 1),
  starts_at: adelaideIso(b.day, b.h1),
  ends_at: adelaideIso(b.day, b.h2, 30),
  vehicle_id: b.vehicle ? vehicles[b.vehicle - 1].id : null,
  crew_id: b.crew ? crews[b.crew - 1].id : null,
  reason: b.reason, created_by: OWNER_ID, created_at: minutesAgo(60 * 24 * 5),
}));

// ---------- quote requests (all 6 statuses) ----------
const QUOTE_STATUSES = ["new", "new", "new", "quote_sent", "quote_sent", "follow_up", "follow_up", "booked", "booked", "completed", "completed", "lost", "new", "follow_up"];
const MOVE_CATEGORIES = ["Residential", "Residential", "Furniture only", "Office", "Residential"];
const MOVE_TYPES = ["House to house", "Apartment to house", "Storage to house", "Single item", "Office relocation"];
const SERVICES_EXTRA = [["Packing", "Packing supplies"], ["Furniture protection"], [], ["Piano", "Stairs"], ["Disassembly / reassembly"]];

export const quote_requests = QUOTE_STATUSES.map((quote_status, i) => {
  const n = String(i + 1).padStart(2, "0");
  const truck = ["hr-16t-2men", "mr-12t-2men", "small-8t-2men", "3-men"][i % 4];
  const delivery_status = i % 7 === 3 ? "failed" : i % 7 === 5 ? "pending" : i % 9 === 8 ? "unknown" : "sent";
  return {
    id: uuid(0xa0, i + 1),
    payload_hash: String(i).padStart(2, "0").repeat(32),
    payload: {
      name: `Sample Enquirer ${n}`,
      phone: `0400 000 1${n}`,
      email: `sample.enquirer${n}@example.invalid`,
      moving_from: `${30 + i} Sample St, ${SUBURBS[i % SUBURBS.length]} SA`,
      moving_to: `${300 + i} Sample St, ${SUBURBS[(i + 4) % SUBURBS.length]} SA`,
      preferred_moving_date: adelaideIso(2 + i * 2, 9).slice(0, 10),
      move_category: MOVE_CATEGORIES[i % MOVE_CATEGORIES.length],
      move_type: MOVE_TYPES[i % MOVE_TYPES.length],
      truck_package_id: truck,
      property_size: ["1 bedroom", "2 bedrooms", "3 bedrooms", "4+ bedrooms"][i % 4],
      floor_access: ["Ground floor", "Stairs", "Lift", "Ground floor"][i % 4],
      parking_access: ["Driveway", "Street parking", "Loading dock", "Driveway"][i % 4],
      boxes_needed: ["None", "10-20", "20-40", "40+"][i % 4],
      "services[]": SERVICES_EXTRA[i % SERVICES_EXTRA.length],
      details: `Sample enquiry ${n}: synthetic job details used for visual QA only. Please ignore.`,
      source_page: ["/get-a-quote", "/", "/services/residential-removals", "/pricing"][i % 4],
    },
    quote_status,
    delivery_status,
    delivery_provider: delivery_status === "pending" ? null : "resend",
    notification_attempted_at: delivery_status === "pending" ? null : minutesAgo(60 * 24 * (14 - i)),
    delivery_failure_category: delivery_status === "failed" ? "provider" : null,
    created_at: minutesAgo(60 * 6 * (i + 1) + (i % 3) * 37),
  };
});

export const tables = {
  staff, business_settings, services, pricing_rules, vehicles, crews, crew_members, customers,
  bookings, booking_events, notifications, booking_assignments, payments, stripe_events, blocked_times, quote_requests,
};

/** many-to-one embeds: tables[name] -> { relationName: [targetTable, foreignKeyColumn] } */
export const relations = {
  bookings: { customers: ["customers", "customer_id"], services: ["services", "service_id"], vehicles: ["vehicles", "vehicle_id"], crews: ["crews", "crew_id"] },
  blocked_times: { vehicles: ["vehicles", "vehicle_id"], crews: ["crews", "crew_id"] },
  crew_members: { crews: ["crews", "crew_id"] },
  booking_events: { bookings: ["bookings", "booking_id"] },
  notifications: { bookings: ["bookings", "booking_id"] },
};
