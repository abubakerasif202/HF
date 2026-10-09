/**
 * Pure helpers for the availability overview. Everything is derived from the
 * blocked_times rows plus the active trucks and crews the page already loads;
 * bookings are not consulted here, so "available" means "no blocked time".
 */
export interface BlockedRow {
  id: string;
  starts_at: string;
  ends_at: string;
  reason: string;
  vehicleId: string | null;
  crewId: string | null;
  vehicleName?: string;
  crewName?: string;
}

export interface ResourceRef {
  id: string;
  name: string;
}

export type BlockScope = "all" | "vehicle" | "crew";
export type BlockState = "active" | "upcoming" | "past";

export function blockScope(row: BlockedRow): BlockScope {
  if (row.vehicleId) return "vehicle";
  if (row.crewId) return "crew";
  return "all";
}

export function scopeLabel(row: BlockedRow): string {
  const scope = blockScope(row);
  if (scope === "vehicle") return `Truck: ${row.vehicleName ?? "Unknown"}`;
  if (scope === "crew") return `Crew: ${row.crewName ?? "Unknown"}`;
  return "Entire business";
}

export function blockState(row: BlockedRow, nowMs: number): BlockState {
  if (new Date(row.ends_at).getTime() <= nowMs) return "past";
  if (new Date(row.starts_at).getTime() > nowMs) return "upcoming";
  return "active";
}

/** "3 h", "1 d 4 h", "45 min": a compact length for a blocked period. */
export function formatDuration(startsAt: string, endsAt: string): string {
  const minutes = Math.max(0, Math.round((new Date(endsAt).getTime() - new Date(startsAt).getTime()) / 60_000));
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const restHours = hours % 24;
  if (days === 0) return minutes % 60 === 0 ? `${hours} h` : `${hours} h ${minutes % 60} min`;
  return restHours === 0 ? `${days} d` : `${days} d ${restHours} h`;
}

export interface ResourceStatus {
  state: "available" | "blocked-now" | "blocked-later";
  /** The block that explains the state: the active one, or the next one coming up. */
  block: BlockedRow | null;
}

function affects(row: BlockedRow, kind: "vehicle" | "crew", id: string): boolean {
  if (!row.vehicleId && !row.crewId) return true;
  return kind === "vehicle" ? row.vehicleId === id : row.crewId === id;
}

export function resourceStatus(rows: BlockedRow[], kind: "vehicle" | "crew", id: string, nowMs: number): ResourceStatus {
  const relevant = rows.filter((row) => affects(row, kind, id) && blockState(row, nowMs) !== "past");
  const active = relevant.filter((row) => blockState(row, nowMs) === "active").sort((a, b) => b.ends_at.localeCompare(a.ends_at))[0];
  if (active) return { state: "blocked-now", block: active };
  const next = relevant.sort((a, b) => a.starts_at.localeCompare(b.starts_at))[0];
  if (next) return { state: "blocked-later", block: next };
  return { state: "available", block: null };
}
