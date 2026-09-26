// Central "is this integration configured?" checks. Every server-only
// client (Supabase, Stripe, Resend, Google Calendar) is constructed lazily
// from these, inside request handlers — never at module scope — so the
// app builds and boots cleanly with zero env vars and the public site
// keeps working. Each getter throws a `NotConfiguredError` that route
// handlers turn into a 503 with a clear message, per AGENTS spec: "add
// graceful disabled states... clearly identify exactly which credentials
// remain required."

export class NotConfiguredError extends Error {
  constructor(public readonly missing: string[]) {
    super(`Not configured: missing ${missing.join(", ")}`);
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
 * Whether the public booking system should be exposed at all. Gated on
 * the minimum needed to safely take a real payment: Supabase (the
 * database of record) and Stripe (the deposit). Without both, the
 * "Book Your Move" CTA stays hidden and /book redirects to the existing
 * "Get a Quote" flow, per AGENTS: "add graceful disabled states."
 */
export function isBookingSystemLive(): boolean {
  return supabaseConfig.isConfigured() && stripeConfig.isConfigured();
}
