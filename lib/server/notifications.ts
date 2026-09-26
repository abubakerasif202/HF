import "server-only";
import { resendConfig } from "./config.ts";
import { getResend } from "./resend.ts";
import { getSupabaseAdmin } from "./supabase.ts";
import { business } from "../site-data.ts";

interface PricingSnapshot {
  package?: string;
  ratePer30MinCents?: number;
  minimumBookingMinutes?: number;
  calloutMinutes?: number;
  bookingConfirmationCents?: number;
}

interface Address {
  formattedAddress?: string;
  addressLine?: string;
  suburb?: string;
}

interface BookingRow {
  id: string;
  booking_number: string;
  starts_at: string;
  customer_id: string | null;
  pickup_address: Address | null;
  destination_address: Address | null;
  deposit_paid_cents: number;
  subtotal_cents?: number;
  balance_due_cents?: number;
  pricing_snapshot?: PricingSnapshot | null;
  booking_status: string;
}

function addressLine(address: Address | null): string {
  if (!address) return "(not provided)";
  return address.formattedAddress ?? `${address.addressLine ?? ""} ${address.suburb ?? ""}`.trim();
}

async function logNotification(input: {
  bookingId: string;
  template: string;
  recipient: string;
  status: "sent" | "failed";
  error?: string;
  providerMessageId?: string;
}) {
  await getSupabaseAdmin().from("notifications").insert({
    booking_id: input.bookingId,
    channel: "email",
    template: input.template,
    recipient: input.recipient,
    status: input.status,
    error: input.error ?? null,
    provider_message_id: input.providerMessageId ?? null,
    sent_at: input.status === "sent" ? new Date().toISOString() : null,
  });
}

async function getCustomerEmail(customerId: string | null): Promise<string | null> {
  if (!customerId) return null;
  const { data } = await getSupabaseAdmin().from("customers").select("email, name").eq("id", customerId).maybeSingle();
  return data?.email ?? null;
}

/**
 * Sends the "booking confirmed" email to the customer and a copy to the
 * business admin address. Failures are logged to `notifications` rather
 * than thrown — an email outage must never un-confirm a booking that
 * Stripe has already been paid for (per AGENTS: "Do not silently lose
 * confirmed bookings because an email... API failed").
 */
export async function sendBookingConfirmedEmail(booking: BookingRow): Promise<void> {
  if (!resendConfig.isConfigured()) {
    await logNotification({ bookingId: booking.id, template: "booking_confirmed", recipient: "(unconfigured)", status: "failed", error: "RESEND_API_KEY / BOOKING_EMAIL_FROM not set" });
    return;
  }

  const email = await getCustomerEmail(booking.customer_id);
  if (!email) return;

  try {
    const snapshot = booking.pricing_snapshot ?? {};
    const rateLine = snapshot.ratePer30MinCents
      ? `$${(snapshot.ratePer30MinCents / 100).toFixed(0)} / 30 min ($${((snapshot.ratePer30MinCents * 2) / 100).toFixed(0)}/hr)`
      : "—";
    const html = `
      <p>Hi,</p>
      <p>Your move with ${business.name} is confirmed.</p>
      <ul>
        <li>Booking reference: ${booking.booking_number}</li>
        <li>Move date/time: ${new Date(booking.starts_at).toLocaleString("en-AU", { timeZone: "Australia/Adelaide" })}</li>
        <li>Pickup: ${addressLine(booking.pickup_address)}</li>
        <li>Destination: ${addressLine(booking.destination_address)}</li>
        <li>Package: ${snapshot.package ?? "—"}</li>
        <li>Rate per 30 minutes: ${rateLine}</li>
        <li>Minimum booking: ${snapshot.minimumBookingMinutes ? snapshot.minimumBookingMinutes / 60 : 3} hours</li>
        <li>Call-out: ${snapshot.calloutMinutes ? snapshot.calloutMinutes / 60 : 1} hour — includes truck fuel and basic transport charges</li>
        <li>$100 booking confirmation received</li>
        <li>Estimated minimum: $${((booking.subtotal_cents ?? 0) / 100).toFixed(2)}</li>
        <li>Estimated remaining balance: $${((booking.balance_due_cents ?? 0) / 100).toFixed(2)}</li>
      </ul>
      <p>Your $100 booking confirmation has been received and credited toward your final balance.</p>
      <p>Final price will be calculated upon completion of the job based on actual billable time.</p>
      <p>Questions? Reply to this email or call ${business.phones[0].display}.</p>
    `;
    const result = await getResend().emails.send({
      from: resendConfig.from(),
      to: email,
      subject: `Booking confirmed — ${booking.booking_number} — ${business.name}`,
      html,
    });
    await logNotification({ bookingId: booking.id, template: "booking_confirmed", recipient: email, status: "sent", providerMessageId: result.data?.id });

    const adminEmail = resendConfig.adminEmail();
    if (adminEmail) {
      await getResend().emails.send({
        from: resendConfig.from(),
        to: adminEmail,
        subject: `New confirmed booking — ${booking.booking_number}`,
        html: `<p>New confirmed booking ${booking.booking_number} for ${new Date(booking.starts_at).toLocaleString("en-AU", { timeZone: "Australia/Adelaide" })}.</p>`,
      });
    }
  } catch (error) {
    await logNotification({ bookingId: booking.id, template: "booking_confirmed", recipient: email, status: "failed", error: (error as Error).message });
    throw error;
  }
}

/** Alerts the admin that a payment arrived for a booking that could not be confirmed (slot conflict). Never blocks the webhook response. */
export async function notifyAdminOfConflict(booking: BookingRow): Promise<void> {
  const adminEmail = resendConfig.isConfigured() ? resendConfig.adminEmail() : null;
  if (!adminEmail) {
    await logNotification({ bookingId: booking.id, template: "payment_conflict", recipient: "(unconfigured)", status: "failed", error: "BOOKING_ADMIN_EMAIL not set" });
    return;
  }
  try {
    const result = await getResend().emails.send({
      from: resendConfig.from(),
      to: adminEmail,
      subject: `ACTION NEEDED: payment received for a booking that couldn't auto-confirm — ${booking.booking_number}`,
      html: `<p>A Stripe payment was received for booking ${booking.booking_number}, but it could not be automatically confirmed (current status: ${booking.booking_status}). This usually means its hold expired before payment landed. Please review manually in /admin/bookings and contact the customer to resolve the slot.</p>`,
    });
    await logNotification({ bookingId: booking.id, template: "payment_conflict", recipient: adminEmail, status: "sent", providerMessageId: result.data?.id });
  } catch (error) {
    await logNotification({ bookingId: booking.id, template: "payment_conflict", recipient: adminEmail, status: "failed", error: (error as Error).message });
  }
}
