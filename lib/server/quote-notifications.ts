import "server-only";
import { z } from "zod";
import type { CreateEmailRequestOptions } from "resend";
import { getResend } from "./resend.ts";
import { resendConfig } from "./config.ts";
import { business } from "../site-data.ts";
import type { QuoteInput } from "../quotes/schema.ts";
import type { QuoteDeliveryResult } from "../quotes/delivery.ts";

const clean = (value: string) => value.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "");
const escapeHtml = (value: string) => clean(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

/** Admin only. Provider acceptance is not proof of inbox delivery. No automatic resend. */
export async function sendQuoteNotification(quote: QuoteInput): Promise<QuoteDeliveryResult> {
  const attemptedAt = new Date().toISOString();
  const result = (status: QuoteDeliveryResult["status"], failureCategory?: QuoteDeliveryResult["failureCategory"]): QuoteDeliveryResult => ({ status, attemptedAt, ...(failureCategory ? { failureCategory } : {}) });
  const recipient = resendConfig.adminEmail();
  const customerEmail = z.email().safeParse(quote.email);
  if (!resendConfig.isConfigured() || !recipient || !z.email().safeParse(recipient).success || /[\r\n\u0000]/.test(resendConfig.from())) return result("failed", "configuration");
  const fields: [string, string][] = [
    ["Quote reference", quote.request_id], ["Customer name", quote.name], ["Phone", quote.phone],
    ["Email", quote.email], ["Moving from", quote.moving_from], ["Moving to", quote.moving_to],
    ["Move category", quote.move_category], ["Move type", quote.move_type], ["Moving package", quote.moving_package],
    ["Preferred moving date", quote.preferred_moving_date], ["Property size", quote.property_size],
    ["Floor/building access", quote.floor_access], ["Parking/truck access", quote.parking_access],
    ["Packing boxes", quote.boxes_needed], ["Additional services", quote["services[]"].join(", ")],
    ["Customer details", quote.details], ["Source page", quote.source_page],
  ];
  if (quote.attribution_consent && quote.attribution) {
    for (const [key, value] of Object.entries(quote.attribution)) if (value) fields.push([key, value]);
  }
  const supplied = fields.filter(([, value]) => value);
  const html = `<h1>${escapeHtml(business.name)} — Quote request</h1><table>${supplied.map(([label, value]) => `<tr><th style="text-align:left;vertical-align:top">${escapeHtml(label)}</th><td style="white-space:pre-wrap">${escapeHtml(value)}</td></tr>`).join("")}</table>`;
  const text = `${business.name} — Quote request\n\n${supplied.map(([label, value]) => `${label}: ${clean(value)}`).join("\n")}`;
  const signal = AbortSignal.timeout(8000);
  // Installed Resend SDK forwards request options to fetch, including signal.
  const options: CreateEmailRequestOptions & { signal: AbortSignal } = { idempotencyKey: `hf-quote/${quote.request_id}`, signal };
  try {
    const response = await getResend().emails.send({
      from: resendConfig.from(), to: recipient,
      ...(customerEmail.success ? { replyTo: customerEmail.data } : {}),
      subject: `New HF Removals Quote Request — ${quote.request_id}`, html, text,
    }, options);
    if (response.error) {
      const code = response.error.statusCode;
      if (code === 401 || code === 403) return result("failed", "authentication");
      if (typeof code === "number" && code >= 400 && code < 500) return result("failed", "rejected");
      return result("unknown", signal.aborted ? "timeout" : typeof code === "number" ? "provider" : "network");
    }
    return response.data && typeof response.data.id === "string" && response.data.id ? result("sent") : result("unknown", "invalid_response");
  } catch { return result("unknown", signal.aborted ? "timeout" : "network"); }
}
