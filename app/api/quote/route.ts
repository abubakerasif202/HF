import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server.js";
import { quoteSchema } from "../../../lib/quotes/schema.ts";
import { acceptQuote } from "../../../lib/quotes/workflow.ts";
import { saveQuote, recordQuoteDelivery } from "../../../lib/server/quote-repo.ts";
import { sendQuoteNotification } from "../../../lib/server/quote-notifications.ts";
import { scheduleMauticSync } from "../../../lib/integrations/mautic/schedule-sync.ts";
import { enforceRateLimit } from "../../../lib/server/rate-limit.ts";
import { supabaseConfig } from "../../../lib/server/config.ts";
import { business } from "../../../lib/site-data.ts";
import { safePage } from "../../../lib/marketing-attribution.ts";
export const maxDuration = 30;
export async function POST(request: Request) {
  if (process.env.NEXT_PUBLIC_HF_QUOTE_BRIDGE_ENABLED !== "true" || !supabaseConfig.isConfigured()) return NextResponse.json({ success: false }, { status: 503 });
  if (request.headers.get("origin") !== new URL(request.url).origin) return NextResponse.json({ success: false }, { status: 403 });
  try {
    const limited = await enforceRateLimit(request, "quote");
    if (limited) return limited;
    // Bound actual streamed bytes, not a caller-controlled Content-Length.
    const reader = request.body?.getReader();
    if (!reader) return NextResponse.json({ success: false }, { status: 400 });
    const chunks: Uint8Array[] = []; let length = 0;
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      length += value.byteLength;
      if (length > 32768) { await reader.cancel(); return NextResponse.json({ success: false }, { status: 413 }); }
      chunks.push(value);
    }
    const bytes = Buffer.concat(chunks);
    const contentType = request.headers.get("content-type") ?? "";
    let input: unknown;
    if (contentType.startsWith("application/json")) {
      try { input = JSON.parse(bytes.toString("utf8")); } catch { return NextResponse.json({ success: false }, { status: 400 }); }
    }
    else if (contentType.startsWith("multipart/form-data") || contentType.startsWith("application/x-www-form-urlencoded")) {
      const form = await new Response(bytes, { headers: { "Content-Type": contentType } }).formData();
      input = { ...Object.fromEntries(form), "services[]": form.getAll("services[]"), request_id: form.get("request_id") || randomUUID(), attribution_consent: false };
    } else return NextResponse.json({ success: false }, { status: 415 });
    const parsed = quoteSchema.safeParse(input);
    if (!parsed.success) return NextResponse.json({ success: false }, { status: 400 });
    const quote = parsed.data;
    if (quote._gotcha) return NextResponse.json({ success: true });
    quote.source_page = safePage(quote.source_page) ?? business.domain;
    if (!quote.attribution_consent) delete quote.attribution;
    const result = await acceptQuote(quote, {
      save: saveQuote, deliver: sendQuoteNotification, recordDelivery: recordQuoteDelivery,
      schedule: scheduleMauticSync, onError: (code) => console.warn("quote_side_effect_failed", { code }),
    });
    return NextResponse.json(result);
  } catch { console.warn("quote_submission_failed"); return NextResponse.json({ success: false }, { status: 503 }); }
}
