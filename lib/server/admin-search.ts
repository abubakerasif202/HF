import "server-only";
import { getSupabaseAdmin } from "./supabase.ts";
import { ADMIN_TIME_ZONE } from "../admin/dates.ts";
import { adelaideDateTime, safeLikeTerm } from "../admin-csv.ts";
import { buildFinderArgs, normalizeAuPhone, toFinderResult, type FinderRow } from "../booking-finder.ts";

export const SEARCH_GROUP_LIMIT = 5;

export type SearchHitKind = "booking" | "quote" | "customer";

export interface SearchHit {
  kind: SearchHitKind;
  id: string;
  title: string;
  subtitle: string;
  href: string;
}

export interface AdminSearchResult {
  bookings: SearchHit[];
  quotes: SearchHit[];
  customers: SearchHit[];
}

const EMPTY: AdminSearchResult = { bookings: [], quotes: [], customers: [] };

function join(parts: Array<string | null | undefined>, separator = " · "): string {
  return parts.filter((part): part is string => Boolean(part && part.trim())).join(separator);
}

/** Phone-looking queries also match a customer's stored number regardless of spacing. */
function phoneVariant(raw: string): string | null {
  const national = normalizeAuPhone(raw);
  return national && /^\d{5,}$/.test(national) ? national : null;
}

/**
 * Global admin search across bookings (booking number, customer, phone, email, suburb via the
 * existing `admin_search_bookings` RPC), quote enquiries and customers (name / email / phone).
 * Callers must have authorized the owner first.
 */
export async function searchAdmin(rawQuery: string): Promise<AdminSearchResult> {
  const term = safeLikeTerm(rawQuery);
  if (!term) return EMPTY;
  const admin = getSupabaseAdmin();

  const built = buildFinderArgs({ q: rawQuery, pageSize: SEARCH_GROUP_LIMIT }, ADMIN_TIME_ZONE);
  const phone = phoneVariant(rawQuery);
  const customerFilter = [`name.ilike.*${term}*`, `email.ilike.*${term}*`, `phone.ilike.*${term}*`, ...(phone ? [`phone.ilike.*${phone}*`] : [])].join(",");
  const quoteFilter = ["name", "email", "phone", "moving_from", "moving_to"].map((key) => `payload->>${key}.ilike.*${term}*`).join(",");

  const [bookings, vehicles, quotes, customers] = await Promise.all([
    built.ok ? admin.rpc("admin_search_bookings", built.args) : Promise.resolve({ data: [], error: null }),
    admin.from("vehicles").select("id, name"),
    admin.from("quote_requests").select("id, payload, quote_status, created_at").or(quoteFilter).order("created_at", { ascending: false }).limit(SEARCH_GROUP_LIMIT),
    admin.from("customers").select("id, name, email, phone").or(customerFilter).order("created_at", { ascending: false }).limit(SEARCH_GROUP_LIMIT),
  ]);
  if (bookings.error) throw bookings.error;
  if (quotes.error) throw quotes.error;
  if (customers.error) throw customers.error;

  const names = new Map(((vehicles.data ?? []) as Array<{ id: string; name: string }>).map((v) => [v.id, v.name]));
  return {
    bookings: ((bookings.data ?? []) as FinderRow[]).slice(0, SEARCH_GROUP_LIMIT).map((row) => {
      const r = toFinderResult(row, names);
      return {
        kind: "booking" as const,
        id: r.id,
        title: join([r.bookingNumber, r.customerName]),
        subtitle: join([adelaideDateTime(r.startsAt), join([r.pickup, r.destination], " → "), r.status.replace(/_/g, " ")]),
        href: `/admin/bookings/${r.id}`,
      };
    }),
    quotes: ((quotes.data ?? []) as Array<{ id: string; payload: Record<string, unknown> | null; quote_status: string; created_at: string }>).map((row) => {
      const p = row.payload ?? {};
      const text = (key: string) => (typeof p[key] === "string" ? (p[key] as string) : "");
      return {
        kind: "quote" as const,
        id: row.id,
        title: text("name") || "Quote enquiry",
        subtitle: join([join([text("moving_from"), text("moving_to")], " → "), text("email") || text("phone"), row.quote_status.replace(/_/g, " ")]),
        href: "/admin/quotes",
      };
    }),
    customers: ((customers.data ?? []) as Array<{ id: string; name: string | null; email: string | null; phone: string | null }>).map((row) => ({
      kind: "customer" as const,
      id: row.id,
      title: row.name || row.email || "Customer",
      subtitle: join([row.email, row.phone]),
      href: `/admin/customers/${row.id}`,
    })),
  };
}
