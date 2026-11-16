import { requireAdmin } from "../../../../lib/server/admin-dal.ts";
import { adelaideYmd } from "../../../../lib/admin/dates.ts";
import { DispatchClient } from "./DispatchClient";

export const dynamic = "force-dynamic";

export default async function AdminDispatchPage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  await requireAdmin();

  const { date } = await searchParams;
  const validDate = date && /^\d{4}-\d{2}-\d{2}$/.test(date)
    && Number.isFinite(Date.parse(`${date}T00:00:00Z`))
    && new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) === date;
  return <DispatchClient initialDate={validDate ? date : adelaideYmd(new Date())} />;
}
