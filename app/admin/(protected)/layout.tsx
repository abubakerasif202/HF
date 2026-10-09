import { redirect } from "next/navigation";
import { getStaffSession } from "../../../lib/server/supabase-ssr.ts";
import { getSupabaseAdmin } from "../../../lib/server/supabase.ts";
import { isBookingSystemLive } from "../../../lib/server/config.ts";
import { AdminShell, type NavGroup } from "../_components/shell/AdminShell";

export const dynamic = "force-dynamic";

const NAV_GROUPS: NavGroup[] = [
  {
    label: "Operations",
    items: [
      { href: "/admin", label: "Dashboard", icon: "dashboard" },
      { href: "/admin/bookings", label: "Bookings", icon: "bookings" },
      { href: "/admin/quotes", label: "Quote enquiries", icon: "inbox" },
      { href: "/admin/calendar", label: "Calendar", icon: "calendar" },
    ],
  },
  {
    label: "Management",
    items: [
      { href: "/admin/availability", label: "Availability", icon: "availability" },
      { href: "/admin/vehicles", label: "Vehicles", icon: "truck" },
      { href: "/admin/crews", label: "Crews", icon: "crew" },
      { href: "/admin/pricing", label: "Pricing", icon: "pricing" },
      { href: "/admin/settings", label: "Settings", icon: "settings" },
    ],
  },
];

/** Live count of untouched enquiries for the sidebar badge. Never blocks the page if it fails. */
async function newEnquiryCount(): Promise<number | null> {
  try {
    const { count, error } = await getSupabaseAdmin()
      .from("quote_requests")
      .select("id", { count: "exact", head: true })
      .eq("quote_status", "new");
    return error ? null : (count ?? 0);
  } catch {
    return null;
  }
}

/**
 * Shared authenticated shell for every /admin/* page except /admin/login.
 * Guards on the server: no staff session -> redirect before any page body
 * or data query runs. Individual pages still re-check via requireAdmin() and
 * server actions re-check themselves (mutations must never trust the layout).
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  if (!isBookingSystemLive()) redirect("/admin/login");
  const staff = await getStaffSession();
  if (!staff) redirect("/admin/login");

  const newEnquiries = await newEnquiryCount();
  const badges: Record<string, number> = newEnquiries ? { "/admin/quotes": newEnquiries } : {};

  return (
    <div className="admin-shell">
      <AdminShell groups={NAV_GROUPS} staffEmail={staff.email ?? ""} staffRole={staff.role} badges={badges}>
        {children}
      </AdminShell>
    </div>
  );
}
