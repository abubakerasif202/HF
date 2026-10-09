import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { getStaffSession } from "./supabase-ssr.ts";

/**
 * Per-request authorization check for admin pages. Layouts do not re-render
 * on client navigation, so every admin page must call this before reading
 * data. Returns the verified owner session or redirects to the login page.
 */
export const requireAdmin = cache(async () => {
  const session = await getStaffSession().catch(() => null);
  if (!session) redirect("/admin/login");
  return session;
});
