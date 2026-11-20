import "server-only";
import { NextResponse } from "next/server";
import { getAdminAuthState } from "./supabase-ssr.ts";
import { supabaseConfig } from "./config.ts";

/** Shared guards for owner-only /api/admin/* route handlers. */

export const privateHeaders = { "Cache-Control": "private, no-store, max-age=0" };

export function adminJson(body: unknown, status = 200): NextResponse {
  return NextResponse.json(body, { status, headers: privateHeaders });
}

/** Returns a 401/403 response when the caller is not the authorized owner, else null. */
export async function denyUnlessAdmin(): Promise<NextResponse | null> {
  if (!supabaseConfig.isConfigured()) return adminJson({ error: "Not authorized" }, 401);
  const state = await getAdminAuthState();
  if (state.status === "authorized") return null;
  const status = state.status === "forbidden" ? 403 : 401;
  return adminJson({ error: status === 403 ? "Forbidden" : "Not authorized" }, status);
}

/** Authenticated mutations must come from our own origin, even if browser cookie policy changes. */
export function denyCrossOrigin(request: Request): NextResponse | null {
  const origin = request.headers.get("origin");
  if (!origin || origin !== new URL(request.url).origin) return adminJson({ error: "Invalid origin" }, 403);
  return null;
}

export type JsonBody = { ok: true; body: Record<string, unknown> } | { ok: false; response: NextResponse };

/** Reads a JSON object body, rejecting oversized, malformed and non-object payloads. */
export async function readJsonObject(request: Request, maxBytes: number): Promise<JsonBody> {
  if (Number(request.headers.get("content-length") ?? 0) > maxBytes) {
    return { ok: false, response: adminJson({ error: "Request too large" }, 413) };
  }
  let raw = "";
  try {
    raw = await request.text();
  } catch {
    return { ok: false, response: adminJson({ error: "Invalid request" }, 400) };
  }
  if (raw.length > maxBytes) return { ok: false, response: adminJson({ error: "Request too large" }, 413) };
  let body: unknown = null;
  try {
    body = JSON.parse(raw);
  } catch {
    body = null;
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, response: adminJson({ error: "Invalid request" }, 400) };
  }
  return { ok: true, body: body as Record<string, unknown> };
}

export const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
