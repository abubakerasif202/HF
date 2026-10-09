"use client";

import { useActionState, useState, type ReactNode } from "react";
import { updateBusinessSettingsAction } from "./actions.ts";
import { AdminAlert } from "../../_components/ui";
import { Icon, type IconName } from "../../_components/Icon";
import "../../styles/ops-config.css";

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
  booking_admin_email: string | null;
}

type SaveBarState = "idle" | "dirty" | "saving" | "saved" | "error";

const SAVE_COPY: Record<SaveBarState, string> = {
  idle: "All changes are saved. Updates apply to new bookings immediately after saving.",
  dirty: "You have unsaved changes.",
  saving: "Saving settings…",
  saved: "Settings saved.",
  error: "Settings were not saved. Check the message above and try again.",
};

export function SettingsForm({ settings }: { settings: Settings }) {
  const [dirty, setDirty] = useState(false);
  const [state, formAction, pending] = useActionState(
    async (_prev: SaveState, formData: FormData): Promise<SaveState> => {
      const result = await updateBusinessSettingsAction(formData);
      if (!result?.error) setDirty(false);
      return { ...result, saved: !result?.error };
    },
    {} as SaveState,
  );
  const barState: SaveBarState = pending ? "saving" : dirty ? "dirty" : state?.error ? "error" : state?.saved ? "saved" : "idle";

  return (
    <form action={formAction} onChange={() => setDirty(true)} className="a-set-form">
      <div className="a-set-error" aria-live="assertive">
        {state?.error && <AdminAlert tone="error">{state.error}</AdminAlert>}
      </div>

      <Section icon="clock" title="Business hours" description={`Times are in ${settings.timezone}, regardless of the viewer's device timezone.`} index={0}>
        <div className="admin-form-grid admin-form-grid--2">
          <Field label="Opens">
            <input type="time" name="business_open_time" defaultValue={settings.business_open_time} required className="admin-input" />
          </Field>
          <Field label="Closes">
            <input type="time" name="business_close_time" defaultValue={settings.business_close_time} required className="admin-input" />
          </Field>
        </div>
      </Section>

      <Section icon="bookings" title="Booking rules" description="How long a slot is reserved while the customer pays, and default job length." index={1}>
        <div className="admin-form-grid admin-form-grid--2">
          <NumberField label="Hold duration (minutes)" help="Minimum 30." name="booking_hold_minutes" defaultValue={settings.booking_hold_minutes} />
          <NumberField label="Default estimated duration (minutes)" name="default_estimated_duration_minutes" defaultValue={settings.default_estimated_duration_minutes} />
        </div>
      </Section>

      <Section icon="availability" title="Availability" description="Which times customers are offered online." index={2}>
        <div className="admin-form-grid admin-form-grid--2">
          <NumberField label="Minimum lead time (hours)" name="min_booking_lead_hours" defaultValue={settings.min_booking_lead_hours} />
          <NumberField label="Maximum booking horizon (days)" name="max_booking_horizon_days" defaultValue={settings.max_booking_horizon_days} />
          <NumberField label="Scheduling buffer (minutes)" help="Gap kept between jobs." name="scheduling_buffer_minutes" defaultValue={settings.scheduling_buffer_minutes} />
        </div>
      </Section>

      <Section icon="dollar" title="Payment" description="How online bookings are paid for." index={3}>
        <p className="admin-help">
          No advance payment is required for online bookings. Customers confirm their booking online and the final
          price is calculated when the job is completed. (The old booking-confirmation deposit settings are no longer
          used for new bookings.)
        </p>
      </Section>

      <Section icon="bell" title="Notifications" description="Where new-booking alerts are sent." index={4}>
        <Field label="Admin notification email">
          <input type="email" name="booking_admin_email" defaultValue={settings.booking_admin_email ?? ""} className="admin-input" />
        </Field>
      </Section>

      <Section icon="note" title="Booking numbers" description="Prefix shown on every booking reference." index={5}>
        <Field label="Booking number prefix">
          <input name="booking_number_prefix" defaultValue={settings.booking_number_prefix} className="admin-input" />
        </Field>
      </Section>

      <div className="a-set-savebar" data-state={barState}>
        <p className="a-set-savebar-status" role="status" aria-live="polite">
          <span className="a-set-dot" aria-hidden="true" />
          {SAVE_COPY[barState]}
        </p>
        <button type="submit" disabled={pending} className="admin-btn admin-btn--primary">
          {pending ? "Saving…" : "Save settings"}
        </button>
      </div>
    </form>
  );
}

function Section({ icon, title, description, index, children }: { icon: IconName; title: string; description: string; index: number; children: ReactNode }) {
  const headingId = `settings-${title.toLowerCase().replace(/[^a-z]+/g, "-")}`;
  return (
    <section className="a-set-section a-reveal" style={{ ["--i" as string]: index }} aria-labelledby={headingId}>
      <div className="a-set-intro">
        <span className="a-set-intro-icon"><Icon name={icon} size={20} /></span>
        <h2 id={headingId} className="a-set-intro-title">{title}</h2>
        <p className="a-set-intro-text">{description}</p>
      </div>
      <div className="a-set-fields">{children}</div>
    </section>
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
