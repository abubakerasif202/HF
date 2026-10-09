import { redirect } from "next/navigation";
import { getStaffSession } from "../../../lib/server/supabase-ssr.ts";
import { isBookingSystemLive } from "../../../lib/server/config.ts";
import { LoginForm } from "./LoginForm";
import { Icon } from "../_components/Icon";
import { BrandMark } from "../_components/BrandMark";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };

function LoginCard({ children }: { children: React.ReactNode }) {
  return (
    <main className="admin-shell admin-login">
      <svg className="a-hero-art" viewBox="0 0 1200 800" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false" style={{ zIndex: 0 }}>
        <circle className="ring" cx="980" cy="160" r="170" />
        <circle className="ring" cx="980" cy="160" r="270" />
        <circle className="ring" cx="980" cy="160" r="380" />
        <path className="road" d="M-60 700C260 520 560 560 820 380S1120 180 1290 220" />
        <path className="road" d="M-60 740C270 570 570 600 840 420S1130 222 1290 262" />
        <path className="road-dash" d="M-60 720C265 545 565 580 830 400S1125 201 1290 241" />
      </svg>
      <div className="admin-card admin-login-card" style={{ zIndex: 1 }}>
        <div className="a-brand">
          <BrandMark size={52} />
          <span className="a-brand-text">
            <span className="a-brand-name">HF Removals</span>
            <span className="a-brand-sub">Private Operations</span>
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
      <h1 className="admin-login-title">Welcome <em style={{ color: "var(--a-accent-text)", fontWeight: 400 }}>back.</em></h1>
      <p className="admin-login-text">
        <Icon name="lock" size={14} className="mr-1 inline-block align-[-2px]" />
        Staff access only. Sign in with your HF Removals administrator account.
      </p>
      <LoginForm />
    </LoginCard>
  );
}
