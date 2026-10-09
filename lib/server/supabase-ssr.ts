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
          cookieStore.set(name, value, options);
        }
      },
    },
  });
}

export async function getStaffSession() {
  const supabase = await getSupabaseForServerComponent();
  const { data } = await supabase.auth.getUser();
  if (!data.user || !isAdminEmail(data.user.email)) return null;
  const { data: staff } = await supabase.from("staff").select("id, full_name, role, active").eq("id", data.user.id).maybeSingle();
  if (!isAuthorizedAdmin(data.user.email, staff)) return null;
  return { userId: data.user.id, email: data.user.email, ...staff };
}
