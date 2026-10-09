import { requireAdmin } from "../../../../lib/server/admin-dal.ts";
import { getSupabaseAdmin } from "../../../../lib/server/supabase.ts";
import { createCrewAction, addCrewMemberAction } from "./actions.ts";
import { AdminCard, AdminEmptyState, AdminPageHeader } from "../../_components/ui";
import { Icon } from "../../_components/Icon";
import { OpsStats } from "../_ops-config/OpsStats";
import { CrewCard, Roster } from "./CrewCard";
import "../../styles/ops-config.css";

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
  const activeCrews = crewRows.filter((c) => c.active);
  const assignableCrews = activeCrews.filter((c) => memberRows.some((m) => m.crew_id === c.id && m.active));
  const activeMembers = memberRows.filter((m) => m.active);

  return (
    <div className="a-ops-page mx-auto max-w-6xl">
      <AdminPageHeader
        eyebrow="Crews"
        title={<>Your <em>crews.</em></>}
        description="Crews are assigned to confirmed jobs. Inactive crews and members can't be assigned."
        actions={
          <a href="#add-crew" className="admin-btn admin-btn--primary">
            <Icon name="plus" size={16} />
            Add crew
          </a>
        }
      />

      <OpsStats
        stats={[
          { label: "Crews", value: crewRows.length, hint: `${activeCrews.length} active` },
          { label: "Ready to assign", value: assignableCrews.length, unit: `of ${crewRows.length}`, hint: "Active with an active member", tone: crewRows.length > 0 && assignableCrews.length === 0 ? "warn" : undefined },
          { label: "Active members", value: activeMembers.length, unit: `of ${memberRows.length}`, hint: "Available for assignment" },
          { label: "Not in a crew", value: unassignedMembers.length, hint: unassignedMembers.length === 0 ? "Everyone is placed" : "Members without a crew", tone: unassignedMembers.length > 0 ? "gold" : undefined },
        ]}
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
        <ul className="a-crew-grid m-0 list-none p-0">
          {crewRows.map((crew, index) => (
            <CrewCard key={crew.id} crew={crew} members={memberRows.filter((m) => m.crew_id === crew.id)} index={index} />
          ))}
          {unassignedMembers.length > 0 && (
            <li className="a-crew-card a-reveal" style={{ ["--i" as string]: crewRows.length }}>
              <div className="a-crew-head">
                <div>
                  <h3 className="a-crew-title">Not in a crew</h3>
                  <p className="a-crew-sub">Members without a crew</p>
                </div>
              </div>
              <Roster members={unassignedMembers} emptyText="" />
              <div className="pb-3" />
            </li>
          )}
        </ul>
      )}

      <div className="a-crew-forms">
        <AdminCard id="add-crew" icon="plus" title="Add a crew" description="A crew is a named team that can be assigned to jobs." className="scroll-mt-20">
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

        <AdminCard icon="user" title="Add a crew member" description="Place a member in a crew now, or leave them unassigned.">
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
