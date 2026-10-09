import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { supabaseConfig } from "./config.ts";
import { isAuthorizedAdmin, isAdminEmail } from "../admin-access.ts";

/**
 * Cookie-backed Supabase client for staff authentication (admin login),
 * using the ANON key + RLS — distinct from lib/server/supabase.ts, which
 * uses the service role key for the public booking flow. Staff pages
 * authorize via Supabase Auth sessions and the `is_staff()` RLS helper,
 * never the service role key.
 */
/** Admin sessions are server-only: no browser Supabase client reads these cookies. */
export const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
};

export async function getSupabaseForServerComponent() {
  const cookieStore = await cookies();
  return createServerClient(supabaseConfig.url(), supabaseConfig.anonKey(), {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: () => {
        // Server Components can't set cookies; session refresh happens in
        // the server actions / route handlers below instead.
      },
    },
  });
}

export async function getSupabaseForServerAction() {
  const cookieStore = await cookies();
  return createServerClient(supabaseConfig.url(), supabaseConfig.anonKey(), {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (cookiesToSet) => {
        for (const { name, value, options } of cookiesToSet) {
          cookieStore.set(name, value, { ...options, ...SESSION_COOKIE_OPTIONS });
        }
      },
    },
  });
}

export type AdminAuthState =
  | { status: "authorized"; session: { userId: string; email: string; id: string; full_name: string; role: string; active: boolean } }
  | { status: "unauthenticated" }
  | { status: "forbidden" };

/** Distinguishes "no valid session" (401) from "valid session, not the owner" (403). */
export async function getAdminAuthState(): Promise<AdminAuthState> {
  const supabase = await getSupabaseForServerComponent();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return { status: "unauthenticated" };
  if (!isAdminEmail(data.user.email)) return { status: "forbidden" };
  const { data: staff } = await supabase.from("staff").select("id, full_name, role, active").eq("id", data.user.id).maybeSingle();
  if (!staff || !isAuthorizedAdmin(data.user.email, staff)) return { status: "forbidden" };
  return { status: "authorized", session: { userId: data.user.id, email: data.user.email as string, ...staff } };
}

export async function getStaffSession() {
  const state = await getAdminAuthState();
  return state.status === "authorized" ? state.session : null;
}
