import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withBookingSystemGuard, jsonError } from "../../../../lib/server/api-helpers.ts";
import {
  getBusinessSettings,
  getActiveVehicleIds,
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

export const dynamic = "force-dynamic";

const addressSchema = z.object({
  addressLine: z.string().min(1),
  suburb: z.string().min(1),
  state: z.string().min(1),
  postcode: z.string().min(1),
  country: z.string().default("Australia"),
  formattedAddress: z.string().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  placeId: z.string().optional(),
});

const bodySchema = z.object({
  serviceSlug: z.string().min(1),
  crewSize: z.coerce.number().int().min(1).max(10),
  startsAt: z.string().datetime(),
  estimatedDurationMinutes: z.coerce.number().int().min(30).max(600).optional(),
  pickupAddress: addressSchema,
  destinationAddress: addressSchema,
  moveDetails: z.record(z.string(), z.unknown()).default({}),
  customer: z.object({
    name: z.string().min(1),
    email: z.string().email(),
    phone: z.string().optional(),
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
    const body = bodySchema.safeParse(await request.json().catch(() => null));
    if (!body.success) return jsonError(400, "Invalid booking request", { issues: body.error.issues });
    const input = body.data;

    if (input.website) {
      // Honeypot tripped — respond as if it succeeded so the bot doesn't
      // learn to look for a different signal, but never actually create a hold.
      return jsonError(429, "Too many requests.");
    }

    // Cheap anti-spam caps. With no payment friction any more, these are
    // the floor that stops one email from squatting on (or confirming)
    // every slot. They do not stop a determined attacker rotating
    // emails/IPs — a proper per-IP rate limiter (e.g. Upstash Redis or
    // Vercel's edge rate limiting) is the real fix and is not wired up here.
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

    // Duplicate-submission guard: the same customer already holds or has
    // confirmed a live booking overlapping this exact window (e.g. a
    // resubmitted wizard). Don't take a second truck for the same move.
    const { count: duplicateCount } = await getSupabaseAdmin()
      .from("bookings")
      .select("id, customers!inner(email)", { count: "exact", head: true })
      .in("booking_status", ["held", "confirmed", "assigned", "in_progress"])
      .lt("starts_at", endsAt.toISOString())
      .gt("ends_at", startsAt.toISOString())
      .eq("customers.email", normalizedEmail);
    if ((duplicateCount ?? 0) > 0) {
      return jsonError(409, "You already have a booking at this time. Check your email for the confirmation, or choose a different time.", { code: "duplicate_booking" });
    }

    const [vehicleIds, busy, blocked] = await Promise.all([
      getActiveVehicleIds(),
      getBusyIntervals(startsAt, endsAt),
      getBlockedIntervals(startsAt, endsAt),
    ]);
    if (vehicleIds.length === 0) {
      return jsonError(503, "No vehicles are configured yet — an admin must add at least one vehicle before bookings can be taken.");
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
        crewSize: input.crewSize,
        vehicleId,
        pickupAddress: input.pickupAddress,
        destinationAddress: input.destinationAddress,
        moveDetails: input.moveDetails,
        customerNotes: input.customerNotes,
        holdMinutes: settings.bookingHoldMinutes,
      });

      const rule = await getPricingRule(input.crewSize);
      const quote = calculateQuote({ crewSize: input.crewSize, actualDurationMinutes: durationMinutes, startsAt }, rule, settings, settings.timezone);

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
