import "server-only";
import { Resend } from "resend";
import { resendConfig } from "./config.ts";

let cached: Resend | null = null;

/** Lazily-constructed Resend client. See lib/server/config.ts for the pattern. */
export function getResend(): Resend {
  if (cached) return cached;
  cached = new Resend(resendConfig.apiKey());
  return cached;
}
