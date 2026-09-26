import { redirect } from "next/navigation";
import { getStaffSession } from "../../../lib/server/supabase-ssr.ts";
import { isBookingSystemLive } from "../../../lib/server/config.ts";
import { LoginForm } from "./LoginForm";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };

export default async function AdminLoginPage() {
  if (!isBookingSystemLive()) {
    return (
      <main className="mx-auto max-w-md px-6 py-24 text-center">
        <h1 className="text-xl font-semibold">Admin is not configured yet</h1>
        <p className="mt-4 text-neutral-500">Supabase and Stripe must be configured before staff accounts can sign in.</p>
      </main>
    );
  }

  const session = await getStaffSession().catch(() => null);
  if (session) redirect("/admin/bookings");

  return (
    <main className="mx-auto max-w-md px-6 py-24">
      <h1 className="text-2xl font-semibold">Staff sign in</h1>
      <p className="mt-2 text-sm text-neutral-500">
        Public sign-up is disabled. Staff accounts are created directly in Supabase Auth and added to the
        <code className="mx-1 rounded bg-neutral-100 px-1">staff</code> table by an admin.
      </p>
      <LoginForm />
    </main>
  );
}
