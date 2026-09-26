import { getSupabaseAdmin } from "../../../../lib/server/supabase.ts";
import { createCrewAction, addCrewMemberAction } from "./actions.ts";
import { CrewToggle, CrewMemberToggle } from "./CrewToggle";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };

export default async function AdminCrewsPage() {
  const supabase = getSupabaseAdmin();
  const [{ data: crews }, { data: members }] = await Promise.all([
    supabase.from("crews").select("id, name, active").order("created_at", { ascending: true }),
    supabase.from("crew_members").select("id, crew_id, name, role, active").order("created_at", { ascending: true }),
  ]);

  return (
    <div className="mx-auto max-w-3xl space-y-10">
      <div>
        <h1 className="text-2xl font-semibold">Crews</h1>
        <ul className="mt-6 divide-y rounded-xl border">
          {(crews ?? []).map((crew) => (
            <li key={crew.id} className="px-4 py-3">
              <div className="flex items-center justify-between">
                <div className="font-medium">{crew.name}</div>
                <CrewToggle crewId={crew.id} active={crew.active} />
              </div>
              <ul className="mt-2 space-y-1 pl-2 text-sm text-neutral-600">
                {(members ?? []).filter((m) => m.crew_id === crew.id).map((m) => (
                  <li key={m.id} className="flex items-center justify-between">
                    <span>{m.name}{m.role ? ` — ${m.role}` : ""}</span>
                    <CrewMemberToggle memberId={m.id} active={m.active} />
                  </li>
                ))}
              </ul>
            </li>
          ))}
          {(crews ?? []).length === 0 && <li className="px-4 py-8 text-center text-neutral-400">No crews yet — add one below.</li>}
        </ul>

        <form action={createCrewAction} className="mt-6 space-y-3 rounded-xl border p-4">
          <h2 className="font-medium">Add a crew</h2>
          <input name="name" required placeholder="e.g. Crew A" className="w-full rounded-lg border px-3 py-2" />
          <button type="submit" className="rounded-full bg-neutral-900 px-5 py-2 text-sm text-white">Add crew</button>
        </form>
      </div>

      <div>
        <h2 className="text-lg font-semibold">Add a crew member</h2>
        <form action={addCrewMemberAction} className="mt-4 space-y-3 rounded-xl border p-4">
          <select name="crew_id" className="w-full rounded-lg border px-3 py-2">
            <option value="">Unassigned</option>
            {(crews ?? []).map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <input name="name" required placeholder="Name" className="w-full rounded-lg border px-3 py-2" />
          <input name="role" placeholder="Role (optional)" className="w-full rounded-lg border px-3 py-2" />
          <button type="submit" className="rounded-full bg-neutral-900 px-5 py-2 text-sm text-white">Add member</button>
        </form>
      </div>
    </div>
  );
}
