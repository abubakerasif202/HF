"use client";

import { useActionState, type ReactNode } from "react";
import { updateBusinessSettingsAction } from "./actions.ts";
import { AdminAlert } from "../../_components/ui";
import { Icon, type IconName } from "../../_components/Icon";

interface SaveState {
  error?: string;
  saved?: boolean;
}

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
    async (_prev: SaveState, formData: FormData): Promise<SaveState> => {
      const result = await updateBusinessSettingsAction(formData);
      return { ...result, saved: !result?.error };
    },
    {} as SaveState,
  );

  return (
    <form action={formAction} className="grid gap-5">
      {state?.error && <AdminAlert tone="error">{state.error}</AdminAlert>}

      <div className="grid items-start gap-5 lg:grid-cols-2">
        <Section icon="clock" title="Business hours" description={`Times are in ${settings.timezone}, regardless of the viewer's device timezone.`}>
          <div className="admin-form-grid admin-form-grid--2">
            <Field label="Opens">
              <input type="time" name="business_open_time" defaultValue={settings.business_open_time} required className="admin-input" />
            </Field>
            <Field label="Closes">
              <input type="time" name="business_close_time" defaultValue={settings.business_close_time} required className="admin-input" />
            </Field>
          </div>
        </Section>

        <Section icon="bookings" title="Booking rules" description="How long a slot is reserved while the customer pays, and default job length.">
          <div className="admin-form-grid admin-form-grid--2">
            <NumberField label="Hold duration (minutes)" help="Minimum 30." name="booking_hold_minutes" defaultValue={settings.booking_hold_minutes} />
            <NumberField label="Default estimated duration (minutes)" name="default_estimated_duration_minutes" defaultValue={settings.default_estimated_duration_minutes} />
          </div>
        </Section>

        <Section icon="availability" title="Availability" description="Which times customers are offered online.">
          <div className="admin-form-grid admin-form-grid--2">
            <NumberField label="Minimum lead time (hours)" name="min_booking_lead_hours" defaultValue={settings.min_booking_lead_hours} />
            <NumberField label="Maximum booking horizon (days)" name="max_booking_horizon_days" defaultValue={settings.max_booking_horizon_days} />
            <NumberField label="Scheduling buffer (minutes)" help="Gap kept between jobs." name="scheduling_buffer_minutes" defaultValue={settings.scheduling_buffer_minutes} />
          </div>
        </Section>

        <Section icon="dollar" title="Payment" description="The booking confirmation payment customers make online.">
          <div className="grid gap-4">
            <label className="admin-check">
              <input type="checkbox" name="deposit_enabled" defaultChecked={Boolean(settings.deposit_type)} />
              <span>
                Booking confirmation payment enabled
                <span className="admin-help block font-medium">Online bookings can&apos;t be paid for while this is off.</span>
              </span>
            </label>
            <Field label="Type">
              <select name="deposit_type" defaultValue={settings.deposit_type ?? ""} className="admin-input">
                <option value="">—</option>
                <option value="fixed">Fixed amount</option>
                <option value="percentage">Percentage of subtotal</option>
              </select>
            </Field>
            <div className="admin-form-grid admin-form-grid--2">
              <Field label="Fixed amount ($)">
                <input type="number" step="0.01" min="0" name="deposit_fixed_amount" defaultValue={settings.deposit_fixed_amount_cents ? (settings.deposit_fixed_amount_cents / 100).toFixed(2) : ""} className="admin-input" />
              </Field>
              <Field label="Percentage (%)">
                <input type="number" step="0.01" min="0" max="100" name="deposit_percentage" defaultValue={settings.deposit_percentage ?? ""} className="admin-input" />
              </Field>
            </div>
            <Field label="Minimum amount ($)" help="Optional floor for percentage payments.">
              <input type="number" step="0.01" min="0" name="min_deposit_amount" defaultValue={settings.min_deposit_amount_cents ? (settings.min_deposit_amount_cents / 100).toFixed(2) : ""} className="admin-input" />
            </Field>
          </div>
        </Section>

        <Section icon="bell" title="Notifications" description="Where new-booking alerts are sent.">
          <Field label="Admin notification email">
            <input type="email" name="booking_admin_email" defaultValue={settings.booking_admin_email ?? ""} className="admin-input" />
          </Field>
        </Section>

        <Section icon="note" title="Booking numbers" description="Prefix shown on every booking reference.">
          <Field label="Booking number prefix">
            <input name="booking_number_prefix" defaultValue={settings.booking_number_prefix} className="admin-input" />
          </Field>
        </Section>
      </div>

      <div className="admin-card flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="min-w-0 flex-1">
          {state?.saved && !pending ? (
            <AdminAlert tone="success">Settings saved.</AdminAlert>
          ) : (
            <p className="admin-help">Changes apply to new bookings immediately after saving.</p>
          )}
        </div>
        <button type="submit" disabled={pending} className="admin-btn admin-btn--primary">
          {pending ? "Saving…" : "Save settings"}
        </button>
      </div>
    </form>
  );
}

function Section({ icon, title, description, children }: { icon: IconName; title: string; description: string; children: ReactNode }) {
  const headingId = `settings-${title.toLowerCase().replace(/[^a-z]+/g, "-")}`;
  return (
    <fieldset className="admin-card admin-fieldset" aria-labelledby={headingId} aria-describedby={`${headingId}-desc`}>
      <div className="admin-card-header">
        <div className="admin-card-heading">
          <Icon name={icon} />
          <div>
            <h2 id={headingId} className="admin-card-title">{title}</h2>
            <p id={`${headingId}-desc`} className="admin-card-description">{description}</p>
          </div>
        </div>
      </div>
      <div className="admin-card-body">{children}</div>
    </fieldset>
  );
}

function Field({ label, help, children }: { label: string; help?: string; children: ReactNode }) {
  return (
    <label className="admin-field">
      <span className="admin-label">{label}</span>
      {children}
      {help && <span className="admin-help">{help}</span>}
    </label>
  );
}

function NumberField({ label, help, name, defaultValue }: { label: string; help?: string; name: string; defaultValue: number }) {
  return (
    <Field label={label} help={help}>
      <input type="number" name={name} defaultValue={defaultValue} required className="admin-input" />
    </Field>
  );
}
