import "server-only";
import { resendConfig } from "./config.ts";
import { getResend } from "./resend.ts";
import { getSupabaseAdmin } from "./supabase.ts";
import { business } from "../site-data.ts";

import type { PricingSnapshot } from "../booking/types.ts";

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

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

/** Customer-typed address, HTML-escaped for safe interpolation into email bodies. */
function addressLine(address: Address | null): string {
  if (!address) return "(not provided)";
  return escapeHtml(address.formattedAddress ?? `${address.addressLine ?? ""} ${address.suburb ?? ""}`.trim());
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
 * than thrown — an email outage must never un-confirm a booking (per
 * AGENTS: "Do not silently lose confirmed bookings because an email...
 * API failed"). Callers invoke this only when the booking has just
 * transitioned to confirmed, so it is sent once per booking.
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
    // Read what was genuinely recorded; historical Stripe-era bookings
    // paid a confirmation amount, new bookings pay nothing up-front.
    const paidCents = booking.deposit_paid_cents ?? 0;
    const paymentLine = paidCents > 0 ? `Booking confirmation paid: $${(paidCents / 100).toFixed(2)}` : "Advance payment: not required";
    const html = `
      <p>Hi,</p>
      <p>Booking confirmed — your move with ${business.name} has been received and confirmed.</p>
      <ul>
        <li>Booking reference: ${booking.booking_number}</li>
        <li>Move date/time: ${new Date(booking.starts_at).toLocaleString("en-AU", { timeZone: "Australia/Adelaide" })}</li>
        <li>Pickup: ${addressLine(booking.pickup_address)}</li>
        <li>Destination: ${addressLine(booking.destination_address)}</li>
        <li>Package: ${snapshot.package ?? "—"}</li>
        <li>Rate per 30 minutes: ${rateLine}</li>
        <li>Minimum service: ${snapshot.minimumBookingMinutes ? snapshot.minimumBookingMinutes / 60 : 3} hours</li>
        <li>Call-out: ${snapshot.calloutMinutes ? snapshot.calloutMinutes / 60 : 1} hour${snapshot.ratePer30MinCents && snapshot.calloutMinutes ? ` — $${((snapshot.ratePer30MinCents * (snapshot.calloutMinutes / 30)) / 100).toFixed(0)}` : ""} — includes truck fuel and basic transport charges</li>
        <li>Estimated minimum: $${((booking.subtotal_cents ?? 0) / 100).toFixed(2)}</li>
        <li>${paymentLine}</li>
      </ul>
      <p>No advance payment is required. Your final price is calculated after your move is completed.</p>
      <p>3-hour minimum service + 1-hour call-out fee. The call-out covers truck fuel and basic transport charges. Additional service time is billed in 30-minute increments at your selected package rate.</p>
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
        html: `<p>New confirmed booking ${booking.booking_number} for ${new Date(booking.starts_at).toLocaleString("en-AU", { timeZone: "Australia/Adelaide" })}. ${paymentLine}.</p>`,
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
