"use client";

import { useActionState } from "react";
import { upsertPricingRuleAction, setPricingRuleActiveAction } from "./actions.ts";
import { useTransition } from "react";

interface Rule {
  id: string;
  crew_size: number;
  rate_per_30_min_cents: number;
  minimum_billable_minutes: number;
  call_out_fee_cents: number;
  weekend_multiplier: number;
  public_holiday_multiplier: number;
  active: boolean;
}

export function PricingRuleForm({ existing }: { existing: Rule[] }) {
  const [state, formAction, pending] = useActionState(
    async (_prev: { error?: string }, formData: FormData) => upsertPricingRuleAction(formData),
    {},
  );

  return (
    <div className="space-y-6">
      <ul className="divide-y rounded-xl border">
        {existing.map((rule) => (
          <RuleRow key={rule.id} rule={rule} />
        ))}
        {existing.length === 0 && <li className="px-4 py-8 text-center text-neutral-400">No pricing rules yet.</li>}
      </ul>

      <form action={formAction} className="space-y-3 rounded-xl border p-4">
        <h2 className="font-medium">Add / update a crew-size rate</h2>
        {state?.error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-sm">
            Crew size
            <input type="number" name="crew_size" min={1} required className="mt-1 w-full rounded-lg border px-3 py-2" />
          </label>
          <label className="block text-sm">
            Rate per 30 min ($)
            <input type="number" step="0.01" name="rate_per_30_min" required className="mt-1 w-full rounded-lg border px-3 py-2" />
          </label>
          <label className="block text-sm">
            Minimum billable minutes
            <input type="number" name="minimum_billable_minutes" defaultValue={60} required className="mt-1 w-full rounded-lg border px-3 py-2" />
          </label>
          <label className="block text-sm">
            Call-out fee ($)
            <input type="number" step="0.01" name="call_out_fee" defaultValue={0} required className="mt-1 w-full rounded-lg border px-3 py-2" />
          </label>
          <label className="block text-sm">
            Weekend multiplier
            <input type="number" step="0.01" name="weekend_multiplier" defaultValue={1} required className="mt-1 w-full rounded-lg border px-3 py-2" />
          </label>
          <label className="block text-sm">
            Public holiday multiplier
            <input type="number" step="0.01" name="public_holiday_multiplier" defaultValue={1} required className="mt-1 w-full rounded-lg border px-3 py-2" />
          </label>
        </div>
        <button type="submit" disabled={pending} className="rounded-full bg-neutral-900 px-5 py-2 text-sm text-white disabled:opacity-40">
          {pending ? "Saving…" : "Save rule"}
        </button>
      </form>
    </div>
  );
}

function RuleRow({ rule }: { rule: Rule }) {
  const [pending, startTransition] = useTransition();
  return (
    <li className="flex items-center justify-between px-4 py-3 text-sm">
      <div>
        <div className="font-medium">{rule.crew_size} movers — ${(rule.rate_per_30_min_cents / 100).toFixed(2)}/30min</div>
        <div className="text-xs text-neutral-400">
          Min {rule.minimum_billable_minutes} min · call-out ${(rule.call_out_fee_cents / 100).toFixed(2)} · weekend ×{rule.weekend_multiplier} · holiday ×{rule.public_holiday_multiplier}
        </div>
      </div>
      <button
        disabled={pending}
        onClick={() => startTransition(() => setPricingRuleActiveAction(rule.id, !rule.active))}
        className={`rounded-full px-3 py-1 text-xs ${rule.active ? "bg-green-100 text-green-700" : "bg-neutral-100 text-neutral-500"}`}
      >
        {rule.active ? "Active" : "Inactive"}
      </button>
    </li>
  );
}
