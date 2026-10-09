// Fake (unsigned, SYNTHETIC) Supabase auth session shared by the mock server and the screenshot script.
import { OWNER_EMAIL, OWNER_ID } from "./fixtures.mjs";

const b64url = (value) => Buffer.from(typeof value === "string" ? value : JSON.stringify(value)).toString("base64url");

export function ownerUser() {
  return {
    id: OWNER_ID,
    aud: "authenticated",
    role: "authenticated",
    email: OWNER_EMAIL,
    email_confirmed_at: "2026-01-01T00:00:00.000Z",
    phone: "",
    confirmed_at: "2026-01-01T00:00:00.000Z",
    last_sign_in_at: "2026-10-01T00:00:00.000Z",
    app_metadata: { provider: "email", providers: ["email"] },
    user_metadata: {},
    identities: [],
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-10-01T00:00:00.000Z",
    is_anonymous: false,
  };
}

export function buildSession() {
  const now = Math.floor(Date.now() / 1000);
  const exp = now + 10 * 365 * 24 * 3600;
  const access_token = `${b64url({ alg: "none", typ: "JWT" })}.${b64url({ sub: OWNER_ID, email: OWNER_EMAIL, role: "authenticated", aud: "authenticated", iat: now, exp })}.mock-signature`;
  return {
    access_token,
    token_type: "bearer",
    expires_in: exp - now,
    expires_at: exp,
    refresh_token: "mock-refresh-token",
    user: ownerUser(),
  };
}

/** Cookie name @supabase/ssr derives from the project URL: sb-<first hostname label>-auth-token. */
export function authCookieName(supabaseUrl) {
  return `sb-${new URL(supabaseUrl).hostname.split(".")[0]}-auth-token`;
}

const MAX_CHUNK = 3180; // @supabase/ssr chunk size (encoded characters)

/** Cookies exactly as @supabase/ssr 0.12 writes them: "base64-" + base64url(JSON), chunked as <name>.N when large. */
export function buildAuthCookies(supabaseUrl, domain = "127.0.0.1") {
  const name = authCookieName(supabaseUrl);
  const value = `base64-${b64url(buildSession())}`;
  const base = { domain, path: "/", httpOnly: true, secure: false, sameSite: "Lax" };
  if (value.length <= MAX_CHUNK) return [{ name, value, ...base }];
  const out = [];
  for (let i = 0, n = 0; i < value.length; i += MAX_CHUNK, n += 1) out.push({ name: `${name}.${n}`, value: value.slice(i, i + MAX_CHUNK), ...base });
  return out;
}
