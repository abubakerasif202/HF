import { AdminActiveBadge } from "../../_components/AdminStatusBadge";
import { Icon } from "../../_components/Icon";
import { initialsOf } from "../_ops-config/OpsStats";
import { CrewToggle, CrewMemberToggle } from "./CrewToggle";

export interface CrewRow {
  id: string;
  name: string;
  active: boolean;
}

export interface MemberRow {
  id: string;
  crew_id: string | null;
  name: string;
  role: string | null;
  active: boolean;
}

const STACK_LIMIT = 4;

export function CrewCard({ crew, members, index }: { crew: CrewRow; members: MemberRow[]; index: number }) {
  const activeMembers = members.filter((m) => m.active);
  const state = !crew.active ? "off" : activeMembers.length === 0 ? "blocked" : "ready";
  const readiness =
    state === "off"
      ? "Inactive — not offered for new job assignments"
      : state === "blocked"
        ? "No active members — add or activate a member to assign jobs"
        : `Ready to assign · ${activeMembers.length} of ${members.length} members active`;
  const percent = members.length === 0 ? 0 : Math.round((activeMembers.length / members.length) * 100);

  return (
    <li className="a-crew-card a-reveal" data-active={crew.active} style={{ ["--i" as string]: index }}>
      <div className="a-crew-head">
        <div className="min-w-0">
          <h3 className="a-crew-title">{crew.name}</h3>
          <p className="a-crew-sub">{members.length} member{members.length === 1 ? "" : "s"}</p>
        </div>
        <AdminActiveBadge active={crew.active} />
      </div>

      <div className="a-crew-readiness" data-state={state}>
        <p className="a-crew-readiness-text">
          <Icon name={state === "ready" ? "check" : state === "blocked" ? "alert" : "ban"} size={16} />
          {readiness}
        </p>
        {members.length > 0 && (
          <div className="a-ops-meter" role="img" aria-label={`${activeMembers.length} of ${members.length} members active`}>
            <span style={{ width: `${percent}%` }} />
          </div>
        )}
      </div>

      <Roster members={members} emptyText="No members yet. Add one using the form below." />

      <div className="a-crew-foot">
        <div className="a-crew-stack" aria-hidden="true">
          {members.slice(0, STACK_LIMIT).map((m) => (
            <span key={m.id} className="a-crew-avatar" data-active={m.active}>{initialsOf(m.name)}</span>
          ))}
          {members.length > STACK_LIMIT && <span className="a-crew-avatar" data-active="false">+{members.length - STACK_LIMIT}</span>}
        </div>
        <CrewToggle crewId={crew.id} active={crew.active} />
      </div>
    </li>
  );
}

export function Roster({ members, emptyText }: { members: MemberRow[]; emptyText: string }) {
  if (members.length === 0) return <p className="a-crew-empty">{emptyText}</p>;
  return (
    <ul className="a-crew-roster">
      {members.map((m) => (
        <li key={m.id} className="a-crew-member">
          <span className="a-crew-avatar" data-active={m.active} aria-hidden="true">{initialsOf(m.name)}</span>
          <div className="a-crew-member-info">
            <div className="a-crew-member-name" data-active={m.active}>{m.name}</div>
            <div className="a-crew-member-role">{m.role || "No role set"}</div>
          </div>
          <div className="a-crew-member-actions">
            <AdminActiveBadge active={m.active} />
            <CrewMemberToggle memberId={m.id} active={m.active} name={m.name} />
          </div>
        </li>
      ))}
    </ul>
  );
}
