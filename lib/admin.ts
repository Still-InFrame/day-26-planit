// Keep in sync with planit_my_role()/planit_is_admin() in the database.
// The super admin is email-gated; additional admins are role-based in the DB.
export const SUPER_ADMIN_EMAILS = ["savion@stillinframe.com"];
export const ADMIN_EMAILS = SUPER_ADMIN_EMAILS;

export function isAdminEmail(email?: string | null): boolean {
  return !!email && ADMIN_EMAILS.includes(email.toLowerCase());
}

export function isSuperAdminEmail(email?: string | null): boolean {
  return !!email && SUPER_ADMIN_EMAILS.includes(email.toLowerCase());
}
