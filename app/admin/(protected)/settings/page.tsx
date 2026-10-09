import { requireAdmin } from "../../../../lib/server/admin-dal.ts";
import { getSupabaseAdmin } from "../../../../lib/server/supabase.ts";
import { SettingsForm } from "./SettingsForm";
import { AdminAlert, AdminPageHeader } from "../../_components/ui";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };

export default async function AdminSettingsPage() {
  await requireAdmin();
  const { data: settings } = await getSupabaseAdmin().from("business_settings").select("*").eq("id", true).single();

  if (!settings) {
    return (
      <div className="mx-auto max-w-6xl">
        <AdminPageHeader title="Settings" />
        <AdminAlert tone="error">Business settings row is missing — re-run the migrations.</AdminAlert>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl">
      <AdminPageHeader
        title="Settings"
        description="Business hours, booking rules, payments and notifications for online booking."
      />
      <SettingsForm
        settings={{
          ...settings,
          business_open_time: String(settings.business_open_time).slice(0, 5),
          business_close_time: String(settings.business_close_time).slice(0, 5),
        }}
      />
    </div>
  );
}
