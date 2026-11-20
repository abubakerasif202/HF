import { redirect } from "next/navigation";
import { getStaffSession } from "../../../lib/server/supabase-ssr.ts";
import { countQuotesNeedingAttention } from "../../../lib/server/quote-crm-repo.ts";
import { isBookingSystemLive } from "../../../lib/server/config.ts";
import { AdminShell, type NavGroup } from "../_components/shell/AdminShell";
import { countCloseoutJobs } from "../../../lib/server/closeout-repo.ts";

export const dynamic = "force-dynamic";

const NAV_GROUPS: NavGroup[] = [
  {
    label: "Operations",
    items: [
      { href: "/admin", label: "Dashboard", icon: "dashboard" },
      { href: "/admin/bookings", label: "Bookings", icon: "bookings" },
      { href: "/admin/dispatch", label: "Dispatch", icon: "truck" },
      { href: "/admin/quotes", label: "Quote enquiries", icon: "inbox" },
      { href: "/admin/customers", label: "Customers", icon: "user" },
      { href: "/admin/invoices", label: "Invoices", icon: "dollar" },
      { href: "/admin/calendar", label: "Calendar", icon: "calendar" },
      { href: "/admin/closeout", label: "Job closeout", icon: "check" },
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

  // Untouched enquiries plus open follow-ups that are overdue. Never blocks the page if it fails.
  const [needsAttention, closeoutJobs] = await Promise.all([countQuotesNeedingAttention(), countCloseoutJobs()]);
  const badges: Record<string, number> = needsAttention ? { "/admin/quotes": needsAttention } : {};
  if (closeoutJobs) badges["/admin/closeout"] = closeoutJobs;

  return (
    <div className="admin-shell">
      <AdminShell groups={NAV_GROUPS} staffEmail={staff.email ?? ""} staffRole={staff.role} badges={badges}>
        {children}
      </AdminShell>
    </div>
  );
}
