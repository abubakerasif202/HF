import { getSupabaseAdmin } from "../../../../lib/server/supabase.ts";
import { PricingRuleForm } from "./PricingRuleForm";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };

export default async function AdminPricingPage() {
  const { data: rules } = await getSupabaseAdmin().from("pricing_rules").select("*").order("crew_size", { ascending: true });

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-semibold">Pricing</h1>
      <p className="mt-1 text-sm text-neutral-500">
        Changing a rate here only affects future quotes — confirmed bookings keep the price they were confirmed at
        (<code className="rounded bg-neutral-100 px-1">pricing_snapshot</code>), so past totals never move.
      </p>
      <div className="mt-6">
        <PricingRuleForm existing={rules ?? []} />
      </div>
    </div>
  );
}
