import { getSupabaseAdmin } from "../../../../lib/server/supabase.ts";
import { getBusinessSettings } from "../../../../lib/server/booking-repo.ts";
import { truckPackages, crewUpgradePackages, legacyPackages } from "../../../../lib/site-data.ts";
import { PricingRuleForm } from "./PricingRuleForm";
import { AdminPageHeader } from "../../_components/ui";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };

// Display order: the three trucks first, then the crew upgrade, then the retired package, then anything unknown.
const PACKAGE_ORDER: string[] = [...truckPackages, ...crewUpgradePackages, ...legacyPackages].map((item) => item.id);

function packageRank(packageId: string): number {
  const index = PACKAGE_ORDER.indexOf(packageId);
  return index === -1 ? PACKAGE_ORDER.length : index;
}

export default async function AdminPricingPage() {
  const [{ data: rules }, settings] = await Promise.all([
    getSupabaseAdmin().from("pricing_rules").select("*").order("package_id", { ascending: true }),
    getBusinessSettings(),
  ]);

  const orderedRules = [...(rules ?? [])].sort((a, b) => packageRank(a.package_id) - packageRank(b.package_id) || String(a.package_id).localeCompare(String(b.package_id)));

  return (
    <div className="mx-auto max-w-5xl">
      <AdminPageHeader
        title="Pricing"
        description="Package rates used for new quotes. Confirmed bookings keep the price they were confirmed at, so past totals never change."
      />
      <PricingRuleForm
        existing={orderedRules}
        minimumBookingMinutes={settings.minimumBookingMinutes}
        calloutMinutes={settings.calloutMinutes}
      />
    </div>
  );
}
