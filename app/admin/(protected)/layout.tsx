import { redirect } from "next/navigation";
import { getStaffSession } from "../../../lib/server/supabase-ssr.ts";
import { isBookingSystemLive } from "../../../lib/server/config.ts";
import { AdminNav, type NavItem } from "./AdminNav";

export const dynamic = "force-dynamic";

const NAV_ITEMS: NavItem[] = [
  { href: "/admin", label: "Dashboard", icon: "dashboard" },
  { href: "/admin/bookings", label: "Bookings", icon: "bookings" },
  { href: "/admin/quotes", label: "Quote enquiries", icon: "inbox" },
  { href: "/admin/calendar", label: "Calendar", icon: "calendar" },
  { href: "/admin/availability", label: "Availability", icon: "availability" },
  { href: "/admin/vehicles", label: "Vehicles", icon: "truck" },
  { href: "/admin/crews", label: "Crews", icon: "crew" },
  { href: "/admin/pricing", label: "Pricing", icon: "pricing" },
  { href: "/admin/settings", label: "Settings", icon: "settings" },
];

/**
 * Shared authenticated shell for every /admin/* page except /admin/login.
 * Guards on the server: no staff session -> redirect before any page body
 * or data query runs. Individual pages still re-check inside server
 * actions (mutations must never trust the layout alone), but reads are
 * safe to gate here.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  if (!isBookingSystemLive()) redirect("/admin/login");
  const staff = await getStaffSession();
  if (!staff) redirect("/admin/login");

  return (
    <div className="admin-shell flex min-h-screen flex-col md:flex-row">
      <AdminNav items={NAV_ITEMS} staffEmail={staff.email ?? ""} staffRole={staff.role} />
      <main id="admin-main" className="admin-main">{children}</main>
    </div>
  );
}
