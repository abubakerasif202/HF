import "server-only";
import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { supabaseConfig } from "../../../../lib/server/config.ts";
import { getSupabaseAdmin } from "../../../../lib/server/supabase.ts";
import { enforceRateLimit } from "../../../../lib/server/rate-limit.ts";

export const runtime = "nodejs";

// An optional, best-effort mirror of the CURRENT Web3Forms quote flow.
// Web3Forms stays the email delivery service. This endpoint cannot verify
// receipt by Web3Forms; therefore stored delivery_status is "unknown".
const FIELDS = [
  "name", "phone", "moving_from", "moving_to", "email",
  "preferred_moving_date", "move_type", "move_category", "truck_package_id",
  "property_size", "floor_access", "parking_access", "boxes_needed",
  "services[]", "details", "source_page",
] as const;

type SubmittedFields = Record<string, string | string[]>;

function normaliseFields(value: unknown): SubmittedFields | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const source = value as Record<string, unknown>;
  // Discard arbitrary keys (especially the Web3Forms access_key and honeypot).
  const result: SubmittedFields = {};
  for (const key of FIELDS) {
    const item = source[key];
    if (typeof item === "string") {
      result[key] = item.trim().slice(0, key === "details" ? 4000 : 500);
    } else if (key === "services[]" && Array.isArray(item) && item.length <= 12 && item.every((x) => typeof x === "string")) {
      result[key] = item.map((x: string) => x.trim().slice(0, 200));
    }
  }
  if (!result.name || !result.phone || !result.moving_from || !result.moving_to) return null;
  return result;
}

export async function POST(request: Request) {
  const noStore = { "Cache-Control": "no-store" };
  try {
    // Same-origin capture only, no cross-origin credentialed API access.
    const origin = request.headers.get("origin");
    if (!origin || origin !== new URL(request.url).origin) {
      return NextResponse.json({ success: false }, { status: 403, headers: noStore });
    }
    if (!supabaseConfig.isConfigured()) {
      return NextResponse.json({ success: false, code: "capture_disabled" }, { status: 503, headers: noStore });
    }
    if (Number(request.headers.get("content-length") ?? 0) > 16384) {
      return NextResponse.json({ success: false }, { status: 413, headers: noStore });
    }
    const limitResponse = await enforceRateLimit(request, "quote");
    if (limitResponse) return limitResponse;

    const body: unknown = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json({ success: false }, { status: 400, headers: noStore });
    }
    const input = body as Record<string, unknown>;
    const uuid = input.id;
    if (typeof uuid !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(uuid)) {
      return NextResponse.json({ success: false }, { status: 400, headers: noStore });
    }
    const fields = normaliseFields(input.fields);
    if (!fields) return NextResponse.json({ success: false }, { status: 400, headers: noStore });

    const payloadHash = createHash("sha256").update(JSON.stringify(fields)).digest("hex");
    const { error } = await getSupabaseAdmin().from("quote_requests").upsert(
      { id: uuid, payload_hash: payloadHash, payload: fields, quote_status: "new", delivery_status: "unknown" },
      { onConflict: "id", ignoreDuplicates: true },
    );
    if (error) {
      console.error("HF quote capture unavailable:", error.code);
      return NextResponse.json({ success: false }, { status: 503, headers: noStore });
    }
    return NextResponse.json({ success: true }, { status: 201, headers: noStore });
  } catch {
    return NextResponse.json({ success: false }, { status: 503, headers: noStore });
  }
}
