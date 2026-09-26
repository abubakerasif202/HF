import { redirect } from "next/navigation";
import { getStaffSession } from "../../lib/server/supabase-ssr.ts";
import { isBookingSystemLive } from "../../lib/server/config.ts";
import { AdminNav } from "./AdminNav";

export const dynamic = "force-dynamic";

const NAV_ITEMS = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/bookings", label: "Bookings" },
  { href: "/admin/calendar", label: "Calendar" },
  { href: "/admin/availability", label: "Availability" },
  { href: "/admin/vehicles", label: "Vehicles" },
  { href: "/admin/crews", label: "Crews" },
  { href: "/admin/pricing", label: "Pricing" },
  { href: "/admin/settings", label: "Settings" },
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
    <div className="flex min-h-screen flex-col md:flex-row">
      <AdminNav items={NAV_ITEMS} staffEmail={staff.email ?? ""} staffRole={staff.role} />
      <main className="flex-1 px-4 py-6 md:px-8 md:py-8">{children}</main>
    </div>
  );
}
