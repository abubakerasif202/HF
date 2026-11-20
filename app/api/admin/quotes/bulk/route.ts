import "server-only";
import { z } from "zod";
import { adminJson, denyCrossOrigin, denyUnlessAdmin, readJsonObject, UUID_PATTERN } from "../../../../../lib/server/admin-api-guard.ts";
import { bulkSetQuoteStatus } from "../../../../../lib/server/quote-crm-repo.ts";
import { BULK_MAX_IDS, LOST_REASON_VALUES, QUOTE_STATUS_VALUES } from "../../../../../lib/admin/quote-crm.ts";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_BODY_BYTES = 8_192;

const bulkSchema = z
  .strictObject({
    ids: z.array(z.string().regex(UUID_PATTERN)).min(1).max(BULK_MAX_IDS),
    quote_status: z.enum(QUOTE_STATUS_VALUES),
    lost_reason: z.enum(LOST_REASON_VALUES).nullable().optional(),
  })
  .refine((value) => new Set(value.ids).size === value.ids.length, "Duplicate IDs")
  .refine((value) => !value.lost_reason || value.quote_status === "lost", "A lost reason only applies to lost enquiries");

/** POST /api/admin/quotes/bulk — set one status on many enquiries (owner only). */
export async function POST(request: Request) {
  try {
    const denied = await denyUnlessAdmin();
    if (denied) return denied;
    const crossOrigin = denyCrossOrigin(request);
    if (crossOrigin) return crossOrigin;
    const body = await readJsonObject(request, MAX_BODY_BYTES);
    if (!body.ok) return body.response;
    const parsed = bulkSchema.safeParse(body.body);
    if (!parsed.success) {
      return adminJson({ error: "Invalid bulk update", issues: parsed.error.issues.map((issue) => ({ path: issue.path, message: issue.message })) }, 400);
    }
    const result = await bulkSetQuoteStatus(parsed.data.ids, parsed.data.quote_status, parsed.data.lost_reason ?? null);
    if ("error" in result) return adminJson({ error: result.error }, 503);
    return adminJson({ updated: result.updated, requested: parsed.data.ids.length });
  } catch {
    return adminJson({ error: "Unable to update enquiries" }, 503);
  }
}
