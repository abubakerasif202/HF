import "server-only";
import { z } from "zod";
import { contactSchema, createMauticClient, mauticConfig, MauticError } from "./client.ts";
import { mapLead, FIELD_ALIASES } from "./mapper.ts";
import type { MauticLead, QuoteStatus, SyncResult } from "./types.ts";

const listSchema = z.object({ total: z.coerce.number().int().nonnegative(), contacts: z.union([z.record(z.string(), contactSchema), z.array(contactSchema)]) });
const emailSchema = z.string().email().max(254);
// Coalesce concurrent requests in one process; Mautic's unique email field handles cross-instance creation races.
const pending = new Map<string, Promise<SyncResult>>();
export async function syncLeadToMautic(lead: MauticLead, options: { env?: NodeJS.ProcessEnv; fetcher?: typeof fetch; timeoutMs?: number } = {}): Promise<SyncResult> {
  if ((options.env ?? process.env).MAUTIC_ENABLED !== "true") return { status: "disabled" };
  const email = emailSchema.safeParse(lead.email?.trim().toLowerCase());
  if (!email.success) return { status: "skipped" }; // No unsafe phone matching or invented email.
  const prior = pending.get(email.data);
  if (prior) { await prior; return syncLeadToMautic(lead, options); }
  const work = sync({ ...lead, email: email.data }, options);
  pending.set(email.data, work);
  try { return await work; } finally { pending.delete(email.data); }
}
async function sync(lead: MauticLead, options: { env?: NodeJS.ProcessEnv; fetcher?: typeof fetch; timeoutMs?: number }): Promise<SyncResult> {
  let client: ReturnType<typeof createMauticClient> | undefined;
  try {
    const config = mauticConfig(options.env);
    if (!config) return { status: "disabled" };
    client = createMauticClient(config, options.fetcher, options.timeoutMs);
    const query = new URLSearchParams({ "where[0][col]": "email", "where[0][expr]": "eq", "where[0][val]": lead.email!, limit: "2" });
    const parsed = listSchema.safeParse(await client.request(`contacts?${query}`));
    if (!parsed.success) throw new MauticError("invalid_response");
    const contacts = Object.values(parsed.data.contacts);
    if (parsed.data.total > 1 || contacts.length > 1) throw new MauticError("ambiguous_identity");
    if (parsed.data.total !== contacts.length) throw new MauticError("invalid_response");
    const existing = contacts[0];
    if (existing && String(existing.fields.all.email ?? "").toLowerCase() !== lead.email) throw new MauticError("identity_mismatch");
    const result = z.object({ contact: contactSchema }).safeParse(await client.request(existing ? `contacts/${existing.id}/edit` : "contacts/new", existing ? "PATCH" : "POST", mapLead(lead, existing?.fields.all)));
    if (!result.success || String(result.data.contact.fields.all.email ?? "").toLowerCase() !== lead.email || (existing && result.data.contact.id !== existing.id)) throw new MauticError("invalid_response");
    return { status: "synced", contactId: result.data.contact.id };
  } catch (error) {
    const safe = error instanceof MauticError ? error : new MauticError("unexpected_error");
    console.warn("mautic_sync_failed", { code: safe.code, ...(safe.status ? { status: safe.status } : {}) });
    return { status: "failed" };
  } finally { client?.close(); }
}
export async function updateMauticQuoteStatus(contactId: number, status: QuoteStatus): Promise<SyncResult> {
  let client: ReturnType<typeof createMauticClient> | undefined;
  try {
    const config = mauticConfig();
    if (!config) return { status: "disabled" };
    if (!Number.isSafeInteger(contactId) || contactId < 1 || !["new", "quote_sent", "follow_up", "booked", "completed", "lost"].includes(status)) throw new MauticError("invalid_input");
    client = createMauticClient(config);
    const result = z.object({ contact: contactSchema }).safeParse(await client.request(`contacts/${contactId}/edit`, "PATCH", { [FIELD_ALIASES.quoteStatus]: status }));
    if (!result.success) throw new MauticError("invalid_response");
    return { status: "synced", contactId: result.data.contact.id };
  } catch { console.warn("mautic_status_sync_failed"); return { status: "failed" }; }
  finally { client?.close(); }
}
