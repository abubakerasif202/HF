import "server-only";
import Stripe from "stripe";
import { stripeConfig } from "./config.ts";

let cached: Stripe | null = null;

/** Lazily-constructed Stripe client. See lib/server/config.ts for the pattern. */
export function getStripe(): Stripe {
  if (cached) return cached;
  cached = new Stripe(stripeConfig.secretKey());
  return cached;
}
