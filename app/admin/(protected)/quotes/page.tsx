import { requireAdmin } from "../../../../lib/server/admin-dal.ts";
import { getBusinessSettings } from "../../../../lib/server/booking-repo.ts";
import { loadQuoteSummary } from "../../../../lib/server/quote-crm-repo.ts";
import { DEFAULT_CLOSE_HM, DEFAULT_OPEN_HM } from "../../../../lib/admin/quote-crm.ts";
import QuotesClient from "./QuotesClient";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };

/** Business window for the "4 business hours" response badge. Falls back to defaults if settings fail. */
async function loadBusinessHours(): Promise<{ open: string; close: string }> {
  try {
    const settings = await getBusinessSettings();
    return { open: settings.businessOpenTime, close: settings.businessCloseTime };
  } catch {
    return { open: DEFAULT_OPEN_HM, close: DEFAULT_CLOSE_HM };
  }
}

export default async function QuotesPage() {
  await requireAdmin();
  const [initialSummary, hours] = await Promise.all([loadQuoteSummary(), loadBusinessHours()]);
  return <QuotesClient initialSummary={initialSummary} businessHours={hours} />;
}
