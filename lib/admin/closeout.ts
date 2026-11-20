import { canTransition } from "../booking/state-machine.ts";
import type { BookingStatus } from "../booking/types.ts";

/** Past-dated jobs that still sit in a live status and need closing out. */
export const CLOSEOUT_STATUSES = ["confirmed", "assigned", "in_progress"] as const satisfies readonly BookingStatus[];
export type CloseoutStatus = (typeof CLOSEOUT_STATUSES)[number];

/** "Cancelled" and "no-show" both end in the existing `cancelled` status; the reason is kept on the audit event. */
export const CLOSEOUT_CANCEL_REASONS = ["cancelled", "no_show"] as const;
export type CloseoutCancelReason = (typeof CLOSEOUT_CANCEL_REASONS)[number];

export const MAX_ACTUAL_MINUTES = 1440;

export function isCloseoutStatus(status: string): status is CloseoutStatus {
  return (CLOSEOUT_STATUSES as readonly string[]).includes(status);
}

/**
 * The statuses a job must pass through, in order, before it can be finalised.
 * Finalising requires `in_progress`; a past job still marked confirmed or
 * assigned is stepped forward one valid transition at a time so the state
 * machine is never bypassed and each hop is audited.
 */
export function stepsToInProgress(from: CloseoutStatus): BookingStatus[] {
  const steps: BookingStatus[] = [];
  let current: BookingStatus = from;
  const route: BookingStatus[] = ["assigned", "in_progress"];
  for (const next of route) {
    if (current === next) continue;
    if (!canTransition(current, next)) continue;
    steps.push(next);
    current = next;
  }
  return steps;
}

/** A job is closeable once it has ended; future jobs are never offered or accepted. */
export function isPastEnd(endsAtIso: string, now: Date = new Date()): boolean {
  const ends = Date.parse(endsAtIso);
  return Number.isFinite(ends) && ends < now.getTime();
}

/** Whole days since the job ended (0 when it ended today). */
export function daysSinceEnd(endsAtIso: string, now: Date = new Date()): number {
  return Math.max(0, Math.floor((now.getTime() - Date.parse(endsAtIso)) / 86_400_000));
}
