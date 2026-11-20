import "server-only";
import { z } from "zod";
import { adminJson, denyCrossOrigin, denyUnlessAdmin, readJsonObject, UUID_PATTERN } from "../../../../../lib/server/admin-api-guard.ts";
import {
  createBookingHold,
  findOrCreateCustomer,
  generateBookingNumber,
  getActiveVehicles,
  getBlockedIntervals,
  getBusinessSettings,
  getBusyIntervals,
  SlotUnavailableError,
} from "../../../../../lib/server/booking-repo.ts";
import { QUOTE_SELECT } from "../../../../../lib/server/quote-crm-repo.ts";
import { getSupabaseAdmin } from "../../../../../lib/server/supabase.ts";
import { pickFreeVehicle, withinBookingWindow } from "../../../../../lib/booking/availability.ts";
import { compatibleVehicleIds } from "../../../../../lib/booking/vehicles.ts";
import { resolveRequestedPackage } from "../../../../../lib/booking/package-request.ts";
import { statusChangeFields } from "../../../../../lib/admin/quote-crm.ts";
import { TRUCK_UNAVAILABLE_MESSAGE } from "../../../../../lib/site-data.ts";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_BODY_BYTES = 32_768;
/** A draft made by the owner must outlive the 30-minute customer hold so the quote can be followed up. */
const DRAFT_HOLD_MINUTES = 48 * 60;

const addressSchema = z.object({
  addressLine: z.string().trim().min(1).max(300),
  suburb: z.string().trim().min(1).max(120),
  state: z.string().trim().min(1).max(60),
  postcode: z.string().trim().min(1).max(12),
  country: z.string().max(60).default("Australia"),
  formattedAddress: z.string().max(400).optional(),
});

const convertSchema = z.strictObject({
  quoteId: z.string().regex(UUID_PATTERN),
  serviceSlug: z.string().min(1).max(100),
  packageId: z.string().min(1).max(64),
  startsAt: z.string().datetime(),
  estimatedDurationMinutes: z.coerce.number().int().min(30).max(600).optional(),
  pickupAddress: addressSchema,
  destinationAddress: addressSchema,
  customer: z.object({
    name: z.string().trim().min(1).max(200),
    email: z.string().trim().max(254).email(),
    phone: z.string().trim().max(40).optional(),
  }),
  customerNotes: z.string().max(2000).optional(),
});

/**
 * POST /api/admin/quotes/convert — owner-only. Creates a held booking draft from a quote enquiry
 * using the same availability checks as the public hold flow (window, duplicate guard,
 * compatible vehicle, pickFreeVehicle), then links it to the quote and marks the quote booked.
 * The customer's own confirmation path (POST /api/booking/confirm) is unchanged.
 */
export async function POST(request: Request) {
  try {
    const denied = await denyUnlessAdmin();
    if (denied) return denied;
    const crossOrigin = denyCrossOrigin(request);
    if (crossOrigin) return crossOrigin;
    const body = await readJsonObject(request, MAX_BODY_BYTES);
    if (!body.ok) return body.response;
    const parsed = convertSchema.safeParse(body.body);
    if (!parsed.success) {
      return adminJson({ error: "Invalid booking details", issues: parsed.error.issues.map((issue) => ({ path: issue.path, message: issue.message })) }, 400);
    }
    const input = parsed.data;
    const supabase = getSupabaseAdmin();

    const { data: quote, error: quoteError } = await supabase
      .from("quote_requests")
      .select("id, quote_status, first_response_at, booking_id")
      .eq("id", input.quoteId)
      .maybeSingle();
    if (quoteError) throw quoteError;
    if (!quote) return adminJson({ error: "Quote not found" }, 404);
    if (quote.booking_id) return adminJson({ error: "This enquiry already has a booking linked.", code: "already_converted" }, 409);

    const requestedPackage = resolveRequestedPackage({ packageId: input.packageId });
    if (!requestedPackage.ok) return adminJson({ error: requestedPackage.message }, 400);

    const { data: service, error: serviceError } = await supabase
      .from("services")
      .select("id, bookable")
      .eq("slug", input.serviceSlug)
      .maybeSingle();
    if (serviceError) throw serviceError;
    if (!service || !service.bookable) return adminJson({ error: "That service isn't available for booking." }, 400);

    const settings = await getBusinessSettings();
    const startsAt = new Date(input.startsAt);
    const durationMinutes = Math.max(input.estimatedDurationMinutes ?? settings.defaultEstimatedDurationMinutes, settings.minimumBookingMinutes);
    const endsAt = new Date(startsAt.getTime() + durationMinutes * 60_000);

    const window = withinBookingWindow(startsAt, new Date(), settings);
    if (!window.ok) return adminJson({ error: window.reason ?? "Requested time is outside the booking window." }, 400);

    const normalizedEmail = input.customer.email.trim().toLowerCase();
    const { count: duplicateCount } = await supabase
      .from("bookings")
      .select("id, customers!inner(email)", { count: "exact", head: true })
      .in("booking_status", ["confirmed", "assigned", "in_progress"])
      .lt("starts_at", endsAt.toISOString())
      .gt("ends_at", startsAt.toISOString())
      .eq("customers.email", normalizedEmail);
    if ((duplicateCount ?? 0) > 0) {
      return adminJson({ error: "This customer already has a booking at that time.", code: "duplicate_booking" }, 409);
    }

    const [fleet, busy, blocked] = await Promise.all([getActiveVehicles(), getBusyIntervals(startsAt, endsAt), getBlockedIntervals(startsAt, endsAt)]);
    const vehicleIds = compatibleVehicleIds(requestedPackage.packageId, fleet);
    if (fleet.length === 0 || vehicleIds.length === 0) {
      return adminJson({ error: TRUCK_UNAVAILABLE_MESSAGE, code: "no_compatible_vehicle" }, 503);
    }
    const vehicleId = pickFreeVehicle({ startsAt, endsAt }, vehicleIds, busy, blocked);
    if (!vehicleId) return adminJson({ error: "That time slot is not available. Choose another time.", code: "slot_unavailable" }, 409);

    const customerId = await findOrCreateCustomer(input.customer);
    const bookingNumber = await generateBookingNumber();
    let booking: { id: string; booking_number: string; hold_expires_at: string | null };
    try {
      booking = await createBookingHold({
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
        moveDetails: { service: input.serviceSlug, source: "admin_quote_conversion", quote_request_id: quote.id },
        customerNotes: input.customerNotes,
        holdMinutes: Math.max(settings.bookingHoldMinutes, DRAFT_HOLD_MINUTES),
      });
    } catch (error) {
      if (error instanceof SlotUnavailableError) {
        return adminJson({ error: "That time slot was just taken. Choose another time.", code: "slot_unavailable" }, 409);
      }
      throw error;
    }

    const { data: updated, error: linkError } = await supabase
      .from("quote_requests")
      .update({ ...statusChangeFields(quote, "booked", new Date().toISOString()), booking_id: booking.id })
      .eq("id", quote.id)
      .is("booking_id", null)
      .select(QUOTE_SELECT)
      .maybeSingle();
    if (linkError || !updated) {
      console.error("HF quote link after conversion failed:", linkError?.code);
      return adminJson({ error: `Booking ${booking.booking_number} was created but could not be linked to this enquiry. Open it from Bookings.`, code: "link_failed", bookingId: booking.id, bookingNumber: booking.booking_number }, 500);
    }
    return adminJson({ bookingId: booking.id, bookingNumber: booking.booking_number, holdExpiresAt: booking.hold_expires_at, quote: updated });
  } catch {
    return adminJson({ error: "Unable to create the booking draft" }, 503);
  }
}
