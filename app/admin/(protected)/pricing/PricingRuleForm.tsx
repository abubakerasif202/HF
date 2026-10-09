"use client";

import { useActionState, useTransition } from "react";
import { upsertPricingRuleAction, setPricingRuleActiveAction } from "./actions.ts";
import { describePackage } from "../../../../lib/booking/pricing.ts";
import { truckPackages, crewUpgradePackages, legacyPackages, formatAud, formatTonnage } from "../../../../lib/site-data.ts";
import { AdminAlert, AdminCard, AdminEmptyState, formatMoney } from "../../_components/ui";
import { AdminActiveBadge } from "../../_components/AdminStatusBadge";
import { Icon } from "../../_components/Icon";
import "../../styles/ops-config.css";

interface SaveState {
  error?: string;
  saved?: boolean;
}

interface Rule {
  id: string;
  package_id: string;
  truck_class: string | null;
  tonnage: number | null;
  crew_size: number;
  rate_per_30_min_cents: number;
  minimum_billable_minutes: number;
  call_out_fee_cents: number;
  weekend_multiplier: number;
  public_holiday_multiplier: number;
  active: boolean;
}

interface PricingRuleFormProps {
  existing: Rule[];
  /** Business-wide values from business_settings — the ones quotes actually use. */
  minimumBookingMinutes: number;
  calloutMinutes: number;
}

// Display-only: how many 30-minute billing units make up an hour. The
// canonical stored figure is the per-30-minute rate; hourly is shown for
// convenience, exactly as on the public site.
const UNITS_PER_HOUR = 2;

// Packages an admin can set a rate for: the trucks first, the crew upgrade, then the retired package.
const PACKAGE_CHOICES = [
  ...truckPackages.map((item) => ({ item, label: `${item.name} — ${formatTonnage(item.tonnage)}, ${item.crewSize} men` })),
  ...crewUpgradePackages.map((item) => ({ item, label: item.name })),
  ...legacyPackages.map((item) => ({ item, label: `${item.name} (retired — historical bookings only)` })),
];

function formatHours(minutes: number): string {
  const hours = minutes / 60;
  return `${Number.isInteger(hours) ? hours : hours.toFixed(1)} hour${hours === 1 ? "" : "s"}`;
}

export function PricingRuleForm({ existing, minimumBookingMinutes, calloutMinutes }: PricingRuleFormProps) {
  const [state, formAction, pending] = useActionState(
    async (_prev: SaveState, formData: FormData): Promise<SaveState> => {
      const result = await upsertPricingRuleAction(formData);
      return { ...result, saved: !result?.error };
    },
    {} as SaveState,
  );

  return (
    <div className="grid gap-5">
      <div className="a-price-summary">
        <div className="a-price-rule a-reveal">
          <span className="a-price-rule-icon"><Icon name="clock" size={20} /></span>
          <div>
            <p className="a-price-rule-title">Minimum service: {formatHours(minimumBookingMinutes)}</p>
            <p className="a-price-rule-text">Every quote is charged for at least this long. Set in business settings.</p>
          </div>
        </div>
        <div className="a-price-rule a-reveal" style={{ ["--i" as string]: 1 }}>
          <span className="a-price-rule-icon"><Icon name="mapPin" size={20} /></span>
          <div>
            <p className="a-price-rule-title">Call-out: {formatHours(calloutMinutes)} at the package rate</p>
            <p className="a-price-rule-text">Billed at whichever package rate the quote uses.</p>
          </div>
        </div>
      </div>

      {existing.length === 0 ? (
        <AdminCard>
          <AdminEmptyState icon="pricing" title="No pricing rules yet" description="Add a package rate below so customers can get a quote." />
        </AdminCard>
      ) : (
        <div className="a-price-grid">
          {existing.map((rule, index) => (
            <RuleCard key={rule.id} rule={rule} index={index} />
          ))}
        </div>
      )}

      <AdminCard id="rate-form" icon="pricing" title="Add or update a package rate" description="Saving a package that already has a rate updates it.">
        <form action={formAction} className="a-price-form-grid">
          <div aria-live="polite">
            {state?.error && <AdminAlert tone="error">{state.error}</AdminAlert>}
            {state?.saved && !pending && <AdminAlert tone="success">Pricing saved.</AdminAlert>}
          </div>
          <fieldset className="a-price-fieldset">
            <legend className="a-price-legend">Package and rate</legend>
            <div className="admin-form-grid admin-form-grid--2">
              <label className="admin-field">
                <span className="admin-label">Package</span>
                <select name="package_id" required defaultValue="" className="admin-input">
                  <option value="" disabled>Choose a package</option>
                  {PACKAGE_CHOICES.map(({ item, label }) => (
                    <option key={item.id} value={item.id}>{label} · site rate {formatAud(item.ratePer30MinCents)} / 30 min</option>
                  ))}
                </select>
              </label>
              <label className="admin-field">
                <span className="admin-label">Rate per 30 min ($)</span>
                <input type="number" step="0.01" name="rate_per_30_min" required className="admin-input" />
              </label>
            </div>
          </fieldset>
          <fieldset className="a-price-fieldset">
            <legend className="a-price-legend">Multipliers</legend>
            <div className="admin-form-grid admin-form-grid--2">
              <label className="admin-field">
                <span className="admin-label">Weekend multiplier</span>
                <input type="number" step="0.01" name="weekend_multiplier" defaultValue={1} required className="admin-input" />
              </label>
              <label className="admin-field">
                <span className="admin-label">Public holiday multiplier</span>
                <input type="number" step="0.01" name="public_holiday_multiplier" defaultValue={1} required className="admin-input" />
              </label>
            </div>
          </fieldset>
          <fieldset className="a-price-fieldset a-price-legacy">
            <legend className="a-price-legend">Legacy fields</legend>
            <div className="admin-form-grid admin-form-grid--2">
              <label className="admin-field">
                <span className="admin-label">Minimum billable minutes (legacy)</span>
                <input type="number" name="minimum_billable_minutes" defaultValue={60} required className="admin-input" />
                <span className="admin-help">Not used for quotes — the {formatHours(minimumBookingMinutes)} minimum comes from business settings.</span>
              </label>
              <label className="admin-field">
                <span className="admin-label">Call-out fee ($, legacy)</span>
                <input type="number" step="0.01" name="call_out_fee" defaultValue={0} required className="admin-input" />
                <span className="admin-help">Not used for quotes — the call-out is {formatHours(calloutMinutes)} at the package rate.</span>
              </label>
            </div>
          </fieldset>
          <div>
            <button type="submit" disabled={pending} className="admin-btn admin-btn--primary">
              {pending ? "Saving…" : "Save pricing"}
            </button>
          </div>
        </form>
      </AdminCard>
    </div>
  );
}

function RuleCard({ rule, index }: { rule: Rule; index: number }) {
  const [pending, startTransition] = useTransition();
  const rate = rule.rate_per_30_min_cents;
  const decimals = rate % 100 === 0 ? 0 : 2;
  const pkg = describePackage({ packageId: rule.package_id, crewSize: rule.crew_size });
  const truckClass = rule.truck_class ?? pkg.truckClass;
  const tonnage = rule.tonnage ?? pkg.tonnage;

  return (
    <article className="a-price-card a-reveal" data-active={rule.active} style={{ ["--i" as string]: index }}>
      <div className="a-price-card-hero">
        <div className="a-price-card-top">
          <h3 className="a-price-card-name">{pkg.packageName}</h3>
          <AdminActiveBadge active={rule.active} />
        </div>
        <p className="a-price-figure">
          {formatMoney(rate, { decimals })}
          <span className="a-price-unit"> / 30 min</span>
        </p>
        <p className="a-price-hourly">{formatMoney(rate * UNITS_PER_HOUR, { decimals })}/hr</p>
      </div>
      <div className="a-price-card-body">
        <div className="a-price-chips">
          <span className="a-ops-chip a-ops-chip--brand">
            <Icon name="truck" size={13} />
            {truckClass ? `${truckClass}${tonnage ? ` — ${formatTonnage(tonnage)}` : ""}` : "Assigned to suit the load"}
          </span>
          <span className="a-ops-chip"><Icon name="crew" size={13} />{rule.crew_size} men</span>
        </div>
        <dl className="a-price-mults">
          <div className="a-price-mult"><dt>Weekend</dt><dd>×{rule.weekend_multiplier}</dd></div>
          <div className="a-price-mult"><dt>Public holiday</dt><dd>×{rule.public_holiday_multiplier}</dd></div>
        </dl>
        <div className="a-price-card-foot">
          <button
            type="button"
            disabled={pending}
            onClick={() => startTransition(() => setPricingRuleActiveAction(rule.id, !rule.active))}
            className="admin-btn admin-btn--secondary admin-btn--sm"
          >
            {pending ? "Saving…" : rule.active ? "Deactivate rate" : "Activate rate"}
          </button>
        </div>
      </div>
    </article>
  );
}
