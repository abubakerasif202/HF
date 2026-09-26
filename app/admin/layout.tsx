import "./admin.css";

/**
 * Pass-through layout for every /admin/* route (including /admin/login).
 * Its only job is to load the admin design system stylesheet; auth
 * guarding stays in (protected)/layout.tsx.
 */
export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
  return children;
}
