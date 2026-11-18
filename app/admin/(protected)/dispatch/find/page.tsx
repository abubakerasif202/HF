import { Suspense } from "react";
import { requireAdmin } from "../../../../../lib/server/admin-dal.ts";
import { getSupabaseAdmin } from "../../../../../lib/server/supabase.ts";
import { AdminPageHeader, SkeletonLoader } from "../../../_components/ui";
import { BookingFinder } from "./BookingFinder";
import "../../../styles/dispatch.css";

export const dynamic = "force-dynamic";
export const metadata = { title: "Find booking", robots: { index: false, follow: false } };

export default async function FindBookingPage() {
  await requireAdmin();
  const admin = getSupabaseAdmin();
  const [crews, vehicles] = await Promise.all([
    admin.from("crews").select("id, name").eq("active", true).order("name"),
    admin.from("vehicles").select("id, name").order("name"),
  ]);
  return (
    <div className="a-find">
      <AdminPageHeader
        back={{ href: "/admin/dispatch", label: "Dispatch" }}
        eyebrow="Dispatch"
        title="Find booking"
        description="Search by reference, customer, phone, email, suburb or street. Open any result to see the original booking."
      />
      <Suspense fallback={<SkeletonLoader label="Loading search" />}>
        <BookingFinder crews={crews.data ?? []} vehicles={vehicles.data ?? []} />
      </Suspense>
    </div>
  );
}
