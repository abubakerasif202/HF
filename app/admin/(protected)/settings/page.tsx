import { getSupabaseAdmin } from "../../../../lib/server/supabase.ts";
import { SettingsForm } from "./SettingsForm";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };

export default async function AdminSettingsPage() {
  const { data: settings } = await getSupabaseAdmin().from("business_settings").select("*").eq("id", true).single();

  if (!settings) {
    return <p className="text-neutral-500">Business settings row is missing — re-run the migrations.</p>;
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-semibold">Settings</h1>
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
