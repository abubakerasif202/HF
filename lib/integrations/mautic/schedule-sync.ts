import "server-only";
import { after } from "next/server.js";
import { syncLeadToMautic } from "./sync-contact.ts";
import type { MauticLead } from "./types.ts";

/** Call only AFTER authoritative acceptance and existing transactional side effects. */
export function scheduleMauticSync(
  lead: MauticLead,
  schedule: (work: () => Promise<void>) => void = after,
  sync: typeof syncLeadToMautic = syncLeadToMautic,
): void {
  if (process.env.MAUTIC_ENABLED !== "true") return;
  try {
    schedule(async () => {
      try { await sync(lead); }
      catch { console.warn("mautic_background_sync_failed"); }
    });
  } catch { console.warn("mautic_background_schedule_failed"); }
}
