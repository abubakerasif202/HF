import { requireAdmin } from "../../../../lib/server/admin-dal.ts";
import QuotesClient from "./QuotesClient";
export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };

export default async function QuotesPage() {
  await requireAdmin();
  return <QuotesClient />;
}
