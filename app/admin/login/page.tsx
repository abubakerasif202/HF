import { redirect } from "next/navigation";
import { getStaffSession } from "../../../lib/server/supabase-ssr.ts";
import { isBookingSystemLive } from "../../../lib/server/config.ts";
import { LoginForm } from "./LoginForm";
import { Icon } from "../_components/Icon";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };

function LoginCard({ children }: { children: React.ReactNode }) {
  return (
    <main className="admin-shell admin-login">
      <div className="admin-card admin-login-card">
        <div className="admin-brand">
          <span className="admin-brand-mark" aria-hidden="true">HF</span>
          <span>
            <span className="admin-brand-name">HF Removals Adelaide</span>
            <span className="admin-brand-sub">Staff portal</span>
          </span>
        </div>
        {children}
      </div>
    </main>
  );
}

export default async function AdminLoginPage() {
  if (!isBookingSystemLive()) {
    return (
      <LoginCard>
        <h1 className="admin-login-title">Staff portal unavailable</h1>
        <p className="admin-login-text">
          Staff sign-in hasn&apos;t been switched on for this site yet. Please contact the site administrator.
        </p>
      </LoginCard>
    );
  }

  const session = await getStaffSession().catch(() => null);
  if (session) redirect("/admin/bookings");

  return (
    <LoginCard>
      <h1 className="admin-login-title">Staff sign in</h1>
      <p className="admin-login-text">
        <Icon name="lock" size={14} className="mr-1 inline-block align-[-2px]" />
        Staff access only. Sign in with your HF Removals administrator account.
      </p>
      <LoginForm />
    </LoginCard>
  );
}
