// Central "is this integration configured?" checks. Every server-only
// client (Supabase, Stripe, Resend, Google Calendar) is constructed lazily
// from these, inside request handlers — never at module scope — so the
// app builds and boots cleanly with zero env vars and the public site
// keeps working. Each getter throws a `NotConfiguredError` that route
// handlers turn into a 503 with a clear message, per AGENTS spec: "add
// graceful disabled states... clearly identify exactly which credentials
// remain required."

export class NotConfiguredError extends Error {
  // Declared explicitly (not as a constructor parameter property) so this
  // module stays importable by Node's type-stripping test runner.
  readonly missing: string[];

  constructor(missing: string[]) {
    super(`Not configured: missing ${missing.join(", ")}`);
    this.missing = missing;
    this.name = "NotConfiguredError";
  }
}

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new NotConfiguredError([name]);
  return value;
}

export const supabaseConfig = {
  isConfigured: () => Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY),
  url: () => required("NEXT_PUBLIC_SUPABASE_URL"),
  serviceRoleKey: () => required("SUPABASE_SERVICE_ROLE_KEY"),
  anonKey: () => required("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
};

/** Optional / legacy. Stripe is no longer part of the booking path; this
 * is read only by the dormant /api/stripe/webhook handler, which keeps
 * historical Stripe-era bookings consistent. */
export const stripeConfig = {
  isConfigured: () => Boolean(process.env.STRIPE_SECRET_KEY),
  isWebhookConfigured: () => Boolean(process.env.STRIPE_WEBHOOK_SECRET),
  secretKey: () => required("STRIPE_SECRET_KEY"),
  publishableKey: () => process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? null,
  webhookSecret: () => required("STRIPE_WEBHOOK_SECRET"),
};

export const resendConfig = {
  isConfigured: () => Boolean(process.env.RESEND_API_KEY && process.env.BOOKING_EMAIL_FROM),
  apiKey: () => required("RESEND_API_KEY"),
  from: () => required("BOOKING_EMAIL_FROM"),
  adminEmail: () => process.env.BOOKING_ADMIN_EMAIL ?? null,
};

export const googleCalendarConfig = {
  isConfigured: () =>
    Boolean(
      process.env.GOOGLE_CALENDAR_ID &&
        process.env.GOOGLE_CLIENT_ID &&
        process.env.GOOGLE_CLIENT_SECRET &&
        process.env.GOOGLE_REFRESH_TOKEN,
    ),
  calendarId: () => required("GOOGLE_CALENDAR_ID"),
  clientId: () => required("GOOGLE_CLIENT_ID"),
  clientSecret: () => required("GOOGLE_CLIENT_SECRET"),
  refreshToken: () => required("GOOGLE_REFRESH_TOKEN"),
};

export const cronConfig = {
  isConfigured: () => Boolean(process.env.CRON_SECRET),
  secret: () => required("CRON_SECRET"),
};

/**
 * Whether the public booking system should be exposed at all. No advance
 * payment is taken, so Supabase (the database of record) is the only
 * requirement — Stripe is deliberately NOT consulted. Resend, Google
 * Calendar and cron are optional add-ons. Without Supabase, /book shows
 * the "Get a Quote" fallback, per AGENTS: "add graceful disabled states."
 */
export function isBookingSystemLive(): boolean {
  return supabaseConfig.isConfigured();
}
