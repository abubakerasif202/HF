import { requireAdmin } from "../../../../lib/server/admin-dal.ts";
import { listCloseoutJobs } from "../../../../lib/server/closeout-repo.ts";
import { daysSinceEnd } from "../../../../lib/admin/closeout.ts";
import { AdminAlert, AdminCard, AdminEmptyState, AdminPageHeader } from "../../_components/ui";
import { CloseoutRow, type CloseoutRowJob } from "./CloseoutRow";
import "../../styles/closeout.css";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };

const PAGE_LIMIT = 100;

type AddressJson = { suburb?: string; addressLine?: string; formattedAddress?: string } | string | null;

function place(address: AddressJson): string {
  if (!address) return "—";
  if (typeof address === "string") {
    const parts = address.split(",").map((part) => part.trim()).filter(Boolean);
    return parts.length > 1 ? parts.slice(-2).join(", ") : (parts[0] ?? "—");
  }
  return address.suburb || address.addressLine || address.formattedAddress || "—";
}

export default async function CloseoutPage() {
  await requireAdmin();
  const now = new Date();
  let loaded: Awaited<ReturnType<typeof listCloseoutJobs>> | null = null;
  try {
    loaded = await listCloseoutJobs(PAGE_LIMIT, now);
  } catch {
    loaded = null;
  }

  const rows: CloseoutRowJob[] = (loaded?.jobs ?? []).map((job) => ({
    id: job.id,
    bookingNumber: job.bookingNumber,
    endsAt: job.endsAt,
    status: job.status,
    customerName: job.customerName,
    customerPhone: job.customerPhone,
    route: `${place(job.pickup)} → ${place(job.destination)}`,
    daysOverdue: daysSinceEnd(job.endsAt, now),
    estimatedDurationMinutes: job.estimatedDurationMinutes,
    crewAssigned: job.crewAssigned,
    invoice: job.invoice,
  }));
  const total = loaded?.total ?? 0;

  return (
    <div className="a-closeout">
      <AdminPageHeader
        eyebrow="Operations"
        title="Job closeout"
        description="Past jobs that are still confirmed, assigned or in progress. Finalise each with the actual time, or mark it cancelled or a no-show."
      />

      {loaded === null ? (
        <AdminAlert tone="error">The closeout queue could not be loaded. Refresh the page to try again.</AdminAlert>
      ) : (
        <AdminCard
          icon="check"
          title={total === 0 ? "Nothing to close out" : `${total} ${total === 1 ? "job needs" : "jobs need"} closing out`}
          description="Oldest first. Every action is recorded in the booking's history."
          flush
        >
          {rows.length === 0 ? (
            <AdminEmptyState icon="check" title="All past jobs are closed out" description="Jobs appear here once their end time passes without being finalised or cancelled." />
          ) : (
            <>
              <ol className="a-closeout-list">
                {rows.map((job) => <CloseoutRow key={job.id} job={job} />)}
              </ol>
              {total > rows.length && <p className="admin-help a-closeout-more">Showing the oldest {rows.length} of {total}. Close some out to see the rest.</p>}
            </>
          )}
        </AdminCard>
      )}
    </div>
  );
}
