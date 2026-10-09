import { requireAdmin } from "../../../../lib/server/admin-dal.ts";
import { getSupabaseAdmin } from "../../../../lib/server/supabase.ts";
import { createCrewAction, addCrewMemberAction } from "./actions.ts";
import { CrewToggle, CrewMemberToggle } from "./CrewToggle";
import { AdminCard, AdminEmptyState, AdminPageHeader } from "../../_components/ui";
import { AdminActiveBadge } from "../../_components/AdminStatusBadge";
import { Icon } from "../../_components/Icon";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };

export default async function AdminCrewsPage() {
  await requireAdmin();
  const supabase = getSupabaseAdmin();
  const [{ data: crews }, { data: members }] = await Promise.all([
    supabase.from("crews").select("id, name, active").order("created_at", { ascending: true }),
    supabase.from("crew_members").select("id, crew_id, name, role, active").order("created_at", { ascending: true }),
  ]);
  const crewRows = crews ?? [];
  const memberRows = members ?? [];
  const unassignedMembers = memberRows.filter((m) => !m.crew_id);

  return (
    <div className="mx-auto max-w-6xl">
      <AdminPageHeader
        title="Crews"
        description="Crews are assigned to confirmed jobs. Inactive crews and members can't be assigned."
        actions={
          <a href="#add-crew" className="admin-btn admin-btn--primary">
            <Icon name="plus" size={16} />
            Add crew
          </a>
        }
      />

      {crewRows.length === 0 ? (
        <AdminCard>
          <AdminEmptyState
            icon="crew"
            title="No crews yet"
            description="Add a crew, then add its members, so jobs can be allocated."
            action={<a href="#add-crew" className="admin-btn admin-btn--primary">Add crew</a>}
          />
        </AdminCard>
      ) : (
        <div className="grid gap-5 md:grid-cols-2">
          {crewRows.map((crew) => {
            const crewMembers = memberRows.filter((m) => m.crew_id === crew.id);
            return (
              <AdminCard
                key={crew.id}
                icon="crew"
                title={crew.name}
                description={`${crewMembers.length} member${crewMembers.length === 1 ? "" : "s"}`}
                actions={<AdminActiveBadge active={crew.active} />}
                flush
              >
                <MemberList members={crewMembers} />
                <div className="border-t px-5 py-3">
                  <CrewToggle crewId={crew.id} active={crew.active} />
                </div>
              </AdminCard>
            );
          })}
          {unassignedMembers.length > 0 && (
            <AdminCard icon="user" title="Not in a crew" description="Members without a crew" flush>
              <MemberList members={unassignedMembers} />
            </AdminCard>
          )}
        </div>
      )}

      <div className="mt-5 grid gap-5 md:grid-cols-2">
        <AdminCard id="add-crew" icon="plus" title="Add a crew" className="scroll-mt-20 self-start">
          <form action={createCrewAction} className="grid gap-4">
            <label className="admin-field">
              <span className="admin-label">Crew name</span>
              <input name="name" required placeholder="e.g. Crew A" className="admin-input" />
            </label>
            <div>
              <button type="submit" className="admin-btn admin-btn--primary">Add crew</button>
            </div>
          </form>
        </AdminCard>

        <AdminCard icon="user" title="Add a crew member" className="self-start">
          <form action={addCrewMemberAction} className="grid gap-4">
            <label className="admin-field">
              <span className="admin-label">Crew</span>
              <select name="crew_id" className="admin-input">
                <option value="">Unassigned</option>
                {crewRows.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </label>
            <div className="admin-form-grid admin-form-grid--2">
              <label className="admin-field">
                <span className="admin-label">Name</span>
                <input name="name" required placeholder="Full name" className="admin-input" />
              </label>
              <label className="admin-field">
                <span className="admin-label">Role <span className="font-medium text-[var(--admin-text-muted)]">(optional)</span></span>
                <input name="role" placeholder="e.g. Team lead" className="admin-input" />
              </label>
            </div>
            <div>
              <button type="submit" className="admin-btn admin-btn--primary">Add member</button>
            </div>
          </form>
        </AdminCard>
      </div>
    </div>
  );
}

function MemberList({ members }: { members: { id: string; name: string; role: string | null; active: boolean }[] }) {
  if (members.length === 0) return <p className="admin-help px-5 py-4">No members yet.</p>;
  return (
    <ul className="admin-list">
      {members.map((m) => (
        <li key={m.id} className="admin-list-item py-3">
          <div className="min-w-0">
            <div className={`font-semibold ${m.active ? "" : "text-[var(--admin-text-muted)]"}`}>{m.name}</div>
            <div className="admin-list-meta">{m.role || "No role set"}</div>
          </div>
          <div className="admin-list-actions">
            <AdminActiveBadge active={m.active} />
            <CrewMemberToggle memberId={m.id} active={m.active} name={m.name} />
          </div>
        </li>
      ))}
    </ul>
  );
}
