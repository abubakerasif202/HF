import "server-only";
import { createHash } from "node:crypto";
import { getSupabaseAdmin } from "./supabase.ts";
import type { QuoteDeliveryResult } from "../quotes/delivery.ts";
import type { QuoteInput } from "../quotes/schema.ts";
export async function saveQuote(quote: QuoteInput): Promise<"created" | "existing"> {
  const payloadHash = createHash("sha256").update(JSON.stringify(quote)).digest("hex");
  const db = getSupabaseAdmin();
  const { error } = await db.from("quote_requests").insert({ id: quote.request_id, payload_hash: payloadHash, payload: quote });
  if (!error) return "created";
  if (error.code !== "23505") throw new Error("quote_save_failed");
  const existing = await db.from("quote_requests").select("payload_hash").eq("id", quote.request_id).single();
  if (existing.error || existing.data.payload_hash !== payloadHash) throw new Error("quote_request_conflict");
  return "existing";
}
export async function recordQuoteDelivery(id: string, delivery: QuoteDeliveryResult) {
  const { error } = await getSupabaseAdmin().from("quote_requests").update({ delivery_status: delivery.status, delivery_provider: "resend", notification_attempted_at: delivery.attemptedAt, delivery_failure_category: delivery.failureCategory ?? null }).eq("id", id);
  if (error) throw new Error("quote_delivery_record_failed");
}
