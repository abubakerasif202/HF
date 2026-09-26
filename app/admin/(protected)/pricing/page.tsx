import { getSupabaseAdmin } from "../../../../lib/server/supabase.ts";
import { getBusinessSettings } from "../../../../lib/server/booking-repo.ts";
import { PricingRuleForm } from "./PricingRuleForm";
import { AdminPageHeader } from "../../_components/ui";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };

export default async function AdminPricingPage() {
  const [{ data: rules }, settings] = await Promise.all([
    getSupabaseAdmin().from("pricing_rules").select("*").order("crew_size", { ascending: true }),
    getBusinessSettings(),
  ]);

  return (
    <div className="mx-auto max-w-5xl">
      <AdminPageHeader
        title="Pricing"
        description="Package rates used for new quotes. Confirmed bookings keep the price they were confirmed at, so past totals never change."
      />
      <PricingRuleForm
        existing={rules ?? []}
        minimumBookingMinutes={settings.minimumBookingMinutes}
        calloutMinutes={settings.calloutMinutes}
      />
    </div>
  );
}
