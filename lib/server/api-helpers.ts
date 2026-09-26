import "server-only";
import { NextResponse } from "next/server";
import { NotConfiguredError, isBookingSystemLive } from "./config.ts";

export function jsonError(status: number, message: string, extra?: Record<string, unknown>) {
  return NextResponse.json({ error: message, ...extra }, { status });
}

/** Wraps a route handler so a missing-config integration returns a clean 503, never a 500. */
export function withBookingSystemGuard<T>(handler: () => Promise<T>): Promise<T | NextResponse> {
  if (!isBookingSystemLive()) {
    return Promise.resolve(
      jsonError(503, "The online booking system is not yet configured. Please use the Get a Quote form.", {
        code: "booking_system_not_configured",
      }),
    );
  }
  return handler().catch((error) => {
    if (error instanceof NotConfiguredError) {
      return jsonError(503, "A required integration is not configured.", { missing: error.missing });
    }
    throw error;
  }) as Promise<T | NextResponse>;
}
