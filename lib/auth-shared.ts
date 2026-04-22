export const ACCESS_COOKIE_NAME = "sb-access-token";
export const REFRESH_COOKIE_NAME = "sb-refresh-token";

export type MemberRole = "member" | "admin" | "superadmin" | "owner";

const MEMBER_ROLE_ORDER: Record<MemberRole, number> = {
  member: 0,
  admin: 1,
  superadmin: 2,
  owner: 3,
};

export function hasRoleAtLeast(
  role: MemberRole | null | undefined,
  minimumRole: MemberRole
) {
  if (!role) {
    return false;
  }

  return MEMBER_ROLE_ORDER[role] >= MEMBER_ROLE_ORDER[minimumRole];
}

export function isAdminRole(role: MemberRole | null | undefined) {
  return hasRoleAtLeast(role, "admin");
}

export function isSuperadminRole(role: MemberRole | null | undefined) {
  return hasRoleAtLeast(role, "superadmin");
}

export function isOwnerRole(role: MemberRole | null | undefined) {
  return role === "owner";
}

export function isPublicPath(pathname: string) {
  return (
    pathname === "/ayuda" ||
    pathname === "/login" ||
    pathname === "/forgot-password" ||
    pathname === "/reset-password" ||
    pathname.startsWith("/admin/whatsapp-summary/")
  );
}

export function isAdminPath(pathname: string) {
  return (
    pathname === "/admin" ||
    (pathname.startsWith("/admin/") &&
      !pathname.startsWith("/admin/whatsapp-summary/"))
  );
}

export function isSuperadminPath(pathname: string) {
  return (
    pathname === "/admin/contabilidad" ||
    pathname.startsWith("/admin/contabilidad/")
  );
}

export function isOwnerPath(pathname: string) {
  return (
    pathname === "/admin/importar-socios" ||
    pathname.startsWith("/admin/importar-socios/")
  );
}

export function isStaticBypassPath(pathname: string) {
  return (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api/") ||
    pathname === "/favicon.ico" ||
    pathname === "/manifest.json" ||
    /\.[a-zA-Z0-9]+$/.test(pathname)
  );
}

export function isProtectedPath(pathname: string) {
  if (isStaticBypassPath(pathname) || isPublicPath(pathname)) {
    return false;
  }

  return true;
}
