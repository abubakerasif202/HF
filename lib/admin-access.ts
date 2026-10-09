/** Single owner-only administration for HF Removals. Public customers do not log in. */
export const ADMIN_LOGIN_EMAIL = "admin@hfremovalsadelaide.com.au";

export function isAdminEmail(email: string | null | undefined): boolean {
  return typeof email === "string" && email.trim().toLowerCase() === ADMIN_LOGIN_EMAIL;
}

export function isAuthorizedAdmin(
  email: string | null | undefined,
  staff: { active: boolean; role: string } | null | undefined,
): boolean {
  return isAdminEmail(email) && staff?.active === true && staff.role === "owner";
}
