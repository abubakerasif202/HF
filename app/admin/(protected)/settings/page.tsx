import { requireAdmin } from "../../../../lib/server/admin-dal.ts";
import { getSupabaseAdmin } from "../../../../lib/server/supabase.ts";
import { SettingsForm } from "./SettingsForm";
import { AdminAlert, AdminPageHeader } from "../../_components/ui";
import { OpsStats } from "../_ops-config/OpsStats";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };

export default async function AdminSettingsPage() {
  await requireAdmin();
  const { data: settings } = await getSupabaseAdmin().from("business_settings").select("*").eq("id", true).single();

  if (!settings) {
    return (
      <div className="a-ops-page mx-auto max-w-6xl">
        <AdminPageHeader title="Settings" />
        <AdminAlert tone="error">Business settings row is missing — re-run the migrations.</AdminAlert>
      </div>
    );
  }

  const openTime = String(settings.business_open_time).slice(0, 5);
  const closeTime = String(settings.business_close_time).slice(0, 5);

  return (
    <div className="a-ops-page mx-auto max-w-6xl">
      <AdminPageHeader
        eyebrow="Settings"
        title={<>Booking <em>settings.</em></>}
        description="Business hours, booking rules, payments and notifications for online booking."
      />
      <OpsStats
        stats={[
          { label: "Trading hours", value: `${openTime}–${closeTime}`, hint: settings.timezone },
          { label: "Slot hold", value: settings.booking_hold_minutes, unit: "min", hint: "Reserved while the customer pays" },
          { label: "Minimum lead", value: settings.min_booking_lead_hours, unit: "hrs", hint: "Notice needed for a booking" },
          { label: "Booking prefix", value: settings.booking_number_prefix || "—", hint: "Shown on every reference" },
        ]}
      />
      <SettingsForm
        settings={{
          ...settings,
          business_open_time: openTime,
          business_close_time: closeTime,
        }}
      />
    </div>
  );
}
