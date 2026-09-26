"use client";

import { useActionState } from "react";
import { updateBusinessSettingsAction } from "./actions.ts";

interface Settings {
  timezone: string;
  business_open_time: string;
  business_close_time: string;
  booking_hold_minutes: number;
  min_booking_lead_hours: number;
  max_booking_horizon_days: number;
  default_estimated_duration_minutes: number;
  scheduling_buffer_minutes: number;
  booking_number_prefix: string;
  deposit_type: "fixed" | "percentage" | null;
  deposit_fixed_amount_cents: number | null;
  deposit_percentage: number | null;
  min_deposit_amount_cents: number | null;
  booking_admin_email: string | null;
}

export function SettingsForm({ settings }: { settings: Settings }) {
  const [state, formAction, pending] = useActionState(
    async (_prev: { error?: string }, formData: FormData) => updateBusinessSettingsAction(formData),
    {},
  );

  return (
    <form action={formAction} className="mt-6 space-y-6">
      {state?.error && <p className="rounded-lg bg-red-50 px-4 py-3 text-red-700">{state.error}</p>}

      <fieldset className="space-y-3 rounded-xl border p-4">
        <legend className="px-1 font-medium">Business hours &amp; timezone</legend>
        <p className="text-xs text-neutral-400">Timezone is fixed to {settings.timezone} — booking math never depends on the browser&apos;s local timezone.</p>
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-sm">
            Opens
            <input type="time" name="business_open_time" defaultValue={settings.business_open_time} required className="mt-1 w-full rounded-lg border px-3 py-2" />
          </label>
          <label className="block text-sm">
            Closes
            <input type="time" name="business_close_time" defaultValue={settings.business_close_time} required className="mt-1 w-full rounded-lg border px-3 py-2" />
          </label>
        </div>
      </fieldset>

      <fieldset className="space-y-3 rounded-xl border p-4">
        <legend className="px-1 font-medium">Booking rules</legend>
        <NumberField label="Hold duration (minutes, min 30)" name="booking_hold_minutes" defaultValue={settings.booking_hold_minutes} />
        <NumberField label="Minimum lead time (hours)" name="min_booking_lead_hours" defaultValue={settings.min_booking_lead_hours} />
        <NumberField label="Maximum booking horizon (days)" name="max_booking_horizon_days" defaultValue={settings.max_booking_horizon_days} />
        <NumberField label="Default estimated duration (minutes)" name="default_estimated_duration_minutes" defaultValue={settings.default_estimated_duration_minutes} />
        <NumberField label="Scheduling buffer (minutes)" name="scheduling_buffer_minutes" defaultValue={settings.scheduling_buffer_minutes} />
        <label className="block text-sm">
          Booking number prefix
          <input name="booking_number_prefix" defaultValue={settings.booking_number_prefix} className="mt-1 w-full rounded-lg border px-3 py-2" />
        </label>
      </fieldset>

      <fieldset className="space-y-3 rounded-xl border p-4">
        <legend className="px-1 font-medium">Deposit policy</legend>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="deposit_enabled" defaultChecked={Boolean(settings.deposit_type)} />
          Deposits enabled (payments are refused until this is on)
        </label>
        <label className="block text-sm">
          Type
          <select name="deposit_type" defaultValue={settings.deposit_type ?? ""} className="mt-1 w-full rounded-lg border px-3 py-2">
            <option value="">—</option>
            <option value="fixed">Fixed amount</option>
            <option value="percentage">Percentage of subtotal</option>
          </select>
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-sm">
            Fixed deposit ($)
            <input type="number" step="0.01" min="0" name="deposit_fixed_amount" defaultValue={settings.deposit_fixed_amount_cents ? (settings.deposit_fixed_amount_cents / 100).toFixed(2) : ""} className="mt-1 w-full rounded-lg border px-3 py-2" />
          </label>
          <label className="block text-sm">
            Percentage deposit (%)
            <input type="number" step="0.01" min="0" max="100" name="deposit_percentage" defaultValue={settings.deposit_percentage ?? ""} className="mt-1 w-full rounded-lg border px-3 py-2" />
          </label>
        </div>
        <label className="block text-sm">
          Minimum deposit ($, optional floor)
          <input type="number" step="0.01" min="0" name="min_deposit_amount" defaultValue={settings.min_deposit_amount_cents ? (settings.min_deposit_amount_cents / 100).toFixed(2) : ""} className="mt-1 w-full rounded-lg border px-3 py-2" />
        </label>
      </fieldset>

      <fieldset className="space-y-3 rounded-xl border p-4">
        <legend className="px-1 font-medium">Notifications</legend>
        <label className="block text-sm">
          Admin notification email
          <input type="email" name="booking_admin_email" defaultValue={settings.booking_admin_email ?? ""} className="mt-1 w-full rounded-lg border px-3 py-2" />
        </label>
      </fieldset>

      <button type="submit" disabled={pending} className="rounded-full bg-neutral-900 px-6 py-3 text-sm text-white disabled:opacity-40">
        {pending ? "Saving…" : "Save settings"}
      </button>
    </form>
  );
}

function NumberField({ label, name, defaultValue }: { label: string; name: string; defaultValue: number }) {
  return (
    <label className="block text-sm">
      {label}
      <input type="number" name={name} defaultValue={defaultValue} required className="mt-1 w-full rounded-lg border px-3 py-2" />
    </label>
  );
}
