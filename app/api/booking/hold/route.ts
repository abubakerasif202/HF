import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withBookingSystemGuard, jsonError } from "../../../../lib/server/api-helpers.ts";
import { enforceRateLimit } from "../../../../lib/server/rate-limit.ts";
import {
  getBusinessSettings,
  getActiveVehicles,
  getBusyIntervals,
  getBlockedIntervals,
  findOrCreateCustomer,
  generateBookingNumber,
  createBookingHold,
  SlotUnavailableError,
} from "../../../../lib/server/booking-repo.ts";
import { getSupabaseAdmin } from "../../../../lib/server/supabase.ts";
import { pickFreeVehicle, withinBookingWindow } from "../../../../lib/booking/availability.ts";
import { calculateQuote } from "../../../../lib/booking/pricing.ts";
import { getPricingRule } from "../../../../lib/server/booking-repo.ts";
import { compatibleVehicleIds } from "../../../../lib/booking/vehicles.ts";
import { resolveRequestedPackage } from "../../../../lib/booking/package-request.ts";
import { TRUCK_UNAVAILABLE_MESSAGE } from "../../../../lib/site-data.ts";

export const dynamic = "force-dynamic";

const addressSchema = z.object({
  addressLine: z.string().min(1).max(300),
  suburb: z.string().min(1).max(120),
  state: z.string().min(1).max(60),
  postcode: z.string().min(1).max(12),
  country: z.string().max(60).default("Australia"),
  formattedAddress: z.string().max(400).optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  placeId: z.string().max(300).optional(),
});

// Public, unauthenticated endpoint: cap the request so a single call cannot
// store an arbitrarily large booking row. Real wizard payloads are ~2-4 KB.
const MAX_BODY_BYTES = 32_768;
const MAX_MOVE_DETAILS_BYTES = 8_192;

const bodySchema = z.object({
  serviceSlug: z.string().min(1),
  // packageId is authoritative (HR / MR / Small share crewSize 2). crewSize alone is
  // accepted only from clients built before truck options existed.
  packageId: z.string().min(1).max(64).optional(),
  crewSize: z.coerce.number().int().min(1).max(10).optional(),
  startsAt: z.string().datetime(),
  estimatedDurationMinutes: z.coerce.number().int().min(30).max(600).optional(),
  pickupAddress: addressSchema,
  destinationAddress: addressSchema,
  moveDetails: z.record(z.string().max(100), z.unknown()).default({})
    .refine((value) => JSON.stringify(value).length <= MAX_MOVE_DETAILS_BYTES, "Move details are too large"),
  customer: z.object({
    name: z.string().trim().min(1).max(200),
    email: z.string().trim().max(254).email(),
    phone: z.string().trim().max(40).optional(),
  }),
  customerNotes: z.string().max(2000).optional(),
  // Honeypot: a real customer never fills this (it's not shown in the
  // wizard UI); a bot filling every field in a scraped form usually does.
  website: z.string().max(0).optional().or(z.literal("")),
});

const MAX_ACTIVE_HOLDS_PER_EMAIL = 3;
// Generous enough for a genuine customer booking a couple of moves, low
// enough that a scripted form-filler can't fill the calendar in a day.
const MAX_RECENT_CONFIRMED_PER_EMAIL = 3;

/**
 * POST /api/booking/hold
 *
 * Creates a temporary `held` booking (server/DB-enforced, not just a
 * frontend check) so no other customer can take the same vehicle/time
 * window while this customer reviews and confirms their booking (no
 * advance payment — see POST /api/booking/confirm). The hold expires
 * automatically after `business_settings.booking_hold_minutes`.
 */
export async function POST(request: NextRequest) {
  return withBookingSystemGuard(async () => {
    // Per-IP limit first, before any other DB work, so junk requests count too.
    const limited = await enforceRateLimit(request, "hold");
    if (limited) return limited;

    if (Number(request.headers.get("content-length") ?? 0) > MAX_BODY_BYTES) {
      return jsonError(413, "Booking request is too large.");
    }
    const raw = await request.text().catch(() => "");
    if (raw.length > MAX_BODY_BYTES) return jsonError(413, "Booking request is too large.");
    let json: unknown = null;
    try { json = JSON.parse(raw); } catch { json = null; }
    const body = bodySchema.safeParse(json);
    if (!body.success) return jsonError(400, "Invalid booking request", { issues: body.error.issues });
    const input = body.data;

    if (input.website) {
      // Honeypot tripped — answer with a generic throttle response (the same
      // shape a real rate limit gives) and never create a hold.
      return jsonError(429, "Too many requests.");
    }

    // Per-email caps, layered on the per-IP limiter above (migration 0012).
    // With no payment friction, these stop one email from squatting on (or
    // confirming) every slot.
    const normalizedEmail = input.customer.email.trim().toLowerCase();
    const { count: activeHoldCount } = await getSupabaseAdmin()
      .from("bookings")
      .select("id, customers!inner(email)", { count: "exact", head: true })
      .in("booking_status", ["held", "pending_payment"])
      .eq("customers.email", normalizedEmail);
    if ((activeHoldCount ?? 0) >= MAX_ACTIVE_HOLDS_PER_EMAIL) {
      return jsonError(429, "You already have bookings in progress. Please finish confirming one, or wait a few minutes for it to lapse, before starting another.");
    }

    const since = new Date(Date.now() - 24 * 60 * 60_000).toISOString();
    const { count: recentConfirmedCount } = await getSupabaseAdmin()
      .from("bookings")
      .select("id, customers!inner(email)", { count: "exact", head: true })
      .in("booking_status", ["confirmed", "assigned"])
      .gte("created_at", since)
      .eq("customers.email", normalizedEmail);
    if ((recentConfirmedCount ?? 0) >= MAX_RECENT_CONFIRMED_PER_EMAIL) {
      return jsonError(429, "You've made several online bookings today. Please call us to add another move so we can make sure everything is right.");
    }

    const { data: service, error: serviceError } = await getSupabaseAdmin()
      .from("services")
      .select("id, bookable, default_crew_size")
      .eq("slug", input.serviceSlug)
      .maybeSingle();
    if (serviceError) throw serviceError;
    if (!service || !service.bookable) {
      return jsonError(400, "This service isn't available for online booking yet — please use Get a Quote.");
    }

    const requestedPackage = resolveRequestedPackage({ packageId: input.packageId, crewSize: input.crewSize });
    if (!requestedPackage.ok) return jsonError(400, requestedPackage.message);

    const settings = await getBusinessSettings();
    const startsAt = new Date(input.startsAt);
    // Scheduling occupancy uses the job's own duration only — the 1-hour
    // call-out is a PRICING add-on, never extra truck/crew time (per
    // confirmed policy: "billing duration and scheduling duration are
    // separate concepts"). Both, however, respect the 3-hour minimum,
    // since a job genuinely occupies the truck for at least that long.
    const requestedDurationMinutes = input.estimatedDurationMinutes ?? settings.defaultEstimatedDurationMinutes;
    const durationMinutes = Math.max(requestedDurationMinutes, settings.minimumBookingMinutes);
    const endsAt = new Date(startsAt.getTime() + durationMinutes * 60_000);

    const window = withinBookingWindow(startsAt, new Date(), settings);
    if (!window.ok) return jsonError(400, window.reason ?? "Requested time is outside the booking window.");

    // Duplicate-submission guard: the same customer already has a
    // CONFIRMED booking overlapping this window (e.g. a resubmitted
    // wizard). Don't take a second truck for the same move. Unconfirmed
    // holds are covered by the active-hold cap above and simply lapse.
    const { count: duplicateCount } = await getSupabaseAdmin()
      .from("bookings")
      .select("id, customers!inner(email)", { count: "exact", head: true })
      .in("booking_status", ["confirmed", "assigned", "in_progress"])
      .lt("starts_at", endsAt.toISOString())
      .gt("ends_at", startsAt.toISOString())
      .eq("customers.email", normalizedEmail);
    if ((duplicateCount ?? 0) > 0) {
      return jsonError(409, "You already have a booking at this time. Check your email for the confirmation, or choose a different time.", { code: "duplicate_booking" });
    }

    const [fleet, busy, blocked] = await Promise.all([
      getActiveVehicles(),
      getBusyIntervals(startsAt, endsAt),
      getBlockedIntervals(startsAt, endsAt),
    ]);
    if (fleet.length === 0) {
      return jsonError(503, TRUCK_UNAVAILABLE_MESSAGE, { code: "no_compatible_vehicle" });
    }
    // The selected truck decides which vehicles may take this job.
    const vehicleIds = compatibleVehicleIds(requestedPackage.packageId, fleet);
    if (vehicleIds.length === 0) {
      return jsonError(503, TRUCK_UNAVAILABLE_MESSAGE, { code: "no_compatible_vehicle" });
    }

    const vehicleId = pickFreeVehicle({ startsAt, endsAt }, vehicleIds, busy, blocked);
    if (!vehicleId) {
      return jsonError(409, "That time slot was just taken. Please choose another time.", { code: "slot_unavailable" });
    }

    const customerId = await findOrCreateCustomer(input.customer);
    const bookingNumber = await generateBookingNumber();

    try {
      const booking = await createBookingHold({
        bookingNumber,
        customerId,
        serviceId: service.id,
        startsAt,
        endsAt,
        estimatedDurationMinutes: durationMinutes,
        crewSize: requestedPackage.crewSize,
        packageId: requestedPackage.packageId,
        truckClass: requestedPackage.truckClass,
        vehicleId,
        pickupAddress: input.pickupAddress,
        destinationAddress: input.destinationAddress,
        moveDetails: input.moveDetails,
        customerNotes: input.customerNotes,
        holdMinutes: settings.bookingHoldMinutes,
      });

      const rule = await getPricingRule({ packageId: requestedPackage.packageId, crewSize: requestedPackage.crewSize });
      const quote = calculateQuote({ packageId: requestedPackage.packageId, crewSize: requestedPackage.crewSize, actualDurationMinutes: durationMinutes, startsAt }, rule, settings, settings.timezone);

      return NextResponse.json({
        bookingId: booking.id,
        bookingNumber: booking.booking_number,
        accessToken: booking.access_token,
        holdExpiresAt: booking.hold_expires_at,
        quote,
      });
    } catch (error) {
      if (error instanceof SlotUnavailableError) {
        return jsonError(409, "That time slot was just taken. Please choose another time.", { code: "slot_unavailable" });
      }
      throw error;
    }
  });
}
